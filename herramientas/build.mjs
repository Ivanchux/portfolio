// Compila el sitio estático en dist/ a partir de src/, datos/ y site.config.json.
// Sin dependencias: solo Node 22.12 o superior.

import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { ICONOS, ICONO_CATEGORIA } from "./iconos.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(RAIZ, "src");
const DIST = path.join(RAIZ, process.env.SALIDA || "dist");
const PC = "POR_CONFIRMAR";

// Idioma: la web en español va en la raíz y la inglesa en /en/, compartiendo CSS, JS e imágenes
const IDIOMA = process.env.IDIOMA === "en" ? "en" : "es";
const EN = IDIOMA === "en";
const PREFIJO = EN ? "en/" : "";
const EST = EN ? "../" : ""; // de las páginas inglesas a los archivos estáticos de la raíz

const leerJSON = async (f) => JSON.parse(await readFile(path.join(RAIZ, f), "utf8"));
const leerIdioma = async (f) => (EN && existsSync(path.join(RAIZ, "datos/en", f)) ? leerJSON("datos/en/" + f) : leerJSON("datos/" + f));
const config = await leerJSON("site.config.json");
if (process.env.CORREO) config.correo = process.env.CORREO;
const { proyectos } = await leerJSON("datos/proyectos.json");
const { habilidades } = await leerIdioma("habilidades.json");
const { categorias } = await leerIdioma("categorias.json");
const { _nota: _m, ...sobreMi } = await leerIdioma("sobre-mi.json");
const { _nota: _t, ...osTextos } = await leerIdioma("os-textos.json");
const { _nota: _s, ...osSistema } = await leerIdioma("os-sistema.json");
// Traducción de los proyectos: solo cambian los textos
if (EN) {
  const { proyectos: tr } = await leerJSON("datos/en/proyectos.json");
  for (const p of proyectos) {
    const t = tr[p.slug];
    if (!t) continue;
    for (const k of ["estado", "resumen", "descripcion", "problema", "papel", "datos_medidos", "pendiente", "licencia"]) if (t[k]) p[k] = t[k];
    if (t.animacion_alt && p.animacion) p.animacion.alt = t.animacion_alt;
    (t.alts || []).forEach((alt, i) => { if (p.capturas?.[i]) p.capturas[i].alt = alt; });
  }
}

// Textos de la interfaz que genera la compilación
const TXT = {
  es: {
    menu: ["Inicio", "Qué sé hacer", "Proyectos", "Laboratorio", "Sobre mí", "Contacto"],
    insertar: "Insertar el disquete de", sinDisco: "sin disco", sinProyectos: "Todavía no hay proyectos publicados.",
    insertado: "disco insertado", verVivo: "▶ Ver en vivo", ficha: "Ficha del proyecto",
    licencia: "Licencia", siguiente: "Lo que viene", verAnim: "▶ Ver animación", pausarAnim: "⏸ Pausar animación", animDe: "Animación de",
    queEs: "Qué es", problema: "Qué problema resuelve", papel: "Mi papel", medidos: "Datos medidos", tecnologias: "Tecnologías",
    abrir: "Abrir el proyecto", nuevaPestana: " (se abre en una pestaña nueva)", codigo: "Ver el código", capturasDe: "Capturas de",
    proyecto: "proyecto", proyectos: "proyectos", queSe: "Qué sé hacer", conQue: "Ver con qué lo demuestro", todos: "Todos",
    correoPronto: "El correo de contacto estará disponible pronto.", mientras: "Mientras tanto, puedes encontrarme en",
    asuntos: ["Prácticas", "Empleo", "Colaboración", "Otra consulta"], notaForm: "Al enviar se abre tu programa de correo con el mensaje preparado. Esta web no guarda nada.",
    nombre: "Tu nombre", asunto: "Asunto", mensaje: "Mensaje", preparar: "Preparar el correo", directo: "O escribe directamente a",
    puesto: "Desarrollador web", descPersona: "Estudiante de 2.º de ASIR en Madrid y desarrollador web autodidacta.", locale: "es_ES",
    otro: "EN", otroNombre: "English", otroLang: "en",
  },
  en: {
    menu: ["Home", "What I do", "Projects", "Lab", "About me", "Contact"],
    insertar: "Insert the floppy disk for", sinDisco: "no disk", sinProyectos: "No projects published yet.",
    insertado: "disk inserted", verVivo: "▶ View live", ficha: "Project page",
    licencia: "Licence", siguiente: "What's next", verAnim: "▶ Play animation", pausarAnim: "⏸ Pause animation", animDe: "Animation of",
    queEs: "What it is", problema: "What problem it solves", papel: "My role", medidos: "Measured results", tecnologias: "Technologies",
    abrir: "Open the project", nuevaPestana: " (opens in a new tab)", codigo: "View the code", capturasDe: "Screenshots of",
    proyecto: "project", proyectos: "projects", queSe: "What I do", conQue: "See the proof", todos: "All",
    correoPronto: "The contact email will be available soon.", mientras: "In the meantime, you can find me on",
    asuntos: ["Work placement", "Job", "Collaboration", "Something else"], notaForm: "Sending opens your email app with the message ready. This website stores nothing.",
    nombre: "Your name", asunto: "Subject", mensaje: "Message", preparar: "Prepare the email", directo: "Or write directly to",
    puesto: "Web developer", descPersona: "Second-year ASIR student in Madrid and self-taught web developer.", locale: "en_GB",
    otro: "ES", otroNombre: "Español", otroLang: "es",
  },
}[IDIOMA];

// Textos del monitor (los usa js/monitor.js)
const TXT_MONITOR = {
  es: { insertado: "disco insertado", leyendo: "leyendo…", enVivo: "en vivo", verVivo: "▶ Ver en vivo", ficha: "Ficha del proyecto", cerrar: "■ Cerrar", pestana: "Abrir en pestaña nueva ↗",
    vistaDe: "Vista en vivo de", leyendoDisquete: "A:\\> leyendo disquete ", cargando: "Cargando", insertadoAviso: "Disquete insertado:", cargandoVivo: "Cargando {n} en vivo dentro del monitor.",
    cerrada: "Vista en vivo cerrada.", os: "IVANDEV OS arrancado en el monitor.", modo: "Modo de pantalla", pulsa: "Pulsa para cambiar", modos: { verde: "verde", ambar: "ámbar", hielo: "hielo" },
    bashIntro: "¡Un combate entre usuarios de Linux!", ataca: "¡{a} ataca!", critico: " ¡CRÍTICO!", dano: "daño", gana: "gana", codigoDe: "Fragmento del código de combate de" },
  en: { insertado: "disk inserted", leyendo: "reading…", enVivo: "live", verVivo: "▶ View live", ficha: "Project page", cerrar: "■ Close", pestana: "Open in a new tab ↗",
    vistaDe: "Live view of", leyendoDisquete: "A:\\> reading floppy disk ", cargando: "Loading", insertadoAviso: "Floppy disk inserted:", cargandoVivo: "Loading {n} live inside the monitor.",
    cerrada: "Live view closed.", os: "IVANDEV OS booted in the monitor.", modo: "Screen mode", pulsa: "Press to change", modos: { verde: "green", ambar: "amber", hielo: "ice" },
    bashIntro: "A battle between Linux users!", ataca: "{a} attacks!", critico: " CRITICAL!", dano: "damage", gana: "wins", codigoDe: "Excerpt of the battle code of" },
}[IDIOMA];
const publicados = proyectos.filter((p) => p.publicar);

const confirmado = (v) => v !== undefined && v !== null && v !== "" && v !== PC && !(Array.isArray(v) && (v.length === 0 || v.includes(PC)));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pendientes = new Set();

// ---------- Plantillas ----------
// {{> parcial}}  {{clave}} (escapada)  {{{clave}}} (sin escapar)
const parciales = {};
async function parcial(nombre) {
  const propia = path.join(SRC, "plantillas", IDIOMA, nombre + ".html");
  parciales[nombre] ??= await readFile(EN && existsSync(propia) ? propia : path.join(SRC, "plantillas", nombre + ".html"), "utf8");
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
  { id: "inicio", ruta: "" },
  { id: "que-se-hacer", ruta: "que-se-hacer/" },
  { id: "proyectos", ruta: "proyectos/" },
  { id: "laboratorio", ruta: "laboratorio/" },
  { id: "sobre-mi", ruta: "sobre-mi/" },
  { id: "contacto", ruta: "contacto/" },
].map((m, i) => ({ ...m, texto: TXT.menu[i] }));
const menuHTML = (raiz, actual) =>
  MENU.map((m) => `<li><a href="${raiz}${m.ruta || "./"}"${m.id === actual ? ' aria-current="page"' : ""}>${esc(m.texto)}</a></li>`).join("\n        ");

const categoria = (id) => categorias.find((k) => k.id === id) || categorias[0];
const icono = (nombre) => ICONOS[nombre] || "";
const iconoCat = (id) => icono(ICONO_CATEGORIA[id]);
const enDesarrollo = (p) => /desarrollo|development/i.test(p.estado || "");
const estadoHTML = (p) =>
  confirmado(p.estado) ? `<span class="estado${enDesarrollo(p) ? " estado--vivo" : ""}">${esc(p.estado)}</span>` : "";
const chipCat = (p) => {
  const k = categoria(p.categoria);
  return `<span class="chip-cat" style="--cat:${k.color}">${iconoCat(k.id)}${esc(k.nombre)}</span>`;
};

// Escritorio: pestañas por categoría y disquetes con etiqueta propia
function archivadorHTML(raiz) {
  const destacado = publicados.find((p) => p.destacado) || publicados[0];
  const inicial = destacado?.categoria || categorias[0].id;
  const pestanas = categorias
    .map((k) => {
      const n = publicados.filter((p) => p.categoria === k.id).length;
      if (!n) return "";
      return `<button type="button" class="pestana" data-filtro="${k.id}" aria-pressed="${k.id === inicial}" style="--cat:${k.color}">${iconoCat(k.id)}<span>${esc(k.nombre)}</span><b>${n}</b></button>`;
    })
    .join("");
  const discos = publicados
    .map((p) => {
      const k = categoria(p.categoria);
      return `<li data-categoria="${k.id}"><a class="disquete" style="--color-disco:${esc(p.color_disco || "#2a6fdb")};--cat:${k.color}" href="${raiz}proyectos/${p.slug}/" data-proyecto="${p.slug}" aria-label="${TXT.insertar} ${esc(p.nombre)} (${esc(k.nombre)})"${p.destacado ? ' aria-current="true"' : ""}><span class="disquete__etiqueta"><span class="disquete__tipo">${esc(k.corto)}</span><span class="disquete__nombre">${esc(p.nombre)}</span></span>${enDesarrollo(p) ? '<i class="disquete__led" aria-hidden="true"></i>' : ""}</a></li>`;
    })
    .join("\n            ");
  return { pestanas, discos, inicial };
}

function datosMonitor(raiz) {
  const d = {};
  for (const p of publicados) {
    const vp = p.vista_previa || {};
    d[p.slug] = {
      nombre: p.nombre,
      resumen: p.resumen,
      ficha: `${raiz}proyectos/${p.slug}/`,
      captura: p.capturas?.[0] ? { src: raiz + EST + p.capturas[0].src, alt: p.capturas[0].alt, ancho: p.capturas[0].ancho, alto: p.capturas[0].alto } : null,
      vivo: vp.tipo === "iframe" && confirmado(vp.url) ? vp.url : null,
      formato: vp.formato === "movil" ? "movil" : "escritorio",
      bash: vp.tipo === "bash" ? { luchadores: vp.luchadores, codigo: vp.codigo } : null,
    };
  }
  d._t = TXT_MONITOR;
  // Se incrusta como JSON: se evita que un «</script>» rompa la etiqueta
  return JSON.stringify(d).replace(/</g, "\\u003c");
}

function pantallaInicial(raiz) {
  const p = publicados.find((x) => x.destacado) || publicados[0];
  if (!p) return `<div class="pantalla__barra"><span>A:\\&gt;</span><span>${TXT.sinDisco}</span></div><div class="pantalla__vista"><p class="pantalla__texto">${TXT.sinProyectos}</p></div>`;
  const vp = p.vista_previa || {};
  const cap = p.capturas?.[0];
  return `<div class="pantalla__barra"><span>A:\\&gt; <strong id="pantalla-titulo" tabindex="-1">${esc(p.nombre.toUpperCase())}</strong></span><span>${TXT.insertado}</span></div>
              <div class="pantalla__vista">
                ${cap ? `<img src="${raiz}${EST}${cap.src}" width="${cap.ancho}" height="${cap.alto}" alt="${esc(cap.alt)}">` : ""}
                <p class="pantalla__texto">${esc(p.resumen)}</p>
              </div>
              <div class="pantalla__acciones">
                ${vp.tipo === "iframe" && confirmado(vp.url) ? `<a class="pantalla__boton" data-accion="vivo" href="${esc(vp.url)}" target="_blank" rel="noopener">${TXT.verVivo}</a>` : ""}
                <a class="pantalla__boton pantalla__boton--hueco" href="${raiz}proyectos/${p.slug}/">${TXT.ficha}</a>
              </div>`;
}

function fichaHTML(p, raiz) {
  const sec = (titulo, cuerpo) => `<section class="ficha__bloque cristal"><h2>${titulo}</h2>${cuerpo}</section>`;
  const partes = [];
  if (p.descripcion?.length) partes.push(sec(TXT.queEs, p.descripcion.map((t) => `<p>${esc(t)}</p>`).join("")));
  if (confirmado(p.problema)) partes.push(sec(TXT.problema, `<p>${esc(p.problema)}</p>`));
  else pendientes.add(`${p.slug}: problema`);
  if (confirmado(p.papel)) partes.push(sec(TXT.papel, `<p>${esc(p.papel)}</p>`));
  else pendientes.add(`${p.slug}: papel`);
  if (p.datos_medidos?.length) partes.push(sec(TXT.medidos, `<ul>${p.datos_medidos.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`));
  if (p.pendiente?.length) partes.push(sec(TXT.siguiente, `<ul>${p.pendiente.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`));
  if (confirmado(p.licencia)) partes.push(sec(TXT.licencia, `<p>${esc(p.licencia)}</p>`));
  if (confirmado(p.tecnologias)) partes.push(sec(TXT.tecnologias, `<ul class="etiquetas">${p.tecnologias.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`));
  const enl = [];
  if (confirmado(p.enlaces?.vivo)) enl.push(`<a class="boton" href="${esc(p.enlaces.vivo)}" target="_blank" rel="noopener">${TXT.abrir}<span class="visualmente-oculto">${TXT.nuevaPestana}</span></a>`);
  else pendientes.add(`${p.slug}: enlace en vivo`);
  if (confirmado(p.enlaces?.codigo)) enl.push(`<a class="boton boton--secundario" href="${esc(p.enlaces.codigo)}">${TXT.codigo}</a>`);
  else pendientes.add(`${p.slug}: enlace al código`);
  const galeria = (p.capturas || [])
    .map((c) => `<figure class="galeria__item"><img src="${raiz}${EST}${c.src}" width="${c.ancho}" height="${c.alto}" loading="lazy" alt="${esc(c.alt)}"></figure>`)
    .join("");
  const galeriaHTML = galeria
    ? `<div class="galeria" tabindex="0" role="region" aria-label="${TXT.capturasDe} ${esc(p.nombre)}">${galeria}</div>`
    : "";
  const estado = estadoHTML(p);
  if (!estado) pendientes.add(`${p.slug}: estado`);
  // Animación: se enseña quieta y se reproduce solo si el visitante lo pide (WCAG 2.2.2)
  const a = p.animacion;
  const animacionHTML = a
    ? `<figure class="animacion" data-animacion data-mov="${raiz}${EST}${a.src}" data-poster="${raiz}${EST}${a.poster}" data-t-ver="${esc(TXT.verAnim)}" data-t-pausa="${esc(TXT.pausarAnim)}">
    <img src="${raiz}${EST}${a.poster}" width="${a.ancho}" height="${a.alto}" loading="lazy" alt="${esc(a.alt)}">
    <button type="button" class="animacion__boton" hidden aria-pressed="false">${esc(TXT.verAnim)}</button>
  </figure>`
    : "";
  return { secciones: partes.join("\n"), enlaces: enl.join(" "), galeria: galeriaHTML, animacion: animacionHTML, estado };
}

const enlacesProyectos = (slugs, raiz) =>
  slugs
    .map((s) => publicados.find((p) => p.slug === s))
    .filter(Boolean)
    .map((p) => `<li><a href="${raiz}proyectos/${p.slug}/">${esc(p.nombre)}</a></li>`)
    .join("");

const discosMini = (slugs, raiz) =>
  slugs
    .map((s) => publicados.find((p) => p.slug === s))
    .filter(Boolean)
    .map((p) => `<li><a href="${raiz}proyectos/${p.slug}/" style="--color-disco:${esc(p.color_disco || "#2a6fdb")}"><i aria-hidden="true"></i>${esc(p.nombre)}</a></li>`)
    .join("");

function listaHabilidades(raiz) {
  return habilidades
    .map((h, i) => {
      const prueba = discosMini(h.proyectos, raiz);
      const fotos = h.proyectos
        .map((s) => publicados.find((p) => p.slug === s))
        .filter((p) => p?.capturas?.[0])
        .slice(0, 3)
        .map((p, k) => `<a class="abanico__foto" href="${raiz}proyectos/${p.slug}/" style="--k:${k}" tabindex="-1" aria-hidden="true"><img src="${raiz}${EST}${p.capturas[0].src}" width="${p.capturas[0].ancho}" height="${p.capturas[0].alto}" loading="lazy" alt=""><span>${esc(p.nombre)}</span></a>`)
        .join("");
      const n = h.proyectos.filter((s) => publicados.some((p) => p.slug === s)).length;
      return `<li class="oficio oficio--${h.id}${i % 2 ? " oficio--par" : ""}" data-revelar>
        <div class="oficio__texto">
          <span class="oficio__icono">${icono(h.icono)}</span>
          <p class="oficio__cuenta">${n} ${n === 1 ? TXT.proyecto : TXT.proyectos}</p>
          <h2>${esc(h.titulo)}</h2>
          <p>${esc(h.texto)}</p>
          ${prueba ? `<ul class="discos-mini">${prueba}</ul>` : ""}
        </div>
        <div class="abanico">${fotos}</div>
      </li>`;
    })
    .join("\n");
}

function blocInicio(raiz) {
  return `<h2>${TXT.queSe}</h2><ul>${habilidades.slice(0, 4).map((h) => `<li>${esc(h.titulo)}</li>`).join("")}</ul><span class="bloc__mas">${TXT.conQue}</span>`;
}

// Texto oscuro sobre colores claros y blanco sobre oscuros
const textoSobre = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? "#1b1b1b" : "#ffffff";
};

function tarjetaProyecto(p, raiz, grande = false) {
  const cap = p.capturas?.[0];
  return `<li class="tarjeta${grande ? " tarjeta--grande" : ""}" data-categoria="${esc(p.categoria)}" data-revelar style="--color-disco:${esc(p.color_disco || "#2a6fdb")};--texto-disco:${textoSobre(p.color_disco || "#2a6fdb")};--cat:${categoria(p.categoria).color}">
        <div class="tarjeta__imagen">${cap ? `<img src="${raiz}${EST}${cap.src}" width="${cap.ancho}" height="${cap.alto}" loading="lazy" alt="">` : `<span class="tarjeta__sin-captura" aria-hidden="true">${esc(p.nombre)}</span>`}</div>
        <div class="tarjeta__texto">
          <div class="tarjeta__chips">${chipCat(p)}${estadoHTML(p)}</div>
          <h3><a href="${raiz}proyectos/${p.slug}/">${esc(p.nombre)}</a></h3>
          <p>${esc(p.resumen)}</p>
          ${confirmado(p.tecnologias) ? `<ul class="etiquetas etiquetas--mini">${p.tecnologias.slice(0, 5).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        </div>
      </li>`;
}

function listadoProyectos(raiz) {
  const filtros = [`<button type="button" class="pestana" data-filtro="todos" aria-pressed="true"><span>${TXT.todos}</span><b>${publicados.length}</b></button>`]
    .concat(categorias.map((k) => `<button type="button" class="pestana" data-filtro="${k.id}" aria-pressed="false" style="--cat:${k.color}">${iconoCat(k.id)}<span>${esc(k.nombre)}</span><b>${publicados.filter((p) => p.categoria === k.id).length}</b></button>`))
    .join("");
  const grupos = categorias
    .map((k) => {
      const lista = publicados.filter((p) => p.categoria === k.id);
      if (!lista.length) return "";
      return `<section class="grupo" data-categoria="${k.id}" aria-labelledby="g-${k.id}" style="--cat:${k.color}">
      <header class="grupo__cabecera" data-revelar><span class="burbuja-icono">${iconoCat(k.id)}</span><div><h2 id="g-${k.id}">${esc(k.nombre)} <small>${lista.length}</small></h2><p>${esc(k.texto)}</p></div></header>
      <ul class="tarjetas">${lista.map((p, i) => tarjetaProyecto(p, raiz, i === 0)).join("")}</ul>
    </section>`;
    })
    .join("\n");
  return { filtros, grupos };
}

function formularioContacto() {
  if (!confirmado(config.correo)) {
    pendientes.add("contacto: formulario (falta el correo)");
    return `<div class="contacto__aviso cristal"><p><strong>${TXT.correoPronto}</strong></p><p>${TXT.mientras} <a href="${esc(config.github)}">GitHub</a>.</p></div>`;
  }
  const asuntos = TXT.asuntos.map((a) => `<option>${a}</option>`).join("");
  return `<form class="formulario cristal" id="formulario-contacto" action="mailto:${esc(config.correo)}" method="post" enctype="text/plain" data-correo="${esc(config.correo)}">
    <p class="formulario__nota">${TXT.notaForm}</p>
    <label for="f-nombre">${TXT.nombre}</label>
    <input id="f-nombre" name="nombre" autocomplete="name" required>
    <label for="f-asunto">${TXT.asunto}</label>
    <select id="f-asunto" name="asunto">${asuntos}</select>
    <label for="f-mensaje">${TXT.mensaje}</label>
    <textarea id="f-mensaje" name="mensaje" rows="6" required></textarea>
    <button class="boton" type="submit">${TXT.preparar}</button>
    <p class="formulario__directo">${TXT.directo} <a href="mailto:${esc(config.correo)}">${esc(config.correo)}</a>.</p>
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
  return publicados.filter(enDesarrollo).map((p) => tarjetaProyecto(p, raiz)).join("\n");
}

const listaOS = (raiz) =>
  publicados.map((p) => `<li><a href="${raiz}proyectos/${p.slug}/">${esc(p.nombre)}</a>: ${esc(p.resumen)}</li>`).join("\n");

// Versión para abrir con doble clic (ARCHIVO=1): los enlaces a carpetas apuntan a su index.html
const paraDobleClic = (html) =>
  html
    .replace(/href="((?!https?:|mailto:|#)[^"]*\/)"/g, 'href="$1index.html"')
    .replace(/("(?:ficha|contacto)":"[^"]*\/)"/g, '$1index.html"');

function paginaSobreMi(raiz) {
  const M = sobreMi;
  const ICONO_COMO = ["chispa", "codigo", "ojo", "candado"];
  return {
    intro: M.intro.map((t) => `<p>${esc(t)}</p>`).join(""),
    como: M.como_trabajo.map((x, i) => `<li class="habilidad cristal" data-revelar><span class="burbuja-icono">${icono(ICONO_COMO[i % 4])}</span><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></li>`).join("\n"),
    pila: M.pila
      .map((x) => {
        const e = discosMini(x.proyectos, raiz);
        return `<li data-revelar><span class="pila__nombre">${esc(x.nombre)}</span>${e ? `<ul class="discos-mini">${e}</ul>` : `<span class="pila__nota">${esc(x.nota || "")}</span>`}</li>`;
      })
      .join("\n"),
    formacion: M.formacion
      .map((x, i) => { const e = discosMini(x.proyectos || [], raiz); return `<li data-revelar${i === 0 ? ' class="formacion__actual"' : ""}><h3>${esc(x.etapa)}</h3><p>${esc(x.texto)}</p>${e ? `<ul class="discos-mini">${e}</ul>` : ""}</li>`; })
      .join("\n"),
    clas_titulo: M.clasificado.titulo,
    clas_texto: M.clasificado.texto,
    clas_cierre: M.clasificado.cierre,
    clas_lineas: Array.from({ length: M.clasificado.lineas }, (_, i) => `<span class="tachado" style="--largo:${[92, 78, 85, 60, 70][i % 5]}%"></span>`).join(""),
    busco: M.busco,
    icono_birrete: icono("birrete"),
    icono_pila: icono("codigo"),
  };
}

// SEO: lo que necesita una dirección absoluta solo se genera con el dominio confirmado
const DOMINIO = confirmado(config.dominio) ? `https://${config.dominio.replace(/^https?:\/\//, "").replace(/\/$/, "")}/` : null;
function personaJSONLD() {
  const p = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: config.nombre_publico,
    alternateName: config.alias,
    jobTitle: TXT.puesto,
    description: TXT.descPersona,
    knowsAbout: ["HTML", "CSS", "JavaScript", "PHP", "MySQL", "Cloudflare Workers", "Linux", "Godot", "IA generativa"],
    sameAs: [config.github, config.perfiles?.linkedin].filter(confirmado),
  };
  if (DOMINIO) p.url = DOMINIO;
  return `<script type="application/ld+json">${JSON.stringify(p).replace(/</g, "\\u003c")}</script>`;
}

// ---------- Páginas ----------
async function pagina(rutaSalida, fuente, ctxExtra = {}) {
  const profundidad = rutaSalida.split("/").length - 1;
  const raiz = "../".repeat(profundidad);
  const propia = path.join(SRC, path.dirname(fuente), IDIOMA, path.basename(fuente));
  let cuerpo = await readFile(EN && existsSync(propia) ? propia : path.join(SRC, fuente), "utf8");
  const meta = JSON.parse(cuerpo.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/)[1]);
  cuerpo = cuerpo.replace(/^<!--[\s\S]*?-->\s*/, "");
  const ruta = rutaSalida.replace(/index\.html$/, "");
  const ctx = {
    ...config,
    raiz,
    est: raiz + EST,
    lang: IDIOMA,
    otro_idioma: EN ? `${raiz}../${ruta}` : `${raiz}en/${ruta}`,
    otro_texto: TXT.otro,
    otro_nombre: TXT.otroNombre,
    otro_lang: TXT.otroLang,
    anio: new Date().getFullYear(),
    menu: menuHTML(raiz, meta.seccion),
    css_extra: (meta.css || []).map((c) => `<link rel="stylesheet" href="${raiz}${EST}css/${c}.css">`).join("\n"),
    js_extra: (meta.js || []).map((j) => `<script src="${raiz}${EST}js/${j}.js" defer></script>`).join("\n"),
    ...ctxExtra,
  };
  ctx.titulo = await render(meta.titulo, ctx);
  ctx.descripcion = await render(meta.descripcion, ctx);
  const urlAbs = DOMINIO ? DOMINIO + PREFIJO + ruta : null;
  ctx.seo = [
    `<meta property="og:type" content="${meta.seccion === "inicio" ? "profile" : "website"}">`,
    `<meta property="og:locale" content="${TXT.locale}">`,
    DOMINIO && `<link rel="alternate" hreflang="es" href="${DOMINIO}${ruta}">`,
    DOMINIO && `<link rel="alternate" hreflang="en" href="${DOMINIO}en/${ruta}">`,
    `<meta property="og:site_name" content="${esc(config.nombre_publico)}">`,
    `<meta property="og:title" content="${esc(ctx.titulo)}">`,
    `<meta property="og:description" content="${esc(ctx.descripcion)}">`,
    urlAbs && `<link rel="canonical" href="${urlAbs}">`,
    urlAbs && `<meta property="og:url" content="${urlAbs}">`,
    meta.seccion === "inicio" && personaJSONLD(),
  ].filter(Boolean).join("\n");
  ctx.contenido = await render(cuerpo, ctx);
  let html = await render(await parcial("base"), ctx);
  const restos = html.match(/\{\{[^}]*\}\}/g);
  if (restos) throw new Error(`${rutaSalida}: marcas sin resolver ${restos.join(", ")}`);
  if (html.includes(PC)) throw new Error(`${rutaSalida}: contiene ${PC}`);
  if (process.env.ARCHIVO) html = paraDobleClic(html);
  const destino = path.join(DIST, PREFIJO + rutaSalida);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, html);
  return rutaSalida;
}

if (!EN) {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const dir of ["css", "js", "os", "fuentes", "img"]) {
    if (existsSync(path.join(SRC, dir))) await cp(path.join(SRC, dir), path.join(DIST, dir), { recursive: true });
  }
}

// Doble clic: Chrome no deja usar como máscara una imagen local, así que los logos se incrustan en el CSS
if (process.env.ARCHIVO && !EN) {
  for (const f of ["base.css", "paginas.css"]) {
    const ruta = path.join(DIST, "css", f);
    let css = await readFile(ruta, "utf8");
    for (const img of ["logo.png", "logo-cubo.png"]) {
      const datos = (await readFile(path.join(SRC, "img", img))).toString("base64");
      css = css.replaceAll(`url("../img/${img}")`, `url("data:image/png;base64,${datos}")`);
    }
    await writeFile(ruta, css);
  }
}

const generadas = [];
generadas.push(
  await pagina("index.html", "paginas/index.html", {
    bloc: blocInicio(""),
    ...(() => { const a = archivadorHTML(""); return { discos: a.discos, pestanas: a.pestanas }; })(),
    pantalla_inicial: pantallaInicial(""),
    datos_monitor: datosMonitor(""),
    datos_os: datosOS(""),
  })
);
generadas.push(await pagina("proyectos/index.html", "paginas/proyectos.html", listadoProyectos("../")));
generadas.push(await pagina("que-se-hacer/index.html", "paginas/que-se-hacer.html", { lista: listaHabilidades("../") }));
generadas.push(await pagina("laboratorio/index.html", "paginas/laboratorio.html", { en_curso: laboratorio("../"), icono_matraz: icono("matraz"), n_curso: publicados.filter(enDesarrollo).length }));
generadas.push(await pagina("laboratorio/os/index.html", "paginas/os.html", { lista_os: listaOS("../../"), datos_os: datosOS("../../") }));
generadas.push(await pagina("sobre-mi/index.html", "paginas/sobre-mi.html", paginaSobreMi("../")));
generadas.push(await pagina("legal/index.html", "paginas/legal.html"));
generadas.push(await pagina("contacto/index.html", "paginas/contacto.html", { formulario: formularioContacto() }));
for (const p of publicados) {
  const raiz = "../../";
  generadas.push(await pagina(`proyectos/${p.slug}/index.html`, "plantillas/proyecto.html", { p, ...fichaHTML(p, raiz), chip_cat: chipCat(p) }));
}

// La versión inglesa termina aquí: robots, sitemap y el informe los hace la española
if (EN) {
  console.log(`${generadas.length} páginas en inglés en ${path.relative(RAIZ, DIST)}/en/`);
  process.exit(0);
}

// robots.txt siempre; sitemap.xml solo con el dominio confirmado
await writeFile(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n${DOMINIO ? `Sitemap: ${DOMINIO}sitemap.xml\n` : ""}`);
if (DOMINIO) {
  const urls = generadas.flatMap((g) => ["", "en/"].map((pre) => `  <url><loc>${DOMINIO}${pre}${g.replace(/index\.html$/, "")}</loc></url>`)).join("\n");
  await writeFile(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
} else pendientes.add("sitemap.xml, canonical y og:url (falta el dominio)");

// Datos de configuración que siguen sin confirmar
for (const [k, v] of Object.entries(config)) if (v === PC) pendientes.add(`config: ${k}`);
for (const [k, v] of Object.entries(config.perfiles || {})) if (v === PC) pendientes.add(`config: perfil ${k}`);

console.log(`${generadas.length} páginas en ${path.relative(RAIZ, DIST)}/`);
// Y la misma web en inglés, en /en/
execFileSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, IDIOMA: "en" }, stdio: "inherit" });
generadas.forEach((g) => console.log("  " + g));
if (pendientes.size) console.log(`\nSin publicar por estar ${PC} (${pendientes.size}):\n  ` + [...pendientes].join("\n  "));
