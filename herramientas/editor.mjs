// Editor visual del portfolio: se ejecuta en tu ordenador (nunca se publica).
//   npm run editor      → abre http://localhost:8090/ en el navegador
// Qué hace: edita los archivos de datos/ (proyectos, categorías, habilidades, sobre mí, textos…),
// sube capturas, guarda copias de seguridad y compila la web para que la veas al momento.
// Sin dependencias: solo Node 22.12 o superior.

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir, readdir, stat, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile, exec } from "node:child_process";
import { ICONOS } from "./iconos.mjs";
import { UI_POR_DEFECTO } from "./textos-inmersivo.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EDITOR = path.join(RAIZ, "herramientas/editor");
const DIST = path.join(RAIZ, "dist");
const PUERTO = Number(process.env.PUERTO_EDITOR || 8090);
const HOST = "127.0.0.1";

/* Lista blanca: el editor solo puede leer y escribir estos archivos */
const ARCHIVOS = {
  config: "site.config.json",
  proyectos: "datos/proyectos.json",
  categorias: "datos/categorias.json",
  habilidades: "datos/habilidades.json",
  sobremi: "datos/sobre-mi.json",
  en_proyectos: "datos/en/proyectos.json",
  en_categorias: "datos/en/categorias.json",
  en_habilidades: "datos/en/habilidades.json",
  en_sobremi: "datos/en/sobre-mi.json",
  textos: "datos/inmersivo-textos.json",
};
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".ico": "image/x-icon" };

const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
const leerCuerpo = (req, max = 12e6) => new Promise((ok, ko) => {
  let n = 0; const trozos = [];
  req.on("data", (c) => { n += c.length; if (n > max) { ko(new Error("Cuerpo demasiado grande")); req.destroy(); } else trozos.push(c); });
  req.on("end", () => ok(Buffer.concat(trozos))); req.on("error", ko);
});
const leerJSON = async (rel, defecto) => (existsSync(path.join(RAIZ, rel)) ? JSON.parse(await readFile(path.join(RAIZ, rel), "utf8")) : defecto);

/* ---------- copias de seguridad: cada guardado conserva la versión anterior ---------- */
async function copia(clave) {
  const rel = ARCHIVOS[clave], origen = path.join(RAIZ, rel);
  if (!existsSync(origen)) return;
  const dir = path.join(RAIZ, "datos/.copias");
  await mkdir(dir, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  await copyFile(origen, path.join(dir, `${clave}__${sello}.json`));
  const todas = (await readdir(dir)).filter((f) => f.startsWith(clave + "__")).sort();
  for (const f of todas.slice(0, Math.max(0, todas.length - 25))) await import("node:fs/promises").then((m) => m.rm(path.join(dir, f)));
}

/* ---------- compilar la web (misma orden que npm run build) ---------- */
let compilando = null;
function compilar() {
  if (compilando) return compilando;
  const correr = (script) => new Promise((ok) => execFile(process.execPath, [path.join(RAIZ, "herramientas", script)], { cwd: RAIZ, maxBuffer: 8e6 }, (err, out, errout) => ok({ code: err ? err.code || 1 : 0, out: String(out) + String(errout) })));
  compilando = (async () => {
    const a = await correr("build.mjs"); if (a.code) return { ok: false, log: a.out };
    const b0 = await correr("inmersivo.mjs"), s0 = await correr("simple.mjs"), b = { code: b0.code || s0.code, out: b0.out + s0.out };
    const log = a.out + b.out;
    const pendientes = log.split("\n").filter((l) => /^ {2}\S/.test(l) && /: /.test(l)).map((l) => l.trim());
    return { ok: b.code === 0, log, pendientes };
  })().finally(() => { compilando = null; });
  return compilando;
}

/* ---------- peticiones ---------- */
const servidor = http.createServer(async (req, res) => {
  try {
    const host = (req.headers.host || "").split(":")[0];
    if (host !== "localhost" && host !== "127.0.0.1") { res.writeHead(403); return res.end("Solo local"); }   // evita DNS rebinding
    const url = new URL(req.url, `http://${HOST}`);
    const ruta = decodeURIComponent(url.pathname);

    if (ruta.startsWith("/api/")) {
      if (req.method !== "GET" && req.headers["x-editor"] !== "1") return json(res, 403, { error: "Falta cabecera de seguridad" });

      if (ruta === "/api/todo" && req.method === "GET") {
        const salida = {};
        for (const [k, rel] of Object.entries(ARCHIVOS)) salida[k] = await leerJSON(rel, k === "textos" ? { es: {}, en: {} } : null);
        salida.meta = { iconos: Object.keys(ICONOS), textosPorDefecto: UI_POR_DEFECTO, dist: existsSync(path.join(DIST, "index.html")) };
        return json(res, 200, salida);
      }

      if (ruta === "/api/guardar" && req.method === "POST") {
        const { clave, datos } = JSON.parse((await leerCuerpo(req)).toString("utf8"));
        if (!ARCHIVOS[clave]) return json(res, 400, { error: "Archivo no permitido" });
        if (datos === null || typeof datos !== "object") return json(res, 400, { error: "Datos no válidos" });
        if (clave === "proyectos") {
          const l = datos.proyectos; if (!Array.isArray(l)) return json(res, 400, { error: "proyectos debe ser una lista" });
          const slugs = l.map((p) => p.slug);
          if (slugs.some((s) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s || ""))) return json(res, 400, { error: "Cada proyecto necesita un identificador (slug) con minúsculas, números y guiones" });
          if (new Set(slugs).size !== slugs.length) return json(res, 400, { error: "Hay dos proyectos con el mismo identificador (slug)" });
        }
        await copia(clave);
        const destino = path.join(RAIZ, ARCHIVOS[clave]);
        await mkdir(path.dirname(destino), { recursive: true });
        await writeFile(destino, JSON.stringify(datos, null, 2) + "\n");
        return json(res, 200, { ok: true });
      }

      if (ruta === "/api/captura" && req.method === "POST") {           // sube una captura (el navegador ya la convirtió a WebP)
        const { slug, datos } = JSON.parse((await leerCuerpo(req)).toString("utf8"));
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || "")) return json(res, 400, { error: "slug no válido" });
        const bytes = Buffer.from(String(datos || "").replace(/^data:image\/webp;base64,/, ""), "base64");
        if (bytes.length < 100 || bytes.length > 6e6 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return json(res, 400, { error: "Debe ser una imagen WebP de menos de 6 MB" });
        const dir = path.join(RAIZ, "src/img/capturas"); await mkdir(dir, { recursive: true });
        let n = 1; while (existsSync(path.join(dir, `${slug}-${n}.webp`))) n++;
        await writeFile(path.join(dir, `${slug}-${n}.webp`), bytes);
        return json(res, 200, { src: `img/capturas/${slug}-${n}.webp` });
      }

      if (ruta === "/api/compilar" && req.method === "POST") return json(res, 200, await compilar());

      if (ruta === "/api/copias" && req.method === "GET") {
        const dir = path.join(RAIZ, "datos/.copias"), clave = url.searchParams.get("clave");
        if (!ARCHIVOS[clave] || !existsSync(dir)) return json(res, 200, []);
        return json(res, 200, (await readdir(dir)).filter((f) => f.startsWith(clave + "__")).sort().reverse());
      }
      if (ruta === "/api/restaurar" && req.method === "POST") {
        const { clave, archivo } = JSON.parse((await leerCuerpo(req)).toString("utf8"));
        if (!ARCHIVOS[clave] || !/^[\w.-]+\.json$/.test(archivo || "") || !archivo.startsWith(clave + "__")) return json(res, 400, { error: "No válido" });
        await copia(clave);
        await copyFile(path.join(RAIZ, "datos/.copias", archivo), path.join(RAIZ, ARCHIVOS[clave]));
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: "No existe" });
    }

    /* la web compilada, para la vista previa dentro del editor */
    if (ruta === "/sitio" || ruta.startsWith("/sitio/")) {
      let rel = ruta.replace(/^\/sitio\/?/, ""); if (!rel || rel.endsWith("/")) rel += "index.html";
      const abs = path.resolve(DIST, rel);
      if (!abs.startsWith(DIST + path.sep) || !existsSync(abs) || !(await stat(abs)).isFile()) { res.writeHead(404); return res.end("No encontrado (compila primero)"); }
      res.writeHead(200, { "content-type": TIPOS[path.extname(abs)] || "application/octet-stream", "cache-control": "no-store" }); return res.end(await readFile(abs));
    }

    /* la propia interfaz del editor */
    let rel = ruta === "/" ? "index.html" : ruta.slice(1);
    const abs = path.resolve(EDITOR, rel);
    if (!abs.startsWith(EDITOR + path.sep) || !existsSync(abs) || !(await stat(abs)).isFile()) { res.writeHead(404); return res.end("No encontrado"); }
    res.writeHead(200, { "content-type": TIPOS[path.extname(abs)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(abs));
  } catch (e) { json(res, 500, { error: String(e.message || e) }); }
});

servidor.on("error", (e) => { console.error(e.code === "EADDRINUSE" ? `El puerto ${PUERTO} está ocupado. Prueba: PUERTO_EDITOR=8091 npm run editor` : e); process.exit(1); });
servidor.listen(PUERTO, HOST, async () => {
  const dir = `http://localhost:${PUERTO}/`;
  console.log(`\nEditor del portfolio → ${dir}\n(solo se abre en tu ordenador; Ctrl+C para cerrarlo)\n`);
  if (!existsSync(path.join(DIST, "index.html"))) { console.log("Compilando la web por primera vez…"); await compilar(); }
  if (!process.env.NO_ABRIR) exec(process.platform === "win32" ? `start "" "${dir}"` : process.platform === "darwin" ? `open "${dir}"` : `xdg-open "${dir}"`);
});
