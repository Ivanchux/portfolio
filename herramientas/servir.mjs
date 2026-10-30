// Servidor local para ver dist/ en http://localhost:8080. Solo para probar en tu ordenador.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PUERTO = Number(process.env.PUERTO) || 8080;
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png",
  ".woff2": "font/woff2", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};

createServer(async (pet, res) => {
  try {
    let ruta = path.normalize(decodeURIComponent(new URL(pet.url, "http://x").pathname));
    let archivo = path.join(DIST, ruta);
    if (!archivo.startsWith(DIST)) throw new Error("fuera de dist");
    if ((await stat(archivo)).isDirectory()) archivo = path.join(archivo, "index.html");
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
    res.end(await readFile(archivo));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  }
}).listen(PUERTO, () => console.log(`Abre http://localhost:${PUERTO} en el navegador. Para pararlo: Ctrl + C`));
