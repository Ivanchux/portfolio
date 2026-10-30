/**
 * IVANCHUX — Fluid Mesh Background v1.0
 * Organic flowing node network with subtle mouse influence.
 * Frutiger Aero feel: soft bezier curves, aqueous movement, low opacity.
 * Usage: <script src="bg.js"></script> anywhere in <body>
 */
(function () {

  /* ── Canvas ────────────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'ivx-bg';
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '-1'
  });
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  /* ── Theme color ───────────────────────────────────────────── */
  function primaryRGB() {
    const t = document.documentElement.getAttribute('data-theme') || 'green';
    if (t === 'cyan')  return [0, 229, 255];
    if (t === 'amber') return [255, 176, 0];
    return [0, 255, 65];
  }

  /* ── Resize ────────────────────────────────────────────────── */
  let W, H;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── Mouse tracking (smoothed) ─────────────────────────────── */
  let txm = window.innerWidth / 2;
  let tym = window.innerHeight / 2;
  let smx = txm, smy = tym;
  document.addEventListener('mousemove', e => { txm = e.clientX; tym = e.clientY; });

  /* ── Layered pseudo-noise (stacked sines, no library) ──────── */
  function noise(x, y, t) {
    return (
      Math.sin(x * 0.008 + t * 0.31)        * 0.35 +
      Math.cos(y * 0.009 - t * 0.19)        * 0.30 +
      Math.sin((x + y) * 0.005 + t * 0.23)  * 0.20 +
      Math.cos((x - y) * 0.006 - t * 0.27)  * 0.15
    );
  }

  /* ── Nodes ─────────────────────────────────────────────────── */
  const COUNT = Math.min(68, Math.floor((window.innerWidth * window.innerHeight) / 13000));
  const CONNECT_DIST  = 185;
  const MOUSE_RADIUS  = 150;
  const MOUSE_PUSH    = 16;

  function makeNode() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.10,
      vy: (Math.random() - 0.5) * 0.10,
      px: Math.random() * 900,   // noise phase x
      py: Math.random() * 900,   // noise phase y
      dx: 0, dy: 0,               // drawn position (after mouse offset)
      r:  1.0 + Math.random() * 1.8
    };
  }

  const nodes = Array.from({ length: COUNT }, makeNode);

  /* ── Animation loop ────────────────────────────────────────── */
  let t = 0;

  function frame() {
    requestAnimationFrame(frame);
    t += 0.011;

    // Ease mouse toward cursor
    smx += (txm - smx) * 0.035;
    smy += (tym - smy) * 0.035;

    ctx.clearRect(0, 0, W, H);

    const [r, g, b] = primaryRGB();

    /* ── Move nodes ── */
    nodes.forEach(n => {
      const nx = noise(n.x + n.px, n.y, t + n.px * 0.08);
      const ny = noise(n.x, n.y + n.py, t + n.py * 0.08);

      n.x += n.vx + nx * 0.22;
      n.y += n.vy + ny * 0.22;

      // Wrap with padding so nodes don't pop
      const pad = 55;
      if (n.x < -pad)    n.x = W + pad;
      if (n.x > W + pad) n.x = -pad;
      if (n.y < -pad)    n.y = H + pad;
      if (n.y > H + pad) n.y = -pad;

      // Subtle mouse push — node drifts slightly away from cursor
      const mdx  = n.x - smx;
      const mdy  = n.y - smy;
      const dist = Math.sqrt(mdx * mdx + mdy * mdy);

      let ox = 0, oy = 0;
      if (dist < MOUSE_RADIUS && dist > 1) {
        const strength = (1 - dist / MOUSE_RADIUS) * MOUSE_PUSH;
        ox = (mdx / dist) * strength;
        oy = (mdy / dist) * strength;
      }

      // Smooth the drawn position (not the actual position)
      n.dx += (n.x + ox - n.dx) * 0.12;
      n.dy += (n.y + oy - n.dy) * 0.12;
    });

    /* ── Draw connections as curved lines ── */
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const ddx  = a.dx - b.dx;
        const ddy  = a.dy - b.dy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);

        if (dist > CONNECT_DIST) continue;

        const alpha = (1 - dist / CONNECT_DIST) * 0.12;

        // Control point: midpoint nudged perpendicularly by noise → organic curve
        const midX = (a.dx + b.dx) * 0.5;
        const midY = (a.dy + b.dy) * 0.5;
        const bend = noise(midX, midY, t * 0.5) * 20;
        const cpx  = midX - (ddy / dist) * bend;
        const cpy  = midY + (ddx / dist) * bend;

        ctx.beginPath();
        ctx.moveTo(a.dx, a.dy);
        ctx.quadraticCurveTo(cpx, cpy, b.dx, b.dy);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.lineWidth = 0.55;
        ctx.stroke();
      }
    }

    /* ── Draw node dots ── */
    nodes.forEach(n => {
      // Gentle pulse per node
      const pulse = 0.20 + Math.sin(t * 0.9 + n.px * 0.01) * 0.07;
      ctx.beginPath();
      ctx.arc(n.dx, n.dy, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${pulse})`;
      ctx.fill();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', frame);
  } else {
    frame();
  }

})();
