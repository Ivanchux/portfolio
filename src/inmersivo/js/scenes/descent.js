/* =========================================================
   scenes/descent.js — pozo subterráneo de cristal azul.
   Cámara-dron que gira siguiendo la curva. Anillos-checkpoint
   con la profundidad, placas flotantes con las "capas"
   (habilidades) y burbujas Aero subiendo por el pozo.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;
  const CX = 0, CZ = -103;                    // eje del pozo

  IV.build.push(['Descenso · cueva de cristal', () => {
    const S = IV.S, P = IV.P, env = IV.env;
    const group = new T.Group(); IV.scene.add(group); group.position.z = IV.OFF;

    /* --- pared del pozo: roca procedural + vetas aqua; vira a rojo al fondo --- */
    const wall = new T.Mesh(new T.CylinderGeometry(24, 24, 116, 48, 1, true), new T.ShaderMaterial({
      side: T.BackSide, uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: `varying vec3 vW;uniform float uT;
        float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
        float fbm(vec3 p){return n3(p)*.55+n3(p*2.1)*.3+n3(p*4.3)*.15;}
        void main(){
          vec3 p=vW;
          float rock=fbm(p*.16);
          float depth=clamp(-p.y/115.,0.,1.);
          vec3 top=vec3(.06,.28,.40),mid=vec3(.02,.07,.26),bot=vec3(.24,.03,.05);
          vec3 base=mix(mix(top,mid,smoothstep(0.,.5,depth)),bot,smoothstep(.82,1.,depth));
          float vein=pow(abs(sin(fbm(p*.22+vec3(0.,uT*.03,0.))*14.)),9.);
          vec3 col=base*(.35+rock*1.5)+vec3(.2,.9,1.)*vein*.5*(1.-depth*.7);
          float d=length(p-cameraPosition);
          col=mix(col,vec3(.01,.03,.09),1.-exp(-d*.02));
          gl_FragColor=vec4(col,1.);
        }`
    }));
    wall.position.set(CX, -58, CZ); group.add(wall);

    /* --- cristales instanciados --- */
    const nC = IV.LOW ? 120 : 280;
    const cry = new T.InstancedMesh(new T.OctahedronGeometry(1),
      new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0x0a3a8a, emissiveIntensity: .8, roughness: .16, metalness: .25, flatShading: true, envMap: env, envMapIntensity: 1.4 }), nC);
    const dm = new T.Object3D(), q = new T.Quaternion(), upv = new T.Vector3(0, 1, 0), dirv = new T.Vector3(), col = new T.Color();
    const pal = [0x2f7bff, 0x35d4ff, 0x5a6cff, 0x7a4dff, 0x2fe0d0];
    for (let i = 0; i < nC; i++) {
      const y = -6 - IV.rnd() * 106, wallSide = IV.rnd() < .65;
      const r = wallSide ? 19 + IV.rnd() * 3 : 8 + IV.rnd() * 10, a = IV.rnd() * 6.283;
      dm.position.set(CX + Math.cos(a) * r, y, CZ + Math.sin(a) * r);
      dirv.set(-Math.cos(a) * (wallSide ? 1 : .2) + (IV.rnd() - .5) * .6, (IV.rnd() - .5) * 1.4, -Math.sin(a) * (wallSide ? 1 : .2) + (IV.rnd() - .5) * .6).normalize();
      q.setFromUnitVectors(upv, dirv); dm.quaternion.copy(q);
      const w = .5 + IV.rnd() * 1.4; dm.scale.set(w, w * (2.2 + IV.rnd() * 3.5), w); dm.updateMatrix();
      cry.setMatrixAt(i, dm.matrix);
      col.setHex(pal[i % pal.length]); col.offsetHSL(0, 0, (IV.rnd() - .5) * .15); cry.setColorAt(i, col);
    }
    group.add(cry);

    /* --- haces de luz desde la trampilla --- */
    const shaftTex = IV.canvasTex(64, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(120,235,255,0)'); gr.addColorStop(.5, 'rgba(160,245,255,.9)'); gr.addColorStop(1, 'rgba(120,235,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, w, h);
    });
    const shafts = [];
    for (let i = 0; i < 6; i++) {
      const m = new T.Mesh(new T.PlaneGeometry(3 + IV.rnd() * 3, 70), new T.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: .16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      m.position.set(CX + (IV.rnd() - .5) * 8, -34, CZ + (IV.rnd() - .5) * 8); m.rotation.y = IV.rnd() * 3; m.rotation.z = (IV.rnd() - .5) * .22; group.add(m); shafts.push(m);
    }

    /* --- anillos-checkpoint con profundidad --- */
    const rings = [], nR = IV.LOW ? 10 : 16;
    const rm = new T.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false });
    const tmpP = new T.Vector3(), tmpT = new T.Vector3();
    for (let i = 0; i < nR; i++) {
      const p = IV.mix(P.d1 + .01, P.contact - .02, i / (nR - 1));
      IV.path.getPointAt(p, tmpP); IV.path.getPointAt(Math.min(p + .004, 1), tmpT);
      const r = new T.Group(); r.position.set(tmpP.x, tmpP.y, tmpP.z - IV.OFF); r.lookAt(tmpT);
      const a = new T.Mesh(new T.TorusGeometry(2.6, .05, 8, 72), rm), b = new T.Mesh(new T.TorusGeometry(2.9, .018, 6, 72), rm);
      r.add(a, b);
      if (i % 3 === 1) {                                   // etiqueta de profundidad
        const m = Math.round(-tmpP.y), tex = IV.canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#eaffff'; g.font = '400 34px ' + IV.F.mono; g.textAlign = 'center'; g.shadowColor = '#35d4ff'; g.shadowBlur = 12; g.fillText('−' + String(m).padStart(3, '0') + ' m', w / 2, 44); });
        const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
        s.scale.set(2.8, .7, 1); s.position.set(0, 3.5, 0); r.add(s);
      }
      group.add(r); rings.push({ r, a, b, i, y: tmpP.y });
    }

    /* --- placas flotantes (se leen mirando hacia abajo): una capa por habilidad + el expediente clasificado --- */
    function wrap(g, text, x, y, maxW, lh, maxLines) {
      const words = String(text).split(' '); let line = '', n = 0;
      for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (g.measureText(t).width > maxW && line) { if (++n >= maxLines) { g.fillText(line + '…', x, y); return y + lh; } g.fillText(line, x, y); y += lh; line = w; } else line = t;
      }
      g.fillText(line, x, y); return y + lh;
    }
    const nS = IV.SLABS.length;
    IV.SLABS.forEach((sl, i) => {
      const F = IV.F, U = IV.UI;
      const tex = IV.canvasTex(768, 480, (g, W, H) => {
        const bg = g.createLinearGradient(0, 0, 0, H);
        if (sl.classified) { bg.addColorStop(0, 'rgba(255,170,150,.5)'); bg.addColorStop(1, 'rgba(70,10,20,.78)'); } else { bg.addColorStop(0, 'rgba(150,235,255,.55)'); bg.addColorStop(1, 'rgba(10,60,110,.7)'); }
        g.fillStyle = bg; IV.rr(g, 4, 4, W - 8, H - 8, 30); g.fill(); g.strokeStyle = 'rgba(230,252,255,.95)'; g.lineWidth = 4; IV.rr(g, 4, 4, W - 8, H - 8, 30); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.25)'; IV.rr(g, 14, 12, W - 28, 56, 18); g.fill();
        g.textBaseline = 'alphabetic'; g.fillStyle = '#eaffff'; g.font = '400 26px ' + F.mono; g.fillText(sl.classified ? U.classifiedLbl : String(i + 1).padStart(2, '0') + ' · ' + U.skillsLbl, 70, 49);
        const o = g.createRadialGradient(40, 36, 1, 40, 40, 14); o.addColorStop(0, '#fff'); o.addColorStop(.4, sl.classified ? '#ff9a7a' : '#7be4ff'); o.addColorStop(1, sl.classified ? '#a02a1a' : '#0a6aa8'); g.fillStyle = o; g.beginPath(); g.arc(40, 40, 14, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.shadowColor = '#0a3a6a'; g.shadowBlur = 14;
        g.font = '600 ' + (sl.title.length > 22 ? 42 : 52) + 'px ' + F.ui;
        let y = wrap(g, sl.title.toUpperCase(), 40, 128, W - 80, 54, 2); g.shadowBlur = 0;
        g.fillStyle = '#e6fbff'; g.font = '400 28px ' + F.txt; y = wrap(g, sl.text, 40, y + 12, W - 80, 36, sl.classified ? 3 : 3);
        if (sl.classified) {                                   // líneas tachadas: lo que todavía no se puede enseñar
          for (let k = 0; k < (sl.lines || 4); k++) { g.fillStyle = '#12060a'; g.fillRect(40, y + 6 + k * 30, W - 80 - ((k * 97) % 170), 20); }
        } else {
          g.fillStyle = '#8dff4e'; g.font = '400 27px ' + F.mono;
          (sl.items || sl.projects || []).slice(0, 5).forEach((s, k) => g.fillText('> ' + s, 44, Math.max(y + 18, 330) + k * 36, W - 90));
        }
        const gl = g.createLinearGradient(0, 0, W, H * .5); gl.addColorStop(0, 'rgba(255,255,255,.3)'); gl.addColorStop(.6, 'rgba(255,255,255,0)'); g.fillStyle = gl; IV.rr(g, 4, 4, W - 8, H * .5, 30); g.fill();
      });
      const m = new T.Mesh(new T.PlaneGeometry(7.2, 4.5), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: T.DoubleSide }));
      IV.path.getPointAt(IV.slabP(i, nS), tmpP);
      m.rotation.x = -Math.PI / 2; m.position.set(tmpP.x + (i % 2 ? 1 : -1) * 4.4, tmpP.y - 3.2, tmpP.z + 1.2 - IV.OFF); m.userData.y0 = m.position.y;
      group.add(m); sl.mesh = m; sl.hv = 0;
    });

    /* --- burbujas y plancton --- */
    const bub = IV.makeBubbles(IV.LOW ? 50 : 150, { x: CX, y: -58, z: CZ + IV.OFF, w: 30, h: 116, d: 30 }, .34, 0x7ff0ff); group.add(bub.mesh);
    const nP = IV.LOW ? 250 : 700, pp = new Float32Array(nP * 3);
    for (let i = 0; i < nP; i++) { const a = IV.rnd() * 6.283, r = 3 + IV.rnd() * 20; pp[i * 3] = CX + Math.cos(a) * r; pp[i * 3 + 1] = -4 - IV.rnd() * 112; pp[i * 3 + 2] = CZ + Math.sin(a) * r; }
    const plankton = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(pp, 3)), new T.PointsMaterial({ color: 0x8ff6ff, size: .09, transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false }));
    group.add(plankton);

    const ray = new T.Raycaster(), ndc = new T.Vector2();
    function pickSlab() {
      ndc.set(S.mx * 2 - 1, S.my * 2 - 1); ray.setFromCamera(ndc, IV.cam);
      const hit = ray.intersectObjects(IV.SLABS.map(x => x.mesh))[0]; if (!hit) return -1;
      const i = IV.SLABS.findIndex(x => x.mesh === hit.object); return IV.SLABS[i].link ? i : -1;
    }
    IV.scenes.descent = {
      pickSlab, group, range: [P.hardwareEnd - .01, P.contact + .02],
      update() {
        const t = S.t, camY = IV.cam.position.y;
        wall.material.uniforms.uT.value = t;
        rings.forEach(o => {
          const near = Math.exp(-Math.pow((camY - o.y) / 6, 2));
          o.a.rotation.z = t * .4 + o.i; o.b.rotation.z = -t * .3 + o.i;
          const s = 1 + near * .18 + Math.sin(t * 2 + o.i) * .02; o.r.scale.set(s, s, s);
        });
        /* las capas con proyectos son clicables: te llevan de vuelta a su proyecto (viaje continuo) */
        const hs = (S.sel < 0 && S.ps > P.d1 - .02 && S.ps < P.contact - .01) ? pickSlab() : -1; S.slab = hs;
        IV.SLABS.forEach((sl, i) => {
          sl.hv += ((i === hs ? 1 : 0) - sl.hv) * .15;
          sl.mesh.position.y = sl.mesh.userData.y0 + Math.sin(t * .9 + i * 2) * .25 + sl.hv * .4;
          sl.mesh.material.color.setScalar(1 + sl.hv * .35); sl.mesh.scale.setScalar(1 + sl.hv * .05);
        });
        shafts.forEach((s, i) => { s.material.opacity = .12 + .06 * Math.sin(t * .6 + i); });
        plankton.rotation.y = t * .01;
        if (!IV.RM) cry.rotation.y = Math.sin(t * .05) * .02;
        bub.update(t);
      }
    };
    IV.sceneList.push(IV.scenes.descent);
  }]);
})();
