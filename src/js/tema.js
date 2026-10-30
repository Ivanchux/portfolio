// Modo de color de la pantalla (verde, ámbar, hielo). Lo comparten el monitor y IVANDEV OS.
(function () {
  var MODOS = ["verde", "ambar", "hielo"];
  var CLAVE = "modo-pantalla";
  var raiz = document.documentElement;

  function aplicar(modo) {
    if (MODOS.indexOf(modo) > 0) raiz.dataset.pantalla = modo;
    else delete raiz.dataset.pantalla;
  }

  try { aplicar(localStorage.getItem(CLAVE)); } catch (e) { /* sin almacenamiento: modo por defecto */ }

  // Modo claro u oscuro: lo elegido en el botón, o lo que diga el sistema
  var CLAVE_TEMA = "tema";
  var sistema = matchMedia("(prefers-color-scheme: dark)");
  var elegido = null;
  try { elegido = localStorage.getItem(CLAVE_TEMA); } catch (e) { /* sin almacenamiento */ }
  function ponerTema(t) {
    raiz.dataset.tema = t;
    var b = document.getElementById("cambio-tema");
    if (b) b.setAttribute("aria-pressed", String(t === "oscuro"));
  }
  ponerTema(elegido === "claro" || elegido === "oscuro" ? elegido : sistema.matches ? "oscuro" : "claro");
  sistema.addEventListener("change", function (e) { if (!elegido) ponerTema(e.matches ? "oscuro" : "claro"); });
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("cambio-tema");
    if (!b) return;
    b.hidden = false;
    ponerTema(raiz.dataset.tema);
    b.addEventListener("click", function () {
      elegido = raiz.dataset.tema === "oscuro" ? "claro" : "oscuro";
      try { localStorage.setItem(CLAVE_TEMA, elegido); } catch (e) { /* se aplica igual, solo no se recuerda */ }
      ponerTema(elegido);
    });
  });

  window.modoPantalla = {
    MODOS: MODOS,
    actual: function () { return raiz.dataset.pantalla || "verde"; },
    poner: function (modo) {
      aplicar(modo);
      try { localStorage.setItem(CLAVE, modo); } catch (e) { /* se aplica igual, solo no se recuerda */ }
      document.dispatchEvent(new CustomEvent("modo-pantalla", { detail: modo }));
    },
  };
})();
