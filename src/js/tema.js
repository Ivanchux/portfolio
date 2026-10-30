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
