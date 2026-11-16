/* =========================================================
   config.js — ajustes TÉCNICOS de la experiencia.
   El contenido (proyectos, categorías, textos, enlaces) NO está aquí:
   sale de datos/*.json y site.config.json, y lo escribe
   herramientas/inmersivo.mjs en datos.js al compilar.
   ========================================================= */
window.IV = window.IV || {};

IV.CONFIG = {
  scrollVh: 1750,        // alto total de scroll: más = viaje más lento
  heroVideo: ''          // ej. 'assets/hero.mp4' → el hero se renderiza como ASCII desde tu vídeo
};
