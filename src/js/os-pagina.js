// Monta IVANDEV OS a pantalla completa en /laboratorio/os/. Sin JavaScript queda la versión en HTML.

(async () => {
  const caja = document.getElementById("os-completo");
  const fuente = document.getElementById("datos-os");
  if (!caja || !fuente) return;
  const base = document.currentScript?.src || new URL("../../js/os-pagina.js", location.href).href;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("../os/os.css", base).href;
  document.head.append(css);
  let montar;
  try {
    ({ montar } = await import(new URL("../os/os.js", base).href));
  } catch {
    return; // abierto con doble clic: se queda la versión en HTML
  }
  document.body.classList.add("os-activo");
  caja.hidden = false;
  const sinArranque = new URLSearchParams(location.search).get("sin-arranque") === "1";
  montar(caja, JSON.parse(fuente.textContent), {
    sinArranque,
    alSalir: () => { location.href = new URL("../", location.href).href; },
  });
})();
