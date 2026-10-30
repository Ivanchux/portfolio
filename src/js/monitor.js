// Monitor del escritorio: insertar disquetes, vista previa en vivo y modo de pantalla.
// Sin JavaScript, cada disquete es un enlace normal a la ficha del proyecto.

(() => {
  const pantalla = document.getElementById("pantalla");
  const fuente = document.getElementById("datos-monitor");
  if (!pantalla || !fuente) return;

  const datos = JSON.parse(fuente.textContent);
  const anuncio = document.getElementById("monitor-anuncio");
  const led = document.getElementById("led-disco");
  const reducido = matchMedia("(prefers-reduced-motion: reduce)");
  const NOMBRES_MODO = { verde: "verde", ambar: "ámbar", hielo: "hielo" };

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
    return el("a", { class: "pantalla__boton pantalla__boton--hueco", href: p.ficha, texto: "Ficha del proyecto" });
  }

  function mostrarVista(slug) {
    const p = datos[slug];
    pantalla.classList.remove("pantalla--vivo");
    pantalla.replaceChildren(
      barra(p, "disco insertado"),
      el("div", { class: "pantalla__vista" },
        p.captura && el("img", { src: p.captura.src, alt: p.captura.alt, width: "960", height: "545" }),
        el("p", { class: "pantalla__texto", texto: p.resumen })),
      el("div", { class: "pantalla__acciones" },
        p.vivo && el("a", { class: "pantalla__boton", "data-accion": "vivo", href: p.vivo, target: "_blank", rel: "noopener", texto: "▶ Ver en vivo" }),
        botonFicha(p)));
  }

  function mostrarEnVivo(slug) {
    const p = datos[slug];
    if (!p.vivo) return;
    pantalla.classList.add("pantalla--vivo");
    const cerrar = el("button", { class: "pantalla__boton", type: "button", "data-accion": "cerrar", texto: "■ Cerrar vista en vivo" });
    pantalla.replaceChildren(
      barra(p, "en vivo"),
      el("div", { class: "pantalla__vista" },
        el("iframe", {
          class: "pantalla__iframe",
          src: p.vivo,
          title: `Vista en vivo de ${p.nombre}`,
          sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
          referrerpolicy: "no-referrer",
        }),
        el("p", { class: "pantalla__aviso", texto: "Si no se ve, ábrelo en una pestaña nueva." })),
      el("div", { class: "pantalla__acciones" },
        cerrar,
        el("a", { class: "pantalla__boton pantalla__boton--hueco", href: p.vivo, target: "_blank", rel: "noopener", texto: "Abrir en pestaña nueva ↗" })));
    anuncio.textContent = `Cargando ${p.nombre} en vivo dentro del monitor.`;
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
    anuncio.textContent = `Disquete insertado: ${datos[slug].nombre}.`;
    if (enfocar) document.getElementById("pantalla-titulo")?.focus();
  }

  // Cualquier tecla o clic durante el arranque lo salta
  function saltar() { terminarArranque(); }

  function insertar(slug, enfocar) {
    if (!datos[slug]) return;
    if (arranque) terminarArranque();
    actual = slug;
    document.querySelectorAll("a.disquete[data-proyecto]").forEach((d) => {
      if (d.dataset.proyecto === slug) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });

    arranque = { slug, enfocar, lineas: [] };
    if (reducido.matches) return terminarArranque();

    const p = datos[slug];
    const salida = el("pre", { class: "pantalla__arranque" });
    pantalla.classList.remove("pantalla--vivo");
    pantalla.replaceChildren(barra(p, "leyendo…"), salida);
    led?.classList.add("leyendo");
    const pasos = ["A:\\> leyendo disquete ", "…", " OK\n", `Cargando ${p.nombre} `, "…", " OK"];
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
    const disco = e.target.closest("a.disquete[data-proyecto]");
    if (!disco || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (!reducido.matches) {
      disco.classList.remove("entrando");
      void disco.offsetWidth;
      disco.classList.add("entrando");
    }
    insertar(disco.dataset.proyecto, true);
  });

  pantalla.addEventListener("click", (e) => {
    const accion = e.target.closest("[data-accion]")?.dataset.accion;
    if (accion === "vivo") {
      e.preventDefault();
      mostrarEnVivo(actual);
    } else if (accion === "cerrar") {
      mostrarVista(actual);
      anuncio.textContent = "Vista en vivo cerrada.";
      pantalla.querySelector('[data-accion="vivo"]')?.focus();
    }
  });

  // Mando de modo de pantalla
  const mando = document.getElementById("modo-pantalla");
  if (mando && window.modoPantalla) {
    const rotular = () => {
      mando.setAttribute("aria-label", `Modo de pantalla: ${NOMBRES_MODO[window.modoPantalla.actual()]}. Pulsa para cambiar`);
    };
    mando.hidden = false;
    rotular();
    mando.addEventListener("click", () => {
      const { MODOS, actual: modo, poner } = window.modoPantalla;
      poner(MODOS[(MODOS.indexOf(modo()) + 1) % MODOS.length]);
      rotular();
      anuncio.textContent = `Modo de pantalla: ${NOMBRES_MODO[window.modoPantalla.actual()]}.`;
    });
    document.addEventListener("modo-pantalla", rotular);
  }
})();
