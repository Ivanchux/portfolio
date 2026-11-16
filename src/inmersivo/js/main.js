/* =========================================================
   main.js — arranque real (cada escena es un paso de carga),
   bucle principal, luces por capítulo y transiciones.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE, S = IV.S, $ = IV.$;
  /* cede el hilo para que el navegador pinte la barra; setTimeout (no rAF) para no bloquear en pestañas ocultas */
  const wait = () => new Promise(r => setTimeout(r, 30));

  (async function boot() {
    document.documentElement.classList.add('lock');
    if (!IV.init()) {                                   // sin WebGL: se ofrece la versión clásica de la web
      const log = $('#boot-log'); log.textContent = IV.UI.noWebgl + '\n\n';
      const a = document.createElement('a'); a.href = IV.DATA.classic; a.textContent = IV.UI.classicLink; log.append(a);
      document.getElementById('boot-bar').style.width = '0%'; return;
    }
    await IV.loadFonts();                               // las fuentes de la web, antes de dibujar en canvas
    const ui = IV.ui;
    IV.initPost(); IV.resize(); ui.init();
    ui.bootLog('IVANCHUX BIOS v3.0', 'dim'); ui.bootLog('WebGL ........ <span class="ok">OK</span>');
    ui.bootLog('entorno de reflejos ...... <span class="ok">OK</span>');

    const total = IV.build.length + 1;
    for (let i = 0; i < IV.build.length; i++) {
      const [name, fn] = IV.build[i];
      await wait();
      try { fn(); ui.bootLog(name + ' ...... <span class="ok">OK</span>'); }
      catch (e) { console.error(name, e); ui.bootLog(name + ' ...... <span style="color:#ff4a2a">ERROR</span>'); }
      ui.bootPct((i + 1) / total * 100);
    }
    await wait();
    try { IV.R.compile(IV.scene, IV.cam); } catch (e) {}
    ui.bootLog('compilando shaders ...... <span class="ok">OK</span>'); ui.bootPct(100);
    ui.bootLog('\nlisto.', 'dim');
    IV.onResize && IV.onResize();
    ui.bootReady();
    requestAnimationFrame(frame);
  })();

  /* ---------- luces por capítulo (posiciones relativas a la cámara, mezcla suave) ---------- */
  const V = (x, y, z) => new T.Vector3(x, y, z), K = c => new T.Color(c);
  const LT = [   // [a, b, c] × capítulo: {o: offset, c: color, i: intensidad, d: distancia}
    [{ o: V(-3, 2, -6), c: K('#35d4ff'), i: 1.2, d: 24 }, { o: V(4, 1, -10), c: K('#ffffff'), i: .9, d: 24 }, { o: V(0, 0, 0), c: K('#ff4a2a'), i: 0, d: 10 }],
    [{ o: V(-4, 3, -5), c: K('#35d4ff'), i: 1.0, d: 22 }, { o: V(4, 3, -12), c: K('#b6ff8a'), i: .7, d: 26 }, { o: V(0, 0, 0), c: K('#ff4a2a'), i: 0, d: 10 }],
    [{ o: V(0, -6, 0), c: K('#4f8bff'), i: 2.4, d: 34 }, { o: V(3, 4, -3), c: K('#9a6bff'), i: 1.2, d: 26 }, { o: V(0, -12, 2), c: K('#35d4ff'), i: .8, d: 30 }],
    [{ o: V(-3, 2, -10), c: K('#ff4a2a'), i: 1.5, d: 34 }, { o: V(3, 2, -22), c: K('#ff7a2a'), i: 1.4, d: 40 }, { o: V(0, 1, 6), c: K('#ff3a1a'), i: .6, d: 24 }]
  ];
  let LC, fogDen = [.02, .018, .03, .028];
  const _c = new T.Color(), _v = new T.Vector3();

  function lights() {
    const P = IV.P, ps = S.ps, L = IV.lights;
    const w1 = IV.ss(P.hardware - .04, P.hardware + .01, ps) * (1 - IV.ss(P.hatch, P.d1, ps));
    const w2 = IV.ss(P.hatch, P.d1 + .01, ps) * (1 - IV.ss(P.contact - .06, P.contact - .01, ps));
    const w3 = IV.ss(P.contact - .06, P.contact - .01, ps);
    let w0 = Math.max(0, 1 - w1 - w2 - w3); const w = [w0, w1, w2, w3], sum = w0 + w1 + w2 + w3 || 1;
    ['a', 'b', 'c'].forEach((n, k) => {
      const l = L[n]; let i = 0, d = 0; _c.setRGB(0, 0, 0); _v.set(0, 0, 0);
      for (let c = 0; c < 4; c++) { const f = w[c] / sum, e = LT[c][k]; _c.r += e.c.r * f; _c.g += e.c.g * f; _c.b += e.c.b * f; _v.addScaledVector(e.o, f); i += e.i * f; d += e.d * f; }
      l.color.copy(_c); l.intensity = i; l.distance = d; l.position.copy(IV.cam.position).add(_v);
    });
    if (!LC) { const mk = a => a.map(([p, c]) => [p, new T.Color(c)]); LC = mk([[0, '#7fffd4'], [P.roster, '#ffffff'], [P.hardware, '#e6fbff'], [P.d1, '#4f8bff'], [P.d4, '#9a7bff'], [P.contact, '#c84a2a'], [1, '#c84a2a']]); }
    IV.colorAt(LC, ps, L.cam.color);
    /* cielo, niebla y luz de acento: la paleta cambia de forma continua con el progreso (distritos incluidos) */
    const pal = IV.palette(ps);
    IV.scene.fog.color.copy(pal.fog); IV.scene.fog.density = pal.den;
    L.a.color.lerp(pal.acc, w[0] / sum * .75);
  }

  /* ---------- bucle ---------- */
  let last = 0, ft = 16, fc = 0, fAcc = 0, fN = 0, fShow = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - (last || now)) / 1000, .1); last = now;
    S.dt = dt; S.t += dt;

    /* rendimiento adaptativo: baja la resolución si va lento */
    ft += (Math.min(dt * 1000, 100) - ft) * .05;
    /* resolución adaptable, pero sin pasar de 0.9 (más abajo todo se ve borroso) y recuperándola si va sobrado */
    if (++fc > 150 && ft > 30 && IV.pr > .9) { IV.pr = Math.max(.9, IV.pr - .15); IV.R.setPixelRatio(IV.pr); IV.resize(); fc = 0; }
    else if (fc > 600 && ft < 14 && IV.pr < Math.min(devicePixelRatio, IV.LOW ? 1.5 : 2)) { IV.pr = Math.min(Math.min(devicePixelRatio, IV.LOW ? 1.5 : 2), IV.pr + .15); IV.R.setPixelRatio(IV.pr); IV.resize(); fc = 0; }
    fAcc += dt; fN++; if (fAcc > .5) { fShow = Math.round(fN / fAcc); IV.ui.fps(fShow); fAcc = fN = 0; }

    /* scroll → progreso suavizado + velocidad */
    const k = 1 - Math.pow(1 - .06, dt * 60);
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    S.p = IV.clamp(scrollY / max, 0, 1);
    S.ps += (S.p - S.ps) * k;
    S.v += (Math.min(Math.abs(S.p - S.ps) * 8, 1.5) - S.v) * .15;
    S.sx += (S.mx - S.sx) * .12; S.sy += (S.my - S.sy) * .12;

    /* transiciones entre capítulos y entre escena↔detalle */
    const P = IV.P; let tr = 0;
    [P.roster, P.hardware, IV.CHIP_P || P.d1, P.d1, P.contact].forEach(b => { tr = Math.max(tr, Math.exp(-Math.pow((S.ps - b) / .010, 2))); });
    tr = Math.max(tr * .85, 4 * S.dz * (1 - S.dz) * .55);
    if (S.intro > 0) { tr = Math.max(tr, S.intro); S.intro = Math.max(0, S.intro - dt * .9); }
    S.tr = tr;

    IV.updateCamera();
    lights();

    /* solo se dibuja la escena en la que estás (±margen) */
    IV.sceneList.forEach(s => {
      const m = .035;
      s.group.visible = (S.ps >= s.range[0] - m && S.ps <= s.range[1] + m) || (s === IV.scenes.roster && S.sel >= 0);
      if (s.group.visible) s.update();
    });

    IV.ui.update(); IV.ui.cursor && IV.ui.cursor();
    IV.post.render();
  }
})();
