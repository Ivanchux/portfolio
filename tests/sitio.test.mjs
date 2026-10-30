// Comprobaciones sobre el sitio compilado en dist/ (npm test compila antes).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIST = path.resolve("dist");
const config = JSON.parse(await readFile("site.config.json", "utf8"));

async function archivos(dir, ext) {
  const salida = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...(await archivos(ruta, ext)));
    else if (ext.includes(path.extname(e.name))) salida.push(ruta);
  }
  return salida;
}
const html = await archivos(DIST, [".html"]);

test("ninguna página publica POR_CONFIRMAR", async () => {
  for (const f of html) assert.ok(!(await readFile(f, "utf8")).includes("POR_CONFIRMAR"), f);
});

test("modo portfolio: sin importes ni palabras comerciales", { skip: config.modo_comercial }, async () => {
  const prohibido = /€|\b(presupuestos?|contratar|tarifas?|comprar)\b/i;
  for (const f of html) {
    const texto = await readFile(f, "utf8");
    assert.ok(!prohibido.test(texto), `${path.relative(DIST, f)}: ${texto.match(prohibido)?.[0]}`);
  }
});

test("nada se carga desde servidores de terceros", async () => {
  const externos = /<(script|link)[^>]+(src|href)="https?:\/\//i;
  for (const f of [...html, ...(await archivos(DIST, [".css"]))]) {
    const texto = await readFile(f, "utf8");
    assert.ok(!externos.test(texto) && !/@import\s+url\(["']?https?:/i.test(texto), f);
  }
});

test("el cursor del sistema nunca se oculta", async () => {
  for (const f of await archivos(DIST, [".css", ".html"])) assert.ok(!/cursor:\s*none/i.test(await readFile(f, "utf8")), f);
});
