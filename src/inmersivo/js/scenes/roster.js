/* =========================================================
   scenes/roster.js — pasillo de paneles de cristal.
   Los paneles NO se ven hasta que eliges un sector (se materializan
   con glitch). Cada panel muestra la captura real del proyecto
   (si el navegador la deja leer; si no, una miniatura procedural).
   Clic = detalle con dolly de cámara y galería.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;

  const ARTBY = { web: 'terminal', juegos: 'radar', aprendizaje: 'lab', sistemas: 'rack' };
  const artFor = p => p.id === 'pokemon-bash-simulator' ? 'terminal' : (ARTBY[p.cat] || 'terminal');
  const CW = 1024, CH = 800, IMG = { x: 24, y: 82, w: 976, h: 549 };

  /* carga una captura; devuelve null si falla o si el navegador la marca como "no legible" (file://) */
  const cache = {};
  IV.loadImg = src => cache[src] || (cache[src] = new Promise(res => {
    const im = new Image();
    im.onload = () => {
      try { const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 1, 1); g.getImageData(0, 0, 1, 1); res(im); }
      catch (e) { res(null); }
    };
    im.onerror = () => res(null); im.src = (IV.CAPS && IV.CAPS[src]) || (IV.DATA.root + src);
  }));

  function cover(g, im, x, y, w, h) {
    const r = Math.max(w / im.width, h / im.height), sw = w / r, sh = h / r;
    g.drawImage(im, (im.width - sw) / 2, 0, sw, sh, x, y, w, h);          // recorte centrado, alineado arriba
  }

  function drawPanel(g, P, i, im) {
    const W = CW, H = CH, F = IV.F, cat = IV.CATS.find(c => c.id === P.cat) || {};
    g.clearRect(0, 0, W, H);
    /* marco de cristal */
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, 'rgba(120,220,255,.92)'); bg.addColorStop(.5, 'rgba(40,130,180,.9)'); bg.addColorStop(1, 'rgba(8,40,64,.96)');
    g.fillStyle = bg; IV.rr(g, 4, 4, W - 8, H - 8, 26); g.fill();
    g.strokeStyle = 'rgba(230,252,255,.95)'; g.lineWidth = 3; IV.rr(g, 4, 4, W - 8, H - 8, 26); g.stroke();
    /* barra de título (con el color del disquete) */
    g.fillStyle = 'rgba(255,255,255,.28)'; IV.rr(g, 14, 12, W - 28, 52, 16); g.fill();
    g.fillStyle = P.color; g.globalAlpha = .6; IV.rr(g, 14, 12, 8, 52, 4); g.fill(); g.globalAlpha = 1;
    g.fillStyle = '#eaffff'; g.font = '400 24px ' + F.mono; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,60,100,.9)'; g.shadowBlur = 6; g.fillText(P.id.slice(0, 26) + '.exe', 64, 40); g.shadowBlur = 0;
    const orb = g.createRadialGradient(40, 33, 1, 40, 39, 13); orb.addColorStop(0, '#fff'); orb.addColorStop(.4, '#7be4ff'); orb.addColorStop(1, '#0a6aa8'); g.fillStyle = orb; g.beginPath(); g.arc(40, 39, 13, 0, 7); g.fill();
    [[W - 150, '#bde'], [W - 112, '#bde'], [W - 74, '#e0452b']].forEach(([x, c], k) => { g.fillStyle = c; IV.rr(g, x, 22, k === 2 ? 50 : 32, 26, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 2, 24, k === 2 ? 46 : 28, 10); });
    g.fillStyle = '#fff'; g.font = '700 22px ' + F.txt; g.fillText('✕', W - 58, 39);
    /* cuerpo: captura real o miniatura procedural */
    g.save(); IV.rr(g, IMG.x, IMG.y, IMG.w, IMG.h, 14); g.clip();
    if (im) cover(g, im, IMG.x, IMG.y, IMG.w, IMG.h); else IV.ART[artFor(P)](g, IMG.x, IMG.y, IMG.w, IMG.h);
    const sh = g.createLinearGradient(0, IMG.y, 0, IMG.y + 200); sh.addColorStop(0, 'rgba(255,255,255,.2)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(IMG.x, IMG.y, IMG.w, 200);
    g.restore(); g.strokeStyle = 'rgba(190,245,255,.85)'; g.lineWidth = 2; IV.rr(g, IMG.x, IMG.y, IMG.w, IMG.h, 14); g.stroke();
    /* texto */
    g.textBaseline = 'alphabetic'; g.fillStyle = '#7fffd4'; g.font = '400 25px ' + F.mono;
    g.fillText('[' + String(i + 1).padStart(2, '0') + '] ' + (cat.label || '') + (P.estado ? ' · ' + P.estado : ''), 40, 676, 940);
    g.fillStyle = '#fff'; g.font = '600 58px ' + F.ui; g.shadowColor = 'rgba(0,50,90,.9)'; g.shadowBlur = 10; g.fillText(P.n, 40, 738, 640); g.shadowBlur = 0;
    g.fillStyle = '#cfefff'; g.font = '400 21px ' + F.mono; g.fillText(P.stack.slice(0, 4).join(' · '), 40, 776, 660);
    /* botón abrir */
    const bx = W - 270, by = 700, bw = 230, bh = 58, bgg = g.createLinearGradient(0, by, 0, by + bh); bgg.addColorStop(0, '#d6f9ff'); bgg.addColorStop(.48, '#74d8f7'); bgg.addColorStop(.52, '#27a3dc'); bgg.addColorStop(1, '#6fe2ff');
    g.fillStyle = bgg; IV.rr(g, bx, by, bw, bh, 29); g.fill(); g.fillStyle = '#04304a'; g.font = '600 25px ' + F.ui; g.textAlign = 'center'; g.fillText('▶ ' + IV.UI.openLbl, bx + bw / 2, by + 38); g.textAlign = 'left';
    /* brillo diagonal de cristal */
    const gl = g.createLinearGradient(0, 0, W, H * .5); gl.addColorStop(0, 'rgba(255,255,255,.3)'); gl.addColorStop(.5, 'rgba(255,255,255,.04)'); gl.addColorStop(.51, 'rgba(255,255,255,0)');
    g.fillStyle = gl; IV.rr(g, 4, 4, W - 8, H * .5, 26); g.fill();
  }

  IV.build.push(['Roster · proyectos en el mundo', () => {
    const S = IV.S, P = IV.P, cam = IV.cam;
    const group = new T.Group(); IV.scene.add(group);

    const geo = new T.PlaneGeometry(5, 5 * CH / CW);
    const blank = new T.CanvasTexture(document.createElement('canvas'));
    const panels = IV.PROJECTS.map((p, i) => {
      const mat = new T.ShaderMaterial({
        transparent: true, depthWrite: false, side: T.DoubleSide,
        uniforms: { map: { value: blank }, uHover: { value: 0 }, uReveal: { value: 0 }, uTime: { value: 0 }, uDim: { value: 1 }, uAcc: { value: new T.Color(p.color) } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec2 vUv;uniform sampler2D map;uniform float uHover,uReveal,uTime,uDim;uniform vec3 uAcc;
          void main(){
            vec4 c=texture2D(map,vUv);
            float sweep=smoothstep(.06,0.,abs(vUv.y-fract(uTime*.4)))*uHover;
            c.rgb+=vec3(.3,.95,1.)*sweep*.35;
            vec2 q=min(vUv,1.-vUv);float e=min(q.x*1.6,q.y*1.25);
            c.rgb+=mix(vec3(.3,.9,1.),uAcc,.55)*smoothstep(.035,0.,e)*(.35+uHover*.9)*c.a;
            c.rgb*=.8+.2*uDim+uHover*.18;
            gl_FragColor=vec4(c.rgb,c.a*uReveal*(.12+.88*uDim));
          }`
      });
      const s = IV.SLOT[i], mesh = new T.Mesh(geo, mat);
      mesh.position.set(s.x, s.y, s.z); mesh.rotation.y = s.ry; mesh.visible = false; group.add(mesh);
      return { mesh, mat, p, i, rev: 0, hov: 0, cv: null, tex: null, cap: 0, slot: s };
    });

    /* textura perezosa: se crea al acercarte (ahorra memoria con muchos proyectos) */
    async function paint(o, k) {
      const g = o.cv.getContext('2d'), c = o.p.caps[k];
      drawPanel(g, o.p, o.i, null); o.tex.needsUpdate = true;
      if (!c) return;
      const im = await IV.loadImg(c.src); if (!im || o.cap !== k) return;
      drawPanel(g, o.p, o.i, im); o.tex.needsUpdate = true;
    }
    function ensure(o) {
      if (o.tex) return;
      o.cv = document.createElement('canvas'); o.cv.width = CW; o.cv.height = CH;
      o.tex = new T.CanvasTexture(o.cv); o.tex.anisotropy = 4; o.mat.uniforms.map.value = o.tex; paint(o, 0);
    }
    /* galería del detalle: cambia la captura del panel */
    function setCap(i, k) { const o = panels[i]; ensure(o); o.cap = k; paint(o, k); }

    /* --- foco de cámara sobre un panel --- */
    const _n = new T.Vector3(), _r = new T.Vector3(), _fp = new T.Vector3(), _fl = new T.Vector3();
    function focus(i) {
      const m = panels[i].mesh, ry = m.rotation.y;
      _n.set(Math.sin(ry), 0, Math.cos(ry)); _r.set(Math.cos(ry), 0, -Math.sin(ry));
      /* encuadre: el panel ocupa la parte libre de pantalla (la ventana de info va a la derecha) */
      const wide = cam.aspect > 1.1, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      let d, ox, oy = 0;
      if (wide) {
        const f = THREE.MathUtils.clamp((innerWidth - 460) / innerWidth, .45, .75);
        d = Math.max(3.8, 5 / (.9 * f * 2 * tanH * cam.aspect));
        ox = (.5 - f / 2) * 2 * d * tanH * cam.aspect;
      } else { d = THREE.MathUtils.clamp(5.6 / (1.155 * cam.aspect), 4.6, 14); ox = 0; oy = -.3 * d * .25; }
      _fp.copy(m.position).addScaledVector(_n, d).addScaledVector(_r, ox); _fp.y += oy;
      _fl.copy(m.position).addScaledVector(_r, ox); _fl.y += oy;
      return { pos: _fp, look: _fl };
    }

    const ray = new T.Raycaster(), ndc = new T.Vector2();
    function pickAt() {                                  // panel bajo el puntero (o -1); sirve también para toques
      ndc.set(S.mx * 2 - 1, S.my * 2 - 1); ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(panels.filter(o => o.rev > .55).map(o => o.mesh))[0];
      return hit ? panels.findIndex(o => o.mesh === hit.object) : -1;
    }
    /* progreso de scroll con el que el panel i queda de frente (para viajar hasta él sin saltos) */
    const pOf = i => IV.pAtZ(IV.SLOT[i].z + 9);

    IV.scenes.roster = {
      group, panels, focus, setCap, pickAt, pOf, sector: null,
      range: [P.roster - .06, P.rosterEnd + .03],
      update() {
        const t = S.t, camZ = cam.position.z;
        const active = S.sel < 0 && S.ps > P.roster - .04 && S.ps < P.rosterEnd + .03;
        const hov = active ? pickAt() : -1;
        S.hover = hov;
        panels.forEach((o, i) => {
          const m = o.mesh, dz = camZ - o.slot.z;                 // >0: el panel está por delante
          /* aparición continua con la distancia: emerge de la niebla al acercarte y se desvanece al alejarte */
          let target = dz >= 0 ? IV.ss(78, 40, dz) : IV.ss(-46, -22, dz);
          if (S.sel >= 0) target = i === S.sel ? 1 : target * .5;
          o.rev += (target - o.rev) * .12;
          if (dz < 105 && dz > -50) ensure(o);
          m.visible = o.rev > .01;
          if (!m.visible) return;
          o.hov += ((i === hov ? 1 : 0) - o.hov) * .15;
          m.position.y += ((o.slot.y + Math.sin(t * .8 + i * 1.3) * .08 + o.hov * .12) - m.position.y) * .1;
          /* se inclinan hacia el cursor al pasar por encima */
          m.rotation.y += ((o.slot.ry + (S.sx - .5) * .18 * o.hov) - m.rotation.y) * .1;
          m.rotation.x += ((-(S.sy - .5) * .16 * o.hov) - m.rotation.x) * .1;
          const s = (.88 + .12 * o.rev) * (1 + o.hov * .07); m.scale.set(s, s, 1);
          const u = o.mat.uniforms; u.uTime.value = t; u.uReveal.value = o.rev; u.uHover.value = o.hov;
          u.uDim.value += ((S.sel < 0 || i === S.sel ? 1 : .12) - u.uDim.value) * .12;
        });
      }
    };
    IV.sceneList.push(IV.scenes.roster);
  }]);
})();
