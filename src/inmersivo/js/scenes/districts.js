/* =========================================================
   scenes/districts.js — el mundo continuo del roster.
   Un suelo cuyo color cambia suavemente con el recorrido, una puerta
   (anillo + rótulo) por distrito, pedestales bajo cada proyecto y
   decorado propio de cada tipo:
     web → ventanas de cristal y burbujas · juegos → bloques y neones
     estudio → libros, colinas y burbujas verdes · sistemas → racks con LEDs
   Nada aparece "de golpe": todo emerge de la niebla al acercarte.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;

  IV.build.push(['Distritos · web, juegos, estudio, sistemas', () => {
    const DIS = IV.DISTRICTS, S = IV.S, env = IV.env;
    if (!DIS.length) return;
    const group = new T.Group(); IV.scene.add(group);
    const zTop = DIS[0].gate + 14, zBot = IV.ZEND - 8, zc = (zTop + zBot) / 2, len = zTop - zBot;
    const Y = -2.4, col = h => new T.Color(h), rnd = IV.rnd;

    /* --- suelo continuo: la paleta se muestrea por z (de un distrito al siguiente sin cortes) --- */
    const pw = 256, pd = new Uint8Array(pw * 4);
    const cs = DIS.map(d => ({ z: d.center, c: col(d.cat.color) })), tmp = new T.Color();
    for (let i = 0; i < pw; i++) {
      const z = IV.mix(zTop, zBot, i / (pw - 1));
      let k = 0; while (k < cs.length - 1 && z < (cs[k].z + cs[k + 1].z) / 2) k++;
      const a = cs[Math.max(0, k)], b = cs[Math.min(cs.length - 1, k + 1)];
      const t = a === b ? 0 : IV.ss(a.z, b.z, z);
      tmp.copy(a.c).lerp(b.c, t);
      pd[i * 4] = tmp.r * 255; pd[i * 4 + 1] = tmp.g * 255; pd[i * 4 + 2] = tmp.b * 255; pd[i * 4 + 3] = 255;
    }
    const palTex = new T.DataTexture(pd, pw, 1, T.RGBAFormat); palTex.minFilter = palTex.magFilter = T.LinearFilter; palTex.needsUpdate = true;
    const floorMat = new T.ShaderMaterial({
      uniforms: { uPal: { value: palTex }, uZ0: { value: zTop }, uZ1: { value: zBot }, uFog: { value: new T.Color() }, uDen: { value: .02 }, uT: { value: 0 } },
      vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: `varying vec3 vW;uniform sampler2D uPal;uniform float uZ0,uZ1,uDen,uT;uniform vec3 uFog;
        void main(){
          float t=clamp((vW.z-uZ0)/(uZ1-uZ0),0.,1.);
          vec3 pc=texture2D(uPal,vec2(t,.5)).rgb;
          vec2 q=vW.xz/2.;vec2 d=abs(fract(q+.5)-.5);
          float l=smoothstep(.04,.0,min(d.x,d.y));
          vec2 d5=abs(fract(q/5.+.5)-.5)*5.;float L=smoothstep(.07,.0,min(d5.x,d5.y));
          float ax=abs(vW.x);
          float lane=smoothstep(2.6,2.2,ax)*(.5+.5*sin(vW.z*.5-uT*2.));   /* carril central con pulso que avanza */
          float edge=smoothstep(19.,6.,ax);
          vec3 base=pc*.10+vec3(.01,.03,.05);
          vec3 c=base+pc*(l*.28+L*.55)*edge+pc*lane*.22+pc*smoothstep(.3,.0,abs(ax-2.5))*.35;
          float dist=length(vW-cameraPosition);
          c=mix(c,uFog,1.-exp(-pow(dist*uDen,2.)));
          gl_FragColor=vec4(c,1.);
        }`
    });
    const floor = new T.Mesh(new T.PlaneGeometry(46, len), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, Y, zc); group.add(floor);

    /* --- puertas: anillo de cristal + rótulo con nombre, cantidad y descripción --- */
    const gates = [];
    DIS.forEach((d, di) => {
      const c = d.cat, g = new T.Group(); g.position.set(0, 0, d.gate);
      const m = new T.MeshBasicMaterial({ color: col(c.color), transparent: true, opacity: .85, blending: T.AdditiveBlending, depthWrite: false });
      const r1 = new T.Mesh(new T.TorusGeometry(7.2, .11, 10, 96), m), r2 = new T.Mesh(new T.TorusGeometry(7.7, .035, 8, 96), m);
      r1.position.y = r2.position.y = 1.2; g.add(r1, r2);
      for (const s of [-1, 1]) { const p = new T.Mesh(new T.BoxGeometry(.18, 9, .18), m); p.position.set(s * 7.2, 1.2 - 2.4 + 2.1, 0); g.add(p); }
      const n = d.idx.length, F = IV.F;
      const tex = IV.canvasTex(1024, 300, (x, W, H) => {
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
    const dm = new T.Object3D(), cc = new T.Color();
    IV.PROJECTS.forEach((p, i) => {
      const s = IV.SLOT[i]; cc.set(p.color);
      dm.position.set(s.x, Y + .04, s.z); dm.updateMatrix(); ped.setMatrixAt(i, dm.matrix); ped.setColorAt(i, cc);
      dm.position.set(s.x, Y + 2.8, s.z); dm.updateMatrix(); beam.setMatrixAt(i, dm.matrix); beam.setColorAt(i, cc);
    });
    group.add(ped, beam);

    /* --- decorado por tipo --- */
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

    DIS.forEach((d, di) => {
      const z0 = d.gate - 3, z1 = d.end + 3, L = z0 - z1, rz = () => z0 - rnd() * L, side = () => (rnd() < .5 ? -1 : 1), accent = col(d.cat.color);
      const nProp = Math.max(10, Math.round(L * (IV.LOW ? .45 : .9)));
      if (d.style === 0) {                                   // WEB · ventanas de cristal que flotan
        const mesh = new T.InstancedMesh(new T.PlaneGeometry(3.2, 2.2), winMat, nProp), base = [];
        for (let i = 0; i < nProp; i++) base.push({ x: side() * (9 + rnd() * 16), y: Y + 1.5 + rnd() * 9, z: rz(), r: (rnd() - .5) * 1.6, s: .7 + rnd() * 1.6, p: rnd() * 6 });
        group.add(mesh);
        const bub = IV.makeBubbles(IV.LOW ? 14 : 40, { x: 0, y: 4, z: d.center, w: 36, h: 14, d: L }, .3, accent.getHex()); group.add(bub.mesh);
        props.push({ z: d.center, L, up(t) { base.forEach((b, i) => { dm.position.set(b.x, b.y + Math.sin(t * .6 + b.p) * .4, b.z); dm.rotation.set(0, b.r + Math.sin(t * .25 + b.p) * .15, 0); dm.scale.setScalar(b.s); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix); }); mesh.instanceMatrix.needsUpdate = true; bub.update(t); } });
      } else if (d.style === 1) {                            // JUEGOS · bloques-píxel y pilonos de neón
        const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0x552211, emissiveIntensity: .8, roughness: .35, metalness: .2, envMap: env, envMapIntensity: .6 }), nProp), base = [];
        const pal = [0xff4aa8, 0xffb347, 0xffe45a, 0x35d4ff, 0xff6a3a];
        for (let i = 0; i < nProp; i++) { base.push({ x: side() * (8 + rnd() * 17), y: Y + .5 + rnd() * 8, z: rz(), s: .6 + rnd() * 1.6, p: rnd() * 6, v: .2 + rnd() * .6 }); cc.setHex(pal[i % pal.length]); mesh.setColorAt(i, cc); }
        group.add(mesh);
        const pyl = new T.InstancedMesh(new T.BoxGeometry(.22, 12, .22), new T.MeshBasicMaterial({ color: accent }), Math.round(L / 6) * 2 + 2); let k = 0;
        for (let z = z0 - 2; z > z1; z -= 6) for (const s of [-1, 1]) { dm.position.set(s * 9, Y + 6, z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.updateMatrix(); pyl.setMatrixAt(k++, dm.matrix); }
        pyl.count = k; group.add(pyl);
        props.push({ z: d.center, L, up(t) { base.forEach((b, i) => { dm.position.set(b.x, b.y + Math.sin(t * b.v + b.p) * .6, b.z); dm.rotation.set(t * b.v * .5 + b.p, t * b.v + b.p, 0); dm.scale.setScalar(b.s); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix); }); mesh.instanceMatrix.needsUpdate = true; } });
      } else if (d.style === 2) {                            // ESTUDIO · libros flotando, colinas y burbujas verdes
        const mesh = new T.InstancedMesh(new T.BoxGeometry(1.3, .2, .95), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: .05 }), nProp), base = [];
        for (let i = 0; i < nProp; i++) { base.push({ x: side() * (8 + rnd() * 14), y: Y + 1 + rnd() * 7, z: rz(), s: .8 + rnd() * .9, p: rnd() * 6 }); cc.setHex(bookCols[i % bookCols.length]); mesh.setColorAt(i, cc); }
        group.add(mesh);
        const hills = new T.MeshStandardMaterial({ color: 0x2f7d3e, roughness: .95, flatShading: false });
        for (let k = 0; k < Math.max(3, Math.round(L / 9)); k++) { const h = new T.Mesh(new T.SphereGeometry(1, 20, 12, 0, 6.283, 0, 1.571), hills); h.scale.set(9 + rnd() * 8, 2 + rnd() * 3, 9 + rnd() * 8); h.position.set(side() * (19 + rnd() * 10), Y, rz()); group.add(h); }
        const bub = IV.makeBubbles(IV.LOW ? 14 : 36, { x: 0, y: 4, z: d.center, w: 34, h: 14, d: L }, .38, 0x9dffb0); group.add(bub.mesh);
        props.push({ z: d.center, L, up(t) { base.forEach((b, i) => { dm.position.set(b.x, b.y + Math.sin(t * .5 + b.p) * .5, b.z); dm.rotation.set(Math.sin(t * .3 + b.p) * .3, t * .15 + b.p, Math.sin(t * .4 + b.p) * .2); dm.scale.setScalar(b.s); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix); }); mesh.instanceMatrix.needsUpdate = true; bub.update(t); } });
      } else {                                               // SISTEMAS · torres de servidores con LEDs
        const n = Math.max(6, Math.round(L / 3.2)) * 2, mesh = new T.InstancedMesh(new T.BoxGeometry(1.4, 1, 1.5), ledMat, n); let k = 0;
        for (let z = z0 - 1; z > z1 && k < n - 1; z -= 3.2) for (const s of [-1, 1]) {
          const h = 5 + rnd() * 9; dm.position.set(s * (9 + rnd() * 3), Y + h / 2, z); dm.rotation.set(0, 0, 0); dm.scale.set(1, h, 1); dm.updateMatrix(); mesh.setMatrixAt(k++, dm.matrix);
        }
        mesh.count = k; group.add(mesh);
        props.push({ z: d.center, L, up(t) { ledMat.uniforms.uT.value = t; } });
      }
    });

    IV.scenes.districts = {
      group, range: [IV.P.roster - .06, IV.P.hardware + .01],
      update() {
        const t = S.t, p = IV.PAL, camZ = IV.cam.position.z;
        floorMat.uniforms.uFog.value.copy(p.fog); floorMat.uniforms.uDen.value = p.den; floorMat.uniforms.uT.value = t;
        gates.forEach(o => { o.r1.rotation.z = t * .2 + o.di; o.r2.rotation.z = -t * .15; const near = Math.exp(-Math.pow((camZ - o.g.position.z) / 9, 2)); o.r1.scale.setScalar(1 + near * .06); o.sp.material.opacity = IV.ss(52, 20, Math.abs(camZ - o.g.position.z)); });
        props.forEach(o => { if (Math.abs(camZ - o.z) < o.L / 2 + 95) o.up(t); });   // solo anima lo cercano
      }
    };
    IV.sceneList.push(IV.scenes.districts);
  }]);
})();
