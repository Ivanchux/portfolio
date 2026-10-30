// Compila el sitio estático en dist/ a partir de src/, datos/ y site.config.json.
// Sin dependencias: solo Node 22.12 o superior.

import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ICONOS, ICONO_CATEGORIA } from "./iconos.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(RAIZ, "src");
const DIST = path.join(RAIZ, process.env.SALIDA || "dist");
const PC = "POR_CONFIRMAR";

const leerJSON = async (f) => JSON.parse(await readFile(path.join(RAIZ, f), "utf8"));
const config = await leerJSON("site.config.json");
if (process.env.CORREO) config.correo = process.env.CORREO;
const { proyectos } = await leerJSON("datos/proyectos.json");
const { habilidades } = await leerJSON("datos/habilidades.json");
const { categorias } = await leerJSON("datos/categorias.json");
const { _nota: _m, ...sobreMi } = await leerJSON("datos/sobre-mi.json");
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

const categoria = (id) => categorias.find((k) => k.id === id) || categorias[0];
const icono = (nombre) => ICONOS[nombre] || "";
const iconoCat = (id) => icono(ICONO_CATEGORIA[id]);
const enDesarrollo = (p) => /desarrollo/i.test(p.estado || "");
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
      return `<li data-categoria="${k.id}"><a class="disquete" style="--color-disco:${esc(p.color_disco || "#2a6fdb")};--cat:${k.color}" href="${raiz}proyectos/${p.slug}/" data-proyecto="${p.slug}" aria-label="Insertar el disquete de ${esc(p.nombre)} (${esc(k.nombre)})"${p.destacado ? ' aria-current="true"' : ""}><span class="disquete__etiqueta"><span class="disquete__tipo">${esc(k.corto)}</span><span class="disquete__nombre">${esc(p.nombre)}</span></span>${enDesarrollo(p) ? '<i class="disquete__led" aria-hidden="true"></i>' : ""}</a></li>`;
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
      captura: p.capturas?.[0] ? { src: raiz + p.capturas[0].src, alt: p.capturas[0].alt, ancho: p.capturas[0].ancho, alto: p.capturas[0].alto } : null,
      vivo: vp.tipo === "iframe" && confirmado(vp.url) ? vp.url : null,
      formato: vp.formato === "movil" ? "movil" : "escritorio",
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
  const estado = estadoHTML(p);
  if (!estado) pendientes.add(`${p.slug}: estado`);
  return { secciones: partes.join("\n"), enlaces: enl.join(" "), galeria: galeriaHTML, estado };
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
      return `<li class="habilidad habilidad--${h.id}${i === 0 ? " habilidad--grande" : ""} cristal" data-revelar><span class="burbuja-icono">${icono(h.icono)}</span><h2>${esc(h.titulo)}</h2><p>${esc(h.texto)}</p>${prueba ? `<p class="habilidad__prueba">Lo demuestro en</p><ul class="discos-mini">${prueba}</ul>` : ""}</li>`;
    })
    .join("\n");
}

function blocInicio(raiz) {
  return `<h2>Qué sé hacer</h2><ul>${habilidades.slice(0, 4).map((h) => `<li>${esc(h.titulo)}</li>`).join("")}</ul><span class="bloc__mas">Ver con qué lo demuestro</span>`;
}

// Texto oscuro sobre colores claros y blanco sobre oscuros
const textoSobre = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? "#1b1b1b" : "#ffffff";
};

function tarjetaProyecto(p, raiz, grande = false) {
  const cap = p.capturas?.[0];
  return `<li class="tarjeta${grande ? " tarjeta--grande" : ""}" data-categoria="${esc(p.categoria)}" data-revelar style="--color-disco:${esc(p.color_disco || "#2a6fdb")};--texto-disco:${textoSobre(p.color_disco || "#2a6fdb")};--cat:${categoria(p.categoria).color}">
        <div class="tarjeta__imagen">${cap ? `<img src="${raiz}${cap.src}" width="${cap.ancho}" height="${cap.alto}" loading="lazy" alt="">` : `<span class="tarjeta__sin-captura" aria-hidden="true">${esc(p.nombre)}</span>`}</div>
        <div class="tarjeta__texto">
          <div class="tarjeta__chips">${chipCat(p)}${estadoHTML(p)}</div>
          <h3><a href="${raiz}proyectos/${p.slug}/">${esc(p.nombre)}</a></h3>
          <p>${esc(p.resumen)}</p>
          ${confirmado(p.tecnologias) ? `<ul class="etiquetas etiquetas--mini">${p.tecnologias.slice(0, 5).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        </div>
      </li>`;
}

function listadoProyectos(raiz) {
  const filtros = [`<button type="button" class="pestana" data-filtro="todos" aria-pressed="true"><span>Todos</span><b>${publicados.length}</b></button>`]
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
    jobTitle: "Desarrollador web",
    description: "Estudiante de 2.º de ASIR en Madrid y desarrollador web autodidacta.",
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
  const urlAbs = DOMINIO ? DOMINIO + rutaSalida.replace(/index\.html$/, "") : null;
  ctx.seo = [
    `<meta property="og:type" content="${meta.seccion === "inicio" ? "profile" : "website"}">`,
    `<meta property="og:locale" content="es_ES">`,
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

// Doble clic: Chrome no deja usar como máscara una imagen local, así que los logos se incrustan en el CSS
if (process.env.ARCHIVO) {
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

// robots.txt siempre; sitemap.xml solo con el dominio confirmado
await writeFile(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n${DOMINIO ? `Sitemap: ${DOMINIO}sitemap.xml\n` : ""}`);
if (DOMINIO) {
  const urls = generadas.map((g) => `  <url><loc>${DOMINIO}${g.replace(/index\.html$/, "")}</loc></url>`).join("\n");
  await writeFile(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
} else pendientes.add("sitemap.xml, canonical y og:url (falta el dominio)");

// Datos de configuración que siguen sin confirmar
for (const [k, v] of Object.entries(config)) if (v === PC) pendientes.add(`config: ${k}`);
for (const [k, v] of Object.entries(config.perfiles || {})) if (v === PC) pendientes.add(`config: perfil ${k}`);

console.log(`${generadas.length} páginas en ${path.relative(RAIZ, DIST)}/`);
generadas.forEach((g) => console.log("  " + g));
if (pendientes.size) console.log(`\nSin publicar por estar ${PC} (${pendientes.size}):\n  ` + [...pendientes].join("\n  "));
