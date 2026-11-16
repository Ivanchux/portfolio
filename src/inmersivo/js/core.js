/* =========================================================
   core.js — renderer, estado global, camino de cámara,
   entorno de reflejos y utilidades compartidas.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;

  /* ---------- utilidades ---------- */
  IV.$ = s => document.querySelector(s);
  IV.$$ = s => [...document.querySelectorAll(s)];
  const clamp = IV.clamp = T.MathUtils.clamp;
  IV.mix = (a, b, t) => a + (b - a) * t;
  IV.ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  IV.F = { ui: '"Chakra Petch","Atkinson Next",system-ui,sans-serif', mono: '"Departure Mono",ui-monospace,Consolas,monospace', txt: '"Atkinson Next",system-ui,sans-serif' };
  IV.RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  IV.LOW = innerWidth < 700;
  IV.TOUCH = matchMedia('(pointer:coarse)').matches;

  let seed = 1337;                         // aleatorio determinista: el mundo es igual en cada visita
  IV.rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* Textura desde un canvas 2D: IV.canvasTex(w,h,(g,w,h)=>{...}) */
  IV.canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.anisotropy = 4; return t;
  };
  IV.rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

  /* ---------- estado global (lo leen todas las escenas) ---------- */
  const S = IV.S = {
    t: 0, dt: .016,
    p: 0, ps: 0,          // scroll crudo / suavizado (0→1)
    v: 0,                 // velocidad de scroll (distorsión)
    mx: .5, my: .5,       // ratón crudo (0→1, y hacia arriba)
    sx: .5, sy: .5,       // ratón suavizado
    sel: -1, last: 0,     // proyecto abierto / último abierto
    dz: 0,                // dolly hacia el panel (0→1)
    depth: 0,             // metros bajo tierra
    aero: .6,             // 0 = CRT puro · 1 = Aero puro
    tr: 0                 // intensidad de transición entre escenas
  };

  /* ---------- islas del roster ----------
     Cada categoría es una ISLA en un sitio distinto (a un lado, más alta o más baja) y entre islas hay
     un PUENTE que se desvía. Todo se calcula desde los datos: al añadir proyectos el mundo se alarga solo.
     La última isla se une, por otro puente, con la sala de máquinas (los brazos) y de ahí se baja al túnel azul. */
  const ROW = 7.6, PER_ROW = 2, STYLE = { web: 0, juegos: 1, aprendizaje: 2, sistemas: 3 };
  const AX = [0, 26, -26, 20, -20], AY = [0, 7, -3.5, 1.5, 4];      // posición lateral y altura de cada isla
  const DIS = IV.DISTRICTS = [];
  (function () {
    const act = (IV.CATS || []).map((c, ci) => ({ c, ci, idx: IV.PROJECTS.map((p, i) => p.cat === c.id ? i : -1).filter(i => i >= 0) })).filter(a => a.idx.length);
    let z = -14;
    act.forEach((a, k) => {
      const rows = Math.ceil(a.idx.length / PER_ROW);
      const d = { id: a.c.id, cat: a.c, idx: a.idx, rows, gate: z, rowsZ: [], style: STYLE[a.c.id] != null ? STYLE[a.c.id] : a.ci % 4, ax: AX[k % AX.length], ay: AY[k % AY.length] };
      for (let r = 0; r < rows; r++) d.rowsZ.push(z - 6 - r * ROW);
      d.end = d.rowsZ[rows - 1] - 7; d.center = (d.gate + d.end) / 2;
      const nx = k + 1 < act.length ? AX[(k + 1) % AX.length] : 0, ny = k + 1 < act.length ? AY[(k + 1) % AY.length] : 0;
      d.bridge = 18 + Math.abs(nx - d.ax) * .62 + Math.abs(ny - d.ay) * 1.1;           // el puente es más largo cuanto más se desvía
      d.nx = nx; d.ny = ny; DIS.push(d); z = d.end - d.bridge;
    });
    IV.ZEND = DIS.length ? z : -44;
  })();
  /* hardware, descenso y contacto se diseñaron con el roster acabando en z=-44: se desplazan lo que haga falta */
  IV.OFF = (IV.ZEND - 12) + 56;

  /* ---------- camino de la cámara: UN recorrido continuo ----------
     Cada waypoint tiene nombre; los capítulos se anclan a esos nombres. */
  const O = IV.OFF, sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const WP = IV.WAYPOINTS = [['start', 0, 0, 12], ['hero', 0, 0, -2]];
  if (DIS.length) {
    /* x,y a lo largo del roster: dentro de cada isla se queda en su sitio (con un leve vaivén); en el puente se desplaza */
    const at = z => {
      let k = DIS.findIndex(d => z > d.end - d.bridge - .001); if (k < 0) k = DIS.length - 1;
      const d = DIS[k], b0 = d.end;
      if (z >= b0) return { x: d.ax + 2.2 * Math.sin(z * .07 + k * 1.3), y: d.ay + .5 * Math.sin(z * .05 + k) };
      const t = sm(b0, b0 - d.bridge, z);
      return { x: IV.mix(d.ax, d.nx, t), y: IV.mix(d.ay, d.ny, t) };
    };
    const zs = new Set(); for (let z = -14; z > IV.ZEND + 3; z -= 6) zs.add(z); DIS.forEach(d => zs.add(d.gate));
    [...zs].sort((p, q) => q - p).filter(z => z > IV.ZEND + 3).forEach(z => {
      const gi = DIS.findIndex(d => d.gate === z), p = at(z);
      WP.push([gi === 0 ? 'roster' : gi > 0 ? 'dist:' + DIS[gi].id : 'p' + Math.round(-z), p.x, p.y, z]);
    });
  } else WP.push(['roster', 0, 0, -14]);
  WP.push(['rosterEnd', 0, 0, IV.ZEND]);
  WP.push(
    ['hardware',    0,  2.3, -56 + O],
    ['hardwareEnd', 0,  2.3, -97 + O],
    ['hatch',       0,  1.2, -104 + O]
  );
  /* descenso: una hélice por el túnel azul (se cierra hacia los extremos para entrar y salir centrado) */
  for (let k = 0; k <= 12; k++) {
    const t = k / 12, th = t * 3 * Math.PI, R = 8 * Math.sin(Math.PI * t);
    WP.push([{ 0: 'd1', 4: 'd2', 8: 'd3', 11: 'd4' }[k] || 'h' + k, R * Math.sin(th), -14 - t * 94, -106 + O + R * (1 - Math.cos(th)) * .6]);
  }
  WP.push(
    ['contact',     0, -121, -100 + O],
    ['end',         0, -123, -129 + O]
  );
  /* los nombres deben ser únicos para P: quita los puntos repetidos de puerta */
  for (let i = WP.length - 1; i > 0; i--) if (WP.findIndex(w => w[0] === WP[i][0]) !== i) WP.splice(i, 1);
  IV.path = new T.CatmullRomCurve3(WP.map(w => new T.Vector3(w[1], w[2], w[3])), false, 'catmullrom', .5);
  IV.path.arcLengthDivisions = 3000;
  IV.PATH_LEN = IV.path.getLength();

  /* IV.P.nombre = progreso de scroll (0→1) donde la cámara pasa por ese waypoint */
  IV.P = {};
  (function () {
    const N = 4000, pts = []; for (let i = 0; i <= N; i++) pts.push(IV.path.getPointAt(i / N));
    let from = 0;
    WP.forEach(w => {
      const v = new T.Vector3(w[1], w[2], w[3]); let best = 1e9, bi = from;
      for (let i = from; i <= N; i++) { const d = pts[i].distanceToSquared(v); if (d < best) { best = d; bi = i; } }
      IV.P[w[0]] = bi / N; from = bi;
    });
    IV.P.end = 1;
  })();
  /* progreso para una z dentro del roster (z siempre decrece a lo largo del camino) */
  const RS = [];
  (function () { const a = IV.P.roster - .03, b = IV.P.rosterEnd + .01; for (let i = 0; i <= 900; i++) { const u = a + (b - a) * i / 900; RS.push([u, IV.path.getPointAt(u).z]); } })();
  IV.pAtZ = z => {
    let lo = 0, hi = RS.length - 1; if (z >= RS[0][1]) return RS[0][0]; if (z <= RS[hi][1]) return RS[hi][0];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (RS[m][1] > z) lo = m; else hi = m; }
    return RS[lo][0] + (RS[hi][0] - RS[lo][0]) * ((RS[lo][1] - z) / ((RS[lo][1] - RS[hi][1]) || 1));
  };
  DIS.forEach(d => { d.p = IV.pAtZ(d.gate); d.pc = IV.pAtZ(d.center); });
  /* hueco de cada proyecto: sigue el camino (curvas incluidas) y cambia de composición según el tipo de isla */
  const _t = new T.Vector3(), _r = new T.Vector3(), _n = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
  IV.SLOT = IV.PROJECTS.map(() => ({ x: 0, y: 0, z: -20, ry: 0 }));
  DIS.forEach(d => d.idx.forEach((pi, k) => {
    const side = k % 2 ? 1 : -1, row = k >> 1, u = IV.pAtZ(d.rowsZ[row]), p = IV.path.getPointAt(u);
    _t.copy(IV.path.getTangentAt(u)); _r.crossVectors(_t, UP).normalize();
    const off = [4.5 + .4 * (row % 2), 4.9 + side * .3, 3.9 + .5 * (row % 2), 5.3][d.style];
    const dy = [.15 + Math.sin(row * 1.7) * .3, side * .8 + .3, -.2 + Math.sin(row * 1.3) * .5, .4][d.style];
    _n.copy(_t).negate().addScaledVector(_r, -side * [.4, .55, .7, .3][d.style]).normalize();
    IV.SLOT[pi] = { x: p.x + _r.x * side * off, y: p.y + dy, z: p.z + _r.z * side * off, ry: Math.atan2(_n.x, _n.z), u, gy: p.y - 2.4 };
  }));
  /* distrito en el que está la cámara (índice) */
  IV.districtAt = ps => { let k = 0; DIS.forEach((d, i) => { if (ps >= d.p - .004) k = i; }); return k; };
  /* posición (progreso) de la capa i de n durante el descenso */
  IV.slabP = (i, n) => IV.mix(IV.P.d1 + .035, IV.P.d4 + .005, n > 1 ? i / (n - 1) : .5);
  /* progreso de un paso: `at` = waypoint, o `from`/`to`/`f` = fracción entre dos waypoints */
  IV.stepP = s => s.at ? IV.P[s.at] : IV.mix(IV.P[s.from], IV.P[s.to], s.f);
  /* fuentes de la web: se cargan antes de dibujar en canvas */
  IV.loadFonts = () => Promise.all(['400 20px "Departure Mono"', '600 20px "Chakra Petch"', '400 20px "Atkinson Next"', '700 20px "Atkinson Next"'].map(f => document.fonts && document.fonts.load(f).catch(() => {}))).catch(() => {});


  /* ---------- paleta del cielo/niebla: cambia de forma CONTINUA con el progreso ----------
     Los distritos derivan su paleta del color de su categoría (se edita en categorias.json). */
  (function () {
    const C = h => new T.Color(h), W = C('#ffffff');
    const KF = [], bf = [.95, .72, .82, .58];
    const add = (p, top, mid, bot, fog, acc, st, night, den) => KF.push({ p, top: C(top), mid: C(mid), bot: C(bot), fog: C(fog), acc: C(acc), st: new T.Vector4(...st), night, den });
    const P = IV.P;
    add(0, '#02060c', '#06222f', '#02080e', '#03090f', '#35d4ff', [0, 0, 0, 0], 1, .02);
    DIS.forEach(d => {
      const c = C(d.cat.color), k = bf[d.style], st = [0, 0, 0, 0]; st[d.style] = 1;
      const mid = c.clone().lerp(W, .34).multiplyScalar(k + .2), top = c.clone().lerp(W, .08).multiplyScalar([.62, .5, .55, .34][d.style]), bot = c.clone().multiplyScalar(.2);
      KF.push({ p: d.pc, top, mid, bot, fog: mid.clone().multiplyScalar(.55), acc: c.clone().lerp(W, .3), st: new T.Vector4(...st), night: [0, .15, 0, .25][d.style], den: .014 });
    });
    add(P.hardware - .01, '#0a2a40', '#1d5c7c', '#061520', '#0a2233', '#7fe9ff', [0, 0, 0, 0], 0, .016);
    add(P.hatch, '#0a2a40', '#1d5c7c', '#061520', '#0a2233', '#7fe9ff', [0, 0, 0, 0], 0, .016);
    add(P.d1, '#031a3a', '#0a4a9a', '#010818', '#0a4a9a', '#35d4ff', [0, 0, 0, 0], 0, .026);
    add(P.d3, '#030f2e', '#07307a', '#010818', '#07307a', '#4f8bff', [0, 0, 0, 0], 0, .026);
    add(P.d4, '#0a0418', '#160a2e', '#010510', '#160a2e', '#9a7bff', [0, 0, 0, 0], 0, .03);
    add(P.contact - .005, '#120201', '#240403', '#0a0101', '#240403', '#ff4a2a', [0, 0, 0, 0], 0, .028);
    add(1, '#120201', '#240403', '#0a0101', '#240403', '#ff4a2a', [0, 0, 0, 0], 0, .028);
    KF.sort((a, b) => a.p - b.p);
    const PAL = IV.PAL = { top: C('#000'), mid: C('#000'), bot: C('#000'), fog: C('#000'), acc: C('#000'), st: new T.Vector4(), night: 0, den: .02 };
    IV.palette = ps => {
      let i = 0; while (i < KF.length - 2 && ps > KF[i + 1].p) i++;
      const a = KF[i], b = KF[i + 1], t0 = IV.clamp((ps - a.p) / ((b.p - a.p) || 1), 0, 1), t = t0 * t0 * (3 - 2 * t0);
      PAL.top.copy(a.top).lerp(b.top, t); PAL.mid.copy(a.mid).lerp(b.mid, t); PAL.bot.copy(a.bot).lerp(b.bot, t);
      PAL.fog.copy(a.fog).lerp(b.fog, t); PAL.acc.copy(a.acc).lerp(b.acc, t); PAL.st.copy(a.st).lerp(b.st, t);
      PAL.night = IV.mix(a.night, b.night, t); PAL.den = IV.mix(a.den, b.den, t);
      return PAL;
    };
  })();
  /* ---------- inicialización del renderer ---------- */
  IV.init = function () {
    let R;
    try { R = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); } catch (e) { return false; }
    IV.R = R;
    IV.pr = Math.min(devicePixelRatio, IV.LOW ? 1.5 : 2);
    R.setPixelRatio(IV.pr);
    R.setClearColor(0x03070b, 1);
    document.body.prepend(R.domElement);

    const scene = IV.scene = new T.Scene();
    scene.fog = new T.FogExp2(0x03070b, .02);
    scene.background = scene.fog.color;
    const cam = IV.cam = new T.PerspectiveCamera(60, 1, .1, 300);
    scene.add(cam);

    /* luces: 1 en cámara + 3 auxiliares que main.js recoloca por capítulo.
       (número constante → three no recompila shaders al cambiar de capítulo) */
    IV.lights = {
      cam: new T.PointLight(0xffffff, .8, 40),
      a: new T.PointLight(0x35d4ff, 1, 30),
      b: new T.PointLight(0xffffff, 1, 30),
      c: new T.PointLight(0xff4a2a, 0, 40)
    };
    cam.add(IV.lights.cam);
    scene.add(IV.lights.a, IV.lights.b, IV.lights.c);
    scene.add(new T.AmbientLight(0x405868, .8));

    IV.env = makeEnv(R);
    IV.gridMat = gridMat;

    /* colores de ambiente por capítulo */
    const P = IV.P, mk = a => a.map(([p, c]) => [p, new T.Color(c)]);
    IV.BG = mk([[0, '#03070b'], [P.roster, '#04121c'], [P.hardware, '#0a2233'], [P.hatch, '#0a2233'], [P.d1, '#052a55'], [P.d3, '#03163c'], [P.d4, '#160a2e'], [P.contact - .005, '#240403'], [1, '#240403']]);
    IV.colorAt = (A, p, o) => { let i = 0; while (i < A.length - 2 && p > A[i + 1][0]) i++; const t = clamp((p - A[i][0]) / ((A[i + 1][0] - A[i][0]) || 1), 0, 1); return o.copy(A[i][1]).lerp(A[i + 1][1], t); };

    IV.resize = function () {
      const w = innerWidth, h = innerHeight, d = R.getPixelRatio();
      R.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix();
      if (IV.post) IV.post.resize(w * d, h * d);
      if (IV.onResize) IV.onResize(w, h);
    };
    addEventListener('resize', IV.resize);
    return true;
  };

  /* ---------- cámara: sigue el camino + dolly al panel + dron ---------- */
  const _pos = new T.Vector3(), _look = new T.Vector3(), _dir = new T.Vector3();
  const _up0 = new T.Vector3(0, 1, 0), _up1 = new T.Vector3(0, 0, -1), _upv = new T.Vector3(), _m4 = new T.Matrix4(), _qd = new T.Quaternion(), _sq = new T.Quaternion(), _sp = new T.Vector3(); let _ini = false;
  IV.updateCamera = function () {
    const cam = IV.cam, P = IV.P;
    const a = clamp(S.ps * .985, 0, .985);
    IV.path.getPointAt(a, _pos); IV.path.getPointAt(a + .014, _look);

    S.dz += ((S.sel >= 0 ? 1 : 0) - S.dz) * .07;
    const e = S.dz * S.dz * (3 - 2 * S.dz);
    if (e > .001 && IV.scenes.roster) { const f = IV.scenes.roster.focus(S.last); _pos.lerp(f.pos, e); _look.lerp(f.look, e); }

    /* mirando casi en vertical,  = -Z para que la orientación no se retuerza */
    _dir.copy(_look).sub(_pos).normalize();
    const u = IV.ss(.5, .88, Math.abs(_dir.y)) * (1 - e);
    _upv.copy(_up0).lerp(_up1, u).normalize();
    _m4.lookAt(_pos, _look, _upv); _qd.setFromRotationMatrix(_m4);

    /* SUAVIZADO: la cámara no salta nunca. Posición y orientación persiguen al objetivo con amortiguación,
       así los quiebros del camino, el giro al mirar abajo o el cambio de capítulo se funden en un movimiento continuo. */
    const dt = Math.min(S.dt || .016, .05);
    if (!_ini) { _sp.copy(_pos); _sq.copy(_qd); _ini = true; }
    _sp.lerp(_pos, 1 - Math.exp(-dt * 9));
    if (_sq.dot(_qd) < 0) { _qd.x *= -1; _qd.y *= -1; _qd.z *= -1; _qd.w *= -1; }
    _sq.slerp(_qd, 1 - Math.exp(-dt * (e > .01 ? 7 : 4.2)));
    cam.position.copy(_sp); cam.quaternion.copy(_sq);

    /* alabeo tipo dron durante el descenso; parallax con el ratón */
    const k = IV.ss(P.d1 - .02, P.d1 + .05, S.ps) * (1 - IV.ss(P.contact - .07, P.contact, S.ps));
    cam.rotateZ(Math.sin(S.ps * 22) * .22 * k * (1 - e));
    cam.rotateY(-(S.sx - .5) * .12 * (1 - e * .7));
    cam.rotateX((S.sy - .5) * .08 * (1 - e * .7));
    S.depth = Math.max(0, -cam.position.y);
  };

  /* ---------- entorno de reflejos (cielo Aero → hierba) ---------- */
  function makeEnv(R) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#f2fdff'); gr.addColorStop(.32, '#6fd6fb'); gr.addColorStop(.5, '#1b6c9a'); gr.addColorStop(.58, '#0a3a40'); gr.addColorStop(.78, '#2f8a2a'); gr.addColorStop(1, '#04140a');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,255,255,.95)';                      // softboxes: dan el brillo de "plástico cristal"
    [[40, 34, 90, 26], [190, 20, 120, 18], [370, 44, 100, 30], [300, 110, 60, 10], [450, 90, 40, 12]].forEach(r => g.fillRect(...r));
    const tex = new T.CanvasTexture(c); tex.mapping = T.EquirectangularReflectionMapping;
    const pm = new T.PMREMGenerator(R); const env = pm.fromEquirectangular(tex).texture; pm.dispose(); tex.dispose();
    return env;
  }

  /* ---------- rejilla de suelo en espacio mundo ---------- */
  function gridMat(color, scale, fade) {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uC: { value: new T.Color(color) }, uS: { value: scale }, uF: { value: fade } },
      vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: `varying vec3 vW;uniform vec3 uC;uniform float uS,uF;
        void main(){
          vec2 q=vW.xz/uS;
          vec2 d=abs(fract(q+.5)-.5);
          float l=smoothstep(.035,.0,min(d.x,d.y));
          vec2 d5=abs(fract(q/5.+.5)-.5)*5.;
          float L=smoothstep(.06,.0,min(d5.x,d5.y));
          float f=exp(-length(vW-cameraPosition)*uF);
          gl_FragColor=vec4(uC*(l*.35+L*.7)*f,1.);
        }`
    });
  }

  /* ---------- burbujas Aero (instanciadas, animadas en GPU) ---------- */
  IV.makeBubbles = function (n, c, size, tint) {
    const sph = new T.SphereGeometry(1, 16, 12);
    const g = new T.InstancedBufferGeometry();
    g.setIndex(sph.index);
    g.setAttribute('position', sph.attributes.position);
    g.setAttribute('normal', sph.attributes.normal);
    const off = new Float32Array(n * 3), sc = new Float32Array(n), sp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      off[i * 3] = (IV.rnd() - .5) * c.w; off[i * 3 + 1] = IV.rnd() * c.h; off[i * 3 + 2] = (IV.rnd() - .5) * c.d;
      sc[i] = size * (.35 + Math.pow(IV.rnd(), 2) * 1.2); sp[i] = .25 + IV.rnd() * .55;
    }
    g.setAttribute('aOff', new T.InstancedBufferAttribute(off, 3));
    g.setAttribute('aSc', new T.InstancedBufferAttribute(sc, 1));
    g.setAttribute('aSp', new T.InstancedBufferAttribute(sp, 1));
    g.instanceCount = n;
    const m = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uC: { value: new T.Vector3(c.x, c.y, c.z) }, uH: { value: c.h }, uTint: { value: new T.Color(tint || 0x7fe9ff) } },
      vertexShader: `attribute vec3 aOff;attribute float aSc,aSp;uniform float uT,uH;uniform vec3 uC;varying vec3 vN,vV;
        void main(){
          vec3 o=aOff;o.y=mod(o.y+uT*aSp,uH)-uH*.5;
          o.x+=sin(uT*.6+aOff.z*3.)*.35;o.z+=cos(uT*.5+aOff.x*2.)*.35;
          vec4 mv=viewMatrix*vec4(uC+o+position*aSc,1.);
          vN=normalize(mat3(viewMatrix)*normal);vV=normalize(-mv.xyz);
          gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vN,vV;uniform vec3 uTint;
        void main(){
          vec3 n=normalize(vN),v=normalize(vV);
          float f=pow(1.-clamp(dot(n,v),0.,1.),2.2);
          vec3 L=normalize(vec3(-.4,.65,.65));
          float sp=pow(max(dot(reflect(-L,n),v),0.),46.);
          vec3 col=uTint*(.08+f*1.2)+vec3(1.)*sp*1.3+vec3(.35,1.,.5)*f*f*.25;
          gl_FragColor=vec4(col,.1+f*.65+sp);}`
    });
    const mesh = new T.Mesh(g, m); mesh.frustumCulled = false;
    return { mesh, update(t) { m.uniforms.uT.value = t; } };
  };

  /* Cada fichero de escena añade pasos a IV.build y objetos a IV.sceneList. */
  IV.build = [];
  IV.scenes = {};
  IV.sceneList = [];
})();
