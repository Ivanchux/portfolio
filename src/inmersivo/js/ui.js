/* =========================================================
   ui.js — todo lo que es HTML sobre el canvas:
   HUD, raíl de capítulos, navegación por distritos, detalle, menú,
   contacto, consola retro, cursor y audio sintetizado.
   Los textos vienen de IV.UI / IV.PROJECTS / IV.STEPS (datos-xx.js).
   ========================================================= */
(function () {
  'use strict';
  const IV = window.IV, S = IV.S, $ = IV.$, C = IV.CONFIG, U = IV.UI, H = document.documentElement;
  const GL = '▓▒░#$%&@01';
  let steps = [], mains = [], cur = -1, booted = false, opener = null, curDist = -1;

  const maxS = () => Math.max(1, H.scrollHeight - innerHeight);
  const slug = p => 'proyecto-' + p.id;
  const hs = u => { try { history.replaceState(null, '', u); } catch (e) {} };
  const mkb = (t, f, cls) => { const b = document.createElement('button'); b.innerHTML = t; b.onclick = f; if (cls) b.className = cls; return b; };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const catOf = id => IV.CATS.find(c => c.id === id) || {};
  const distOf = i => IV.DISTRICTS.find(d => d.idx.includes(i));

  /* texto que se "descifra" (efecto de terminal, corto) */
  function scr(e, s) {
    if (IV.RM) { e.textContent = s; return; }
    let n = 0; clearInterval(e._i);
    e._i = setInterval(() => {
      n++; e.textContent = [...s].map((c, i) => c === ' ' || i < n * 1.2 ? c : GL[Math.random() * GL.length | 0]).join('');
      if (n > s.length / 1.2) { clearInterval(e._i); e.textContent = s; }
    }, 24);
  }

  /* ---------- audio: pad suave con reverb (sin ficheros) ----------
     Un acorde por zona (inicio, cada distrito, sala de máquinas, descenso, contacto).
     Al cambiar de zona los tonos se deslizan despacio; dentro de la zona el filtro y
     la afinación varían MUY poco con la posición, también al retroceder. */
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const CH = {   // notas MIDI: 4 tonos del acorde + 1 brillo agudo
    hero:      [48, 55, 62, 64, 76], web:    [53, 60, 67, 69, 81], juegos:  [55, 62, 69, 71, 74],
    aprendizaje: [45, 52, 60, 71, 76], sistemas: [50, 57, 60, 65, 81], hardware: [46, 53, 57, 62, 77],
    descent:   [40, 47, 55, 62, 71], contact: [50, 57, 64, 66, 69]
  };
  const A = IV.audio = {
    ctx: null, on: false, master: null, filt: null, fx: null, voices: [], zone: '', last: 0,
    init() {
      if (this.ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -30; comp.ratio.value = 3; this.master.connect(comp); comp.connect(c.destination);
      /* reverb sintética: ruido con cola larga y suave */
      const len = c.sampleRate * 3.4, buf = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
      const conv = c.createConvolver(); conv.buffer = buf; const wet = c.createGain(); wet.gain.value = .7; conv.connect(wet); wet.connect(this.master);
      const dry = c.createGain(); dry.gain.value = .45; dry.connect(this.master);
      this.fx = c.createGain(); this.fx.connect(conv); this.fx.connect(dry);
      this.filt = c.createBiquadFilter(); this.filt.type = 'lowpass'; this.filt.frequency.value = 700; this.filt.Q.value = .25;
      const bus = c.createGain(); bus.gain.value = .5; bus.connect(this.filt); this.filt.connect(this.fx);
      for (let i = 0; i < 5; i++) {
        const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
        o.type = 'sine'; o2.type = 'triangle'; o2.detune.value = (i % 2 ? 1 : -1) * 7;
        g.gain.value = i < 4 ? .13 : .03; g2.gain.value = i < 4 ? .04 : 0;
        o.connect(g); o2.connect(g2); g.connect(bus); g2.connect(bus); o.start(); o2.start(); this.voices.push({ o, o2 });
      }
      /* respiración lenta del filtro y del volumen */
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .06; lg.gain.value = 110; lfo.connect(lg); lg.connect(this.filt.frequency); lfo.start();
      const l2 = c.createOscillator(), lg2 = c.createGain(); l2.frequency.value = .045; lg2.gain.value = .09; l2.connect(lg2); lg2.connect(bus.gain); l2.start();
    },
    set(on) {
      this.on = on; if (on) { this.init(); this.ctx && this.ctx.resume(); this.zone = ''; }
      if (this.master) this.master.gain.setTargetAtTime(on ? .17 : 0, this.ctx.currentTime, .6);
      const b = $('#b-snd'); b.textContent = on ? '♪ on' : '♪ off'; b.setAttribute('aria-pressed', on);
    },
    /* "tink" de cristal: dos senos con cola larga, muy bajito */
    blip(f = 660, d = .5, v = .018) {
      if (!this.on || !this.ctx) return; const c = this.ctx, t = c.currentTime;
      [1, 1.5].forEach((m, k) => {
        const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * m;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v / (k + 1), t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d);
        o.connect(g); g.connect(this.fx); o.start(t); o.stop(t + d + .05);
      });
    },
    zoneAt() {
      const P = IV.P, ps = S.ps;
      if (ps >= P.contact - .01) return 'contact';
      if (ps >= P.hatch) return 'descent';
      if (ps >= P.hardware - .01) return 'hardware';
      if (ps >= P.roster - .01 && IV.DISTRICTS.length) { const d = IV.DISTRICTS[IV.districtAt(ps)]; return CH[d.id] ? d.id : ['web', 'juegos', 'aprendizaje', 'sistemas'][d.style]; }
      return 'hero';
    },
    tick() {
      if (!this.on || !this.ctx) return; const t = this.ctx.currentTime;
      if (t - this.last < .25) return; this.last = t;
      const z = this.zoneAt(), k = IV.clamp(S.depth / 124, 0, 1), detune = 1 - k * .05 + Math.sin(S.ps * 30) * .004;
      if (z !== this.zone) { this.zone = z; this.notes = CH[z] || CH.hero; }
      this.voices.forEach((v, i) => { const f = hz(this.notes[i]) * detune; v.o.frequency.setTargetAtTime(f, t, 2.4); v.o2.frequency.setTargetAtTime(f, t, 2.4); });
      this.filt.frequency.setTargetAtTime(620 + (1 - k) * 380 + Math.min(Math.abs(S.p - S.ps) * 3000, 220) + Math.sin(S.ps * 20) * 40, t, .8);
    }
  };

  /* ---------- navegación ---------- */
  function menu(on) { $('#mn').classList.toggle('on', on); $('#b-menu').setAttribute('aria-expanded', on); }
  function go(p) {
    closeD(); menu(false);
    scrollTo({ top: p * maxS(), behavior: IV.RM ? 'instant' : 'smooth' });
    A.blip(520);
  }
  IV.go = go;
  const goDistrict = i => { const d = IV.DISTRICTS[i]; if (d) go(d.p + .006); };
  /* viaje continuo hasta un proyecto: recorre el mundo y, al llegar, abre su detalle */
  function goProject(i) {
    closeD(); menu(false);
    const R = IV.scenes.roster, target = R.pOf(i) * maxS();
    scrollTo({ top: target, behavior: IV.RM ? 'instant' : 'smooth' });
    const t0 = performance.now();
    const wait = () => { if (Math.abs(scrollY - target) < 6 || performance.now() - t0 > 6000) open(i); else setTimeout(wait, 120); };
    wait();
  }

  /* ---------- navegación por distritos (web · juegos · estudio · sistemas) ---------- */
  function buildSectors() {
    const nav = $('#sectors'); nav.hidden = false; nav.innerHTML = '';
    const lbl = el('div', 'lbl', ''); lbl.id = 'sec-lbl'; nav.append(lbl);
    IV.DISTRICTS.forEach((d, i) => {
      const b = mkb('<i class="dot" style="color:' + d.cat.color + ';background:' + d.cat.color + '"></i>' + d.cat.label + '<em>' + String(d.idx.length).padStart(2, '0') + '</em>', () => { goDistrict(i); A.blip(880); });
      b.dataset.i = i; b.title = d.cat.name; b.setAttribute('aria-pressed', 'false'); nav.append(b);
    });
  }
  function updateSectors() {
    const k = IV.DISTRICTS.length ? IV.districtAt(S.ps) : -1;
    if (k === curDist) return; curDist = k;
    $('#sectors').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === k));
    const d = IV.DISTRICTS[k]; if (d) $('#sec-lbl').textContent = '> ' + d.cat.name + ' — ' + (d.cat.text || '');
  }

  /* ---------- detalle de proyecto (estado, no ruta) ---------- */
  function siblings() { const d = distOf(S.sel >= 0 ? S.sel : S.last); return d ? d.idx : IV.PROJECTS.map((p, i) => i); }
  function buildDetailNav() {
    const dm = $('#dm'); dm.innerHTML = '';
    siblings().forEach(i => { const b = mkb(String(i + 1).padStart(2, '0'), () => open(i)); b.setAttribute('aria-label', IV.PROJECTS[i].n); b.setAttribute('aria-current', i === S.sel); dm.append(b); });
  }
  function section(box, title, content) {
    if (!content || (Array.isArray(content) && !content.length)) return;
    box.append(el('h3', '', title));
    if (Array.isArray(content)) { const ul = el('ul'); content.forEach(t => ul.append(el('li', '', t))); box.append(ul); } else box.append(el('p', '', content));
  }
  function open(i, jump) {
    const R = IV.scenes.roster, P = IV.PROJECTS[i];
    menu(false);
    if (jump) { const t = R.pOf(i); scrollTo({ top: t * maxS(), behavior: 'instant' }); S.ps = t; R.panels[i].rev = 1; }
    if (S.sel < 0) opener = document.activeElement;
    S.sel = S.last = i; H.classList.add('lock', 'det-on');
    R.setCap(i, 0);
    $('#dn').textContent = '[' + String(i + 1).padStart(2, '0') + '] ' + P.id + '.exe';
    scr($('#dt'), P.n);
    const r = $('#dr'); r.textContent = catOf(P.cat).name || ''; if (P.estado) r.append(el('span', 'estado', P.estado));
    const d = $('#dd'); d.innerHTML = ''; d.append(el('p', '', P.resumen)); P.desc.forEach(t => d.append(el('p', '', t)));
    const x = $('#dx'); x.innerHTML = '';
    section(x, U.lblRole, P.papel); section(x, U.lblProblem, P.problema); section(x, U.lblMeasured, P.medidos); section(x, U.lblNext, P.pendiente);
    $('#ds').innerHTML = ''; P.stack.forEach(t => $('#ds').append(el('li', '', t)));
    const g = $('#dg'); g.innerHTML = '';
    if (P.caps.length > 1) P.caps.forEach((c, k) => {
      const b = el('button'); b.setAttribute('aria-label', c.alt || (U.lblShots + ' ' + (k + 1))); b.setAttribute('aria-current', k === 0);
      const im = el('img'); im.src = (IV.CAPS && IV.CAPS[c.src]) || IV.DATA.root + c.src; im.alt = ''; im.loading = 'lazy'; b.append(im);
      b.onclick = () => { R.setCap(i, k); g.querySelectorAll('button').forEach((o, j) => o.setAttribute('aria-current', j === k)); A.blip(900, .3); };
      g.append(b);
    });
    const l = $('#dl'); l.innerHTML = '';
    const link = (t, u, ext) => { if (!u) return; const a = el('a', 'aero sm', t); a.href = u; if (ext) { a.target = '_blank'; a.rel = 'noopener'; } l.append(a); };
    link(U.live, P.vivo, true); link(U.code, P.codigo, true); link(U.page, P.ficha, false);
    buildDetailNav();
    $('#dv').classList.add('on'); $('#dc').focus({ preventScroll: true }); hs('#' + slug(P)); A.blip(1100);
  }
  function closeD() {
    if (S.sel < 0) return; S.sel = -1; H.classList.remove('lock', 'det-on'); $('#dv').classList.remove('on');
    hs(location.pathname + location.search); if (opener && opener.focus) opener.focus({ preventScroll: true }); A.blip(440);
  }
  function fromHash() {
    const i = IV.PROJECTS.findIndex(P => '#' + slug(P) === location.hash);
    if (i >= 0 && i !== S.sel) open(i, 1); else if (i < 0 && S.sel >= 0) closeD();
  }

  /* ---------- menú ---------- */
  function buildMenu() {
    const b = $('#mn-body'); b.innerHTML = '';
    mains.forEach(s => b.append(mkb('<b>' + s.k + '</b>' + s.t, () => go(s.p ? s.p + .004 : 0))));
    b.append(el('hr')); b.append(el('small', '', U.sectorsLbl));
    IV.DISTRICTS.forEach((d, i) => b.append(mkb('<b>›</b>' + d.cat.name + ' (' + d.idx.length + ')', () => goDistrict(i))));
    b.append(el('hr'));
    [[U.classicName, IV.DATA.classic], [U.simpleName, IV.DATA.simple], [IV.DATA.otherLang, IV.DATA.other]].forEach(([t, u]) => { const a = el('a'); a.href = u; a.textContent = t; b.append(a); });
  }

  /* ---------- contacto (tus datos: correo, GitHub, LinkedIn) ---------- */
  function buildContact() {
    $('#ct-p').textContent = C.busco || '';
    const box = $('#ct-links'); box.innerHTML = '';
    const L = [];
    if (C.mail) L.push([U.mail, 'mailto:' + C.mail]);
    if (C.github) L.push(['GITHUB', C.github]);
    if (C.linkedin) L.push(['LINKEDIN', C.linkedin]);
    L.forEach(([t, u]) => { const a = el('a', 'aero', '> ' + t); a.href = u; if (u.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; } box.append(a); });
    const cp = mkb(U.copyLink, () => { try { navigator.clipboard.writeText(location.href.split('#')[0]); cp.textContent = U.copied; setTimeout(() => cp.textContent = U.copyLink, 1500); } catch (e) {} }, 'aero ghost');
    box.append(cp);
  }

  /* ---------- consola retro (tecla ` o botón >_) ---------- */
  function buildConsole() {
    const con = $('#con'), out = $('#con-out'), inp = $('#con-i'), hist = []; let hi = 0;
    const say = (s, c) => { const d = el('div', c, s); out.append(d); out.scrollTop = out.scrollHeight; };
    const toggle = on => { con.hidden = !on; $('#b-con').setAttribute('aria-expanded', on); if (on) { inp.focus(); if (!out.childElementCount) say(U.conHint, 'm'); } else inp.blur(); };
    IV.consoleToggle = () => toggle(con.hidden);
    const stepBy = n => mains.find(s => s.id === n || s.t.toLowerCase().startsWith(n));
    const CMD = {
      help() { say('help · whoami · ls [proyectos] · goto <capítulo> · sector <' + IV.CATS.map(c => c.id).join('|') + '>\nopen <nombre|n> · stack · lab · os · sound on|off · theme crt|aero|mix · clear · exit', 'c'); },
      whoami() { say(C.name + ' (' + C.alias + ') — ' + C.tagline); },
      ls(a) {
        if (a[0] === 'proyectos' || a[0] === 'projects') IV.PROJECTS.forEach((p, i) => say(String(i + 1).padStart(2, '0') + '  ' + p.cat.padEnd(12) + p.n));
        else mains.forEach(s => say(s.k + '  ' + s.id));
      },
      goto(a) { const s = stepBy((a[0] || '').toLowerCase()); if (!s) return say('? ' + (a[0] || ''), 'e'); go(s.p ? s.p + .004 : 0); say('→ ' + s.t, 'm'); },
      sector(a) {
        const i = IV.DISTRICTS.findIndex(d => d.id === (a[0] || '').toLowerCase()); if (i < 0) return say(IV.DISTRICTS.map(d => d.id).join(' · '), 'e');
        goDistrict(i); say('→ ' + IV.DISTRICTS[i].cat.name, 'm');
      },
      open(a) {
        const q = a.join(' ').toLowerCase(), i = /^\d+$/.test(q) ? +q - 1 : IV.PROJECTS.findIndex(p => p.n.toLowerCase().startsWith(q) || p.id.startsWith(q));
        if (!IV.PROJECTS[i]) return say('? ' + q, 'e'); toggle(false); goProject(i);
      },
      stack() { (IV.SLABS.find(s => s.id === 'pila') || { items: [] }).items.forEach(t => say('· ' + t)); },
      lab() { (IV.SLABS.find(s => s.id === 'laboratorio') || { items: [] }).items.forEach(t => say('· ' + t)); },
      os() { say('IVANDEV OS → ' + IV.DATA.os, 'c'); window.open(IV.DATA.os, '_blank', 'noopener'); },
      sound(a) { A.set(a[0] !== 'off'); say('sound ' + (A.on ? 'on' : 'off'), 'm'); },
      theme(a) { const m = { crt: 0, mix: .6, aero: 1 }[a[0]]; if (m === undefined) return say('theme crt|mix|aero', 'e'); S.aero = m; say('theme ' + a[0], 'm'); },
      clear() { out.innerHTML = ''; },
      exit() { toggle(false); },
      sudo() { say('nice try.', 'e'); }
    };
    $('#b-con').onclick = () => toggle(con.hidden); $('#con-x').onclick = () => toggle(false);
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = inp.value.trim(); inp.value = ''; if (!v) return; hist.push(v); hi = hist.length; say('> ' + v); const [c, ...a] = v.split(/\s+/); (CMD[c.toLowerCase()] || (() => say('? ' + c + ' (help)', 'e')))(a); A.blip(700, .25); }
      else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); inp.value = hist[hi] || ''; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; e.preventDefault(); }
      else if (e.key === 'Escape' || e.key === '`') { toggle(false); e.preventDefault(); }
    });
  }

  /* ---------- pasos del viaje: los de datos + un paso por distrito + una capa por habilidad ---------- */
  function buildSteps() {
    const all = IV.STEPS.map(s => Object.assign({}, s, { p: IV.stepP(s) }));
    IV.DISTRICTS.forEach((d, i) => all.push({ id: 'd-' + d.id, sub: true, p: d.p + .004, t: String(i + 1).padStart(2, '0') + ' · ' + d.cat.name, text: esc(d.cat.text || '') + '<br><span class="pr">' + d.idx.length + ' ' + (d.idx.length === 1 ? U.project : U.projectsN) + '</span>' }));
    const n = IV.SLABS.length;
    IV.SLABS.forEach((sl, i) => {
      const p = IV.slabP(i, n), depth = '−' + String(Math.round(-IV.path.getPointAt(p).y)).padStart(3, '0') + ' m';
      all.push({ id: 's' + i, sub: true, p, t: U.stratum + ' ' + depth + ' · ' + sl.title, text: esc(sl.text) });
    });
    steps = all.sort((a, b) => a.p - b.p); mains = steps.filter(s => s.main);
  }
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  /* ---------- init ---------- */
  IV.ui = {
    init() {
      buildSteps();
      document.body.style.height = C.scrollVh + 'vh';
      $('#hero-tag').textContent = C.tagline;

      /* raíl lateral */
      const rail = $('#rail');
      mains.forEach(s => { const b = mkb('<i></i><span>' + s.k + ' ' + s.t + '</span>', () => go(s.p ? s.p + .004 : 0)); b.setAttribute('aria-label', s.t); rail.append(b); });

      buildMenu(); buildContact(); buildConsole();
      $('#b-menu').onclick = () => menu(!$('#mn').classList.contains('on'));
      $('#b-talk').onclick = () => go(IV.P.contact + .002);
      $('#b-snd').onclick = () => A.set(!A.on);
      $('#brand').onclick = e => { e.preventDefault(); go(0); };
      $('#dc').onclick = closeD;
      $('#dv').addEventListener('click', e => e.stopPropagation());

      /* clic en el mundo: panel de proyecto, o capa del descenso (te lleva a su proyecto) */
      addEventListener('click', e => {
        if (S.sel >= 0 || !booted || e.target.closest('button,a,.ov,.console')) return;
        S.mx = e.clientX / innerWidth; S.my = 1 - e.clientY / innerHeight;
        const R = IV.scenes.roster, D = IV.scenes.descent, P = IV.P;
        if (R && S.ps > P.roster - .04 && S.ps < P.rosterEnd + .03) { const i = R.pickAt(); if (i >= 0) open(i); return; }
        if (D && S.ps > P.d1 - .02 && S.ps < P.contact - .01) {
          const k = D.pickSlab(); if (k < 0) return;
          const names = IV.SLABS[k].items || [], i = IV.PROJECTS.findIndex(p => names.includes(p.n)); if (i >= 0) goProject(i);
        }
      });
      addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === '`' || e.key === 'º' || e.key === '\\') { e.preventDefault(); IV.consoleToggle(); return; }
        if (e.key === 'Escape') { if ($('#mn').classList.contains('on')) menu(false); else closeD(); }
        else if (S.sel >= 0 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          const v = siblings(), k = v.indexOf(S.sel); open(v[(k + (e.key === 'ArrowRight' ? 1 : v.length - 1)) % v.length]);
        }
      });
      addEventListener('hashchange', () => booted && fromHash());

      /* puntero: parallax + cursor Aero (el cursor del sistema NO se oculta) */
      const cu = $('#cur'); let cx = 0, cy = 0, tx = 0, ty = 0;
      addEventListener('pointermove', e => {
        S.mx = e.clientX / innerWidth; S.my = 1 - e.clientY / innerHeight; tx = e.clientX; ty = e.clientY; cu.classList.add('on');
        cu.classList.toggle('hot', S.hover >= 0 || S.slab >= 0 || !!e.target.closest('button,a'));
      });
      addEventListener('pointerdown', e => { S.mx = e.clientX / innerWidth; S.my = 1 - e.clientY / innerHeight; });
      document.addEventListener('pointerleave', () => cu.classList.remove('on'));
      IV.ui.cursor = () => { cx += (tx - cx) * .2; cy += (ty - cy) * .2; cu.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; };

      buildSectors();
    },

    /* --- arranque (BIOS) --- */
    bootLog(line, cls) { const l = $('#boot-log'); l.insertAdjacentHTML('beforeend', '<span class="' + (cls || '') + '">' + line + '</span>\n'); l.scrollTop = l.scrollHeight; },
    bootPct(p) { $('#boot-bar').style.width = p + '%'; $('#boot-pct').textContent = Math.round(p) + ' %'; },
    bootReady(cb) {
      const go1 = $('#boot-go'), go2 = $('#boot-snd'); go1.disabled = go2.disabled = false; go1.focus();
      const enter = snd => {
        $('#boot').classList.add('done'); document.body.classList.remove('booting'); H.classList.remove('lock');
        booted = true; if (snd) A.set(true); S.intro = .5; cb && cb(); fromHash(); A.blip(784, .7);
      };
      go1.onclick = () => enter(false); go2.onclick = () => enter(true);
    },

    /* --- cada frame --- */
    update() {
      const ps = S.ps, P = IV.P;
      let idx = 0; steps.forEach((s, i) => { if (ps >= s.p - .003) idx = i; });
      if (idx !== cur && booted) {
        cur = idx; const tx = $('#txt'), s = steps[idx]; tx.classList.add('out');
        setTimeout(() => { if (!s.text) { tx.style.display = 'none'; } else { tx.style.display = ''; scr($('#tt'), (s.k ? s.k + ' ' : '› ') + s.t); $('#tp').innerHTML = s.text; } tx.classList.remove('out'); }, IV.RM ? 0 : 260);
        $('#m-ch').textContent = s.k || '··';
        const m = mains.filter(x => ps >= x.p - .003).pop(); $('#rail').querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', mains[i] === m));
      }
      $('#m-depth').textContent = String(Math.round(S.depth)).padStart(4, '0');
      $('#m-bar').style.transform = 'scaleX(' + ps.toFixed(3) + ')';
      $('#hint').style.opacity = booted && ps < .02 ? 1 : 0;
      $('#hero-ui').style.opacity = booted ? 1 - IV.ss(0, .04, ps) : 0;
      const inRoster = booted && S.sel < 0 && ps > P.roster - .035 && ps < P.rosterEnd + .005;
      $('#sectors').classList.toggle('on', inRoster);
      if (inRoster) updateSectors();
      $('#contact').classList.toggle('on', booted && ps > P.contact - .004);
      A.tick();
    },
    fps(f) { $('#m-fps').textContent = f + ' fps'; },
    isBooted() { return booted; }
  };
})();
