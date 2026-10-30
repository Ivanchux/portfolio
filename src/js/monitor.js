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

  // ---------- Simulador de Bash: combate con aire de Game Boy y el código real resaltado ----------
  let bucleBash = null;
  const pararBash = () => { clearTimeout(bucleBash); bucleBash = null; };
  const SPRITES = {
    // 12 × 12: 1 = contorno, 2 = relleno, 3 = brillo
    fuego: ["....1.......", "...121......", "...1221..1..", "..12221.121.", "..122221221.", ".1222322221.", ".1223332221.", "122333332221", "122233322221", ".1222222221.", "..11222211..", "....1111...."],
    agua: [".....11.....", "....1221....", "...122221...", "...122221...", "..12222221..", "..12232221..", ".1222332221.", ".1222333221.", ".1222232221.", "..12222221..", "...112211...", ".....11....."],
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
  function vistaBash(p) {
    const [a, b] = p.bash.luchadores;
    const vida = (n) => el("span", { class: "gb__vida" }, el("i", { style: "--vida:100%" }));
    const rival = el("div", { class: "gb__ficha gb__ficha--rival" }, el("b", { texto: b }), vida());
    const propio = el("div", { class: "gb__ficha gb__ficha--propio" }, el("b", { texto: a }), vida());
    const texto = el("p", { class: "gb__texto", texto: T.bashIntro });
    const sA = sprite("fuego", "gb__sprite gb__sprite--propio"), sB = sprite("agua", "gb__sprite gb__sprite--rival");
    const escena = el("div", { class: "gb", "aria-hidden": "true" }, rival, sB, sA, propio, texto);
    const lineas = p.bash.codigo.map((l, i) => el("span", { class: "bash__l" + (l.startsWith("#") ? " bash__c" : ""), "data-n": String(i + 1), texto: l || " " }));
    const codigo = el("pre", { class: "bash", tabindex: "0", "aria-label": `${T.codigoDe} ${p.nombre}` }, el("code", {}, ...lineas));
    if (!reducido.matches) {
      const st = { [a]: { vida: 100, ataque: 52, defensa: 40, bonus: 50, sprite: sA, barra: propio.querySelector("i") }, [b]: { vida: 100, ataque: 48, defensa: 38, bonus: 200, sprite: sB, barra: rival.querySelector("i") } };
      let turno = a;
      const resaltar = (ns) => lineas.forEach((l, i) => l.classList.toggle("on", ns.includes(i)));
      const paso = () => {
        const at = st[turno], df = st[turno === a ? b : a], nDf = turno === a ? b : a;
        const factor = 75 + Math.floor(Math.random() * 51);
        let efectivo = Math.floor(Math.floor((at.ataque * factor) / 100) * at.bonus / 100);
        const critico = Math.random() < 0.05;
        if (critico) efectivo *= 2;
        const dano = Math.max(0, efectivo - df.defensa);
        resaltar(critico ? [1, 2, 5, 6, 7, 10, 11] : [1, 2, 10, 11]);
        at.sprite.classList.remove("ataca"); df.sprite.classList.remove("golpe"); void at.sprite.offsetWidth;
        at.sprite.classList.add("ataca"); df.sprite.classList.add("golpe");
        df.vida = Math.max(0, df.vida - dano);
        df.barra.style.setProperty("--vida", df.vida + "%");
        texto.textContent = `${rellenar(T.ataca, { a: turno })} factor=${factor}${critico ? T.critico : ""} → ${T.dano} ${dano}`;
        if (df.vida === 0) {
          bucleBash = setTimeout(() => {
            resaltar([13, 14]);
            texto.textContent = `userdel -r ${nDf.toLowerCase()} · ${turno} ${T.gana}`;
            df.sprite.classList.add("borrado");
            bucleBash = setTimeout(() => {
              for (const k of [a, b]) { st[k].vida = 100; st[k].barra.style.setProperty("--vida", "100%"); st[k].sprite.classList.remove("borrado"); }
              turno = a; paso();
            }, 2600);
          }, 1400);
          return;
        }
        turno = nDf;
        bucleBash = setTimeout(paso, 2000);
      };
      bucleBash = setTimeout(paso, 900);
    }
    return el("div", { class: "pantalla__vista pantalla__vista--bash" }, escena, codigo);
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
