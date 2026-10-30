// Movimiento y filtros comunes a todas las páginas.
// Sin JavaScript todo se ve igual, solo que sin animaciones de entrada y con todas las categorías a la vista.

(() => {
  const raiz = document.documentElement;
  const reducido = matchMedia("(prefers-reduced-motion: reduce)");

  // Aparecer al entrar en pantalla
  const revelar = document.querySelectorAll("[data-revelar]");
  if (!reducido.matches && "IntersectionObserver" in window) {
    raiz.classList.add("vida");
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    revelar.forEach((el, i) => {
      el.style.setProperty("--retraso", `${Math.min(i % 6, 5) * 60}ms`);
      io.observe(el);
    });
  }

  // Filtros por categoría: un grupo de botones que muestra u oculta [data-categoria] dentro de su destino
  for (const grupo of document.querySelectorAll("[data-filtros]")) {
    const destino = document.getElementById(grupo.dataset.filtros);
    if (!destino) continue;
    const botones = [...grupo.querySelectorAll("[data-filtro]")];
    const aplicar = (filtro) => {
      botones.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filtro === filtro)));
      for (const el of destino.querySelectorAll(":scope > [data-categoria]")) {
        const ver = filtro === "todos" || el.dataset.categoria === filtro;
        el.hidden = !ver;
        if (ver && !reducido.matches) {
          el.classList.remove("entra");
          void el.offsetWidth;
          el.classList.add("entra");
        }
      }
      destino.dataset.filtro = filtro;
    };
    botones.forEach((b) => b.addEventListener("click", () => aplicar(b.dataset.filtro)));
    // Flechas para moverse entre categorías
    grupo.addEventListener("keydown", (e) => {
      const i = botones.indexOf(document.activeElement);
      if (i < 0 || !["ArrowRight", "ArrowLeft"].includes(e.key)) return;
      e.preventDefault();
      const b = botones[(i + (e.key === "ArrowRight" ? 1 : botones.length - 1)) % botones.length];
      b.focus();
      b.click();
    });
    grupo.hidden = false;
    aplicar((botones.find((b) => b.getAttribute("aria-pressed") === "true") || botones[0]).dataset.filtro);
  }

})();
