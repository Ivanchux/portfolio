// IVANDEV OS en un navegador real (Playwright). Se lanza con: npm run test:os
// Recorre todos los hallazgos solo con el teclado y comprueba el arranque secreto.
// La frase secreta no está en el repositorio: se pasa en la variable OS_SECRETO.
// Sin ella, los dos tests que la escriben se saltan.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const PUERTO = 8300 + Math.floor(Math.random() * 500);
const URL_OS = `http://localhost:${PUERTO}/laboratorio/os/`;
const SECRETO = process.env.OS_SECRETO;
const sinSecreto = SECRETO ? false : "falta la variable OS_SECRETO";
const huella = (s) => {
  let h = 0x811c9dc5;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0;
  return h;
};
let servidor, navegador;

before(async () => {
  servidor = spawn(process.execPath, ["herramientas/servir.mjs"], { env: { ...process.env, PUERTO: String(PUERTO) }, stdio: "pipe" });
  await new Promise((ok) => servidor.stdout.once("data", ok));
  navegador = await chromium.launch();
});
after(async () => {
  await navegador?.close();
  servidor?.kill();
});

async function abrir(opciones = {}) {
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 }, ...opciones });
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(e.message));
  pagina.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  await pagina.goto(URL_OS);
  await pagina.locator(".ios__entrada-grub.sel").waitFor();
  return { pagina, errores };
}
const contador = (p) => p.locator('[data-r="cnt"]').textContent();
const foco = (p) => p.evaluate(() => document.activeElement.textContent.trim());

test("recorrido completo solo con teclado: el contador llega a N/N y el final aparece solo entonces", { skip: sinSecreto }, async () => {
  const { pagina: p, errores } = await abrir();
  const total = Number((await contador(p)).split("/")[1]);
  assert.match(await contador(p), /^0\/\d+$/);

  // Arranque secreto: GRUB → e → editar la línea del kernel
  await p.keyboard.press("e");
  await p.keyboard.press("End");
  await p.keyboard.type(" " + SECRETO);
  await p.keyboard.press("Enter");
  await p.locator('[aria-labelledby="ios-v-root"]').waitFor();
  assert.equal(await contador(p), `2/${total}`);
  await p.keyboard.press("Escape");

  // Núcleo → PROYECTOS → cada proyecto
  assert.match(await foco(p), /IVANDEV/);
  await p.keyboard.press("Enter");
  assert.match(await foco(p), /PROYECTOS/);
  await p.keyboard.press("Enter");
  const proyectos = await p.locator(".ios__nodo:not(.hub)").count();
  for (let i = 0; i < proyectos; i++) {
    await p.keyboard.press("Enter");
    await p.locator(".ios__ventana.act").waitFor();
    await p.keyboard.press("Escape");
    await p.keyboard.press("Tab");
  }
  // El Tab ha llegado al núcleo: subir
  assert.match(await foco(p), /subir/);
  await p.keyboard.press("Enter");

  // SOBRE MÍ
  await p.keyboard.press("Tab");
  assert.match(await foco(p), /SOBRE MÍ/);
  await p.keyboard.press("Enter");
  assert.match(await foco(p), /SOBRE_MI/);
  await p.keyboard.press("Enter");
  await p.keyboard.press("Escape");
  await p.keyboard.press("Escape");

  // SISTEMA → TERMINAL: kill y mapper
  await p.keyboard.press("Tab");
  await p.keyboard.press("Tab");
  assert.match(await foco(p), /SISTEMA/);
  await p.keyboard.press("Enter");
  assert.match(await foco(p), /TERMINAL/);
  await p.keyboard.press("Enter");
  await p.keyboard.type("kill 2101");
  await p.keyboard.press("Enter");
  assert.equal(await contador(p), `${total - 1}/${total}`);
  assert.equal(await p.locator('[aria-labelledby="ios-v-fin"]').count(), 0, "el final no debe salir antes de tiempo");

  await p.keyboard.type("mapper");
  await p.keyboard.press("Enter");
  await p.locator('[aria-labelledby="ios-v-map"]').waitFor();
  await p.keyboard.press("End");
  await p.keyboard.type("\n# probado");
  await p.keyboard.press("Tab");
  await p.keyboard.press("Enter");

  assert.equal(await contador(p), `${total}/${total}`);
  await p.locator('[aria-labelledby="ios-v-fin"]').waitFor();
  assert.deepEqual(errores, []);
  await p.close();
});

test("arranque secreto: root ve el contacto; invitado no", { skip: sinSecreto }, async () => {
  const { pagina: p } = await abrir({ reducedMotion: "reduce" });
  await p.keyboard.press("Enter");
  await p.locator("[data-login]:focus").waitFor();
  await p.keyboard.press("Enter");
  await p.locator('[aria-labelledby="ios-v-hola"]').waitFor();
  assert.equal(await p.locator('[aria-labelledby="ios-v-root"]').count(), 0);
  await p.close();

  const { pagina: r } = await abrir({ reducedMotion: "reduce" });
  await r.keyboard.press("e");
  await r.keyboard.press("End");
  await r.keyboard.type(" " + SECRETO);
  await r.keyboard.press("Enter");
  const ventana = r.locator('[aria-labelledby="ios-v-root"]');
  await ventana.waitFor();
  assert.match(await ventana.textContent(), /github\.com\/Ivanchux/);
  await r.close();
});

test("la frase del arranque secreto no aparece en ningún archivo publicado", async () => {
  // Se busca por su huella: el test no necesita conocer la frase
  const LLAVE = Number((await readFile("src/os/os.js", "utf8")).match(/const LLAVE = (\d+)/)[1]);
  async function todos(dir) {
    const salida = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) salida.push(...(await todos(ruta)));
      else salida.push(ruta);
    }
    return salida;
  }
  for (const f of await todos(path.resolve("dist"))) {
    if (!/\.(html|js|css|json|txt|xml|svg)$/.test(f)) continue;
    const fichas = (await readFile(f, "utf8")).split(/[\s"'`<>()\[\]{},;\\]+/);
    assert.ok(!fichas.some((t) => huella(t) === LLAVE), f);
  }
});
