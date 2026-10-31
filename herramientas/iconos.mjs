// Iconos SVG dibujados a mano. Usan currentColor y se incrustan en el HTML.

const trazo = (d, extra = "") =>
  `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;

export const ICONOS = {
  ventana: trazo('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18"/><circle cx="6.5" cy="6.5" r=".6" fill="currentColor"/><circle cx="9" cy="6.5" r=".6" fill="currentColor"/>'),
  terminal: trazo('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 10 3 2-3 2M12.5 15h4.5"/>'),
  chispa: trazo('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/><circle cx="12" cy="12" r="2"/>'),
  mando: trazo('<path d="M7 8h10a4 4 0 0 1 4 4v1.5a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.3A3 3 0 0 1 3 13.5V12a4 4 0 0 1 4-4Z"/><path d="M8 10.5v3M6.5 12h3"/><circle cx="15.5" cy="11" r=".7" fill="currentColor"/><circle cx="17" cy="12.8" r=".7" fill="currentColor"/>'),
  datos: trazo('<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"/>'),
  grafo: trazo('<circle cx="6" cy="17" r="2.2"/><circle cx="12" cy="7" r="2.2"/><circle cx="18" cy="15" r="2.2"/><path d="m7.2 15.1 3.6-6.2M13.9 8.3l2.9 4.9M8.2 17.4l7.6-1.9"/>'),
  telefono: trazo('<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 18.5h3"/><path d="M9.5 6.5h5"/>'),
  libro: trazo('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/><path d="M9 8h7"/>'),
  codigo: trazo('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
  ojo: trazo('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>'),
  candado: trazo('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor"/>'),
  matraz: trazo('<path d="M9.5 3h5M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4A1.5 1.5 0 0 0 19 19l-5.5-10V3"/><path d="M7.5 15h9"/>'),
  birrete: trazo('<path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z"/><path d="M6.5 11v4.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V11M21.5 9v5"/>'),
};

export const ICONO_CATEGORIA = { web: "ventana", juegos: "mando", aprendizaje: "libro", sistemas: "terminal" };
