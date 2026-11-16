/* =========================================================
   scenes/contact.js — callejón rojo (sala final).
   Persianas, neones verticales, farolillos, tuberías, vapor
   y, al fondo, una puerta aqua: el único punto "Aero" de la sala.
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, T = THREE;
  const Y0 = -128, Y1 = -116, Z0 = -84, Z1 = -142, ZC = (Z0 + Z1) / 2, LEN = Z0 - Z1;

  IV.build.push(['Contacto · callejón rojo', () => {
    const S = IV.S, P = IV.P, env = IV.env;
    const group = new T.Group(); IV.scene.add(group); group.position.z = IV.OFF;

    const shutter = IV.canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#3a0c0a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) { g.fillStyle = y % 16 ? '#4a110d' : '#2c0806'; g.fillRect(0, y, w, 7); g.fillStyle = 'rgba(255,120,80,.08)'; g.fillRect(0, y, w, 1); }
    }); shutter.wrapS = shutter.wrapT = T.RepeatWrapping;
    const wallM = new T.MeshStandardMaterial({ color: 0x2e0c09, roughness: .95, metalness: .05 });
    const shopM = new T.MeshStandardMaterial({ map: shutter, color: 0xb86650, roughness: .75, metalness: .2, envMap: env, envMapIntensity: .2 });
    const floorM = new T.MeshStandardMaterial({ color: 0x1a0504, roughness: .22, metalness: .45, envMap: env, envMapIntensity: .5 });

    /* caja de la sala */
    const floor = new T.Mesh(new T.PlaneGeometry(14, LEN), floorM); floor.rotation.x = -Math.PI / 2; floor.position.set(0, Y0, ZC); group.add(floor);
    const ceil = new T.Mesh(new T.PlaneGeometry(14, LEN), wallM); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, Y1, ZC); group.add(ceil);
    for (const s of [-1, 1]) {
      const w = new T.Mesh(new T.PlaneGeometry(LEN, 12), wallM); w.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; w.position.set(s * 7, (Y0 + Y1) / 2, ZC); group.add(w);
    }

    /* fachadas: bloques con persiana a ambos lados */
    for (const s of [-1, 1]) {
      let z = Z0 - 2;
      while (z > Z1 + 3) {
        const len = 3.6 + IV.rnd() * 2.8, hgt = 4.6 + IV.rnd() * 2.6, dep = .8 + IV.rnd() * .5;
        const b = new T.Mesh(new T.BoxGeometry(dep, hgt, len), shopM);
        b.material = shopM.clone(); b.material.map = shutter.clone(); b.material.map.needsUpdate = true; b.material.map.repeat.set(1, hgt / 2);
        b.position.set(s * (7 - dep / 2), Y0 + hgt / 2, z - len / 2); group.add(b);
        const awn = new T.Mesh(new T.BoxGeometry(dep + .5, .14, len + .1), new T.MeshStandardMaterial({ color: IV.rnd() < .5 ? 0xb3261a : 0x6a1410, roughness: .8 }));
        awn.position.set(s * (7 - (dep + .5) / 2), Y0 + hgt + .1, z - len / 2); group.add(awn);
        z -= len + .3 + IV.rnd() * .8;
      }
    }

    /* neones verticales (texto apilado) perpendiculares a la fachada */
    const signs = [['SERVER', '#35d4ff'], ['24H', '#ff4a2a'], ['ONLINE', '#8dff4e'], ['SYS>_', '#ffb347'], ['DEV', '#ff4aa8'], ['OPEN', '#7fffd4'], ['LAB', '#35d4ff'], ['NET', '#ff4a2a']];
    const neon = [];
    signs.forEach(([txt, c], i) => {
      const tex = IV.canvasTex(128, 512, (g, w, h) => {
        g.fillStyle = 'rgba(20,0,0,.85)'; g.fillRect(6, 6, w - 12, h - 12);
        g.strokeStyle = c; g.lineWidth = 6; g.shadowColor = c; g.shadowBlur = 18; g.strokeRect(10, 10, w - 20, h - 20);
        g.fillStyle = '#fff'; g.font = '400 54px ' + IV.F.mono; g.textAlign = 'center'; g.shadowBlur = 22;
        const L = [...txt]; const step = Math.min(70, (h - 60) / L.length); L.forEach((ch, k) => g.fillText(ch, w / 2, 70 + k * step + (h - 60 - step * L.length) / 2));
      });
      const s = i % 2 ? 1 : -1, m = new T.Mesh(new T.PlaneGeometry(1.1, 4.4), new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
      m.position.set(s * 5.9, Y0 + 6.6, Z0 - 6 - i * 6.2); group.add(m); neon.push(m);
    });

    /* farolillos colgando sobre el pasillo */
    const lanM = [new T.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff7a1a, emissiveIntensity: 1.3 }), new T.MeshStandardMaterial({ color: 0xfff0d8, emissive: 0xffd9a0, emissiveIntensity: 1 })];
    const lanG = new T.SphereGeometry(.5, 14, 12), cap = new T.CylinderGeometry(.18, .18, .1, 10), lan = [];
    const poolTex = IV.canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(64, 64, 2, 64, 64, 64); r.addColorStop(0, 'rgba(255,150,70,.7)'); r.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    for (let i = 0; i < 10; i++) for (const s of [-1, 1]) {
      const z = Z0 - 4 - i * 5.4 + (s > 0 ? 2.5 : 0), l = new T.Mesh(lanG, lanM[(i + (s > 0 ? 1 : 0)) % 2]);
      l.scale.y = 1.25; l.position.set(s * 3.4, Y1 - 1.5, z); group.add(l); lan.push(l);
      const c = new T.Mesh(cap, new T.MeshStandardMaterial({ color: 0x1a0505 })); c.position.set(s * 3.4, Y1 - .85, z); group.add(c);
      const pool = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshBasicMaterial({ map: poolTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(s * 2.4, Y0 + .03, z); group.add(pool);
    }
    /* cables entre los farolillos */
    for (const s of [-1, 1]) {
      const pts = []; for (let k = 0; k <= 10; k++) pts.push(new T.Vector3(s * 3.4, Y1 - .55 - Math.sin(k * Math.PI * 2 * 5) * 0 - (k % 2) * .1, Z0 - 2 - k * 5.4));
      group.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 90, .025, 4), new T.MeshBasicMaterial({ color: 0x120303 })));
    }

    /* tuberías en el techo */
    for (const x of [-5, -1.6, 2.4, 5.6]) {
      const m = new T.Mesh(new T.CylinderGeometry(.18 + Math.abs(x) * .01, .18, LEN, 10), new T.MeshStandardMaterial({ color: 0x2b0c0a, roughness: .5, metalness: .7, envMap: env, envMapIntensity: .4 }));
      m.rotation.x = Math.PI / 2; m.position.set(x, Y1 - .25, ZC); group.add(m);
    }

    /* puerta aqua al fondo */
    const door = new T.Mesh(new T.PlaneGeometry(4.2, 7), new T.MeshBasicMaterial({ color: 0x7feeff, fog: false }));
    door.position.set(0, Y0 + 3.5, Z1 + .05); group.add(door);
    const glow = new T.Mesh(new T.PlaneGeometry(13, 13), new T.MeshBasicMaterial({ map: poolTex, color: 0x66e6ff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.set(0, Y0 + 3.5, Z1 + .2); group.add(glow);
    const back = new T.Mesh(new T.PlaneGeometry(14, 12), wallM); back.position.set(0, (Y0 + Y1) / 2, Z1); group.add(back);

    /* vapor */
    const nS = IV.LOW ? 120 : 320, sp = new Float32Array(nS * 3), sd = new Float32Array(nS);
    for (let i = 0; i < nS; i++) { sp[i * 3] = (IV.rnd() - .5) * 11; sp[i * 3 + 1] = Y0 + IV.rnd() * 11; sp[i * 3 + 2] = Z0 - IV.rnd() * LEN; sd[i] = .2 + IV.rnd(); }
    const steam = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(sp, 3)),
      new T.PointsMaterial({ map: poolTex, color: 0xff7a50, size: 1.6, transparent: true, opacity: .22, blending: T.AdditiveBlending, depthWrite: false }));
    group.add(steam);

    IV.scenes.contact = {
      group, range: [P.d4, 1],
      update() {
        const t = S.t;
        lan.forEach((l, i) => { l.position.y = Y1 - 1.5 + Math.sin(t * 1.3 + i) * .12; l.rotation.z = Math.sin(t * .8 + i) * .05; });
        neon.forEach((n, i) => { n.material.opacity = .85 + .15 * Math.sin(t * 9 + i * 3) * (Math.sin(t * .7 + i) > .93 ? 1 : .15); });
        const a = steam.geometry.attributes.position;
        for (let i = 0; i < nS; i++) { let y = a.getY(i) + sd[i] * .004; if (y > Y1) y = Y0; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * .5 + i) * .0015); }
        a.needsUpdate = true;
        glow.material.opacity = .85 + .15 * Math.sin(t * 1.4);
      }
    };
    IV.sceneList.push(IV.scenes.contact);
  }]);
})();
