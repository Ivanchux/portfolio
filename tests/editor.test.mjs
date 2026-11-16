// Seguridad del editor: solo local, con cabecera propia, lista blanca de archivos y sin salir de dist/.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

let proc, base;
const libre = () => new Promise((ok) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });

before(async () => {
  const puerto = await libre();
  base = `http://127.0.0.1:${puerto}`;
  proc = spawn(process.execPath, ["herramientas/editor.mjs"], { env: { ...process.env, PUERTO_EDITOR: String(puerto), NO_ABRIR: "1" }, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error("El editor no arrancó")), 20000); proc.stdout.on("data", (d) => { if (String(d).includes("Editor del portfolio")) { clearTimeout(t); ok(); } }); });
});
after(() => proc && proc.kill());

const post = (ruta, cuerpo, cab = {}) => fetch(base + ruta, { method: "POST", headers: { "content-type": "application/json", ...cab }, body: JSON.stringify(cuerpo) });

test("el editor sirve su interfaz y los datos", async () => {
  assert.equal((await fetch(base + "/")).status, 200);
  const d = await (await fetch(base + "/api/todo")).json();
  assert.ok(Array.isArray(d.proyectos.proyectos) && d.meta.iconos.length);
});

test("sin la cabecera de seguridad no se puede escribir", async () => {
  assert.equal((await post("/api/guardar", { clave: "config", datos: {} })).status, 403);
});

test("solo acepta archivos de la lista blanca y datos válidos", async () => {
  const h = { "x-editor": "1" };
  assert.equal((await post("/api/guardar", { clave: "../package", datos: {} }, h)).status, 400);
  assert.equal((await post("/api/guardar", { clave: "proyectos", datos: { proyectos: [{ slug: "Mal Slug" }] } }, h)).status, 400);
  assert.equal((await post("/api/guardar", { clave: "proyectos", datos: { proyectos: [{ slug: "a" }, { slug: "a" }] } }, h)).status, 400);
});

test("rechaza capturas que no son WebP y rutas fuera de dist/", async () => {
  assert.equal((await post("/api/captura", { slug: "prueba", datos: "data:image/webp;base64,AAAA" }, { "x-editor": "1" })).status, 400);
  assert.equal((await fetch(base + "/sitio/..%2f..%2fpackage.json")).status, 404);
  assert.equal((await fetch(base + "/..%2fpackage.json")).status, 404);
});

test("rechaza peticiones con un Host que no sea local (DNS rebinding)", async () => {
  const r = await new Promise((ok) => { const q = net.connect(new URL(base).port, "127.0.0.1", () => q.write("GET /api/todo HTTP/1.1\r\nHost: malo.example\r\nConnection: close\r\n\r\n")); let s = ""; q.on("data", (d) => (s += d)); q.on("end", () => ok(s)); });
  assert.match(r, /^HTTP\/1\.1 403/);
});
