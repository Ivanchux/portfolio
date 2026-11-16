/* =========================================================
   scenes/districts.js — el mundo del roster, hecho de ISLAS y PUENTES.
   Cada categoría es una isla en un sitio distinto (a un lado, más alta o más baja):
     web → terraza de cristal con ventanas y burbujas
     juegos → pista elevada sobre el vacío, con neones, bloques y rejilla abajo
     estudio → valle con colinas, árboles, libros flotando y burbujas verdes
     sistemas → nave de servidores con arcos de cables y torres con LEDs
   Entre islas hay puentes estrechos que giran, suben o bajan, y el último
   entra en la sala de máquinas. Todo emerge de la niebla: nada aparece de golpe.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;
  const UP = new T.Vector3(0, 1, 0);

  IV.build.push(['Islas · web, juegos, estudio, sistemas', () => {
    const DIS = IV.DISTRICTS, S = IV.S, P = IV.P, env = IV.env;
    if (!DIS.length) return;
    const group = new T.Group(); IV.scene.add(group);
    const col = h => new T.Color(h), rnd = IV.rnd, F = IV.F;
    const u0 = P.roster - .02, u1 = P.rosterEnd + .012, len = (u1 - u0) * IV.PATH_LEN;
    const zTop = IV.path.getPointAt(u0).z, zBot = IV.path.getPointAt(u1).z;
    const _p = new T.Vector3(), _t = new T.Vector3(), _r = new T.Vector3(), dm = new T.Object3D(), cc = new T.Color();

    /* ancho del suelo en cada punto: ancho en las islas, estrecho (puente) entre ellas */
    const island = z => { let w = 0; DIS.forEach(d => { w = Math.max(w, IV.ss(d.gate + 10, d.gate - 4, z) * (1 - IV.ss(d.end + 4, d.end - 8, z))); }); return w; };

    /* --- suelo continuo: sigue el camino (curvas incluidas); la paleta se muestrea por z --- */
    const pw = 256, pd = new Uint8Array(pw * 4), cs = DIS.map(d => ({ z: d.center, c: col(d.cat.color) })), tmp = new T.Color();
    for (let i = 0; i < pw; i++) {
      const z = IV.mix(zTop, zBot, i / (pw - 1));
      let k = 0; while (k < cs.length - 1 && z < (cs[k].z + cs[k + 1].z) / 2) k++;
      const a = cs[k], b = cs[Math.min(cs.length - 1, k + 1)], t = a === b ? 0 : IV.ss(a.z, b.z, z);
      tmp.copy(a.c).lerp(b.c, t); pd[i * 4] = tmp.r * 255; pd[i * 4 + 1] = tmp.g * 255; pd[i * 4 + 2] = tmp.b * 255; pd[i * 4 + 3] = 255;
    }
    const palTex = new T.DataTexture(pd, pw, 1, T.RGBAFormat); palTex.minFilter = palTex.magFilter = T.LinearFilter; palTex.needsUpdate = true;
    const nS = Math.ceil(len / 1.4), pos = new Float32Array(nS * 2 * 3), lat = new Float32Array(nS * 2), wid = new Float32Array(nS * 2), idxs = [];
    for (let i = 0; i < nS; i++) {
      const u = IV.mix(u0, u1, i / (nS - 1)); IV.path.getPointAt(u, _p); _t.copy(IV.path.getTangentAt(u)); _r.crossVectors(_t, UP).normalize();
      const w = IV.mix(5.2, 21, island(_p.z)), y = _p.y + IV.mix(-2.4, -1, IV.ss(zBot + 30, zBot + 4, _p.z));
      for (const s of [0, 1]) { const sg = s ? 1 : -1, o = (i * 2 + s) * 3; pos[o] = _p.x + _r.x * sg * w; pos[o + 1] = y; pos[o + 2] = _p.z + _r.z * sg * w; lat[i * 2 + s] = sg * w; wid[i * 2 + s] = w; }
      if (i) { const a = (i - 1) * 2; idxs.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(pos, 3)); fg.setAttribute('aLat', new T.BufferAttribute(lat, 1)); fg.setAttribute('aW', new T.BufferAttribute(wid, 1)); fg.setIndex(idxs);
    const floorMat = new T.ShaderMaterial({
      side: T.DoubleSide,
      uniforms: { uPal: { value: palTex }, uZ0: { value: zTop }, uZ1: { value: zBot }, uFog: { value: new T.Color() }, uDen: { value: .02 }, uT: { value: 0 } },
      vertexShader: 'attribute float aLat,aW;varying vec3 vW;varying float vL,vWd;void main(){vW=position;vL=aLat;vWd=aW;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vW;varying float vL,vWd;uniform sampler2D uPal;uniform float uZ0,uZ1,uDen,uT;uniform vec3 uFog;
        void main(){
          float t=clamp((vW.z-uZ0)/(uZ1-uZ0),0.,1.);
          vec3 pc=texture2D(uPal,vec2(t,.5)).rgb;
          /* cristal con cáusticas de agua (sin rejilla): brillo en el centro, luz que baila y destellos */
          vec2 q=vW.xz*.32;
          float c1=sin(q.x*3.+uT*.6+sin(q.y*2.7+uT*.4)*1.6),c2=sin(q.y*3.4-uT*.5+sin(q.x*2.3-uT*.3)*1.4),c3=sin((q.x+q.y)*2.1+uT*.35);
          float caus=pow(max(0.,(c1+c2+c3)*.2+.5),3.);
          float ax=abs(vL);
          float rel=ax/max(vWd,1.);
          float lane=smoothstep(2.8,2.0,ax)*(.55+.45*sin(vW.z*.35+vW.x*.2-uT*1.6));
          float edge=smoothstep(vWd,vWd-5.,ax);
          float rim=smoothstep(.8,.0,vWd-ax);
          float sheen=pow(1.-rel,2.2);
          float spark=step(.9965,fract(sin(dot(floor(vW.xz*5.),vec2(12.9898,78.233)))*43758.5453))*(.5+.5*sin(uT*3.+vW.x));
          vec3 base=pc*.36+vec3(.03,.07,.11);
          vec3 c=base+pc*caus*.5*edge+pc*sheen*.22+vec3(.75,.95,1.)*sheen*.10+pc*lane*.30+pc*rim*1.1+vec3(1.)*spark*.7*edge;
          float dist=length(vW-cameraPosition);
          c=mix(c,uFog,1.-exp(-pow(dist*uDen,2.)));
          gl_FragColor=vec4(c,1.);
        }`
    });
    group.add(new T.Mesh(fg, floorMat));

    /* --- puertas: anillo de cristal orientado según el camino + rótulo --- */
    const gates = [];
    DIS.forEach((d, di) => {
      const c = d.cat, g = new T.Group(); IV.path.getPointAt(d.p, _p); _t.copy(IV.path.getTangentAt(d.p)); g.position.copy(_p); g.lookAt(_p.clone().add(_t));
      const m = new T.MeshBasicMaterial({ color: col(c.color), transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false });
      const r1 = new T.Mesh(new T.TorusGeometry(7.2, .11, 10, 96), m), r2 = new T.Mesh(new T.TorusGeometry(7.7, .035, 8, 96), m);
      r1.position.y = r2.position.y = 1.2; g.add(r1, r2);
      for (const s of [-1, 1]) { const p = new T.Mesh(new T.BoxGeometry(.18, 9, .18), m); p.position.set(s * 7.2, -.3, 0); g.add(p); }
      const n = d.idx.length, tex = IV.canvasTex(1024, 300, (x, W) => {
        x.textAlign = 'center'; x.textBaseline = 'alphabetic';
        x.shadowColor = c.color; x.shadowBlur = 28; x.fillStyle = '#fff'; x.font = '600 110px ' + F.ui; x.fillText((c.name || c.label).toUpperCase(), W / 2, 130);
        x.shadowBlur = 10; x.fillStyle = '#bff6ff'; x.font = '400 34px ' + F.mono;
        x.fillText(String(di + 1).padStart(2, '0') + ' · ' + n + ' ' + (n === 1 ? IV.UI.project : IV.UI.projectsN), W / 2, 190);
        x.shadowBlur = 0; x.fillStyle = 'rgba(230,250,255,.85)'; x.font = '400 30px ' + F.txt;
        const t = c.text || '', cut = t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, '') + '…' : t; x.fillText(cut, W / 2, 245);
      });
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      sp.scale.set(15, 4.4, 1); sp.position.set(0, 10.2, 0); g.add(sp);
      group.add(g); gates.push({ r1, r2, g, di, sp });
    });

    /* --- pedestales con el color del disquete bajo cada proyecto --- */
    const N = IV.PROJECTS.length;
    const ped = new T.InstancedMesh(new T.CylinderGeometry(1.5, 1.8, .06, 40), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .28, blending: T.AdditiveBlending, depthWrite: false }), N);
    const beam = new T.InstancedMesh(new T.CylinderGeometry(1.5, 1.6, 5.5, 28, 1, true), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), N);
    IV.PROJECTS.forEach((p, i) => {
      const s = IV.SLOT[i]; cc.set(p.color); const gy = s.gy;
      dm.rotation.set(0, 0, 0); dm.scale.setScalar(1);
      dm.position.set(s.x, gy + .04, s.z); dm.updateMatrix(); ped.setMatrixAt(i, dm.matrix); ped.setColorAt(i, cc);
      dm.position.set(s.x, gy + 2.8, s.z); dm.updateMatrix(); beam.setMatrixAt(i, dm.matrix); beam.setColorAt(i, cc);
    });
    group.add(ped, beam);

    /* --- puentes: luces en los bordes --- */
    const lightsN = Math.ceil(len / 4), edge = new T.InstancedMesh(new T.BoxGeometry(.18, .5, .5), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false }), lightsN * 2); let ek = 0;
    for (let i = 0; i < lightsN; i++) {
      const u = IV.mix(u0, u1, i / (lightsN - 1)); IV.path.getPointAt(u, _p); _t.copy(IV.path.getTangentAt(u)); _r.crossVectors(_t, UP).normalize();
      const iw = island(_p.z); if (iw > .6) continue;
      const k = DIS.findIndex(d => _p.z > d.end - d.bridge - 1 && _p.z <= d.end + 1), dd = DIS[Math.max(0, k)], c = dd ? dd.cat.color : '#35d4ff', w = IV.mix(5.2, 21, iw);
      for (const s of [-1, 1]) { dm.position.set(_p.x + _r.x * s * (w - .2), _p.y - 2.1, _p.z + _r.z * s * (w - .2)); dm.lookAt(dm.position.clone().add(_t)); dm.scale.setScalar(1); dm.updateMatrix(); edge.setMatrixAt(ek, dm.matrix); cc.set(c); edge.setColorAt(ek, cc); ek++; }
    }
    edge.count = ek; group.add(edge);

    /* --- decorado por tipo de isla --- */
    const props = [];
    const winTex = IV.canvasTex(256, 176, (g, w, h) => {
      g.fillStyle = 'rgba(150,230,255,.22)'; IV.rr(g, 4, 4, w - 8, h - 8, 10); g.fill();
      g.strokeStyle = 'rgba(230,252,255,.95)'; g.lineWidth = 3; IV.rr(g, 4, 4, w - 8, h - 8, 10); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(6, 6, w - 12, 22);
      ['#ff8a7a', '#ffd36a', '#8dff7a'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(20 + i * 18, 17, 5, 0, 7); g.fill(); });
      g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 4; i++) g.fillRect(18, 50 + i * 24, w - 36 - ((i * 53) % 90), 8);
    });
    const winMat = new T.MeshBasicMaterial({ map: winTex, transparent: true, depthWrite: false, side: T.DoubleSide, opacity: .9 });
    const bookCols = [0x3c9a4f, 0x7be79a, 0xf2fff4, 0x2f7d3e, 0xbdf5c8];
    const ledMat = new T.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv;uniform float uT;
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          float unit=floor(vUv.y*30.),fy=fract(vUv.y*30.);vec3 c=vec3(.03,.035,.06);
          for(int i=0;i<5;i++){float fi=float(i);float lx=.14+fi*.14;
            float b=step(.5,h(vec2(unit*1.3+fi,floor(uT*(.8+h(vec2(unit,fi))*2.5)))));
            float dd=step(abs(vUv.x-lx),.04)*step(abs(fy-.5),.22);
            vec3 lc=mod(unit+fi,3.)<1.?vec3(.7,.5,1.):(mod(unit+fi,3.)<2.?vec3(.2,.85,1.):vec3(1.,.5,.8));
            c+=lc*dd*(.2+.9*b);}
          c+=vec3(.1,.1,.2)*step(fy,.08);
          gl_FragColor=vec4(c,1.);}`
    });
    const along = (d, step, fn) => { for (let z = d.gate - 4; z > d.end + 2; z -= step) { const u = IV.pAtZ(z); IV.path.getPointAt(u, _p); _t.copy(IV.path.getTangentAt(u)); _r.crossVectors(_t, UP).normalize(); fn(_p, _t, _r, z); } };

    DIS.forEach(d => {
      const z0 = d.gate - 3, z1 = d.end + 3, L = z0 - z1, rz = () => z0 - rnd() * L, side = () => (rnd() < .5 ? -1 : 1), accent = col(d.cat.color), gy = d.ay - 2.4;
      const nProp = Math.max(10, Math.round(L * (IV.LOW ? .45 : .9)));
      if (d.style === 0) {                                   // WEB · terraza de cristal: ventanas flotantes
        const mesh = new T.InstancedMesh(new T.PlaneGeometry(3.2, 2.2), winMat, nProp), base = [];
        for (let i = 0; i < nProp; i++) base.push({ x: d.ax + side() * (9 + rnd() * 16), y: gy + 1.5 + rnd() * 9, z: rz(), r: (rnd() - .5) * 1.6, s: .7 + rnd() * 1.6, p: rnd() * 6 });
        group.add(mesh);
        const bub = IV.makeBubbles(IV.LOW ? 14 : 40, { x: d.ax, y: gy + 5, z: d.center, w: 36, h: 14, d: L }, .3, accent.getHex()); group.add(bub.mesh);
        props.push({ z: d.center, L, up(t) { base.forEach((b, i) => { dm.position.set(b.x, b.y + Math.sin(t * .6 + b.p) * .4, b.z); dm.rotation.set(0, b.r + Math.sin(t * .25 + b.p) * .15, 0); dm.scale.setScalar(b.s); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix); }); mesh.instanceMatrix.needsUpdate = true; bub.update(t); } });
      } else if (d.style === 1) {                            // JUEGOS · pista elevada: pilares al vacío, rejilla abajo, bloques y neones
        const mesh = new T.InstancedMesh(new T.SphereGeometry(.62, 28, 20), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .1, metalness: 0, envMap: env, envMapIntensity: 1.7 }), nProp), base = [];
        const pal = [0xff7ab8, 0xffc15a, 0xfff08a, 0x6fd8ff, 0xff9a6a, 0xa98bff];
        for (let i = 0; i < nProp; i++) { base.push({ x: d.ax + side() * (8 + rnd() * 17), y: gy + .5 + rnd() * 8, z: rz(), s: .6 + rnd() * 1.6, p: rnd() * 6, v: .2 + rnd() * .6 }); cc.setHex(pal[i % pal.length]); mesh.setColorAt(i, cc); }
        group.add(mesh);
        const pil = new T.InstancedMesh(new T.CylinderGeometry(.9, 1.4, 34, 12), new T.MeshStandardMaterial({ color: 0xf4fbff, roughness: .18, metalness: .1, envMap: env, envMapIntensity: 1.2 }), Math.ceil(L / 10) + 2); let pk = 0;
        along(d, 10, p => { dm.position.set(p.x, p.y - 2.4 - 17, p.z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.updateMatrix(); pil.setMatrixAt(pk++, dm.matrix); }); pil.count = pk; group.add(pil);
        props.push({ z: d.center, L, up(t) { base.forEach((b, i) => { dm.position.set(b.x, b.y + Math.abs(Math.sin(t * b.v * 1.6 + b.p)) * 1.4, b.z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(b.s); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix); }); mesh.instanceMatrix.needsUpdate = true; } });
      } else if (d.style === 2) {                            // ESTUDIO · valle: colinas, árboles, libros y burbujas verdes
        const mesh = new T.InstancedMesh(new T.BoxGeometry(1.3, .2, .95), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: .05 }), nProp), base = [];
        for (let i = 0; i < nProp; i++) { base.push({ x: d.ax + side() * (8 + rnd() * 14), y: gy + 1 + rnd() * 7, z: rz(), s: .8 + rnd() * .9, p: rnd() * 6 }); cc.setHex(bookCols[i % bookCols.length]); mesh.setColorAt(i, cc); }
        group.add(mesh);
        const hills = new T.MeshStandardMaterial({ color: 0x2f7d3e, roughness: .95 });
        for (let k = 0; k < Math.max(4, Math.round(L / 7)); k++) { const h = new T.Mesh(new T.SphereGeometry(1, 20, 12, 0, 6.283, 0, 1.571), hills); h.scale.set(9 + rnd() * 9, 2.5 + rnd() * 4, 9 + rnd() * 9); h.position.set(d.ax + side() * (20 + rnd() * 12), gy, rz()); group.add(h); }
        const nT = Math.round(L * (IV.LOW ? .5 : 1.1)), trunk = new T.InstancedMesh(new T.CylinderGeometry(.22, .3, 3, 6), new T.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 }), nT), crown = new T.InstancedMesh(new T.SphereGeometry(1.7, 12, 10), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .7, emissive: 0x0a3a14 }), nT);
        for (let i = 0; i < nT; i++) { const x = d.ax + side() * (8 + rnd() * 16), z = rz(), s = .8 + rnd() * .9; dm.rotation.set(0, 0, 0); dm.scale.setScalar(s); dm.position.set(x, gy + 1.5 * s, z); dm.updateMatrix(); trunk.setMatrixAt(i, dm.matrix); dm.position.set(x, gy + 3.6 * s, z); dm.updateMatrix(); crown.setMatrixAt(i, dm.matrix); cc.setHex(0x3cbf5c).offsetHSL((rnd() - .5) * .08, 0, (rnd() - .5) * .1); crown.setColorAt(i, cc); }
        group.add(trunk, crown);
        const bub = IV.makeBubbles(IV.LOW ? 14 : 36, { x: d.ax, y: gy + 5, z: d.center, w: 34, h: 14, d: L }, .38, 0x9dffb0); group.add(bub.mesh);
        props.push({ z: d.center, L, up(t) { base.forEach((b, i) => { dm.position.set(b.x, b.y + Math.sin(t * .5 + b.p) * .5, b.z); dm.rotation.set(Math.sin(t * .3 + b.p) * .3, t * .15 + b.p, Math.sin(t * .4 + b.p) * .2); dm.scale.setScalar(b.s); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix); }); mesh.instanceMatrix.needsUpdate = true; bub.update(t); } });
      } else {                                               // SISTEMAS · nave de servidores con arcos de cables
        const n = Math.max(6, Math.round(L / 3.2)) * 2, mesh = new T.InstancedMesh(new T.BoxGeometry(1.4, 1, 1.5), ledMat, n); let k = 0;
        along(d, 3.2, (p, t, r) => { for (const s of [-1, 1]) { if (k >= n) return; const h = 5 + rnd() * 9, o = 9 + rnd() * 3; dm.position.set(p.x + r.x * s * o, p.y - 2.4 + h / 2, p.z + r.z * s * o); dm.rotation.set(0, 0, 0); dm.scale.set(1, h, 1); dm.updateMatrix(); mesh.setMatrixAt(k++, dm.matrix); } });
        mesh.count = k; group.add(mesh);
        const arcs = new T.InstancedMesh(new T.TorusGeometry(8.6, .13, 6, 40, Math.PI), new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false }), Math.ceil(L / 8) + 2); let a = 0;
        along(d, 8, (p, t) => { dm.position.set(p.x, p.y - 2.4, p.z); dm.lookAt(p.clone().add(t)); dm.scale.setScalar(1); dm.updateMatrix(); arcs.setMatrixAt(a++, dm.matrix); }); arcs.count = a; group.add(arcs);
        props.push({ z: d.center, L, up(t) { ledMat.uniforms.uT.value = t; } });
      }
    });

    IV.scenes.districts = {
      group, range: [P.roster - .06, P.hardware + .01],
      update() {
        const t = S.t, p = IV.PAL, cam = IV.cam;
        floorMat.uniforms.uFog.value.copy(p.fog); floorMat.uniforms.uDen.value = p.den; floorMat.uniforms.uT.value = t;
        gates.forEach(o => { o.r1.rotation.z = t * .2 + o.di; o.r2.rotation.z = -t * .15; const dist = o.g.position.distanceTo(cam.position); o.r1.scale.setScalar(1 + Math.exp(-Math.pow(dist / 9, 2)) * .06); o.sp.material.opacity = IV.ss(52, 20, dist); });
        props.forEach(o => { if (Math.abs(cam.position.z - o.z) < o.L / 2 + 95) o.up(t); });   // solo anima lo cercano
      }
    };
    IV.sceneList.push(IV.scenes.districts);
  }]);
})();
