/* =========================================================
   scenes/hardware.js — sala de máquinas.
   - Brazos de 3 articulaciones que se abren/cierran según la
     distancia a la cámara (reversible al subir el scroll).
   - Cables de colores, rail con placas, racks con LEDs (ASIR).
   - Trampilla en el suelo que se abre para el descenso.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;

  IV.build.push(['Hardware · brazos, racks y trampilla', () => {
    const S = IV.S, P = IV.P, env = IV.env;
    const group = new T.Group(); IV.scene.add(group); group.position.z = IV.OFF;   // el mundo se desplaza según el largo del roster
    const FLOOR = -1;

    /* materiales: plástico blanco brillante + cristal + metal oscuro */
    const white = new T.MeshStandardMaterial({ color: 0xb9ccd9, roughness: .28, metalness: .15, envMap: env, envMapIntensity: .5 });
    const dark = new T.MeshStandardMaterial({ color: 0x1b2631, roughness: .45, metalness: .6, envMap: env, envMapIntensity: .9 });
    const glass = new T.MeshStandardMaterial({ color: 0x7fe9ff, roughness: .05, metalness: .1, envMap: env, envMapIntensity: 1.8, transparent: true, opacity: .6 });
    const pcb = new T.MeshStandardMaterial({ color: 0x23c552, emissive: 0x0b6a1f, roughness: .5 });

    /* --- suelo con agujero para la trampilla (ShapeGeometry con hueco) --- */
    const sh = new T.Shape(); sh.moveTo(-15, 48); sh.lineTo(15, 48); sh.lineTo(15, 116); sh.lineTo(-15, 116); sh.closePath();
    const hole = new T.Path(); hole.moveTo(-3, 101); hole.lineTo(-3, 107); hole.lineTo(3, 107); hole.lineTo(3, 101); hole.closePath(); sh.holes.push(hole);
    const fg = new T.ShapeGeometry(sh);
    const floor = new T.Mesh(fg, new T.MeshStandardMaterial({ color: 0x0c1722, roughness: .32, metalness: .55, envMap: env, envMapIntensity: .7 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; group.add(floor);
    const fgrid = new T.Mesh(fg, IV.gridMat(0x35d4ff, 1.5, .03)); fgrid.rotation.x = -Math.PI / 2; fgrid.position.y = FLOOR + .012; group.add(fgrid);

    /* --- brazos --- */
    const gBase = new T.CylinderGeometry(.62, .8, .8, 24), gTurn = new T.CylinderGeometry(.46, .5, .26, 24);
    const gJoint = new T.SphereGeometry(.33, 20, 16), gJointS = new T.SphereGeometry(.24, 16, 12);
    const gUp = new T.BoxGeometry(2, .36, .36), gFore = new T.BoxGeometry(1.7, .3, .3);
    const gGrip = new T.BoxGeometry(.42, .07, .12), gRing = new T.CylinderGeometry(.37, .37, .08, 20);
    const N = IV.LOW ? 9 : 17, arms = [];
    function makeArm(side, i) {
      const g = new T.Group(); g.position.set(side * 3.5, FLOOR, -56 - i * 2.4); g.rotation.y = side > 0 ? Math.PI : 0;
      const base = new T.Mesh(gBase, white); base.position.y = .4; g.add(base);
      const turn = new T.Mesh(gTurn, dark); turn.position.y = .93; g.add(turn);
      const sP = new T.Group(); sP.position.set(0, 1.15, 0); g.add(sP);
      const ring = new T.Mesh(gRing, dark); ring.rotation.x = Math.PI / 2;
      sP.add(new T.Mesh(gJoint, glass)); sP.add(ring);
      const up = new T.Mesh(gUp, white); up.position.x = 1; sP.add(up);
      const eP = new T.Group(); eP.position.x = 2; sP.add(eP);
      eP.add(new T.Mesh(gJoint, glass));
      const fo = new T.Mesh(gFore, white); fo.position.x = .85; eP.add(fo);
      const wP = new T.Group(); wP.position.x = 1.7; eP.add(wP);
      wP.add(new T.Mesh(gJointS, dark));
      const g1 = new T.Mesh(gGrip, dark), g2 = new T.Mesh(gGrip, dark); g1.position.set(.22, .1, 0); g2.position.set(.22, -.1, 0); wP.add(g1, g2);
      group.add(g);
      return { g, sP, eP, wP, z: g.position.z, o: 0, i, side };
    }
    for (const side of [-1, 1]) for (let i = 0; i < N; i++) arms.push(makeArm(side, i));

    /* cables rojo/azul/naranja de cada base al rail */
    const cc = [0xff3b2f, 0x2f7bff, 0xff9a1f];
    arms.forEach(a => {
      cc.forEach((c, k) => {
        if (IV.LOW && k > 0) return;
        const s = a.side, z = a.z + (k - 1) * .12;
        const pts = [[s * 3.5, FLOOR + .15, z + (k - 1) * .2], [s * 2.6, FLOOR + .05, z + .5 + k * .1], [s * 1.5, FLOOR + .06, z - .2], [s * .7, FLOOR + .35, z]].map(p => new T.Vector3(...p));
        const m = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 18, .045, 5), new T.MeshStandardMaterial({ color: c, roughness: .4, emissive: c, emissiveIntensity: .12 }));
        group.add(m);
      });
    });

    /* --- rail central con placas en movimiento --- */
    const rail = new T.Mesh(new T.BoxGeometry(.9, .3, 66), dark); rail.position.set(0, FLOOR + .12, -80); group.add(rail);
    for (const x of [-.34, .34]) { const r = new T.Mesh(new T.BoxGeometry(.06, .05, 66), glass); r.position.set(x, FLOOR + .3, -80); group.add(r); }
    const chips = [];
    for (let i = 0; i < 24; i++) {
      const c = new T.Group();
      const b = new T.Mesh(new T.BoxGeometry(.72, .1, .9), pcb); c.add(b);
      const ic = new T.Mesh(new T.BoxGeometry(.3, .09, .3), dark); ic.position.y = .09; c.add(ic);
      const led = new T.Mesh(new T.BoxGeometry(.06, .05, .06), new T.MeshBasicMaterial({ color: 0xffffff })); led.position.set(.26, .08, .3); c.add(led);
      c.position.y = FLOOR + .36; group.add(c); chips.push({ c, led, o: i * 2.75 });
    }

    /* --- racks con LEDs parpadeantes (identidad ASIR) --- */
    const rackFront = new T.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv;uniform float uT;
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          float unit=floor(vUv.y*24.);float fy=fract(vUv.y*24.);
          vec3 col=vec3(.03,.05,.07);
          float vent=step(.5,fract(vUv.x*26.))*step(.2,fy)*step(fy,.8)*step(.55,vUv.x);
          col+=vec3(.06,.08,.1)*vent;
          for(int i=0;i<6;i++){
            float fi=float(i);float lx=.08+fi*.075;
            float blink=step(.45,h(vec2(unit*1.3+fi,floor(uT*(1.+h(vec2(unit,fi))*3.)))));
            float dot_=step(abs(vUv.x-lx),.022)*step(abs(fy-.5),.16);
            vec3 lc=mod(unit+fi,3.)<1.?vec3(.55,1.,.3):(mod(unit+fi,3.)<2.?vec3(.2,.85,1.):vec3(1.,.55,.15));
            col+=lc*dot_*(.25+.9*blink);
          }
          col+=vec3(.08,.12,.15)*step(fy,.06);
          gl_FragColor=vec4(col,1.);
        }`
    });
    const rackBody = [rackFront, dark, dark, dark, dark, dark];
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const r = new T.Mesh(new T.BoxGeometry(1.2, 4.6, 2.1), rackBody);   // cara +x = frontal
      r.position.set(side * 5.6, FLOOR + 2.3, -95.5 - i * 2.4); r.rotation.y = side > 0 ? Math.PI : 0; group.add(r);
      const top = new T.Mesh(new T.BoxGeometry(.4, .06, 1.9), new T.MeshBasicMaterial({ color: 0x35d4ff })); top.position.set(side * 5.0, FLOOR + 4.64, r.position.z); group.add(top);
    }

    /* --- columnas de luz y vigas: dan profundidad y escala --- */
    const strip = new T.InstancedMesh(new T.BoxGeometry(.12, 6, .12), new T.MeshBasicMaterial({ color: 0x7fe9ff }), 26);
    const dm = new T.Object3D();
    for (let k = 0; k < 13; k++) for (const s of [-1, 1]) { dm.position.set(s * 9, FLOOR + 3, -52 - k * 5); dm.updateMatrix(); strip.setMatrixAt(k * 2 + (s > 0 ? 1 : 0), dm.matrix); }
    group.add(strip);
    for (let k = 0; k < 12; k++) { const b = new T.Mesh(new T.BoxGeometry(20, .25, .5), dark); b.position.set(0, 7, -54 - k * 5); group.add(b); }

    /* --- el CHIP bajo la trampilla: al abrirse se ve un microprocesador; la cámara "entra en el chip" y solo entonces aparece el túnel --- */
    const CHIP_Y = -4.4, CHIP_Z = -104;
    const chipTex = IV.canvasTex(1024, 1024, (g, W, H) => {
      g.fillStyle = '#04101b'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(53,212,255,.07)'; g.lineWidth = 1; for (let i = 0; i <= 32; i++) { g.beginPath(); g.moveTo(i * W / 32, 0); g.lineTo(i * W / 32, H); g.stroke(); g.beginPath(); g.moveTo(0, i * H / 32); g.lineTo(W, i * H / 32); g.stroke(); }
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 110; i++) {                                     // pistas que salen del núcleo hacia los bordes, con quiebros a 45°
        const side = i % 4, dx = [0, 1, 0, -1][side], dy = [-1, 0, 1, 0][side], gold = i % 6 === 0;
        let x = W / 2 + (IV.rnd() - .5) * 300, y = H / 2 + (IV.rnd() - .5) * 300;
        g.strokeStyle = gold ? 'rgba(255,205,100,.75)' : 'rgba(53,212,255,.6)'; g.lineWidth = gold ? 4 : 2 + IV.rnd() * 2.5; g.beginPath(); g.moveTo(x, y);
        x += dx * (140 + IV.rnd() * 160); y += dy * (140 + IV.rnd() * 160); g.lineTo(x, y);
        const j = IV.rnd() < .5 ? -1 : 1, q = 50 + IV.rnd() * 90; x += (dx ? dx : j) * q; y += (dy ? dy : j) * q; g.lineTo(x, y);
        x = dx ? (dx > 0 ? W - 46 : 46) : x; y = dy ? (dy > 0 ? H - 46 : 46) : y; g.lineTo(x, y); g.stroke();
        g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(255,205,100,.8)';                               // patillas del encapsulado
      for (let i = 0; i < 40; i++) { const p = 30 + i * (W - 60) / 39; g.fillRect(p - 5, 8, 10, 26); g.fillRect(p - 5, H - 34, 10, 26); g.fillRect(8, p - 5, 26, 10); g.fillRect(W - 34, p - 5, 26, 10); }
      const d = g.createLinearGradient(W / 2 - 200, H / 2 - 200, W / 2 + 200, H / 2 + 200); d.addColorStop(0, '#1d4f8a'); d.addColorStop(.5, '#0a2142'); d.addColorStop(1, '#2a6ac0');
      g.shadowColor = '#35d4ff'; g.shadowBlur = 50; g.fillStyle = d; IV.rr(g, W / 2 - 200, H / 2 - 200, 400, 400, 26); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = 'rgba(190,245,255,.9)'; g.lineWidth = 4; IV.rr(g, W / 2 - 200, H / 2 - 200, 400, 400, 26); g.stroke();
      g.strokeStyle = 'rgba(127,233,255,.25)'; g.lineWidth = 1.5; for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(W / 2 - 180, H / 2 - 200 + i * 40); g.lineTo(W / 2 + 180, H / 2 - 200 + i * 40); g.stroke(); g.beginPath(); g.moveTo(W / 2 - 200 + i * 40, H / 2 - 180); g.lineTo(W / 2 - 200 + i * 40, H / 2 + 180); g.stroke(); }
      g.fillStyle = '#eaffff'; g.font = '600 64px ' + IV.F.ui; g.textAlign = 'center'; g.shadowColor = '#35d4ff'; g.shadowBlur = 22; g.fillText('IVANCHUX', W / 2, H / 2 + 12);
      g.shadowBlur = 0; g.font = '400 26px ' + IV.F.mono; g.fillStyle = '#7fffd4'; g.fillText('SYS-ASIR · rev.2', W / 2, H / 2 + 60);
    });
    const darkM = new T.MeshStandardMaterial({ color: 0x0a1624, roughness: .5, metalness: .6 }), chipTop = new T.MeshBasicMaterial({ map: chipTex });
    const chip = new T.Mesh(new T.BoxGeometry(9.6, .5, 9.6), [darkM, darkM, chipTop, darkM, darkM, darkM]);
    chip.position.set(0, CHIP_Y, CHIP_Z); group.add(chip);
    /* progreso en el que la cámara cruza la superficie del chip: ahí se hace el destello y empieza a verse el túnel */
    IV.CHIP_P = (() => { let u = P.hatch; while (u < P.d1 && IV.path.getPointAt(u).y > CHIP_Y - .3) u += .0002; return u; })();

    /* --- cables gruesos del rail que se hunden por la trampilla y siguen como fibras del túnel azul --- */
    const bajada = [];
    [0xff3b2f, 0x2f7bff, 0xff9a1f, 0x35d4ff, 0x8dff4e, 0xffffff].forEach((c, k) => {
      const x = (k - 2.5) * .16, pts = [[x, FLOOR + .5, -84], [x, FLOOR + .25, -96], [x * 1.2, FLOOR + .1, -103], [x * 1.4, FLOOR - 1.6, -104.4], [x * 1.2, -4.1, -104.5]].map(p => new T.Vector3(...p));
      const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uT: { value: 0 }, uC: { value: new T.Color(c) } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'varying vec2 vUv;uniform float uT;uniform vec3 uC;void main(){float p=pow(max(0.,sin(vUv.x*60.-uT*3.)),10.);gl_FragColor=vec4(uC*(.5+p*1.8),1.);}' });
      group.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, .1, 6, false), m)); bajada.push(m);
    });

    /* --- trampilla: dos placas que se separan + haz de luz hacia abajo --- */
    const hatchL = new T.Mesh(new T.BoxGeometry(3, .22, 6), white), hatchR = hatchL.clone();
    hatchL.position.set(-1.5, FLOOR + .05, -104); hatchR.position.set(1.5, FLOOR + .05, -104); group.add(hatchL, hatchR);
    const beam = new T.Mesh(new T.CylinderGeometry(2.6, 3.6, 18, 24, 1, true), new T.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    beam.position.set(0, FLOOR - 9, -104); group.add(beam);

    const bub = IV.makeBubbles(IV.LOW ? 20 : 54, { x: 0, y: 2.5, z: -78 + IV.OFF, w: 16, h: 9, d: 56 }, .13, 0x9ff3ff); group.add(bub.mesh);

    /* poses: [cerrado, abierto] por articulación */
    const SH = [1.5, .5], EL = [-2.9, -1.1], WR = [1.2, -.45];
    IV.scenes.hardware = {
      group, range: [P.rosterEnd - .02, P.d1 + .03],
      update() {
        const t = S.t, camZ = IV.cam.position.z;
        arms.forEach(a => {
          const d = camZ - (a.z + IV.OFF);                        // >0 = el brazo está delante
          const target = 1 - IV.ss(7, 26, d);
          a.o += (target - a.o) * .07;
          const o = a.o, e = o * o * (3 - 2 * o), sw = Math.sin(t * 1.3 + a.i * .6) * .07 * o;
          a.sP.rotation.z = IV.mix(SH[0], SH[1], e) + sw;
          a.eP.rotation.z = IV.mix(EL[0], EL[1], e) - sw * 1.4;
          a.wP.rotation.z = IV.mix(WR[0], WR[1], e) + sw;
          /* los brazos siguen el cursor: se inclinan y giran hacia él */
          const fin = IV.ss(N - 6, N - 1, a.i) * .55;                 /* los últimos brazos se inclinan hacia la trampilla */
          a.sP.rotation.z -= fin * o; a.eP.rotation.z -= fin * .8 * o;
          a.sP.rotation.y = Math.sin(t * .5 + a.i) * .05 * o + (S.sx - .5) * .5 * o * a.side;
          a.sP.rotation.z += (S.sy - .5) * .3 * o;
        });
        chips.forEach((k, i) => {
          const z = -48 - ((k.o + t * 1.1) % 64);
          k.c.position.z = z;
          k.led.material.color.setHSL((i % 3) * .17 + .05 + Math.sin(t * 3 + i) * .02, 1, .55 + .15 * Math.sin(t * 4 + i));
        });
        rackFront.uniforms.uT.value = t; bajada.forEach(m => { m.uniforms.uT.value = t; }); chipTop.color.setScalar(.8 + .2 * Math.sin(t * 2.2));
        const open = IV.ss(P.hardwareEnd - .012, P.hatch + .004, S.ps);
        hatchL.position.x = -1.5 - open * 3.3; hatchR.position.x = 1.5 + open * 3.3;
        beam.material.opacity = open * .08 * (.85 + .15 * Math.sin(t * 2));
        bub.update(t);
      }
    };
    IV.sceneList.push(IV.scenes.hardware);
  }]);
})();
