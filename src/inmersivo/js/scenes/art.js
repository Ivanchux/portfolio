/* scenes/art.js — miniaturas procedurales (respaldo cuando no hay captura legible). IV.ART[tema](g,x,y,w,h) */
(function () {
  'use strict';
  const IV = window.IV;
  const ART = IV.ART = {
    terminal(g, x, y, w, h) {
      g.fillStyle = '#03100e'; g.fillRect(x, y, w, h);
      g.font = '17px monospace'; g.textBaseline = 'top';
      const L = ['$ ./retroterm --boot', '[ ok ] kernel de juguete', '[ ok ] shell.sh cargado', '> pregunta algo_', '', '  ░▒▓ ▒░ ▓▒░▒ ░▓', '$ ls proyectos/', 'orbis  naval  edulab'];
      L.forEach((s, i) => { g.fillStyle = i === 3 ? '#8dff4e' : (s[0] === '$' ? '#7fffd4' : '#3fae8e'); g.fillText(s, x + 14, y + 12 + i * 24); });
      g.fillStyle = '#7fffd4'; g.fillRect(x + 14 + 15 * 10.2, y + 12 + 3 * 24, 10, 18);
    },
    globe(g, x, y, w, h) {
      const gr = g.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w / 1.5); gr.addColorStop(0, '#0b4a78'); gr.addColorStop(1, '#021019');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      const cx = x + w / 2, cy = y + h / 2, R = h * .42;
      g.strokeStyle = 'rgba(127,235,255,.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
      for (let i = 1; i < 6; i++) { g.beginPath(); g.ellipse(cx, cy, R * Math.abs(Math.cos(i * Math.PI / 6)), R, 0, 0, 7); g.stroke(); }
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(cx, cy + i * R * .33, R * Math.sqrt(1 - Math.pow(i * .33, 2)), R * .1, 0, 0, 7); g.stroke(); }
      g.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { const a = i * 2.4, r = R * (.2 + (i % 5) * .15); g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a * 1.3) * r * .8, 3, 3); }
      const hl = g.createRadialGradient(cx - R * .4, cy - R * .5, 4, cx - R * .3, cy - R * .4, R * .9); hl.addColorStop(0, 'rgba(255,255,255,.45)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hl; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    },
    radar(g, x, y, w, h) {
      g.fillStyle = '#021410'; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(80,255,170,.22)'; g.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(x + i * w / 10, y); g.lineTo(x + i * w / 10, y + h); g.stroke(); g.beginPath(); g.moveTo(x, y + i * h / 10); g.lineTo(x + w, y + i * h / 10); g.stroke(); }
      const cx = x + w * .5, cy = y + h * .5;
      g.strokeStyle = 'rgba(80,255,170,.6)'; [.18, .32, .46].forEach(k => { g.beginPath(); g.arc(cx, cy, h * k, 0, 7); g.stroke(); });
      const sw = g.createRadialGradient(cx, cy, 0, cx, cy, h * .46); sw.addColorStop(0, 'rgba(80,255,170,.55)'); sw.addColorStop(1, 'rgba(80,255,170,0)');
      g.fillStyle = sw; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, h * .46, -1.2, -.35); g.fill();
      g.fillStyle = '#ff6a4a'; [[.62, .3], [.3, .62], [.7, .68]].forEach(([a, b]) => { g.fillRect(x + w * a - 5, y + h * b - 5, 10, 10); });
      g.fillStyle = '#fff'; g.font = '14px monospace'; g.fillText('A7', x + w * .62 + 10, y + h * .3);
    },
    lab(g, x, y, w, h) {
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#53c8f2'); gr.addColorStop(1, '#0c5f98');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      for (let i = 0; i < 12; i++) {
        const r = 16 + (i * 29 % 38), bx = x + 30 + (i * 83 % (w - 60)), by = y + 30 + (i * 57 % (h - 60));
        const bg = g.createRadialGradient(bx - r * .3, by - r * .35, 1, bx, by, r);
        bg.addColorStop(0, 'rgba(255,255,255,.9)'); bg.addColorStop(.35, 'rgba(180,240,255,.25)'); bg.addColorStop(.9, 'rgba(120,230,255,.15)'); bg.addColorStop(1, 'rgba(255,255,255,.7)');
        g.fillStyle = bg; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(141,255,78,.7)'; g.beginPath(); g.moveTo(x + w * .45, y + h * .35); g.lineTo(x + w * .55, y + h * .35); g.lineTo(x + w * .66, y + h * .85); g.lineTo(x + w * .34, y + h * .85); g.fill();
    },
    rack(g, x, y, w, h) {
      g.fillStyle = '#05080c'; g.fillRect(x, y, w, h);
      for (let r = 0; r < 9; r++) {
        const yy = y + 10 + r * (h - 20) / 9; g.fillStyle = '#0f1a24'; g.fillRect(x + 20, yy, w - 40, (h - 20) / 9 - 6);
        for (let l = 0; l < 10; l++) { g.fillStyle = (r * 7 + l * 3) % 5 === 0 ? '#ff8a3a' : ((r + l) % 3 ? '#35d4ff' : '#8dff4e'); g.fillRect(x + 34 + l * 18, yy + 9, 8, 8); }
        g.fillStyle = 'rgba(255,255,255,.12)'; for (let v = 0; v < 8; v++) g.fillRect(x + w - 200 + v * 18, yy + 6, 3, 20);
      }
    },
    film(g, x, y, w, h) {
      g.fillStyle = '#0a0710'; g.fillRect(x, y, w, h);
      const fh = h * .74, fy = y + (h - fh) / 2;
      g.fillStyle = '#17121f'; g.fillRect(x, fy, w, fh);
      for (let i = 0; i < 4; i++) {
        const fx = x + 18 + i * (w - 36) / 4, fw = (w - 36) / 4 - 10;
        const gr = g.createLinearGradient(fx, fy, fx + fw, fy + fh); gr.addColorStop(0, ['#ff7a4a', '#35d4ff', '#8dff4e', '#c07bff'][i]); gr.addColorStop(1, '#101828');
        g.fillStyle = gr; g.fillRect(fx, fy + 22, fw, fh - 44);
        g.fillStyle = '#05050a'; for (let k = 0; k < 6; k++) { g.fillRect(fx + 4 + k * (fw / 6), fy + 5, 10, 11); g.fillRect(fx + 4 + k * (fw / 6), fy + fh - 17, 10, 11); }
      }
    }
  };
})();
