// Formulario v1: prepara un correo con asunto y texto. No envía ni guarda nada.

(() => {
  const form = document.getElementById("formulario-contacto");
  if (!form) return;
  const asunto = form.querySelector("#f-asunto");

  // Asunto precargado desde la página de servicios: ?servicio=web
  const servicio = new URLSearchParams(location.search).get("servicio");
  if (servicio && asunto.querySelector(`option[value="${CSS.escape(servicio)}"]`)) asunto.value = servicio;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const nombre = form.elements.nombre.value.trim();
    const titulo = asunto.options[asunto.selectedIndex].text;
    const cuerpo = `${form.elements.mensaje.value.trim()}\n\n— ${nombre}`;
    location.href = `mailto:${form.dataset.correo}?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(cuerpo)}`;
  });
})();
