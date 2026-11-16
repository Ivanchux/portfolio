// Genera la versión SIMPLE: una sola página ligera, sin JavaScript ni animaciones, con todo el contenido
// (proyectos por categoría, qué sé hacer, sobre mí y contacto). Sale de los mismos datos que las otras versiones.
//   dist/simple/index.html      → español
//   dist/en/simple/index.html   → inglés
// Reglas heredadas: solo `publicar: true`, nada con POR_CONFIRMAR, sin precios y sin recursos de terceros.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UI_POR_DEFECTO } from "./textos-inmersivo.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(RAIZ, process.env.SALIDA || "dist");
const PC = "POR_CONFIRMAR";
const ARCHIVO = !!process.env.ARCHIVO;
const leer = async (f) => JSON.parse(await readFile(path.join(RAIZ, f), "utf8"));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const limpia = (v) => (v === PC ? null : Array.isArray(v) ? v.filter((x) => x !== PC && x != null).map(limpia) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, limpia(x)])) : v);

/* textos propios de esta página (el resto sale de los de la experiencia 3D) */
const T_SIMPLE = {
  es: { lead: "Versión ligera: una sola página, sin animaciones ni JavaScript.", skills: "Qué sé hacer", about: "Sobre mí", how: "Cómo trabajo", stack: "Pila técnica", edu: "Formación", lab: "Experimentos", top: "↑ Volver arriba", skip: "Saltar al contenido", shots: "capturas", more: "Ficha completa" },
  en: { lead: "Light version: a single page, with no animations or JavaScript.", skills: "What I do", about: "About me", how: "How I work", stack: "Tech stack", edu: "Education", lab: "Experiments", top: "↑ Back to top", skip: "Skip to content", shots: "screenshots", more: "Full page" }
};

async function datos(idioma) {
  const EN = idioma === "en";
  const idm = async (f) => (EN && existsSync(path.join(RAIZ, "datos/en", f)) ? leer("datos/en/" + f) : leer("datos/" + f));
  const config = await leer("site.config.json");
  if (process.env.CORREO) config.correo = process.env.CORREO;
  const { proyectos } = await leer("datos/proyectos.json");
  const { habilidades } = await idm("habilidades.json");
  const { categorias } = await idm("categorias.json");
  const { _nota, ...sobre } = await idm("sobre-mi.json");
  if (EN) {
    const { proyectos: tr } = await leer("datos/en/proyectos.json");
    for (const p of proyectos) { const t = tr[p.slug]; if (!t) continue; for (const k of ["estado", "resumen", "descripcion", "problema", "papel", "datos_medidos", "pendiente"]) if (t[k]) p[k] = t[k]; (t.alts || []).forEach((alt, i) => { if (p.capturas?.[i]) p.capturas[i].alt = alt; }); }
  }
  return { config, pub: proyectos.filter((p) => p.publicar === true).map(limpia), categorias, habilidades, sobre };
}

const CSS = `
@font-face{font-family:"Atkinson Next";src:url("{R}fuentes/atkinson-hyperlegible-next-latin-400-normal.woff2") format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Atkinson Next";src:url("{R}fuentes/atkinson-hyperlegible-next-latin-700-normal.woff2") format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:"Chakra Petch";src:url("{R}fuentes/chakra-petch-latin-600-normal.woff2") format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:"Departure Mono";src:url("{R}fuentes/departure-mono-regular.woff2") format("woff2");font-weight:400;font-display:swap}
:root{--bg:#eef9fd;--fg:#0c2431;--mu:#44606d;--card:#fff;--ln:#bfe0ec;--ac:#0a6a78;--ac2:#0e7a6d;color-scheme:light dark;
  --t:"Atkinson Next","Segoe UI",system-ui,sans-serif;--h:"Chakra Petch","Atkinson Next",system-ui,sans-serif;--m:"Departure Mono",ui-monospace,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#071a24;--fg:#e8f6fb;--mu:#a3c3d0;--card:#0d2a38;--ln:#1f4a5e;--ac:#7fdcea;--ac2:#3fc7b5}}
*{box-sizing:border-box;margin:0}
body{background:linear-gradient(180deg,color-mix(in srgb,var(--ac) 14%,var(--bg)),var(--bg) 360px) no-repeat,var(--bg);color:var(--fg);font:1.05rem/1.65 var(--t)}
a{color:var(--ac)}a:focus-visible{outline:3px solid var(--ac);outline-offset:3px}
.salto{position:absolute;left:-999px}.salto:focus{left:8px;top:8px;background:var(--card);padding:8px 12px;z-index:9}
.wrap{max-width:62rem;margin:0 auto;padding:0 1.25rem}
header.top{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding:1rem 0}
header.top strong{font:600 1.05rem var(--h);letter-spacing:.04em}
.versiones{display:flex;gap:2px;padding:2px;border:1px solid var(--ln);border-radius:99px;background:var(--card)}
.versiones a{padding:.2rem .7rem;border-radius:99px;font:600 .8rem var(--h);text-decoration:none;color:var(--fg)}
.versiones a[aria-current]{background:var(--ac2);color:#fff}
.idioma{font:600 .8rem var(--h);margin-left:.5rem}
h1{font:600 clamp(2rem,6vw,3.4rem)/1.05 var(--h);margin:2rem 0 .6rem}
.lead{font-size:1.2rem;color:var(--mu);max-width:42rem}.nota{font:.85rem var(--m);color:var(--mu);margin-top:.8rem}
nav.indice{display:flex;gap:.5rem;flex-wrap:wrap;margin:1.4rem 0 2rem}
nav.indice a{padding:.3rem .9rem;border:1px solid var(--ln);border-radius:99px;background:var(--card);text-decoration:none;font:600 .85rem var(--h);color:var(--fg)}
nav.indice a:hover{border-color:var(--ac)}
h2{font:600 1.7rem var(--h);margin:3rem 0 .4rem;scroll-margin-top:1rem}h3{font:600 1.15rem var(--h)}
.cat{display:flex;align-items:center;gap:.6rem;margin:2.2rem 0 .3rem;font:600 1.3rem var(--h)}
.cat i{width:.9rem;height:.9rem;border-radius:50%}.cat small{font:.8rem var(--m);color:var(--mu)}
.cat-t{color:var(--mu);max-width:44rem;margin-bottom:1rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:1rem;list-style:none;padding:0}
.card{background:var(--card);border:1px solid var(--ln);border-top:4px solid var(--c);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;height:100%}
.card img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;display:block;background:var(--ln)}
.card div{padding:.9rem 1rem 1rem;display:flex;flex-direction:column;gap:.45rem;flex:1}
.estado{font:.72rem var(--m);text-transform:uppercase;color:var(--mu)}
.chips{display:flex;gap:.3rem;flex-wrap:wrap;list-style:none;padding:0}.chips li{font:.72rem var(--m);padding:.05rem .5rem;border:1px solid var(--ln);border-radius:99px}
.enl{display:flex;gap:.8rem;flex-wrap:wrap;margin-top:auto;padding-top:.4rem;font-weight:700}
.dos{display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:1rem}
.caja{background:var(--card);border:1px solid var(--ln);border-radius:14px;padding:1rem 1.1rem}.caja p{color:var(--mu);margin-top:.3rem}
ul.lista{padding-left:1.2rem}ul.lista li{margin:.25rem 0}
.contacto a.bt{display:inline-block;margin:.3rem .5rem .3rem 0;padding:.55rem 1.1rem;border-radius:99px;background:var(--ac2);color:#fff;font:600 .95rem var(--h);text-decoration:none}
footer{margin:4rem 0 2rem;padding-top:1rem;border-top:1px solid var(--ln);color:var(--mu);font-size:.9rem;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}
`;

async function escribe(idioma) {
  const EN = idioma === "en", { config, pub, categorias, habilidades, sobre } = await datos(idioma);
  const U = { ...UI_POR_DEFECTO[idioma], ...((existsSync(path.join(RAIZ, "datos/inmersivo-textos.json")) ? JSON.parse(await readFile(path.join(RAIZ, "datos/inmersivo-textos.json"), "utf8")) : {})[idioma] || {}) };
  const S = T_SIMPLE[idioma], R = EN ? "../../" : "../", idx = ARCHIVO ? "index.html" : "", L = "../";   // L: raíz de las páginas de este idioma (la simple está un nivel por debajo)
  const nombres = (slugs) => (slugs || []).map((s) => pub.find((p) => p.slug === s)).filter(Boolean);
  const enlace = (p) => `${L}${EN ? "" : ""}proyectos/${p.slug}/${idx}`;
  const cats = categorias.filter((c) => pub.some((p) => p.categoria === c.id));
  const correo = config.correo && config.correo !== PC ? config.correo : "";
  const linkedin = config.perfiles?.linkedin && config.perfiles.linkedin !== PC ? config.perfiles.linkedin : "";
  const tarjeta = (p, c) => {
    const im = p.capturas?.[0];
    return `<li><article class="card" style="--c:${esc(p.color_disco || c.color)}">${im ? `<img src="${R}${esc(im.src)}" width="${im.ancho}" height="${im.alto}" alt="${esc(im.alt)}" loading="lazy" decoding="async">` : ""}<div>
<h4><a href="${enlace(p)}">${esc(p.nombre)}</a></h4>${p.estado ? `<span class="estado">${esc(p.estado)}</span>` : ""}<p>${esc(p.resumen)}</p>
${p.tecnologias?.length ? `<ul class="chips">${p.tecnologias.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
<p class="enl">${p.enlaces?.vivo ? `<a href="${esc(p.enlaces.vivo)}" rel="noopener">${esc(U.live.replace("▶ ", ""))}</a>` : ""}${p.enlaces?.codigo ? `<a href="${esc(p.enlaces.codigo)}" rel="noopener">${esc(U.code)}</a>` : ""}<a href="${enlace(p)}">${esc(S.more)}</a></p></div></article></li>`;
  };
  const secProyectos = cats.map((c) => { const l = pub.filter((p) => p.categoria === c.id); return `<h3 class="cat"><i style="background:${esc(c.color)}" aria-hidden="true"></i>${esc(c.nombre)} <small>${l.length}</small></h3><p class="cat-t">${esc(c.texto)}</p><ul class="grid">${l.map((p) => tarjeta(p, c)).join("")}</ul>`; }).join("");
  const secHab = `<div class="dos">${habilidades.map((h) => `<div class="caja"><h3>${esc(h.titulo)}</h3><p>${esc(h.texto)}</p>${nombres(h.proyectos).length ? `<p>${nombres(h.proyectos).map((p) => `<a href="${enlace(p)}">${esc(p.nombre)}</a>`).join(" · ")}</p>` : ""}</div>`).join("")}</div>`;
  const secSobre = `${(sobre.intro || []).map((t) => `<p>${esc(t)}</p>`).join("")}
<h3 style="margin-top:1.4rem">${esc(S.how)}</h3><div class="dos">${(sobre.como_trabajo || []).map((c) => `<div class="caja"><h3>${esc(c.titulo)}</h3><p>${esc(c.texto)}</p></div>`).join("")}</div>
<div class="dos" style="margin-top:1rem"><div class="caja"><h3>${esc(S.stack)}</h3><ul class="lista">${(sobre.pila || []).map((x) => `<li>${esc(x.nombre)}${x.nota ? ` <small>(${esc(x.nota)})</small>` : ""}</li>`).join("")}</ul></div>
<div class="caja"><h3>${esc(S.edu)}</h3><ul class="lista">${(sobre.formacion || []).map((f) => `<li><strong>${esc(f.etapa)}</strong> — ${esc(f.texto)}</li>`).join("")}</ul></div></div>
${sobre.clasificado ? `<div class="caja" style="margin-top:1rem"><h3>${esc(sobre.clasificado.titulo)}</h3><p>${esc(sobre.clasificado.texto)} ${esc(sobre.clasificado.cierre || "")}</p></div>` : ""}`;
  const secContacto = `<p>${esc(sobre.busco || "")}</p><p class="contacto">${correo ? `<a class="bt" href="mailto:${esc(correo)}">${esc(U.mail)}</a>` : ""}${config.github ? `<a class="bt" href="${esc(config.github)}" rel="noopener">GitHub</a>` : ""}${linkedin ? `<a class="bt" href="${esc(linkedin)}" rel="noopener">LinkedIn</a>` : ""}</p>`;

  const raizSitio = idx ? "index.html" : "";
  const html = `<!doctype html>
<html lang="${idioma}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.nombre_publico)} · ${esc(U.simpleName)}</title>
<meta name="description" content="${esc(U.desc)}">
<link rel="icon" href="${R}img/favicon.png">
<style>${CSS.replaceAll("{R}", R)}</style>
</head>
<body>
<a class="salto" href="#contenido">${esc(S.skip)}</a>
<div class="wrap">
<header class="top"><strong>${esc(config.nombre_publico)} <span style="font-weight:400;color:var(--mu)">· ${esc(config.alias)}</span></strong>
<span style="display:flex;align-items:center"><nav class="versiones" aria-label="${esc(U.versionAria)}"><a href="${L}${raizSitio}">3D</a><a href="${L}clasica/${idx}">${esc(U.classicName)}</a><a href="${EN ? "./" : "./"}${raizSitio}" aria-current="page">${esc(U.simpleName)}</a></nav>
<a class="idioma" href="${EN ? "../../simple/" : "../en/simple/"}${idx}" hreflang="${EN ? "es" : "en"}" lang="${EN ? "es" : "en"}">${EN ? "ES" : "EN"}</a></span></header>
<main id="contenido">
<h1>${esc(config.nombre_publico)}</h1>
<p class="lead">${EN ? "Second-year ASIR student in Madrid and self-taught web developer." : "Estudiante de 2.º de ASIR en Madrid y desarrollador web autodidacta."}</p>
<p class="nota">${esc(S.lead)}</p>
<nav class="indice" aria-label="${esc(U.chaptersAria)}"><a href="#proyectos">${esc(U.stProjects)}</a><a href="#habilidades">${esc(S.skills)}</a><a href="#sobre-mi">${esc(S.about)}</a><a href="#contacto">${esc(U.stContact)}</a></nav>
<section aria-labelledby="proyectos"><h2 id="proyectos">${esc(U.stProjects)} <small style="font:.9rem var(--m);color:var(--mu)">${pub.length}</small></h2>${secProyectos}</section>
<section aria-labelledby="habilidades"><h2 id="habilidades">${esc(S.skills)}</h2>${secHab}</section>
<section aria-labelledby="sobre-mi"><h2 id="sobre-mi">${esc(S.about)}</h2>${secSobre}</section>
<section aria-labelledby="contacto"><h2 id="contacto">${esc(U.stContact)}</h2>${secContacto}</section>
</main>
<footer><span>© ${esc(config.nombre_publico)} · <a href="${L}legal/${idx}">${esc(U.legal)}</a></span><a href="#">${esc(S.top)}</a></footer>
</div>
</body>
</html>
`;
  if (html.includes(PC)) throw new Error("La versión simple contiene " + PC);
  const out = path.join(DIST, EN ? "en/simple" : "simple");
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "index.html"), html);
}

await escribe("es"); await escribe("en");
console.log("Simple: dist/simple/ y dist/en/simple/");
