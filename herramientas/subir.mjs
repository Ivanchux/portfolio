// Sube los cambios de esta carpeta a tu repositorio de GitHub, con confirmación antes de cada paso importante.
//
//   node herramientas/subir.mjs                  → clona el repo en ../portfolio-clon (la primera vez) y lo actualiza
//   node herramientas/subir.mjs C:\ruta\a\tu\clon → usa un clon que ya tengas
//   node herramientas/subir.mjs --prueba          → hace todo menos el commit y el push
//
// Qué hace: copia aquí → clon (sin dist/, node_modules/ ni copias del editor), muestra los cambios,
// pregunta, hace commit y push con TU git y TUS credenciales. Nunca borra archivos del repositorio.
// Después, en GitHub: Actions → «Publicar la web» → Run workflow.

import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { readdir, mkdir, copyFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = process.env.REPO_PORTFOLIO || "https://github.com/Ivanchux/portfolio.git";
const args = process.argv.slice(2), prueba = args.includes("--prueba");
const destino = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(RAIZ, "..", "portfolio-clon"));
const IGNORAR = /^(dist|dist-[^/]*|node_modules|\.git|datos\/\.copias)(\/|$)/;

const git = (cwd, ...a) => spawnSync("git", a, { cwd, encoding: "utf8" });
const falla = (m) => { console.error("\n✖ " + m); process.exit(1); };

if (git(RAIZ, "--version").error) falla("No encuentro git. Instálalo desde https://git-scm.com/ y vuelve a ejecutar esto.");

/* 1. el clon: se crea la primera vez, y si ya existe se pone al día */
if (!existsSync(path.join(destino, ".git"))) {
  console.log(`Clonando ${REPO} en ${destino} …`);
  const r = spawnSync("git", ["clone", REPO, destino], { stdio: "inherit" });
  if (r.status !== 0) falla("No se pudo clonar el repositorio.");
} else {
  const sucio = git(destino, "status", "--porcelain").stdout.trim();
  if (sucio) falla(`El clon ${destino} tiene cambios sin guardar. Haz commit o descártalos antes de seguir.`);
  console.log("Actualizando el clon (git pull) …");
  const r = spawnSync("git", ["pull", "--ff-only"], { cwd: destino, stdio: "inherit" });
  if (r.status !== 0) falla("No se pudo actualizar el clon (git pull). Resuélvelo a mano y vuelve a ejecutar esto.");
}

/* 2. copiar (solo copia y sobrescribe; no borra nada) */
async function copiar(dir, rel = "") {
  let n = 0;
  for (const e of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (IGNORAR.test(r)) continue;
    if (e.isDirectory()) n += await copiar(dir, r);
    else { const o = path.join(destino, r); await mkdir(path.dirname(o), { recursive: true }); await copyFile(path.join(dir, r), o); n++; }
  }
  return n;
}
console.log("Copiando archivos …");
const total = await copiar(RAIZ);

/* 3. qué cambia */
git(destino, "add", "-A");
const estado = git(destino, "status", "--short").stdout.trim();
if (!estado) { console.log(`\n✔ Nada que subir: el repositorio ya está al día (${total} archivos revisados).`); process.exit(0); }
const lineas = estado.split("\n"), cuenta = (c) => lineas.filter((l) => l.startsWith(c)).length;
console.log(`\nCambios que se subirían: ${cuenta("M")} modificados · ${cuenta("A")} nuevos · ${cuenta("D")} eliminados`);
console.log(lineas.slice(0, 60).join("\n") + (lineas.length > 60 ? `\n… y ${lineas.length - 60} más` : ""));
if (cuenta("D")) console.log("\n(!) Hay archivos eliminados: revisa la lista antes de confirmar.");
if (prueba) { git(destino, "reset", "-q"); console.log(`\n(prueba) No se ha hecho commit ni push. Clon: ${destino}`); process.exit(0); }

/* 4. confirmar, commit y push */
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const mensaje = (await rl.question("\nMensaje del commit [Portfolio 3D, editor visual y tres versiones]: ")).trim() || "Portfolio 3D, editor visual y tres versiones";
const ok = (await rl.question("¿Hacer commit y subir a GitHub? (s/N): ")).trim().toLowerCase();
rl.close();
if (ok !== "s" && ok !== "si" && ok !== "sí") { git(destino, "reset", "-q"); console.log("Cancelado. No se ha subido nada."); process.exit(0); }

const c = spawnSync("git", ["commit", "-m", mensaje], { cwd: destino, stdio: "inherit" });
if (c.status !== 0) falla("No se pudo hacer el commit (¿tienes configurados user.name y user.email en git?).");
const p = spawnSync("git", ["push"], { cwd: destino, stdio: "inherit" });
if (p.status !== 0) falla("No se pudo subir (git push). El commit está hecho en el clon; revisa tus credenciales y ejecuta «git push» allí.");
console.log("\n✔ Subido. Ahora en GitHub: Actions → «Publicar la web» → Run workflow.");
