// Comprobaciones de la experiencia inmersiva (npm test compila antes).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const DIST = path.resolve("dist");
const leer = (f) => readFile(path.join(DIST, f), "utf8");
const { proyectos } = JSON.parse(await readFile("datos/proyectos.json", "utf8"));
const publicados = proyectos.filter((p) => p.publicar === true);

/* datos.js asigna IV.*: se evalúa en un objeto aislado para inspeccionarlo */
async function datos(f) {
  const ctx = {}; ctx.window = ctx;
  vm.runInNewContext(await leer(f), ctx);
  return JSON.parse(JSON.stringify(ctx.IV));
}

for (const [ruta, idioma] of [["inmersivo/datos-es.js", "es"], ["inmersivo/datos-en.js", "en"]]) {
  test(`inmersivo (${idioma}): solo proyectos publicados y sin pendientes`, async () => {
    const IV = await datos(ruta);
    assert.equal(IV.PROJECTS.length, publicados.length);
    assert.deepEqual(IV.PROJECTS.map((p) => p.id).sort(), publicados.map((p) => p.slug).sort());
    assert.ok(!(await leer(ruta)).includes("POR_CONFIRMAR"));
    for (const p of IV.PROJECTS) for (const c of p.caps) assert.ok(existsSync(path.join(DIST, c.src)), `captura ausente: ${c.src}`);
  });

  test(`inmersivo (${idioma}): cada proyecto tiene categoría y enlaces válidos`, async () => {
    const IV = await datos(ruta);
    const cats = new Set(IV.CATS.map((c) => c.id));
    for (const p of IV.PROJECTS) {
      assert.ok(cats.has(p.cat), `${p.id}: categoría ${p.cat}`);
      for (const u of [p.vivo, p.codigo]) if (u) assert.match(u, /^https:\/\//);
    }
  });
}

test("inmersivo: las páginas y los recursos existen y son locales", async () => {
  for (const f of ["index.html", "en/index.html", "clasica/index.html", "en/clasica/index.html", "simple/index.html", "en/simple/index.html", "inmersivo/vendor/three.min.js", "inmersivo/js/main.js", "inmersivo/css/style.css"]) assert.ok(existsSync(path.join(DIST, f)), f);
  for (const f of ["index.html", "en/index.html"]) {
    const html = await leer(f);
    assert.ok(!/<(script|link)[^>]+(src|href)="https?:\/\//i.test(html), f);
    assert.ok(html.includes("<nav class=\"sr\""), "lista accesible de proyectos");
  }
});
