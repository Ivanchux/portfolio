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
if (process.env.CORREO) config.correo = process.env.CORREO;
const { proyectos } = await leerJSON("datos/proyectos.json");
const { habilidades } = await leerJSON("datos/habilidades.json");
const { _nota: _t, ...osTextos } = await leerJSON("datos/os-textos.json");
const { _nota: _s, ...osSistema } = await leerJSON("datos/os-sistema.json");
const publicados = proyectos.filter((p) => p.publicar);

const confirmado = (v) => v !== undefined && v !== null && v !== "" && v !== PC && !(Array.isArray(v) && (v.length === 0 || v.includes(PC)));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pendientes = new Set();

// ---------- Plantillas ----------
// {{> parcial}}  {{clave}} (escapada)  {{{clave}}} (sin escapar)
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
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => String(valor(ctx, k) ?? ""))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => esc(valor(ctx, k) ?? ""));
  return salida;
}

// ---------- Piezas generadas ----------
const MENU = [
  { id: "inicio", texto: "Inicio", ruta: "" },
  { id: "que-se-hacer", texto: "Qué sé hacer", ruta: "que-se-hacer/" },
  { id: "proyectos", texto: "Proyectos", ruta: "proyectos/" },
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
      captura: p.capturas?.[0] ? { src: raiz + p.capturas[0].src, alt: p.capturas[0].alt, ancho: p.capturas[0].ancho, alto: p.capturas[0].alto } : null,
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
                ${cap ? `<img src="${raiz}${cap.src}" width="${cap.ancho}" height="${cap.alto}" alt="${esc(cap.alt)}">` : ""}
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
    .map((c) => `<figure class="galeria__item"><img src="${raiz}${c.src}" width="${c.ancho}" height="${c.alto}" loading="lazy" alt="${esc(c.alt)}"></figure>`)
    .join("");
  const galeriaHTML = galeria
    ? `<div class="galeria" tabindex="0" role="region" aria-label="Capturas de ${esc(p.nombre)}">${galeria}</div>`
    : "";
  const estado = confirmado(p.estado) ? `<p class="ficha__estado">${esc(p.estado)}</p>` : "";
  if (!estado) pendientes.add(`${p.slug}: estado`);
  return { secciones: partes.join("\n"), enlaces: enl.join(" "), galeria: galeriaHTML, estado };
}

const enlacesProyectos = (slugs, raiz) =>
  slugs
    .map((s) => publicados.find((p) => p.slug === s))
    .filter(Boolean)
    .map((p) => `<li><a href="${raiz}proyectos/${p.slug}/">${esc(p.nombre)}</a></li>`)
    .join("");

function listaHabilidades(raiz) {
  return habilidades
    .map((h) => {
      const prueba = enlacesProyectos(h.proyectos, raiz);
      return `<li class="habilidad cristal"><h2>${esc(h.titulo)}</h2><p>${esc(h.texto)}</p>${prueba ? `<p class="habilidad__prueba">Lo demuestro en:</p><ul class="etiquetas">${prueba}</ul>` : ""}</li>`;
    })
    .join("\n");
}

function blocInicio(raiz) {
  return `<h2>Qué sé hacer</h2><ul>${habilidades.slice(0, 4).map((h) => `<li>${esc(h.titulo)}</li>`).join("")}</ul><span class="bloc__mas">Ver con qué lo demuestro</span>`;
}

function listadoProyectos(raiz) {
  return publicados
    .map((p) => {
      const cap = p.capturas?.[0];
      return `<li class="archivo cristal" style="--color-disco:${esc(p.color_disco || "#2a6fdb")}">
        <div class="archivo__texto">
          <h2><a href="${raiz}proyectos/${p.slug}/">${esc(p.nombre)}</a></h2>
          ${confirmado(p.estado) ? `<p class="archivo__estado">${esc(p.estado)}</p>` : ""}
          <p>${esc(p.resumen)}</p>
          ${confirmado(p.tecnologias) ? `<ul class="etiquetas">${p.tecnologias.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        </div>
        ${cap ? `<img class="archivo__captura" src="${raiz}${cap.src}" width="${cap.ancho}" height="${cap.alto}" loading="lazy" alt="">` : `<span class="archivo__sin-captura" aria-hidden="true">${esc(p.nombre)}</span>`}
      </li>`;
    })
    .join("\n");
}

function formularioContacto() {
  if (!confirmado(config.correo)) {
    pendientes.add("contacto: formulario (falta el correo)");
    return `<div class="contacto__aviso cristal"><p><strong>El correo de contacto estará disponible pronto.</strong></p><p>Mientras tanto, puedes encontrarme en <a href="${esc(config.github)}">GitHub</a>.</p></div>`;
  }
  const asuntos = ["Prácticas", "Empleo", "Colaboración", "Otra consulta"].map((a) => `<option>${a}</option>`).join("");
  return `<form class="formulario cristal" id="formulario-contacto" action="mailto:${esc(config.correo)}" method="post" enctype="text/plain" data-correo="${esc(config.correo)}">
    <p class="formulario__nota">Al enviar se abre tu programa de correo con el mensaje preparado. Esta web no guarda nada.</p>
    <label for="f-nombre">Tu nombre</label>
    <input id="f-nombre" name="nombre" autocomplete="name" required>
    <label for="f-asunto">Asunto</label>
    <select id="f-asunto" name="asunto">${asuntos}</select>
    <label for="f-mensaje">Mensaje</label>
    <textarea id="f-mensaje" name="mensaje" rows="6" required></textarea>
    <button class="boton" type="submit">Preparar el correo</button>
    <p class="formulario__directo">O escribe directamente a <a href="mailto:${esc(config.correo)}">${esc(config.correo)}</a>.</p>
  </form>`;
}

// Datos para IVANDEV OS: solo proyectos publicados y solo datos confirmados
function datosOS(raiz) {
  const d = {
    textos: osTextos,
    sistema: osSistema,
    perfil: {
      nombre: config.nombre_publico,
      alias: config.alias,
      github: config.github,
      correo: confirmado(config.correo) ? config.correo : null,
      web: confirmado(config.dominio) ? `https://${config.dominio}` : null,
      contacto: `${raiz}contacto/`,
    },
    proyectos: publicados.map((p) => ({ id: p.slug, nombre: p.nombre, resumen: p.resumen, ficha: `${raiz}proyectos/${p.slug}/` })),
  };
  return JSON.stringify(d).replace(/</g, "\\u003c");
}

function laboratorio(raiz) {
  const enCurso = publicados.filter((p) => /desarrollo/i.test(p.estado || ""));
  return enCurso
    .map((p) => `<li class="habilidad cristal"><h2><a href="${raiz}proyectos/${p.slug}/">${esc(p.nombre)}</a></h2><p class="archivo__estado">${esc(p.estado)}</p><p>${esc(p.resumen)}</p></li>`)
    .join("\n");
}

const listaOS = (raiz) =>
  publicados.map((p) => `<li><a href="${raiz}proyectos/${p.slug}/">${esc(p.nombre)}</a>: ${esc(p.resumen)}</li>`).join("\n");

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
for (const dir of ["css", "js", "os", "fuentes", "img"]) {
  if (existsSync(path.join(SRC, dir))) await cp(path.join(SRC, dir), path.join(DIST, dir), { recursive: true });
}

const generadas = [];
generadas.push(
  await pagina("index.html", "paginas/index.html", {
    bloc: blocInicio(""),
    discos: discosHTML(""),
    pantalla_inicial: pantallaInicial(""),
    datos_monitor: datosMonitor(""),
    datos_os: datosOS(""),
  })
);
generadas.push(await pagina("proyectos/index.html", "paginas/proyectos.html", { listado: listadoProyectos("../") }));
generadas.push(await pagina("que-se-hacer/index.html", "paginas/que-se-hacer.html", { lista: listaHabilidades("../") }));
generadas.push(await pagina("laboratorio/index.html", "paginas/laboratorio.html", { en_curso: laboratorio("../") }));
generadas.push(await pagina("laboratorio/os/index.html", "paginas/os.html", { lista_os: listaOS("../../"), datos_os: datosOS("../../") }));
generadas.push(await pagina("contacto/index.html", "paginas/contacto.html", { formulario: formularioContacto() }));
for (const p of publicados) {
  const raiz = "../../";
  generadas.push(await pagina(`proyectos/${p.slug}/index.html`, "plantillas/proyecto.html", { p, ...fichaHTML(p, raiz) }));
}

// Datos de configuración que siguen sin confirmar
for (const [k, v] of Object.entries(config)) if (v === PC) pendientes.add(`config: ${k}`);
for (const [k, v] of Object.entries(config.perfiles || {})) if (v === PC) pendientes.add(`config: perfil ${k}`);

console.log(`${generadas.length} páginas en ${path.relative(RAIZ, DIST)}/`);
generadas.forEach((g) => console.log("  " + g));
if (pendientes.size) console.log(`\nSin publicar por estar ${PC} (${pendientes.size}):\n  ` + [...pendientes].join("\n  "));
