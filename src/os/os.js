// IVANDEV OS: mini sistema operativo de mentira.
// Se monta dentro de un contenedor (monitor del escritorio o pantalla completa) y se desmonta sin dejar rastro.

const huella = (s) => {
  let h = 0x811c9dc5;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0;
  return h;
};
const LLAVE = 140350227;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const rellenar = (t, v = {}) => t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const enlace = (url, texto, nueva = true) => `<a href="${esc(url)}"${nueva ? ' target="_blank" rel="noopener"' : ""}>${esc(texto)}</a>`;

export function montar(raiz, datos, opciones = {}) {
  const X = datos.textos;
  const SIS = datos.sistema;
  const P = datos.perfil;
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const espera = (ms) => (reducido ? 0 : ms);
  const v = { nombre: P.nombre, alias: P.alias };

  // ---------- Temporizadores y escuchas, para poder desmontar ----------
  const tiempos = new Set();
  const intervalos = new Set();
  const luego = (f, ms) => {
    const id = setTimeout(() => { tiempos.delete(id); f(); }, ms);
    tiempos.add(id);
    return id;
  };
  const cada = (f, ms) => { const id = setInterval(f, ms); intervalos.add(id); return id; };
  const escuchasDoc = [];
  const enDocumento = (tipo, f, op) => { document.addEventListener(tipo, f, op); escuchasDoc.push([tipo, f, op]); };

  // ---------- Esqueleto ----------
  raiz.classList.add("ios");
  raiz.innerHTML = `
    <div class="ios__arranque" data-r="boot" tabindex="-1"></div>
    <div class="ios__escritorio" data-r="desk" hidden>
      <svg class="ios__mapa" data-r="map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div class="ios__nodos" data-r="nodes" role="group" aria-label="Mapa del sistema"></div>
      <div class="ios__hud" data-r="hud" aria-hidden="true"></div>
      <div class="ios__iconos" data-r="icons"></div>
      <div class="ios__menu" data-r="sm" hidden role="menu" aria-label="Menú de inicio"></div>
      <div class="ios__avisos" data-r="ts" role="status" aria-live="polite"></div>
      <div class="ios__barra" data-r="bar">
        <button type="button" data-r="st" aria-expanded="false" aria-haspopup="menu">☰ inicio</button>
        <button type="button" data-a="cv">cv rápido</button>
        <div class="ios__tareas" data-r="tasks"></div>
        <button type="button" data-a="tema" aria-label="Cambiar el modo de color">tema</button>
        <button type="button" data-a="crt" aria-label="Activar o quitar el efecto CRT">crt</button>
        <span class="ios__tenue">hallazgos <b class="ios__ok" data-r="cnt"></b></span>
        <span class="ios__tenue ios__reloj" data-r="clk"></span>
        ${opciones.alSalir ? `<button type="button" data-a="salir">${esc(X.salir)}</button>` : ""}
      </div>
    </div>`;
  const $ = (r) => raiz.querySelector(`[data-r="${r}"]`);

  // ---------- Datos del sistema ----------
  const N = datos.proyectos.map((p, i) => ({ id: p.id, n: p.nombre.toUpperCase(), pid: 2101 + i * 117, d: p.resumen, ficha: p.ficha }));
  N.push({ id: "sobre-mi", n: "SOBRE_MI", pid: 1, d: rellenar(X.sobre_mi, v) });
  const contacto = () => {
    const l = [`GitHub   ${enlace(P.github, P.github.replace(/^https?:\/\//, ""))}`];
    if (P.correo) l.push(`Correo   ${enlace("mailto:" + P.correo, P.correo, false)}`);
    if (P.web) l.push(`Web      ${enlace(P.web, P.web.replace(/^https?:\/\//, ""))}`);
    if (!P.correo && !P.web) l.push(esc(X.contacto_pronto));
    if (P.contacto) l.push(enlace(P.contacto, X.contacto_pagina, false));
    return l.join("\n");
  };
  const ROOT = { id: "root", n: "/ROOT", rt: 1, d: () => esc(X.root) + "\n\n" + contacto() };
  const cuerpoNodo = (n) => (typeof n.d === "function" ? n.d() : esc(n.d) + (n.ficha ? `\n\n${enlace(n.ficha, X.ver_ficha, false)}` : ""));
  const CV = () => esc(rellenar(X.cv_cabecera, v)) + "\n\n" + N.filter((n) => n.pid > 1).map((n) => `${esc(n.n.padEnd(14))} ${esc(n.d.split("\n")[0])}`).join("\n");

  // ---------- Hallazgos ----------
  const CLAVES = [...N.map((n) => n.id), "kill", "mapper", "grub", "root"];
  const TOT = CLAVES.length;
  const F = new Set();
  const pintarContador = () => { $("cnt").textContent = `${F.size}/${TOT}`; };
  pintarContador();
  function hallar(k) {
    if (F.has(k) || !CLAVES.includes(k)) return;
    F.add(k);
    pintarContador();
    aviso(rellenar(X.hallazgo, { n: F.size, total: TOT }));
    if (F.size === TOT) {
      const p = P.contacto ? `\n\n${enlace(P.contacto, X.contacto_pagina, false)}` : "";
      ventana("fin", X.fin_titulo, esc(X.fin) + p);
    }
  }

  function aviso(m) {
    const t = document.createElement("div");
    t.className = "ios__aviso";
    t.textContent = m;
    $("ts").appendChild(t);
    luego(() => t.remove(), 3200);
  }

  // ---------- Ventanas ----------
  let R = false, z = 10, activa = null, cuenta = 0;
  const W = {};

  function tareas() {
    const t = $("tasks");
    t.replaceChildren();
    for (const id of Object.keys(W)) {
      const d = W[id], b = document.createElement("button");
      b.type = "button";
      b.textContent = d.dataset.t;
      b.className = "ios__tarea" + (id === activa && !d.classList.contains("min") ? " on" : "");
      b.onclick = () => { if (id === activa && !d.classList.contains("min")) minimizar(id); else enfocar(id, true); };
      t.appendChild(b);
      d.classList.toggle("act", id === activa);
    }
  }
  function enfocar(id, moverFoco) {
    const d = W[id];
    if (!d) return;
    d.classList.remove("min");
    d.style.zIndex = ++z;
    activa = id;
    tareas();
    if (moverFoco) (d.querySelector(".ios__cuerpo a, .ios__cuerpo button, .ios__cuerpo input, .ios__cuerpo textarea, .ios__cuerpo [tabindex='0']") || d.querySelector(".ios__cuerpo")).focus();
  }
  function minimizar(id) {
    W[id].classList.add("min");
    if (activa === id) activa = null;
    tareas();
    $("bar").querySelector(".ios__tarea")?.focus();
  }
  function cerrar(id) {
    const d = W[id];
    if (!d) return;
    const volver = d._origen;
    d._alCerrar?.();
    d.remove();
    delete W[id];
    if (activa === id) activa = null;
    tareas();
    if (volver && raiz.contains(volver)) volver.focus();
    else $("nodes").querySelector(".ios__nodo")?.focus();
  }

  function ventana(id, titulo, html, o = {}) {
    if (W[id]) { enfocar(id, true); return W[id]; }
    const area = $("desk");
    const ancho = Math.min(o.w || 440, area.clientWidth - 16);
    const k = cuenta++ % 6;
    const x = Math.max(8, Math.min(24 + k * 26, area.clientWidth - ancho - 8));
    const y = o.abajo ? Math.max(8, area.clientHeight - 230) : Math.max(8, Math.min(24 + k * 26, area.clientHeight * 0.3));
    const d = document.createElement("div");
    const tid = `ios-v-${id}`;
    d.className = "ios__ventana";
    d.dataset.t = titulo;
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-labelledby", tid);
    d.style.cssText = `left:${x}px;top:${y}px;width:${ancho}px`;
    d.innerHTML = `<div class="ios__titulo"><h2 id="${tid}" tabindex="0" title="${esc(X.mover_ventana)}">${esc(titulo)}</h2><span class="ios__botones"><button type="button" data-b="m" aria-label="Minimizar">_</button><button type="button" data-b="x" aria-label="Maximizar">□</button><button type="button" data-b="c" aria-label="Cerrar">×</button></span></div><div class="ios__cuerpo" tabindex="-1">${html}</div><i class="ios__tirador" aria-hidden="true"></i>`;
    d._origen = raiz.contains(document.activeElement) ? document.activeElement : null;
    area.appendChild(d);
    W[id] = d;

    const tb = d.firstChild, h2 = tb.firstChild;
    const maxim = () => d.classList.toggle("max");
    tb.onclick = (e) => {
      const b = e.target.closest("[data-b]")?.dataset.b;
      if (b === "c") cerrar(id);
      else if (b === "m") minimizar(id);
      else if (b === "x") maxim();
    };
    tb.ondblclick = (e) => { if (!e.target.closest("[data-b]")) maxim(); };
    d.addEventListener("pointerdown", () => { if (activa !== id) enfocar(id); });
    d.addEventListener("focusin", () => { if (activa !== id) enfocar(id); });

    // Mover y redimensionar con el ratón o el dedo
    const limitar = (nx, ny) => {
      d.style.left = Math.max(0, Math.min(area.clientWidth - 80, nx)) + "px";
      d.style.top = Math.max(0, Math.min(area.clientHeight - 90, ny)) + "px";
    };
    tb.onpointerdown = (e) => {
      if (e.target.closest("[data-b]") || d.classList.contains("max")) return;
      const dx = e.clientX - d.offsetLeft, dy = e.clientY - d.offsetTop;
      tb.setPointerCapture(e.pointerId);
      tb.onpointermove = (m) => limitar(m.clientX - dx, m.clientY - dy);
      tb.onpointerup = () => { tb.onpointermove = null; };
    };
    const rz = d.querySelector(".ios__tirador");
    rz.onpointerdown = (e) => {
      e.preventDefault(); e.stopPropagation();
      const w = d.offsetWidth, hh = d.offsetHeight, x0 = e.clientX, y0 = e.clientY;
      rz.setPointerCapture(e.pointerId);
      rz.onpointermove = (m) => { d.style.width = Math.max(240, w + m.clientX - x0) + "px"; d.style.height = Math.max(140, hh + m.clientY - y0) + "px"; };
      rz.onpointerup = () => { rz.onpointermove = null; };
    };
    // … y con el teclado, con el foco en el título
    h2.addEventListener("keydown", (e) => {
      const paso = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[e.key];
      if (!paso || d.classList.contains("max")) return;
      e.preventDefault();
      if (e.shiftKey) {
        d.style.width = Math.max(240, d.offsetWidth + paso[0]) + "px";
        d.style.height = Math.max(140, d.offsetHeight + paso[1]) + "px";
      } else limitar(d.offsetLeft + paso[0], d.offsetTop + paso[1]);
    });

    enfocar(id, o.foco !== false);
    return d;
  }

  // ---------- Mapa de capas ----------
  let escena = null;
  const ESC = {
    top: { t: X.nucleo, items: () => [{ id: "proyectos", n: X.capa_proyectos, to: "proyectos" }, { id: "sobre", n: X.capa_sobre, to: "sobre" }, { id: "sistema", n: X.capa_sistema, to: "sistema" }] },
    proyectos: { t: X.capa_proyectos, up: "top", items: () => N.filter((n) => n.pid > 1) },
    sobre: { t: X.capa_sobre, up: "top", items: () => [N.find((n) => n.pid === 1), { id: "cv", n: "CV RÁPIDO", fn: () => ventana("cv", "cv", CV()) }] },
    sistema: { t: X.capa_sistema, up: "top", items: () => [
      { id: "term", n: "TERMINAL", fn: terminal },
      { id: "ps", n: "PROCESOS", fn: procesos },
      { id: "files", n: "ARCHIVOS", fn: () => explorador(["Sistema"]) },
      { id: "mapper", n: "MAPPER.EXE", fn: mapper },
      ...(R ? [ROOT] : []),
    ] },
  };
  function abrir(n) { hallar(n.id); ventana(n.id, n.n.toLowerCase(), cuerpoNodo(n)); }

  function dibujar(enfocarId) {
    const S = escena && ESC[escena], m = $("map"), nd = $("nodes");
    m.innerHTML = "";
    nd.replaceChildren();
    const L = S ? S.items() : [];
    const anillos = L.length > 7;
    const crear = (n, clase, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ios__nodo" + clase;
      b.id = `ios-n-${n.id}`;
      b.style.left = n.x + "%";
      b.style.top = n.y + "%";
      b.style.animationDelay = i * 70 + "ms";
      b.innerHTML = n.hub
        ? `<b aria-hidden="true">◉</b>${esc(n.t)}<small>${esc(S ? X.nucleo_subir : X.nucleo_entrar)}</small>`
        : `<b aria-hidden="true">${n.to ? "◈" : n.rt ? "⚠" : "▣"}</b>${esc(n.n)}`;
      b.onclick = () => {
        if (n.hub) { escena = S ? S.up || null : "top"; dibujar(escena ? null : "hub"); }
        else if (n.to) { escena = n.to; dibujar(); }
        else if (n.fn) n.fn();
        else abrir(n);
      };
      nd.appendChild(b);
      return b;
    };
    // En contenedores estrechos y con muchos nodos: dos columnas y el núcleo arriba
    const columnas = L.length > 5 && raiz.clientWidth < 600;
    const cy = columnas ? 9 : 46;
    L.forEach((n, i) => {
      if (columnas) {
        const filas = Math.ceil(L.length / 2);
        n.x = i % 2 ? 73 : 27;
        n.y = 24 + (Math.floor(i / 2) * 60) / Math.max(1, filas - 1);
      } else {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / L.length;
        const r = anillos && i % 2 ? 0.62 : 1;
        n.x = 50 + 38 * r * Math.cos(a);
        n.y = 46 + 34 * r * Math.sin(a);
      }
      m.insertAdjacentHTML("beforeend", `<line class="${n.rt ? "rt" : ""}" x1="50" y1="${cy}" x2="${n.x}" y2="${n.y}"/>`);
      crear(n, n.rt ? " rt" : "", i + 1);
    });
    const hub = crear({ hub: 1, t: S ? S.t : X.nucleo, x: 50, y: cy, id: "hub" }, S ? " hub" : " hub core", 0);
    // El foco no se pierde al cambiar de capa
    const destino = enfocarId ? nd.querySelector(`#ios-n-${enfocarId}`) : nd.querySelector(".ios__nodo:not(.hub)") || hub;
    if (raiz.contains(document.activeElement) || document.activeElement === document.body) destino?.focus();
  }

  // ---------- Procesos ----------
  let tictac = null;
  function procesos() {
    const d = ventana("ps", "procesos", "", { w: 470 });
    if (d._i) return;
    d._i = 1;
    const b = d.querySelector(".ios__cuerpo");
    const filas = N.map((n) => `<tr><td>${n.pid}</td><td>${esc(n.id)}</td><td data-c></td><td><button type="button" data-k="${n.pid}" aria-label="kill ${esc(n.id)}">kill</button></td></tr>`).join("");
    b.innerHTML = `<table><tr class="ios__tenue"><th scope="col">PID</th><th scope="col">PROCESO</th><th scope="col">CPU</th><th scope="col"><span class="ios__oculto">acción</span></th></tr>${filas}</table><div class="ios__aviso-ps" aria-live="polite"></div>`;
    b.onclick = (e) => {
      const k = e.target.dataset.k;
      if (k) matar(+k, (t) => { b.querySelector(".ios__aviso-ps").textContent = t; });
    };
    const tick = () => b.querySelectorAll("[data-c]").forEach((c) => {
      const val = Math.floor(Math.random() * 90) + 2;
      c.innerHTML = `<span class="ios__cpu" style="width:${val}px"></span> ${val}%`;
    });
    tick();
    b.querySelector("button").focus();
    if (!reducido) tictac = cada(tick, 900);
    d._alCerrar = () => { clearInterval(tictac); intervalos.delete(tictac); };
  }
  function matar(pid, decir) {
    const n = N.find((x) => x.pid === pid);
    if (!n) return decir(X.kill_no_existe);
    if (pid === 1) return decir(X.kill_init);
    hallar("kill");
    decir(rellenar(X.kill_hecho, { proceso: n.id, mensaje: n.d.split("\n")[0] }));
  }

  // ---------- Terminal ----------
  function terminal() {
    if (W.term) return enfocar("term", true);
    const d = ventana("term", "tty0 · " + (R ? "root" : "guest"), `<div class="ios__salida" aria-live="polite"></div><input class="ios__entrada" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Terminal: escribe un comando">`, { w: 520 });
    const o = d.querySelector(".ios__salida"), i = d.querySelector(".ios__entrada"), pr = R ? "root#" : "guest$";
    const decir = (h) => { const e = document.createElement("div"); e.innerHTML = h; o.appendChild(e); d.querySelector(".ios__cuerpo").scrollTop = 1e9; };
    const decirTexto = (t) => decir(esc(t));
    const T = {
      help: () => decirTexto(X.term_ayuda),
      ls: () => decirTexto(N.concat(R ? [ROOT] : []).map((n) => n.id).join("   ")),
      cat: (a) => { const n = [...N, ROOT].find((x) => x.id === a[0]); n && (n !== ROOT || R) ? decir(cuerpoNodo(n)) : decirTexto(X.term_cat_error); },
      ping: (a) => {
        const n = N.find((x) => x.id === a[0]);
        if (!n) return decirTexto(X.term_ping_error);
        const e = raiz.querySelector(`#ios-n-${CSS.escape(n.id)}`);
        if (e && !reducido) { e.classList.add("pulso"); luego(() => e.classList.remove("pulso"), 1600); }
        decirTexto(rellenar(X.term_ping, { nodo: n.id, ms: Math.floor(Math.random() * 9) + 1 }));
      },
      ps: () => decirTexto(N.map((n) => n.pid + "  " + n.id).join("\n")),
      kill: (a) => matar(+a[0], decirTexto),
      cv: () => decir(CV()),
      contact: () => (R ? decir(ROOT.d()) : decirTexto(X.term_contact_guest)),
      mapper: () => mapper(),
      clear: () => o.replaceChildren(),
    };
    const historial = [];
    let pos = 0;
    decirTexto(X.term_bienvenida);
    i.onkeydown = (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (!historial.length) return;
        e.preventDefault();
        pos = Math.max(0, Math.min(historial.length, pos + (e.key === "ArrowUp" ? -1 : 1)));
        i.value = historial[pos] ?? "";
        return;
      }
      if (e.key !== "Enter") return;
      const val = i.value.trim();
      i.value = "";
      if (val) historial.push(val);
      pos = historial.length;
      decir(`<span class="ios__ok">${pr}</span> ${esc(val)}`);
      const [c, ...a] = val.split(/\s+/);
      if (c) Object.hasOwn(T, c) ? T[c](a) : decirTexto(rellenar(X.term_no_encontrado, { comando: c }));
    };
    i.focus();
  }

  // ---------- mapper.exe ----------
  function analizar(t) {
    const S = {};
    let sec = "", cur = null, clave = null;
    t.split("\n").forEach((l) => {
      if (!l.trim() || l.trim()[0] === "#") return;
      const ind = l.search(/\S/), s = l.trim();
      if (ind === 0) { sec = s.replace(/:.*$/, ""); cur = null; clave = null; return; }
      if (sec !== "services") return;
      const m = s.match(/^([\w.-]+):\s*(.*)$/);
      if (ind === 2 && m) { cur = m[1]; S[cur] = { image: "", ports: [], dep: [] }; clave = null; return; }
      if (!cur) return;
      if (ind === 4 && m) { clave = m[1]; if (clave === "image") S[cur].image = m[2]; return; }
      if (s[0] === "-" && clave) {
        const val = s.slice(1).trim().replace(/^["']|["']$/g, "");
        if (clave === "ports") S[cur].ports.push(val);
        else if (clave === "depends_on") S[cur].dep.push(val);
      } else if (ind === 6 && clave === "depends_on" && m) S[cur].dep.push(m[1]);
    });
    return S;
  }
  function mapper() {
    const d = ventana("map", "mapper.exe", "", { w: 560 });
    if (d._i) return;
    d._i = 1;
    const b = d.querySelector(".ios__cuerpo"), caidos = new Set();
    b.innerHTML = `<p class="ios__tenue" id="ios-mapper-ayuda">${esc(X.mapper_ayuda)}</p><textarea class="ios__compose" spellcheck="false" aria-labelledby="ios-mapper-ayuda">${esc(SIS.compose_ejemplo)}</textarea><button type="button" data-g>${esc(X.mapper_boton)}</button><div class="ios__mapper"></div>`;
    const ta = b.querySelector("textarea"), o = b.querySelector(".ios__mapper");
    const generar = () => {
      const S = analizar(ta.value), k = Object.keys(S);
      caidos.clear();
      if (ta.value !== SIS.compose_ejemplo) hallar("mapper");
      if (!k.length) { o.innerHTML = `<p class="ios__aviso-txt">${esc(X.mapper_vacio)}</p>`; return; }
      const nv = {};
      k.forEach((s) => (nv[s] = 0));
      for (let i = 0; i < k.length; i++) k.forEach((s) => S[s].dep.forEach((x) => { if (x in nv) nv[x] = Math.max(nv[x], nv[s] + 1); }));
      const filas = {};
      k.forEach((s) => (filas[nv[s]] = filas[nv[s]] || []).push(s));
      const H = Object.keys(filas).length, pos = {};
      Object.entries(filas).forEach(([r, a]) => a.forEach((s, i) => { pos[s] = { x: ((i + 0.5) * 400) / a.length, y: 30 + r * 80, w: Math.min(120, 400 / a.length - 8) }; }));
      let g = "";
      k.forEach((s) => S[s].dep.forEach((x) => { if (pos[x]) g += `<line x1="${pos[s].x}" y1="${pos[s].y + 16}" x2="${pos[x].x}" y2="${pos[x].y - 16}" marker-end="url(#ios-flecha)"/>`; }));
      k.forEach((s) => {
        const p = pos[s];
        g += `<g class="ios__servicio" data-s="${esc(s)}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(s)}, ${esc(S[s].image || "sin imagen")}"><rect x="${p.x - p.w / 2}" y="${p.y - 16}" width="${p.w}" height="32"/><text x="${p.x}" y="${p.y - 3}" text-anchor="middle">${esc(s)}</text><text x="${p.x}" y="${p.y + 10}" text-anchor="middle" class="sm">${esc(S[s].image)}</text></g>`;
      });
      o.innerHTML = `<svg viewBox="0 0 400 ${H * 80 + 10}" width="100%" role="group" aria-label="Mapa de servicios"><defs><marker id="ios-flecha" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="currentColor"/></marker></defs>${g}</svg><p class="ios__tenue" aria-live="polite" data-info>${esc(X.mapper_pulsa)}</p>`;
      const pintar = () => {
        const af = new Set(caidos);
        let cambio = 1;
        while (cambio) { cambio = 0; k.forEach((s) => { if (!af.has(s) && S[s].dep.some((x) => af.has(x))) { af.add(s); cambio = 1; } }); }
        o.querySelectorAll(".ios__servicio").forEach((e) => {
          const s = e.dataset.s;
          e.classList.toggle("caido", caidos.has(s));
          e.classList.toggle("afectado", af.has(s) && !caidos.has(s));
          e.setAttribute("aria-pressed", String(caidos.has(s)));
        });
        const f = [...af].filter((s) => !caidos.has(s));
        o.querySelector("[data-info]").textContent = caidos.size ? rellenar(X.mapper_caido, { caidos: [...caidos].join(", "), afectados: f.join(", ") || X.mapper_ninguno }) : X.mapper_pulsa;
      };
      o.querySelectorAll(".ios__servicio").forEach((e) => {
        const alternar = () => { const s = e.dataset.s; caidos.has(s) ? caidos.delete(s) : caidos.add(s); pintar(); };
        e.onclick = alternar;
        e.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); alternar(); } };
      });
    };
    b.querySelector("[data-g]").onclick = generar;
    generar();
    ta.focus();
  }

  // ---------- Explorador ----------
  const ARBOL = () => ({
    Proyectos: Object.fromEntries(N.filter((n) => n.pid > 1).map((n) => [n.id + ".app", n])),
    Documentos: { "sobre_mi.txt": N.find((n) => n.id === "sobre-mi"), "cv.txt": "@cv" },
    Sistema: { ...SIS.sistema, root: "@root" },
    Papelera: SIS.papelera,
  });
  function explorador(ruta) {
    const d = ventana("exp", "explorador", `<div><button type="button" class="ios__atras" aria-label="Subir una carpeta">←</button> <span class="ios__tenue ios__ruta"></span></div><div class="ios__lista"></div>`, { w: 480 });
    if (!d._i) { d._i = 1; d._p = []; d.querySelector(".ios__atras").onclick = () => { d._p.pop(); listar(d); }; }
    if (ruta) d._p = ruta;
    listar(d);
  }
  function listar(d) {
    const n = d._p.reduce((a, k) => a[k], ARBOL()), el = d.querySelector(".ios__lista");
    d.querySelector(".ios__ruta").textContent = "/" + d._p.join("/");
    el.replaceChildren();
    Object.entries(n).forEach(([k, val]) => {
      const dir = typeof val === "object" && val.d === undefined;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ios__archivo";
      b.innerHTML = `<b aria-hidden="true">${dir ? "▤" : "▫"}</b>${esc(k)}${dir ? "/" : ""}`;
      b.onclick = () => {
        if (dir) { d._p.push(k); listar(d); el.querySelector("button")?.focus(); }
        else if (val === "@cv") ventana("cv", "cv", CV());
        else if (val === "@root") R ? abrir(ROOT) : aviso(X.permiso_denegado);
        else if (typeof val === "string") ventana("f-" + k, k, esc(val));
        else abrir(val);
      };
      el.appendChild(b);
    });
  }

  // ---------- Ajustes, menú e iconos ----------
  const MODOS = window.modoPantalla?.MODOS || ["verde", "ambar", "hielo"];
  const NOMBRE_MODO = { verde: "fósforo verde", ambar: "ámbar", hielo: "hielo" };
  const cambiarModo = (m) => window.modoPantalla?.poner(m);
  function ajustes() {
    const d = ventana("set", "ajustes", `<b>Tema</b>\n${MODOS.map((m) => `<button type="button" data-t="${m}">${NOMBRE_MODO[m]}</button>`).join(" ")}\n\n<b>Pantalla</b>\n<button type="button" data-crt>efecto CRT: alternar</button>\n\n<b>Acerca de</b>\n${esc(X.version)}\nnúcleo: JavaScript vanilla\nusuario: ${R ? "root" : "guest"}\nhallazgos: <span data-h>${F.size}/${TOT}</span>`);
    d.querySelector("[data-h]").textContent = `${F.size}/${TOT}`;
    if (d._i) return;
    d._i = 1;
    d.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => cambiarModo(b.dataset.t)));
    d.querySelector("[data-crt]").onclick = () => raiz.classList.toggle("ios--sin-crt");
  }
  const APPS = [["▤", "Explorador", () => explorador()], [">_", "Terminal", terminal], ["≣", "Procesos", procesos], ["⌘", "Mapper", mapper], ["⚙", "Ajustes", ajustes], ["◉", "CV rápido", () => ventana("cv", "cv", CV())]];
  [APPS[0], APPS[1], APPS[2], APPS[3], ["▢", "Papelera", () => explorador(["Papelera"])]].forEach(([i, t, f]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ios__icono";
    b.innerHTML = `<b aria-hidden="true">${i}</b>${t}`;
    b.onclick = f;
    $("icons").appendChild(b);
  });
  const botonInicio = $("st");
  function cerrarMenu(devolver) {
    $("sm").hidden = true;
    botonInicio.setAttribute("aria-expanded", "false");
    if (devolver) botonInicio.focus();
  }
  function menu() {
    const m = $("sm");
    if (!m.hidden) return cerrarMenu(true);
    m.replaceChildren();
    const add = ([i, t, f]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.innerHTML = `<b aria-hidden="true">${i}</b>${t}`;
      b.onclick = () => { cerrarMenu(false); f(); };
      m.appendChild(b);
    };
    APPS.forEach(add);
    m.insertAdjacentHTML("beforeend", "<hr>");
    [["↻", "Reiniciar", () => energia(true)], ["⏻", "Apagar", () => energia(false)]].forEach(add);
    m.hidden = false;
    botonInicio.setAttribute("aria-expanded", "true");
    m.querySelector("button").focus();
  }
  $("sm").addEventListener("keydown", (e) => {
    const bs = [...$("sm").querySelectorAll("button")], i = bs.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
  });
  botonInicio.onclick = (e) => { e.stopPropagation(); menu(); };
  enDocumento("click", (e) => { if (!$("sm").hidden && !$("sm").contains(e.target)) cerrarMenu(false); });
  $("bar").addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "cv") ventana("cv", "cv", CV());
    if (a === "tema") cambiarModo(MODOS[(MODOS.indexOf(window.modoPantalla?.actual() || "verde") + 1) % MODOS.length]);
    if (a === "crt") raiz.classList.toggle("ios--sin-crt");
    if (a === "salir") opciones.alSalir();
  });

  // Esc: cierra la ventana con el foco, luego el menú, luego sube de capa
  raiz.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || $("desk").hidden) return;
    const v = e.target.closest?.(".ios__ventana");
    if (v) { e.preventDefault(); cerrar(Object.keys(W).find((k) => W[k] === v)); return; }
    if (!$("sm").hidden) { e.preventDefault(); cerrarMenu(true); return; }
    if (escena) { e.preventDefault(); escena = ESC[escena].up || null; dibujar(escena ? null : "hub"); }
  });

  // ---------- HUD y reloj ----------
  const t0 = Date.now(), dos = (n) => String(n).padStart(2, "0");
  const hud = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    $("hud").textContent = `${X.version}\nnodo: ${X.nodo}\nusuario: ${R ? "root" : "guest"}\nprofundidad: ${escena ? (escena === "top" ? 1 : 2) : 0}\nuptime: ${dos(Math.floor(s / 60))}:${dos(s % 60)}`;
    $("clk").textContent = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };
  hud();
  cada(hud, 1000);

  // ---------- Arranque ----------
  function iniciar(root, recuperacion) {
    R = root;
    $("boot").hidden = true;
    $("desk").hidden = false;
    escena = null;
    dibujar("hub");
    aviso(rellenar(X.sesion_iniciada, { usuario: root ? "root" : "guest" }));
    if (root) { hallar("grub"); hallar("root"); ventana("root", X.root_titulo, ROOT.d()); }
    else ventana("hola", recuperacion ? X.recuperacion_titulo : X.leeme_titulo, recuperacion ? CV() : esc(X.leeme), { abajo: true, w: 360, foco: false });
  }

  let sel = 0;
  function grub() {
    const b = $("boot");
    b.innerHTML = `<pre>${esc(X.grub_titulo)}\n</pre><div class="ios__grub" role="listbox" aria-label="Entradas de arranque">${X.grub_entradas.map((t, i) => `<button type="button" role="option" class="ios__entrada-grub${i === sel ? " sel" : ""}" aria-selected="${i === sel}" data-i="${i}">${esc(t)}</button>`).join("")}</div><p class="ios__tenue">${esc(X.grub_ayuda)}</p><button type="button" data-editar>${esc(X.grub_editar)}</button>`;
    const entradas = [...b.querySelectorAll("[data-i]")];
    entradas.forEach((x) => {
      x.onclick = () => { sel = +x.dataset.i; arrancar(); };
      x.onkeydown = (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + entradas.length) % entradas.length;
          grub();
        } else if (e.key === "e" || e.key === "E") { e.preventDefault(); editar(); }
      };
    });
    b.querySelector("[data-editar]").onclick = editar;
    entradas[sel].focus();
  }
  function arrancar() { sel === 1 ? iniciar(false, true) : login(); }
  function login() {
    const b = $("boot");
    b.innerHTML = `<pre>${esc(X.login_cabecera)}\n\n${new Date().toLocaleTimeString("es-ES")}\n\n</pre><button type="button" data-login>${esc(X.login_boton)}</button><p class="ios__tenue">${esc(X.login_nota)}</p>`;
    const l = b.querySelector("[data-login]");
    l.onclick = () => { b.innerHTML = `<pre>${esc(X.login_cargando)}</pre>`; luego(() => iniciar(false, false), espera(700)); };
    // Se enfoca en el siguiente ciclo: la misma pulsación de Intro no debe activarlo
    luego(() => l.focus(), 0);
  }
  function editar() {
    const b = $("boot");
    b.innerHTML = `<pre>${esc(X.grub_editando)}\n\n</pre><input class="ios__linea" value="${esc(X.grub_linea)}" aria-label="Línea del kernel" autocomplete="off" autocapitalize="off" spellcheck="false">`;
    const i = b.querySelector("input");
    i.focus();
    i.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); iniciar(i.value.split(/\s+/).some((t) => huella(t) === LLAVE), false); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); grub(); }
    };
  }
  function energia(reiniciar) {
    Object.keys(W).forEach((id) => { W[id]._alCerrar?.(); W[id].remove(); delete W[id]; });
    activa = null;
    tareas();
    R = false;
    cerrarMenu(false);
    $("desk").hidden = true;
    const b = $("boot");
    b.hidden = false;
    sel = 0;
    if (reiniciar) { b.innerHTML = `<pre>${esc(X.reiniciando)}</pre>`; b.focus(); luego(grub, espera(900)); }
    else {
      b.innerHTML = `<pre>${esc(X.apagado)}</pre><button type="button" data-on>${esc(X.encender)}</button>`;
      const on = b.querySelector("[data-on]");
      on.onclick = () => energia(true);
      on.focus();
    }
  }

  if (opciones.sinArranque) iniciar(false, false);
  else {
    const b = $("boot");
    b.focus();
    if (reducido) grub();
    else {
      b.innerHTML = '<pre data-bp></pre>';
      X.bios.forEach((l, i) => luego(() => { b.querySelector("[data-bp]").textContent += l + "\n"; }, 200 * (i + 1)));
      luego(grub, 200 * (X.bios.length + 1));
    }
  }

  return function desmontar() {
    tiempos.forEach(clearTimeout);
    intervalos.forEach(clearInterval);
    escuchasDoc.forEach(([t, f, o]) => document.removeEventListener(t, f, o));
    raiz.classList.remove("ios", "ios--sin-crt");
    raiz.replaceChildren();
  };
}
