/* Animated background for the "Let's talk" CTA section: sound-wave lines that start tangled
   and resolve into clean parallel lines, drawn in the page's palette: ink -> blue lines on the pink slab, soft white glow. The clear zone follows the cursor and opens fully
   when the "Start a project" button is hovered or focused. */
(function () {
  'use strict';
  var sec = document.getElementById('start-project');
  var cv = document.getElementById('cta-stage');
  if (!sec || !cv) return;
  var ctx = cv.getContext('2d');
  var btn = sec.querySelector('.btn');
  var elClar = document.getElementById('cta-clarity');
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeNoise(seed) {
    var r = mulberry(seed), p = new Float32Array(512);
    for (var i = 0; i < 512; i++) p[i] = r();
    return function (x) { var i = Math.floor(x), f = x - i, a = p[i & 511], b = p[(i + 1) & 511], t = f * f * (3 - 2 * f); return a + (b - a) * t; };
  }

  var N = 11, MID = (N - 1) / 2, nz = [], i;
  for (i = 0; i < N; i++) nz.push(makeNoise(100 + i * 17));
  var BLUE = [118, 140, 255], INK = [23, 22, 15], GREY = INK;

  var W = 0, H = 0, dpr = 1, bandY = 0, bandH = 40;
  var time = 0, cx = 0.5, w = 0.16, tcx = 0.5, tw = 0.16, hoverBtn = false, pointerIn = false, readT = 1;

  function clarity(u) { return 1 - smooth(0, 0.22, Math.abs(u - cx) - w); }

  function layout() {
    var sr = sec.getBoundingClientRect(), br = btn ? btn.getBoundingClientRect() : null;
    var top = br ? br.bottom - sr.top : H * 0.7;
    var below = Math.max(60, H - top - 22);
    bandY = top + below * 0.5;
    bandH = clamp(below * 0.36, 24, 120);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = sec.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    layout();
    if (reduce) draw();
  }

  function lineY(i, x, c, t) {
    var k = (i - MID) / MID;
    var base = bandY + k * bandH * (1 - 0.72 * c);
    var nse = (nz[i](x * 0.035 + t * 0.7) * 0.65 + nz[i](x * 0.11 - t * 1.3 + 40) * 0.35 - 0.5) * 2;
    var noise = (1 - c) * nse * bandH * 0.95;
    var amp = bandH * 0.42 * (0.35 + 0.65 * c);
    var lam = Math.max(340, W * 0.32);
    return base + noise + c * amp * Math.sin(6.2832 * x / lam + t * 1.1 + i * 0.26);
  }

  function draw() {
    if (!W) return;
    var g, j, x, c, i2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // soft lime bloom where the signal is clear
    var avg = 0;
    for (j = 0; j <= 24; j++) avg += clarity(j / 24);
    avg /= 25;
    g = ctx.createRadialGradient(cx * W, bandY, 0, cx * W, bandY, W * 0.4);
    g.addColorStop(0, 'rgba(255,254,251,' + (0.16 + 0.2 * avg) + ')');
    g.addColorStop(1, 'rgba(255,254,251,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // axis
    ctx.setLineDash([2, 7]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(23,22,15,0.3)';
    ctx.beginPath(); ctx.moveTo(0, bandY); ctx.lineTo(W, bandY); ctx.stroke(); ctx.setLineDash([]);

    // colour ramp: grey noise -> lime signal
    var grad = ctx.createLinearGradient(0, 0, W, 0);
    for (j = 0; j <= 20; j++) {
      c = clarity(j / 20);
      grad.addColorStop(j / 20, 'rgba(' + Math.round(GREY[0] + (BLUE[0] - GREY[0]) * c) + ',' + Math.round(GREY[1] + (BLUE[1] - GREY[1]) * c) + ',' + Math.round(GREY[2] + (BLUE[2] - GREY[2]) * c) + ',' + (0.34 + 0.61 * c) + ')');
    }
    ctx.strokeStyle = grad; ctx.lineWidth = 1.7; ctx.lineJoin = 'round';
    var step = 3;
    for (i2 = 0; i2 < N; i2++) {
      ctx.globalAlpha = 0.4 + 0.6 * (1 - Math.abs(i2 - MID) / MID);
      ctx.beginPath();
      for (x = 0; x <= W + step; x += step) {
        c = clarity(x / W);
        var y = lineY(i2, x, c, time);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // a pulse travelling along the centre line
    var up = ((time * 0.07) % 1.2) - 0.1, px = up * W;
    if (px >= 0 && px <= W) {
      c = clarity(up);
      var py = lineY(Math.round(MID), px, c, time), pr = 16;
      g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, 'rgba(255,254,251,' + (0.6 + 0.4 * c) + ')'); g.addColorStop(1, 'rgba(255,254,251,0)');
      ctx.fillStyle = g; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      ctx.fillStyle = '#0B0B09'; ctx.beginPath(); ctx.arc(px, py, 2.4, 0, 6.2832); ctx.fill();
    }
    return avg;
  }

  function frame(dt) {
    time += dt;
    if (hoverBtn) { tw = 0.85; tcx = 0.5; }
    else if (pointerIn) { tw = 0.2; }
    else { tcx = 0.5; tw = 0.14 + 0.05 * Math.sin(time * 0.5); }
    cx += (tcx - cx) * Math.min(1, dt * 3);
    w += (tw - w) * Math.min(1, dt * 2.2);
    var avg = draw();
    readT += dt;
    if (readT > 0.2 && avg != null) { readT = 0; elClar.textContent = Math.round(avg * 100) + '%'; }
  }

  var last = 0;
  function loop(now) { var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; frame(dt); requestAnimationFrame(loop); }

  sec.addEventListener('pointermove', function (e) {
    var r = sec.getBoundingClientRect(); tcx = clamp((e.clientX - r.left) / r.width, 0, 1); pointerIn = true;
    if (reduce) stillFrame();
  }, { passive: true });
  sec.addEventListener('pointerleave', function () { pointerIn = false; if (reduce) stillFrame(); });
  if (btn) {
    ['pointerenter', 'focus'].forEach(function (ev) { btn.addEventListener(ev, function () { hoverBtn = true; if (reduce) stillFrame(); }); });
    ['pointerleave', 'blur'].forEach(function (ev) { btn.addEventListener(ev, function () { hoverBtn = false; if (reduce) stillFrame(); }); });
  }
  function stillFrame() {
    if (hoverBtn) { cx = 0.5; w = 0.85; } else if (pointerIn) { cx = tcx; w = 0.2; } else { cx = 0.5; w = 0.2; }
    var a = draw(); if (a != null) elClar.textContent = Math.round(a * 100) + '%';
  }

  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(sec);
  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { W = 0; resize(); });

  if (reduce) { time = 3; stillFrame(); }
  else { frame(0); requestAnimationFrame(function (t) { last = t; requestAnimationFrame(loop); }); }
})();
