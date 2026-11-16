// Genera la experiencia inmersiva (3D por scroll) a partir de los MISMOS datos que la web clásica.
//   dist/index.html        → portada en español (experiencia 3D)
//   dist/en/index.html     → portada en inglés
//   dist/inmersivo/        → recursos compartidos (css, js, vendor) y datos-es.js / datos-en.js
// Reglas heredadas de la web: solo `publicar: true`, nada con POR_CONFIRMAR, sin precios ni recursos de terceros.
// Se ejecuta después de build.mjs (npm run build lo hace solo).

import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(RAIZ, "src/inmersivo");
const DIST = path.join(RAIZ, process.env.SALIDA || "dist");
const PC = "POR_CONFIRMAR";
const ARCHIVO = !!process.env.ARCHIVO;                       // abrir con doble clic: enlaces a index.html explícito

const leer = async (f) => JSON.parse(await readFile(path.join(RAIZ, f), "utf8"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ---------- limpieza: lo pendiente no se publica ---------- */
const limpia = (v) => {
  if (v === PC) return null;
  if (Array.isArray(v)) return v.filter((x) => x !== PC && x != null).map(limpia);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, limpia(x)]));
  return v;
};

/* ---------- textos de la interfaz (ES / EN): valores por defecto + los que edites en datos/inmersivo-textos.json ---------- */
import { UI_POR_DEFECTO } from "./textos-inmersivo.mjs";
const PROPIOS = existsSync(path.join(RAIZ, "datos/inmersivo-textos.json")) ? JSON.parse(await readFile(path.join(RAIZ, "datos/inmersivo-textos.json"), "utf8")) : {};
const UI = { es: { ...UI_POR_DEFECTO.es, ...(PROPIOS.es || {}) }, en: { ...UI_POR_DEFECTO.en, ...(PROPIOS.en || {}) } };

/* ---------- datos (mismas reglas de traducción que build.mjs) ---------- */
async function datos(idioma) {
  const EN = idioma === "en";
  const idiomaJSON = async (f) => (EN && existsSync(path.join(RAIZ, "datos/en", f)) ? leer("datos/en/" + f) : leer("datos/" + f));
  const config = await leer("site.config.json");
  if (process.env.CORREO) config.correo = process.env.CORREO;
  const { proyectos } = await leer("datos/proyectos.json");
  const { habilidades } = await idiomaJSON("habilidades.json");
  const { categorias } = await idiomaJSON("categorias.json");
  const { _nota, ...sobre } = await idiomaJSON("sobre-mi.json");
  if (EN) {
    const { proyectos: tr } = await leer("datos/en/proyectos.json");
    for (const p of proyectos) {
      const t = tr[p.slug]; if (!t) continue;
      for (const k of ["estado", "resumen", "descripcion", "problema", "papel", "datos_medidos", "pendiente"]) if (t[k]) p[k] = t[k];
      (t.alts || []).forEach((alt, i) => { if (p.capturas?.[i]) p.capturas[i].alt = alt; });
    }
  }
  const pub = proyectos.filter((p) => p.publicar === true).map(limpia);
  const cats = categorias.filter((c) => pub.some((p) => p.categoria === c.id));
  return { config, pub, cats, habilidades, sobre, EN };
}

/* ---------- salida ---------- */
const jsStr = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

async function escribe(idioma) {
  const { config, pub, cats, habilidades, sobre, EN } = await datos(idioma);
  const T = UI[idioma];
  const raiz = EN ? "../" : "";                                // de la portada [en/]index.html a la raíz de dist
  const clasica = "";                                          // páginas del mismo idioma: misma carpeta que la portada
  const idx = ARCHIVO ? "index.html" : "";
  const nombreIdx = (p) => clasica + p + idx;
  const cap = (c) => ({ src: c.src, alt: c.alt || "", w: c.ancho, h: c.alto });

  const proyectos = pub.map((p) => ({
    id: p.slug, n: p.nombre, cat: p.categoria, color: p.color_disco || "#2a6fdb", estado: p.estado || null,
    resumen: p.resumen || "", desc: p.descripcion || [], problema: p.problema || null, papel: p.papel || null,
    medidos: p.datos_medidos || [], pendiente: p.pendiente || [], stack: p.tecnologias || [],
    vivo: p.enlaces?.vivo || null, codigo: p.enlaces?.codigo || null,
    ficha: nombreIdx(`proyectos/${p.slug}/`), caps: (p.capturas || []).map(cap)
  }));

  const nombres = (slugs) => (slugs || []).map((s) => pub.find((p) => p.slug === s)?.nombre).filter(Boolean).slice(0, 5);
  const slabs = habilidades.map((h) => ({ id: h.id, title: h.titulo, text: h.texto, items: nombres(h.proyectos), link: true }));
  slabs.push({ id: "pila", title: T.stackTitle, text: T.stackText, items: (sobre.pila || []).map((x) => x.nombre).slice(0, 6) });
  slabs.push({ id: "formacion", title: T.eduTitle, text: T.eduText, items: (sobre.formacion || []).map((f) => f.etapa) });
  slabs.push({ id: "laboratorio", title: T.labTitle, text: T.labText, items: [...pub.filter((p) => /desarrollo|development/i.test(p.estado || "")).map((p) => p.nombre).slice(0, 4), "IVANDEV OS"] });
  if (sobre.clasificado) slabs.push({ id: "clasificado", title: sobre.clasificado.titulo, text: sobre.clasificado.texto, lines: sobre.clasificado.lineas || 4, classified: true });

  const steps = [
    { id: "arranque", k: "01", t: T.stBoot, at: "start", main: true, text: T.txBoot },
    { id: "proyectos", k: "02", t: T.stProjects, at: "roster", main: true, text: T.txProjects },
    { id: "sistemas", k: "03", t: T.stMachines, at: "hardware", main: true, text: `<span class="pr">&gt; whoami</span><br>${esc(sobre.intro?.[0] || "")}` },
    ...(sobre.como_trabajo || []).map((c, i, a) => ({ id: "w" + i, t: c.titulo, from: "hardware", to: "hardwareEnd", f: (i + 1) / (a.length + 1), sub: true, text: esc(c.texto) })),
    { id: "descenso", k: "04", t: T.stDescent, at: "d1", main: true, text: T.txDescent },
    { id: "contacto", k: "05", t: T.stContact, at: "contact", main: true, text: "" }
  ];

  const cfg = {
    name: config.nombre_publico, alias: config.alias, github: config.github || null, mail: config.correo === PC ? "" : config.correo,
    linkedin: config.perfiles?.linkedin && config.perfiles.linkedin !== PC ? config.perfiles.linkedin : null,
    tagline: EN ? "Second-year ASIR student in Madrid and self-taught web developer." : "Estudiante de 2.º de ASIR en Madrid y desarrollador web autodidacta.",
    busco: sobre.busco || ""
  };
  const links = { classic: nombreIdx("clasica/"), simple: nombreIdx("proyectos/"), legal: nombreIdx("legal/"), os: nombreIdx("laboratorio/os/"), other: (EN ? "../" : "en/") + (ARCHIVO ? "index.html" : ""), otherLang: EN ? "ES" : "EN", root: raiz, lang: idioma };

  const js = `/* Generado por herramientas/inmersivo.mjs — no editar a mano (edita datos/ y vuelve a compilar) */
window.IV=window.IV||{};
IV.DATA=${jsStr(links)};
IV.UI=${jsStr(T)};
IV.CONFIG=Object.assign(IV.CONFIG||{},${jsStr(cfg)});
IV.CATS=${jsStr(cats.map((c) => ({ id: c.id, label: c.corto, name: c.nombre, color: c.color, text: c.texto })))};
IV.PROJECTS=${jsStr(proyectos)};
IV.SLABS=${jsStr(slabs)};
IV.STEPS=${jsStr(steps)};
`;

  /* lista de proyectos legible por buscadores y lectores de pantalla (la escena 3D no lo es) */
  const lista = `<ul>${proyectos.map((p) => `<li><a href="${esc(p.ficha)}">${esc(p.n)}</a> — ${esc(p.resumen)}</li>`).join("")}</ul>`;
  const assets = (EN ? "../" : "") + "inmersivo/";
  const sub = {
    ...T, assets, root: raiz, datos: assets + "datos-" + idioma + ".js", classicHref: links.classic, simpleHref: links.simple, topHref: (EN ? "" : "") + (ARCHIVO ? "index.html" : "./"), legalHref: links.legal, otherHref: links.other, otherLang: links.otherLang,
    name: esc(config.nombre_publico), proyectosLista: lista
  };
  let html = await readFile(path.join(SRC, "index.template.html"), "utf8");
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in sub ? sub[k] : (() => { throw new Error("Falta la clave de plantilla: " + k); })()));
  if (html.includes(PC)) throw new Error("La página inmersiva contiene " + PC);

  await mkdir(path.join(DIST, EN ? "en" : "."), { recursive: true });
  await writeFile(path.join(DIST, EN ? "en/index.html" : "index.html"), html);
  await writeFile(path.join(comun, "datos-" + idioma + ".js"), js);
  return { n: proyectos.length, slabs: slabs.length };
}

/* recursos compartidos (se copian una vez, en dist/inmersivo/) */
const comun = path.join(DIST, "inmersivo");
await mkdir(comun, { recursive: true });
for (const d of ["css", "js", "vendor"]) await cp(path.join(SRC, d), path.join(comun, d), { recursive: true });

/* Primera captura de cada proyecto incrustada (data URI): así los paneles 3D funcionan también abriendo con doble clic,
   donde el navegador no deja usar como textura una imagen local. El resto de la galería carga por HTTP. */
{
  const { proyectos } = await leer("datos/proyectos.json");
  const caps = {};
  for (const p of proyectos.filter((x) => x.publicar === true && x.capturas?.[0])) {
    const f = path.join(RAIZ, "src", p.capturas[0].src);
    if (existsSync(f)) caps[p.capturas[0].src] = "data:image/webp;base64," + (await readFile(f)).toString("base64");
  }
  await writeFile(path.join(comun, "capturas.js"), "window.IV=window.IV||{};IV.CAPS=" + JSON.stringify(caps) + ";\n");
}

const es = await escribe("es");
const en = await escribe("en");
console.log(`Inmersivo: ${es.n} proyectos publicados, ${es.slabs} capas · dist/index.html y dist/en/index.html`);
