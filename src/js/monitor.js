// Monitor del escritorio: insertar disquetes, vista previa en vivo y modo de pantalla.
// Sin JavaScript, cada disquete es un enlace normal a la ficha del proyecto.

(() => {
  const pantalla = document.getElementById("pantalla");
  const fuente = document.getElementById("datos-monitor");
  if (!pantalla || !fuente) return;

  const datos = JSON.parse(fuente.textContent);
  const T = datos._t;
  delete datos._t;
  const anuncio = document.getElementById("monitor-anuncio");
  const led = document.getElementById("led-disco");
  const reducido = matchMedia("(prefers-reduced-motion: reduce)");
  const NOMBRES_MODO = T.modos;
  const rellenar = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  const base = document.currentScript?.src || location.href;
  let desmontarOS = null;

  let actual = document.querySelector('a.disquete[aria-current="true"]')?.dataset.proyecto || Object.keys(datos)[0];
  let arranque = null;

  // Crea un elemento con atributos y texto, sin pasar por innerHTML
  function el(etiqueta, atributos = {}, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [k, v] of Object.entries(atributos)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "texto") nodo.textContent = v;
      else nodo.setAttribute(k, v);
    }
    nodo.append(...hijos.filter(Boolean));
    return nodo;
  }

  function barra(p, estado) {
    return el("div", { class: "pantalla__barra" },
      el("span", {}, "A:\\> ", el("strong", { id: "pantalla-titulo", tabindex: "-1", texto: p.nombre.toUpperCase() })),
      el("span", { texto: estado }));
  }

  function botonFicha(p) {
    return el("a", { class: "pantalla__boton pantalla__boton--hueco", href: p.ficha, texto: T.ficha });
  }

  // ---------- Simulador de Bash: un combate con aire de Game Boy y la salida real del script, turno a turno ----------
  let bucleBash = null;
  const pararBash = () => { clearTimeout(bucleBash); bucleBash = null; };
  const SPRITES = {
    // 12 × 12: 1 = contorno, 2 = relleno, 3 = brillo
    fuego: ["....1.......", "...121......", "...1221..1..", "..12221.121.", "..122221221.", ".1222322221.", ".1223332221.", "122333332221", "122233322221", ".1222222221.", "..11222211..", "....1111...."],
    agua: [".....11.....", "....1221....", "...122221...", "...122221...", "..12222221..", "..12232221..", ".1222332221.", ".1222333221.", ".1222232221.", "..12222221..", "...112211...", ".....11....."],
    planta: ["....1111....", "...122221...", "..12233221..", ".1223332221.", ".1222332221.", ".1222222221.", "..12222221..", "...1222221..", "....12221...", ".....121....", ".....121....", "....1121...."],
  };
  function sprite(nombre, clase) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 12 12");
    svg.setAttribute("class", clase);
    svg.setAttribute("aria-hidden", "true");
    SPRITES[nombre].forEach((fila, y) => [...fila].forEach((v, x) => {
      if (v === ".") return;
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      Object.entries({ x, y, width: 1, height: 1, class: "gb__p" + v }).forEach(([k, val]) => r.setAttribute(k, val));
      svg.append(r);
    }));
    return svg;
  }

  // Reglas de tipos de Simulador_3_0.sh: [tipo que ataca, tipo que defiende, bonus] y, para quien defiende, [su tipo, tipo del atacante, multiplicador]
  const ATAQUE = [["Fuego", "Planta", 200], ["Fuego", "Agua", 50], ["Fuego", "Bicho", 200], ["Planta", "Agua", 200], ["Planta", "Fuego", 50], ["Planta", "Bicho", 50], ["Agua", "Fuego", 200], ["Agua", "Planta", 50],
    ["Psiquico", "Veneno", 200], ["Psiquico", "Psiquico", 50], ["Veneno", "Bicho", 50], ["Bicho", "Planta", 200], ["Bicho", "Veneno", 50], ["Bicho", "Fuego", 50], ["Bicho", "Psiquico", 200]];
  const DEFENSA = [["Planta", "Bicho", 200], ["Planta", "Fuego", 200], ["Veneno", "Psiquico", 200], ["Veneno", "Bicho", 50], ["Psiquico", "Bicho", 200], ["Psiquico", "Psiquico", 50],
    ["Agua", "Fuego", 50], ["Agua", "Planta", 200], ["Fuego", "Agua", 50], ["Fuego", "Planta", 50], ["Fuego", "Bicho", 50]];
  function bonusDeTipo(tAt, tDf) {
    let ba = 100;
    for (const [a, d, v] of ATAQUE) if (tAt.includes(a) && tDf.includes(d)) { if (v === 200 && ba < 200) ba = 200; if (v === 50 && ba > 50) ba = 50; }
    let bd = 100;
    for (const [d, a, m] of DEFENSA) if (tDf.includes(d) && tAt.includes(a)) bd = Math.floor((bd * m) / 100);
    return Math.max(ba, bd); // el bonus final es el mayor de los dos, como en el script
  }

  // Calcula el combate entero con las mismas fórmulas del script y lo devuelve como una lista de líneas de terminal con sus efectos
  function guionCombate(B, [n1, n2]) {
    const P = { [n1]: { ...B.pokemon[n1] }, [n2]: { ...B.pokemon[n2] } };
    const tipos = (n) => P[n].tipos.map((t) => " " + t).join("");
    const L = [];
    const l = (t, e) => L.push({ t, e });
    l(`${B.prompt} ${B.comando} ${n1} ${n2}`, { tipo: "cmd" });
    l("============================================");
    l(`  Combate entre ${n1} y ${n2}`);
    l(`  ${n1} tipo: ${tipos(n1)}`);
    l(`  ${n2} tipo: ${tipos(n2)}`);
    let at = P[n1].velocidad >= P[n2].velocidad ? n1 : n2;
    l(`  Ataca primero: ${at}`);
    l("============================================");
    const esp = { [n1]: 0, [n2]: 0 };
    let ronda = 0, ganador = null, perdedor = null;
    while (P[n1].vida > 0 && P[n2].vida > 0) {
      ronda++;
      const df = at === n1 ? n2 : n1;
      l(""); l(`-------- Ronda ${ronda} --------`);
      l(`${n1}: ${P[n1].vida} HP | ${n2}: ${P[n2].vida} HP`); l("");
      l(`Turno de ${at}`); l("");
      const bonus = bonusDeTipo(P[at].tipos, P[df].tipos);
      let usado = P[at].ataque, especial = false;
      if (esp[at] >= 100) { usado = Math.floor((P[at].ataque * 3) / 2); especial = true; esp[at] = 0; }
      const factor = 75 + Math.floor(Math.random() * 51);
      let efectivo = Math.floor((Math.floor((usado * factor) / 100) * bonus) / 100);
      const critico = Math.random() * 100 < 5;
      if (critico) efectivo *= 2;
      const dano = Math.max(0, efectivo - P[df].defensa);
      if (dano === 0) esp[at] += P[df].defensa - efectivo;
      const antes = P[df].vida;
      P[df].vida = Math.max(0, P[df].vida - dano);
      l(`  ${at} ataca a ${df}`, { tipo: "ataque", at, df });
      l("");
      l(`  [ATACANTE] ${at}`);
      l(`    Ataque:       ${usado}`);
      if (especial) l("    Ataque especial activado! (x1.5)");
      l(`    Bonus tipo:   ${bonus}% (${tipos(at)} vs ${tipos(df)})`);
      if (critico) l("    Golpe critico! (x2)");
      l(`    Dano causado: ${dano}`);
      l("");
      l(`  [DEFENSOR] ${df}`);
      l(`    Defensa:      ${P[df].defensa}`);
      l(`    Vida antes:   ${antes}`);
      l(`    Vida despues: ${P[df].vida}`, { tipo: "vida", df, vida: P[df].vida, max: B.pokemon[df].vida, dano, at, factor, critico });
      l("");
      if (P[df].vida > 0) l("Presiona Enter para continuar...", { tipo: "enter" });
      at = df;
      if (P[df].vida <= 0) { perdedor = df; ganador = df === n1 ? n2 : n1; }
    }
    l(""); l("============================================");
    l(`  GANADOR: ${ganador}  (en ${ronda} rondas)`);
    l("============================================");
    l(""); l(`${perdedor} ha sido debilitado y eliminado del sistema.`, { tipo: "fin", perdedor, ganador });
    l(`${B.prompt} id ${perdedor}`);
    l(`id: «${perdedor}»: no existe ese usuario`);
    l(""); l("Stats restauradas.");
    return L;
  }

  function vistaBash(p) {
    const B = p.bash;
    const spriteDe = (n) => (SPRITES[B.pokemon[n].tipos[0].toLowerCase()] ? B.pokemon[n].tipos[0].toLowerCase() : "agua");
    const contenedor = el("div", { class: "pantalla__vista pantalla__vista--bash" });
    const terminal = el("pre", { class: "bash", tabindex: "0", "aria-label": `${T.codigoDe} ${p.nombre}` });
    let escena = null, indice = 0;

    function montarEscena([n1, n2]) {
      const vida = () => el("span", { class: "gb__vida" }, el("i", { style: "--vida:100%" }));
      const f1 = el("div", { class: "gb__ficha gb__ficha--propio" }, el("b", { texto: `${n1.toUpperCase()} ${B.pokemon[n1].vida}` }), vida());
      const f2 = el("div", { class: "gb__ficha gb__ficha--rival" }, el("b", { texto: `${n2.toUpperCase()} ${B.pokemon[n2].vida}` }), vida());
      const s1 = sprite(spriteDe(n1), "gb__sprite gb__sprite--propio"), s2 = sprite(spriteDe(n2), "gb__sprite gb__sprite--rival");
      const texto = el("p", { class: "gb__texto", texto: T.bashIntro });
      const nodo = el("div", { class: "gb", "aria-hidden": "true" }, f1, s2, s1, f2, texto);
      return { nodo, texto, [n1]: { sprite: s1, barra: f1.querySelector("i"), num: f1.querySelector("b") }, [n2]: { sprite: s2, barra: f2.querySelector("i"), num: f2.querySelector("b") } };
    }
    const pintarVida = (E, n, vida, max) => { E[n].barra.style.setProperty("--vida", (vida / max) * 100 + "%"); E[n].num.textContent = `${n.toUpperCase()} ${vida}`; };

    function combate() {
      const par = B.combates[indice % B.combates.length];
      indice++;
      const E = montarEscena(par);
      escena?.nodo.replaceWith(E.nodo);
      if (!escena) contenedor.prepend(E.nodo);
      escena = E;
      terminal.textContent = "";
      const guion = guionCombate(B, par);

      // Sin animación: se enseña el primer turno ya escrito y el marcador a cero
      if (reducido.matches) {
        const fin = guion.findIndex((x) => x.e?.tipo === "enter");
        terminal.textContent = guion.slice(0, fin < 0 ? guion.length : fin).map((x) => x.t).join("\n");
        return;
      }
      let i = 0;
      const siguiente = () => {
        if (i >= guion.length) { bucleBash = setTimeout(combate, 3200); return; }
        const { t, e } = guion[i++];
        terminal.append(document.createTextNode((terminal.textContent ? "\n" : "") + t));
        terminal.scrollTop = terminal.scrollHeight;
        let espera = e?.tipo === "cmd" ? 700 : t.startsWith("====") || t === "" ? 40 : 70;
        if (e?.tipo === "ataque") {
          E[e.at].sprite.classList.remove("ataca"); E[e.df].sprite.classList.remove("golpe"); void E[e.at].sprite.offsetWidth;
          E[e.at].sprite.classList.add("ataca");
          E.texto.textContent = rellenar(T.ataca, { a: e.at });
        } else if (e?.tipo === "vida") {
          if (e.dano > 0) E[e.df].sprite.classList.add("golpe");
          pintarVida(E, e.df, e.vida, e.max);
          E.texto.textContent = `${rellenar(T.ataca, { a: e.at })} factor=${e.factor}${e.critico ? T.critico : ""} → ${T.dano} ${e.dano}`;
          espera = 500;
        } else if (e?.tipo === "enter") {
          espera = 1100;
          bucleBash = setTimeout(() => { terminal.append(document.createTextNode(" ↵")); bucleBash = setTimeout(siguiente, 350); }, espera);
          return;
        } else if (e?.tipo === "fin") {
          E[e.perdedor].sprite.classList.add("borrado");
          E.texto.textContent = `userdel -r ${e.perdedor.toLowerCase()} · ${e.ganador} ${T.gana}`;
          espera = 1200;
        }
        bucleBash = setTimeout(siguiente, espera);
      };
      bucleBash = setTimeout(siguiente, 600);
    }
    combate();
    contenedor.append(terminal);
    return contenedor;
  }

  function mostrarVista(slug) {
    const p = datos[slug];
    observador?.disconnect();
    pararBash();
    pantalla.classList.remove("pantalla--vivo");
    pantalla.replaceChildren(
      barra(p, T.insertado),
      p.bash ? vistaBash(p) : el("div", { class: "pantalla__vista" },
        p.captura && el("img", { src: p.captura.src, alt: p.captura.alt, width: "960", height: "545" }),
        el("p", { class: "pantalla__texto", texto: p.resumen })),
      el("div", { class: "pantalla__acciones" },
        p.vivo && el("a", { class: "pantalla__boton", "data-accion": "vivo", href: p.vivo, target: "_blank", rel: "noopener", texto: T.verVivo }),
        botonFicha(p)));
  }

  // La web se carga a su tamaño real (1280 px de ancho, o un móvil de 390 × 844) y se reduce para caber en el monitor
  const VIRTUAL = { escritorio: { ancho: 1280 }, movil: { ancho: 390, alto: 844 } };
  let observador = null;
  function marcoEnVivo(p) {
    const iframe = el("iframe", {
      class: "pantalla__iframe",
      src: p.vivo,
      title: `${T.vistaDe} ${p.nombre}`,
      sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
      referrerpolicy: "no-referrer",
      allow: "fullscreen; gamepad",
    });
    const marco = el("div", { class: `pantalla__marco pantalla__marco--${p.formato}` }, iframe);
    const v = VIRTUAL[p.formato] || VIRTUAL.escritorio;
    const ajustar = () => {
      const w = marco.clientWidth, h = marco.clientHeight;
      if (!w || !h) return;
      if (v.alto) {
        const s = Math.min(w / v.ancho, h / v.alto);
        Object.assign(iframe.style, { width: v.ancho + "px", height: v.alto + "px", transform: `scale(${s})`, left: (w - v.ancho * s) / 2 + "px" });
      } else {
        const s = w / v.ancho;
        Object.assign(iframe.style, { width: v.ancho + "px", height: h / s + "px", transform: `scale(${s})`, left: "0" });
      }
    };
    observador?.disconnect();
    observador = new ResizeObserver(ajustar);
    observador.observe(marco);
    return marco;
  }

  function mostrarEnVivo(slug) {
    const p = datos[slug];
    if (!p.vivo) return;
    pantalla.classList.add("pantalla--vivo");
    const cerrar = el("button", { class: "pantalla__boton", type: "button", "data-accion": "cerrar", texto: T.cerrar });
    pantalla.replaceChildren(
      barra(p, T.enVivo),
      el("div", { class: "pantalla__vista" },
        marcoEnVivo(p)),
      el("div", { class: "pantalla__acciones pantalla__acciones--vivo" },
        cerrar,
        el("a", { class: "pantalla__boton pantalla__boton--hueco", href: p.vivo, target: "_blank", rel: "noopener", texto: T.pestana })));
    anuncio.textContent = rellenar(T.cargandoVivo, { n: p.nombre });
    cerrar.focus();
  }

  function terminarArranque() {
    if (!arranque) return;
    arranque.lineas.forEach(clearTimeout);
    const { slug, enfocar } = arranque;
    arranque = null;
    led?.classList.remove("leyendo");
    document.removeEventListener("keydown", saltar, true);
    pantalla.removeEventListener("click", saltar);
    mostrarVista(slug);
    anuncio.textContent = `${T.insertadoAviso} ${datos[slug].nombre}.`;
    if (enfocar) document.getElementById("pantalla-titulo")?.focus();
  }

  // Cualquier tecla o clic durante el arranque lo salta
  function saltar() { terminarArranque(); }

  function apagarOS() {
    pararBash();
    if (!desmontarOS) return;
    desmontarOS();
    desmontarOS = null;
    pantalla.classList.remove("pantalla--os");
  }

  // El disquete «sistema» arranca IVANDEV OS dentro del monitor. En pantallas pequeñas se abre a pantalla completa.
  async function arrancarOS(disco) {
    const fuenteOS = document.getElementById("datos-os");
    if (!fuenteOS || pantalla.clientWidth < 420) return (location.href = disco.href);
    if (arranque) terminarArranque();
    apagarOS();
    if (!document.querySelector("link[data-os-css]")) {
      const css = el("link", { rel: "stylesheet", href: new URL("../os/os.css", base).href, "data-os-css": "" });
      const listo = new Promise((ok) => { css.onload = ok; css.onerror = ok; });
      document.head.append(css);
      await listo;
    }
    let montar;
    try {
      ({ montar } = await import(new URL("../os/os.js", base).href));
    } catch {
      return (location.href = disco.href); // abierto con doble clic: los módulos no cargan, se va a la versión en HTML
    }
    document.querySelectorAll("a.disquete[data-proyecto]").forEach((d) => d.removeAttribute("aria-current"));
    pantalla.classList.remove("pantalla--vivo");
    pantalla.classList.add("pantalla--os");
    desmontarOS = montar(pantalla, JSON.parse(fuenteOS.textContent), {
      sinArranque: reducido.matches,
      alSalir: () => {
        apagarOS();
        insertar(actual, false);
        disco.focus();
      },
    });
    anuncio.textContent = T.os;
  }

  function insertar(slug, enfocar) {
    if (!datos[slug]) return;
    apagarOS();
    if (arranque) terminarArranque();
    actual = slug;
    document.querySelectorAll("a.disquete[data-proyecto]").forEach((d) => {
      if (d.dataset.proyecto === slug) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });

    pararBash();
    arranque = { slug, enfocar, lineas: [] };
    if (reducido.matches) return terminarArranque();

    const p = datos[slug];
    const salida = el("pre", { class: "pantalla__arranque" });
    pantalla.classList.remove("pantalla--vivo");
    pantalla.replaceChildren(barra(p, T.leyendo), salida);
    led?.classList.add("leyendo");
    const pasos = [T.leyendoDisquete, "…", " OK\n", `${T.cargando} ${p.nombre} `, "…", " OK"];
    pasos.forEach((texto, i) => {
      arranque.lineas.push(setTimeout(() => {
        salida.append(texto.includes("OK") ? el("span", { class: "ok", texto }) : texto);
      }, 110 * (i + 1)));
    });
    arranque.lineas.push(setTimeout(terminarArranque, 110 * (pasos.length + 2)));
    // El clic que inserta el disquete no debe saltar el arranque: se escucha en el siguiente ciclo
    setTimeout(() => {
      document.addEventListener("keydown", saltar, true);
      pantalla.addEventListener("click", saltar);
    });
  }

  document.addEventListener("click", (e) => {
    const sistema = e.target.closest("a.disquete[data-os]");
    if (sistema && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
      e.preventDefault();
      arrancarOS(sistema);
      return;
    }
    const disco = e.target.closest("a.disquete[data-proyecto]");
    if (!disco || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (disco.getAttribute("aria-current") === "true") return insertar(disco.dataset.proyecto, true);
    volar(disco).then(() => insertar(disco.dataset.proyecto, true));
  });

  // El disquete sale de la estantería y entra por la ranura de la disquetera
  const ranura = document.querySelector(".monitor__ranura");
  function volar(disco) {
    if (reducido.matches || !ranura || !disco.animate) return Promise.resolve();
    const a = disco.getBoundingClientRect(), r = ranura.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return Promise.resolve(); // la ranura no se ve: sin vuelo
    const copia = disco.cloneNode(true);
    copia.removeAttribute("href");
    copia.removeAttribute("aria-current");
    copia.setAttribute("aria-hidden", "true");
    copia.className = "disquete disquete--volando";
    Object.assign(copia.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
    document.body.append(copia);
    disco.classList.add("fuera");
    const dx = r.left + r.width / 2 - (a.left + a.width / 2), dy = r.top - (a.top + a.height / 2);
    const escala = Math.min(1, (r.width * 0.8) / a.width);
    const vuelo = copia.animate([
      { transform: "translate(0, 0) rotate(0) scale(1)", opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 70}px) rotate(-12deg) scale(${(1 + escala) / 2})`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy - 6}px) rotate(0) scale(${escala}) perspective(300px) rotateX(0deg)`, opacity: 1, offset: 0.78 },
      { transform: `translate(${dx}px, ${dy + 10}px) rotate(0) scale(${escala}) perspective(300px) rotateX(70deg)`, opacity: 0, offset: 1 },
    ], { duration: 780, easing: "cubic-bezier(.4, 0, .2, 1)" });
    return vuelo.finished.then(() => {
      copia.remove();
      disco.classList.remove("fuera");
      ranura.classList.remove("recibe");
      void ranura.offsetWidth;
      ranura.classList.add("recibe");
    });
  }

  pantalla.addEventListener("click", (e) => {
    const accion = e.target.closest("[data-accion]")?.dataset.accion;
    if (accion === "vivo") {
      if (pantalla.clientWidth < 420) return; // en pantallas pequeñas se abre en una pestaña nueva
      e.preventDefault();
      mostrarEnVivo(actual);
    } else if (accion === "cerrar") {
      mostrarVista(actual);
      anuncio.textContent = T.cerrada;
      pantalla.querySelector('[data-accion="vivo"]')?.focus();
    }
  });

  // Mando de modo de pantalla
  const mando = document.getElementById("modo-pantalla");
  if (mando && window.modoPantalla) {
    const rotular = () => {
      mando.setAttribute("aria-label", `${T.modo}: ${NOMBRES_MODO[window.modoPantalla.actual()]}. ${T.pulsa}`);
    };
    mando.hidden = false;
    rotular();
    mando.addEventListener("click", () => {
      const { MODOS, actual: modo, poner } = window.modoPantalla;
      poner(MODOS[(MODOS.indexOf(modo()) + 1) % MODOS.length]);
      rotular();
      anuncio.textContent = `${T.modo}: ${NOMBRES_MODO[window.modoPantalla.actual()]}.`;
    });
    document.addEventListener("modo-pantalla", rotular);
  }
})();
