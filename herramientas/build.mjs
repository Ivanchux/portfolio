// Compila el sitio estático en dist/ a partir de src/, datos/ y site.config.json.
// Sin dependencias: solo Node 22.12 o superior.

import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(RAIZ, "src");
const DIST = path.join(RAIZ, process.env.SALIDA || "dist");
const PC = "POR_CONFIRMAR";

const leerJSON = async (f) => JSON.parse(await readFile(path.join(RAIZ, f), "utf8"));
const config = await leerJSON("site.config.json");
if (process.env.MODO_COMERCIAL) config.modo_comercial = process.env.MODO_COMERCIAL === "true";
const { proyectos } = await leerJSON("datos/proyectos.json");
const publicados = proyectos.filter((p) => p.publicar);

const confirmado = (v) => v !== undefined && v !== null && v !== "" && v !== PC && !(Array.isArray(v) && (v.length === 0 || v.includes(PC)));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pendientes = new Set();

// ---------- Plantillas ----------
// {{> parcial}}  {{clave}} (escapada)  {{{clave}}} (sin escapar)
// {{#comercial}}…{{/comercial}}  {{^comercial}}…{{/comercial}}
const parciales = {};
async function parcial(nombre) {
  parciales[nombre] ??= await readFile(path.join(SRC, "plantillas", nombre + ".html"), "utf8");
  return parciales[nombre];
}
const valor = (ctx, clave) => clave.split(".").reduce((o, k) => (o == null ? o : o[k]), ctx);

async function render(texto, ctx) {
  let salida = texto;
  for (let i = 0; i < 5 && /\{\{>\s*[\w-]+\s*\}\}/.test(salida); i++) {
    const nombres = [...salida.matchAll(/\{\{>\s*([\w-]+)\s*\}\}/g)].map((m) => m[1]);
    for (const n of new Set(nombres)) salida = salida.replaceAll(new RegExp(`\\{\\{>\\s*${n}\\s*\\}\\}`, "g"), await parcial(n));
  }
  salida = salida
    .replace(/\{\{#comercial\}\}([\s\S]*?)\{\{\/comercial\}\}/g, (_, c) => (config.modo_comercial ? c : ""))
    .replace(/\{\{\^comercial\}\}([\s\S]*?)\{\{\/comercial\}\}/g, (_, c) => (config.modo_comercial ? "" : c))
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => String(valor(ctx, k) ?? ""))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => esc(valor(ctx, k) ?? ""));
  return salida;
}

// ---------- Piezas generadas ----------
const MENU = [
  { id: "inicio", texto: "Inicio", ruta: "" },
  config.modo_comercial ? { id: "servicios", texto: "Servicios", ruta: "servicios/" } : { id: "que-se-hacer", texto: "Qué sé hacer", ruta: "que-se-hacer/" },
  { id: "proyectos", texto: "Proyectos", ruta: "proyectos/" },
  ...(config.modo_comercial ? [{ id: "productos", texto: "Productos", ruta: "productos/" }] : []),
  { id: "laboratorio", texto: "Laboratorio", ruta: "laboratorio/" },
  { id: "sobre-mi", texto: "Sobre mí", ruta: "sobre-mi/" },
  { id: "contacto", texto: "Contacto", ruta: "contacto/" },
];
const menuHTML = (raiz, actual) =>
  MENU.map((m) => `<li><a href="${raiz}${m.ruta || "./"}"${m.id === actual ? ' aria-current="page"' : ""}>${esc(m.texto)}</a></li>`).join("\n        ");

const discosHTML = (raiz) =>
  publicados
    .map((p) => `<li><a class="disquete" style="--color-disco:${esc(p.color_disco || "#2a6fdb")}" href="${raiz}proyectos/${p.slug}/" data-proyecto="${p.slug}" aria-label="Insertar el disquete de ${esc(p.nombre)}"${p.destacado ? ' aria-current="true"' : ""}><span class="disquete__etiqueta">${esc(p.nombre)}</span></a></li>`)
    .join("\n            ");

function datosMonitor(raiz) {
  const d = {};
  for (const p of publicados) {
    const vp = p.vista_previa || {};
    d[p.slug] = {
      nombre: p.nombre,
      resumen: p.resumen,
      ficha: `${raiz}proyectos/${p.slug}/`,
      captura: p.capturas?.[0] ? { src: raiz + p.capturas[0].src, alt: p.capturas[0].alt } : null,
      vivo: vp.tipo === "iframe" && confirmado(vp.url) ? vp.url : null,
    };
  }
  // Se incrusta como JSON: se evita que un «</script>» rompa la etiqueta
  return JSON.stringify(d).replace(/</g, "\\u003c");
}

function pantallaInicial(raiz) {
  const p = publicados.find((x) => x.destacado) || publicados[0];
  if (!p) return `<div class="pantalla__barra"><span>A:\\&gt;</span><span>sin disco</span></div><div class="pantalla__vista"><p class="pantalla__texto">Todavía no hay proyectos publicados.</p></div>`;
  const vp = p.vista_previa || {};
  const cap = p.capturas?.[0];
  return `<div class="pantalla__barra"><span>A:\\&gt; <strong id="pantalla-titulo" tabindex="-1">${esc(p.nombre.toUpperCase())}</strong></span><span>disco insertado</span></div>
              <div class="pantalla__vista">
                ${cap ? `<img src="${raiz}${cap.src}" width="960" height="545" alt="${esc(cap.alt)}">` : ""}
                <p class="pantalla__texto">${esc(p.resumen)}</p>
              </div>
              <div class="pantalla__acciones">
                ${vp.tipo === "iframe" && confirmado(vp.url) ? `<a class="pantalla__boton" data-accion="vivo" href="${esc(vp.url)}" target="_blank" rel="noopener">▶ Ver en vivo</a>` : ""}
                <a class="pantalla__boton pantalla__boton--hueco" href="${raiz}proyectos/${p.slug}/">Ficha del proyecto</a>
              </div>`;
}

function fichaHTML(p, raiz) {
  const sec = (titulo, cuerpo) => `<section class="ficha__bloque cristal"><h2>${titulo}</h2>${cuerpo}</section>`;
  const partes = [];
  if (p.descripcion?.length) partes.push(sec("Qué es", p.descripcion.map((t) => `<p>${esc(t)}</p>`).join("")));
  if (confirmado(p.problema)) partes.push(sec("Qué problema resuelve", `<p>${esc(p.problema)}</p>`));
  else pendientes.add(`${p.slug}: problema`);
  if (confirmado(p.papel)) partes.push(sec("Mi papel", `<p>${esc(p.papel)}</p>`));
  else pendientes.add(`${p.slug}: papel`);
  if (p.datos_medidos?.length) partes.push(sec("Datos medidos", `<ul>${p.datos_medidos.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`));
  if (confirmado(p.tecnologias)) partes.push(sec("Tecnologías", `<ul class="etiquetas">${p.tecnologias.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`));
  const enl = [];
  if (confirmado(p.enlaces?.vivo)) enl.push(`<a class="boton" href="${esc(p.enlaces.vivo)}" target="_blank" rel="noopener">Abrir el proyecto<span class="visualmente-oculto"> (se abre en una pestaña nueva)</span></a>`);
  else pendientes.add(`${p.slug}: enlace en vivo`);
  if (confirmado(p.enlaces?.codigo)) enl.push(`<a class="boton boton--secundario" href="${esc(p.enlaces.codigo)}">Ver el código</a>`);
  else pendientes.add(`${p.slug}: enlace al código`);
  const galeria = (p.capturas || [])
    .map((c) => `<figure class="galeria__item"><img src="${raiz}${c.src}" width="960" height="545" loading="lazy" alt="${esc(c.alt)}"></figure>`)
    .join("");
  const galeriaHTML = galeria
    ? `<div class="galeria" tabindex="0" role="region" aria-label="Capturas de ${esc(p.nombre)}">${galeria}</div>`
    : "";
  return { secciones: partes.join("\n"), enlaces: enl.join(" "), galeria: galeriaHTML };
}

// ---------- Páginas ----------
async function pagina(rutaSalida, fuente, ctxExtra = {}) {
  const profundidad = rutaSalida.split("/").length - 1;
  const raiz = "../".repeat(profundidad);
  let cuerpo = await readFile(path.join(SRC, fuente), "utf8");
  const meta = JSON.parse(cuerpo.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/)[1]);
  cuerpo = cuerpo.replace(/^<!--[\s\S]*?-->\s*/, "");
  const ctx = {
    ...config,
    raiz,
    anio: new Date().getFullYear(),
    menu: menuHTML(raiz, meta.seccion),
    css_extra: (meta.css || []).map((c) => `<link rel="stylesheet" href="${raiz}css/${c}.css">`).join("\n"),
    js_extra: (meta.js || []).map((j) => `<script src="${raiz}js/${j}.js" defer></script>`).join("\n"),
    ...ctxExtra,
  };
  ctx.titulo = await render(meta.titulo, ctx);
  ctx.descripcion = await render(meta.descripcion, ctx);
  ctx.contenido = await render(cuerpo, ctx);
  const html = await render(await parcial("base"), ctx);
  const restos = html.match(/\{\{[^}]*\}\}/g);
  if (restos) throw new Error(`${rutaSalida}: marcas sin resolver ${restos.join(", ")}`);
  if (html.includes(PC)) throw new Error(`${rutaSalida}: contiene ${PC}`);
  const destino = path.join(DIST, rutaSalida);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, html);
  return rutaSalida;
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
for (const dir of ["css", "js", "fuentes", "img"]) {
  if (existsSync(path.join(SRC, dir))) await cp(path.join(SRC, dir), path.join(DIST, dir), { recursive: true });
}

const generadas = [];
generadas.push(
  await pagina("index.html", "paginas/index.html", {
    discos: discosHTML(""),
    pantalla_inicial: pantallaInicial(""),
    datos_monitor: datosMonitor(""),
  })
);
for (const p of publicados) {
  const raiz = "../../";
  generadas.push(await pagina(`proyectos/${p.slug}/index.html`, "plantillas/proyecto.html", { p, ...fichaHTML(p, raiz) }));
}

// Datos de configuración que siguen sin confirmar
for (const [k, v] of Object.entries(config)) if (v === PC) pendientes.add(`config: ${k}`);
for (const [k, v] of Object.entries(config.perfiles || {})) if (v === PC) pendientes.add(`config: perfil ${k}`);

console.log(`Modo ${config.modo_comercial ? "comercial" : "portfolio"} · ${generadas.length} páginas en ${path.relative(RAIZ, DIST)}/`);
generadas.forEach((g) => console.log("  " + g));
if (pendientes.size) console.log(`\nSin publicar por estar ${PC} (${pendientes.size}):\n  ` + [...pendientes].join("\n  "));
