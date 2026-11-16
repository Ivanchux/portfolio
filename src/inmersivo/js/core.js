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

  /* ---------- distritos del roster ----------
     Se calculan desde los datos (categorías × proyectos): al añadir proyectos el mundo se alarga solo.
     Cada distrito = una puerta (gate), filas de 2 paneles y un final. */
  const ROW = 7.6, PER_ROW = 2, STYLE = { web: 0, juegos: 1, aprendizaje: 2, sistemas: 3 };
  const DIS = IV.DISTRICTS = [];
  (function () {
    let z = -14;
    (IV.CATS || []).forEach((c, ci) => {
      const idx = IV.PROJECTS.map((p, i) => p.cat === c.id ? i : -1).filter(i => i >= 0);
      if (!idx.length) return;
      const rows = Math.ceil(idx.length / PER_ROW), d = { id: c.id, cat: c, idx, rows, gate: z, rowsZ: [], style: STYLE[c.id] != null ? STYLE[c.id] : ci % 4 };
      for (let r = 0; r < rows; r++) d.rowsZ.push(z - 6 - r * ROW);
      d.end = d.rowsZ[rows - 1] - 7; d.center = (d.gate + d.end) / 2;
      DIS.push(d); z = d.end - 7;
    });
    IV.ZEND = DIS.length ? z : -44;
  })();
  /* hardware, descenso y contacto se diseñaron con el roster acabando en z=-44: se desplazan lo que haga falta */
  IV.OFF = (IV.ZEND - 12) + 56;

  /* ---------- camino de la cámara: UN recorrido continuo ----------
     Cada waypoint tiene nombre; los capítulos se anclan a esos nombres. */
  const O = IV.OFF;
  const WP = IV.WAYPOINTS = [['start', 0, 0, 12], ['hero', 0, 0, -2]];
  if (DIS.length) DIS.forEach((d, i) => WP.push([i ? 'dist:' + d.id : 'roster', 0, 0, d.gate])); else WP.push(['roster', 0, 0, -14]);
  WP.push(
    ['rosterEnd',   0,    0, IV.ZEND],
    ['hardware',    0,  2.3, -56 + O],
    ['hardwareEnd', 0,  2.3, -97 + O],
    ['hatch',       0,  1.2, -104 + O],
    ['d1',          0,  -14, -106 + O],
    ['d2',          4,  -42, -103 + O],
    ['d3',         -4,  -76, -101 + O],
    ['d4',          0, -108, -100 + O],
    ['contact',     0, -121, -100 + O],
    ['end',         0, -123, -129 + O]
  );
  IV.path = new T.CatmullRomCurve3(WP.map(w => new T.Vector3(w[1], w[2], w[3])), false, 'catmullrom', .5);
  IV.path.arcLengthDivisions = 1400;

  /* IV.P.nombre = progreso de scroll (0→1) donde la cámara pasa por ese waypoint */
  IV.P = {};
  (function () {
    const N = 2400, pts = []; for (let i = 0; i <= N; i++) pts.push(IV.path.getPointAt(i / N));
    let from = 0;
    WP.forEach(w => {
      const v = new T.Vector3(w[1], w[2], w[3]); let best = 1e9, bi = from;
      for (let i = from; i <= N; i++) { const d = pts[i].distanceToSquared(v); if (d < best) { best = d; bi = i; } }
      IV.P[w[0]] = bi / N; from = bi;
    });
    IV.P.end = 1;
  })();
  /* progreso para una z dentro del roster (tramo recto: el avance es lineal en z) */
  IV.pAtZ = z => IV.mix(IV.P.roster, IV.P.rosterEnd, IV.clamp((z - WP[2][3]) / ((IV.ZEND - WP[2][3]) || -1), 0, 1));
  DIS.forEach((d, i) => { d.p = IV.P[i ? 'dist:' + d.id : 'roster']; d.pc = IV.pAtZ(d.center); });
  /* hueco de cada proyecto en el mundo: lo usan el roster y los pedestales */
  IV.SLOT = IV.PROJECTS.map(() => ({ x: 0, y: 0, z: -20, ry: 0 }));
  DIS.forEach(d => d.idx.forEach((pi, k) => { const side = k % 2 ? 1 : -1, row = k >> 1; IV.SLOT[pi] = { x: side * (4.5 + .4 * (row % 2)), y: .15 + Math.sin(row * 1.7) * .3, z: d.rowsZ[row], ry: -side * .38 }; }));
  /* distrito en el que está la cámara (índice) y mezcla con el siguiente */
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
      const mid = c.clone().lerp(W, .12).multiplyScalar(k), top = c.clone().multiplyScalar(.28 * (d.style === 0 ? 1.7 : 1)), bot = c.clone().multiplyScalar(.14);
      KF.push({ p: d.pc, top, mid, bot, fog: mid.clone().multiplyScalar(.38), acc: c.clone().lerp(W, .25), st: new T.Vector4(...st), night: [.15, .9, .2, .7][d.style], den: .017 });
    });
    add(P.hardware - .01, '#0a2a40', '#1d5c7c', '#061520', '#0a2233', '#7fe9ff', [0, 0, 0, 0], 0, .016);
    add(P.hatch, '#0a2a40', '#1d5c7c', '#061520', '#0a2233', '#7fe9ff', [0, 0, 0, 0], 0, .016);
    add(P.d1, '#031326', '#052a55', '#010510', '#052a55', '#35d4ff', [0, 0, 0, 0], 0, .03);
    add(P.d3, '#020a1c', '#03163c', '#010510', '#03163c', '#4f8bff', [0, 0, 0, 0], 0, .03);
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
  const _up0 = new T.Vector3(0, 1, 0), _up1 = new T.Vector3(0, 0, -1);
  IV.updateCamera = function () {
    const cam = IV.cam, P = IV.P;
    const a = clamp(S.ps * .985, 0, .985);
    IV.path.getPointAt(a, _pos); IV.path.getPointAt(a + .014, _look);

    S.dz += ((S.sel >= 0 ? 1 : 0) - S.dz) * .07;
    const e = S.dz * S.dz * (3 - 2 * S.dz);
    if (e > .001 && IV.scenes.roster) { const f = IV.scenes.roster.focus(S.last); _pos.lerp(f.pos, e); _look.lerp(f.look, e); }

    /* mirando casi en vertical, `up` = -Z para que lookAt no se retuerza */
    _dir.copy(_look).sub(_pos).normalize();
    const u = IV.ss(.5, .88, Math.abs(_dir.y)) * (1 - e);
    cam.up.copy(_up0).lerp(_up1, u).normalize();
    cam.position.copy(_pos); cam.lookAt(_look);

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
