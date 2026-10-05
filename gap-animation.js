/* Animated background for The Gap section — ported from "Summit Storm"
   (Downloads/Summit Storm.html). Canvas-drawn mountain/snowstorm scene with
   a HUD readout strip and a storm-intensity slider. IDs are scoped with a
   gap- prefix so this can sit alongside the rest of the site's scripts. */
(function () {
  'use strict';
  var hero = document.getElementById('the-gap');
  var cv = document.getElementById('gap-stage');
  if (!hero || !cv) return;
  var ctx = cv.getContext('2d');
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var $ = function (id) { return document.getElementById(id); };
  var elAlt = $('gap-r-alt'), elWind = $('gap-r-wind'), elVis = $('gap-r-vis'), elState = $('gap-r-state'), elProg = $('gap-prog'), elStorm = $('gap-storm');

  /* ---------- noise ---------- */
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeNoise(seed) {
    var r = mulberry(seed), p = new Float32Array(512);
    for (var i = 0; i < 512; i++) p[i] = r();
    return function (x) {
      var i = Math.floor(x), f = x - i, a = p[i & 511], b = p[(i + 1) & 511], t = f * f * (3 - 2 * f);
      return a + (b - a) * t;
    };
  }
  function fbm(n, x, o) {
    var s = 0, a = 0.5, f = 1, m = 0;
    for (var i = 0; i < o; i++) { s += a * n(x * f + i * 13.7); m += a; a *= 0.5; f *= 2.03; }
    return s / m;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function terrain(n, x) {
    var f = fbm(n, x, 5), m = clamp((f - 0.3) / 0.4, 0, 1);
    var r = 1 - Math.abs(2 * n(x * 2.4 + 7) - 1);
    return Math.min(1, 0.72 * m + 0.28 * r * m);
  }
  var nA = makeNoise(11), nD = makeNoise(77), nJ = makeNoise(101), nT = makeNoise(131), nG = makeNoise(151), nS = makeNoise(171), nX = makeNoise(191);

  /* ---------- state ---------- */
  var W = 0, H = 0, dpr = 1, sx = 0, sy = 0, hL = 0, hR = 0, pkH = 0;
  var scene = null, route = [], parts = [], blobs = [], vign = null, pk = [];
  var intensity = clamp((+elStorm.value || 70) / 100, 0, 1);
  var time = 0, p = 0.04, phase = 0, hold = 0, calm = 0, fade = 0, sl = 0.16, sevS = 0.4, readT = 1, whiteout = false;

  var sprite = document.createElement('canvas');
  sprite.width = sprite.height = 256;
  (function () {
    var g = sprite.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(205,220,240,1)');
    gr.addColorStop(0.5, 'rgba(205,220,240,0.45)');
    gr.addColorStop(1, 'rgba(205,220,240,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  })();

  /* ---------- scene (static, pre-rendered) ---------- */
  function drawRange(s, o) {
    var pts = [], top = 1e9, x, y, i;
    for (x = -4; x <= W + 4; x += 3) {
      y = o.base - o.amp * terrain(nA, x / o.wl + o.off);
      pts.push(x, y); if (y < top) top = y;
    }
    var g = s.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, o.top); g.addColorStop(1, o.bot);
    s.beginPath(); s.moveTo(-4, H + 2);
    for (i = 0; i < pts.length; i += 2) s.lineTo(pts[i], pts[i + 1]);
    s.lineTo(W + 4, H + 2); s.closePath(); s.fillStyle = g; s.fill();
    s.beginPath();
    for (i = 0; i < pts.length; i += 2) { if (i === 0) s.moveTo(pts[i], pts[i + 1]); else s.lineTo(pts[i], pts[i + 1]); }
    s.strokeStyle = o.rim; s.lineWidth = 1.2; s.stroke();
  }

  function peakY(x) {
    var d = x - sx, a = Math.abs(d), h = d < 0 ? hL : hR;
    var y = sy + pkH * Math.pow(a / h, 0.8);
    var k = Math.min(1, a / 70);
    y += (nJ(x / 38) - 0.5) * 20 * k + (nJ(x / 11 + 9) - 0.5) * 7 * k;
    return y;
  }
  function edgeL(y) { return sx - hL * Math.pow(Math.max(0, (y - sy) / pkH), 1.25); }
  function edgeR(y) { return sx + hR * Math.pow(Math.max(0, (y - sy) / pkH), 1.25); }

  function tracePeak(s) {
    s.beginPath(); s.moveTo(pk[0][0], H + 2);
    for (var i = 0; i < pk.length; i++) s.lineTo(pk[i][0], pk[i][1]);
    s.lineTo(pk[pk.length - 1][0], H + 2); s.closePath();
  }

  function drawPeak(s) {
    var x, i, y;
    pk = [];
    var x0 = sx - hL - 10, x1 = sx + hR + 10;
    for (x = x0; x < sx; x += 2) pk.push([x, peakY(x)]);
    var idxS = pk.length;
    pk.push([sx, sy]);
    for (x = sx + 2; x <= x1; x += 2) pk.push([x, peakY(x)]);

    tracePeak(s);
    var g = s.createLinearGradient(0, sy, 0, H);
    g.addColorStop(0, '#f1f6fc'); g.addColorStop(0.18, '#c9d7e8'); g.addColorStop(0.42, '#7b8fab');
    g.addColorStop(0.7, '#33445f'); g.addColorStop(1, '#141f33');
    s.fillStyle = g; s.fill();

    // shadowed left face, divided by a jagged arete
    var ar = [];
    for (y = sy; y <= H + 12; y += 12) {
      ar.push([sx - (y - sy) * 0.10 + (nJ(y / 60 + 40) - 0.5) * 22 * Math.min(1, (y - sy) / 80), y]);
    }
    s.beginPath(); s.moveTo(sx, sy);
    for (i = idxS - 1; i >= 0; i--) s.lineTo(pk[i][0], pk[i][1]);
    s.lineTo(pk[0][0], H + 2); s.lineTo(ar[ar.length - 1][0], H + 2);
    for (i = ar.length - 1; i >= 0; i--) s.lineTo(ar[i][0], ar[i][1]);
    s.closePath();
    var sg = s.createLinearGradient(0, sy, 0, H);
    sg.addColorStop(0, 'rgba(8,16,36,0.62)'); sg.addColorStop(1, 'rgba(3,7,16,0.85)');
    s.fillStyle = sg; s.fill();

    // couloirs and snow flutes
    var r = mulberry(7);
    s.save(); tracePeak(s); s.clip();
    for (var k = 0; k < 18; k++) {
      y = sy + pkH * (0.04 + r() * 0.36);
      var xl = edgeL(y), xr = edgeR(y);
      x = xl + (xr - xl) * (0.1 + 0.8 * r());
      var len = pkH * (0.15 + r() * 0.35), steps = 8;
      s.beginPath(); s.moveTo(x, y);
      for (i = 1; i <= steps; i++) { x += (r() - 0.5) * 14 + (x - sx) * 0.02; y += len / steps; s.lineTo(x, y); }
      s.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(8,16,30,0.24)';
      s.lineWidth = 0.8 + r() * 1.6; s.stroke();
    }
    s.restore();

    // warm rim light near the summit
    var rg = s.createLinearGradient(0, sy, 0, sy + pkH * 0.4);
    rg.addColorStop(0, 'rgba(255,190,110,0.9)'); rg.addColorStop(1, 'rgba(255,190,110,0)');
    s.save();
    s.shadowColor = 'rgba(255,170,90,0.6)'; s.shadowBlur = 8 * dpr;
    s.beginPath();
    for (i = 0; i < pk.length; i++) { if (i === 0) s.moveTo(pk[i][0], pk[i][1]); else s.lineTo(pk[i][0], pk[i][1]); }
    s.strokeStyle = rg; s.lineWidth = 1.6; s.stroke();
    s.restore();
  }

  function tree(s, x, y, h) {
    var w = h * 0.34;
    s.beginPath();
    for (var t = 0; t < 3; t++) {
      var yt = y - h + t * h * 0.24, yb = yt + h * 0.5, wt = w * (0.55 + 0.22 * t);
      s.moveTo(x, yt); s.lineTo(x - wt, yb); s.lineTo(x + wt, yb); s.closePath();
    }
    s.fill();
  }

  function drawForeground(s) {
    var base = H * 0.945, r = mulberry(19), pts = [], top = 1e9, x, i;
    for (x = -4; x <= W + 4; x += 4) {
      var y = base - H * 0.05 * terrain(nD, x / 220 + 5);
      pts.push(x, y); if (y < top) top = y;
    }
    var g = s.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#0a101b'); g.addColorStop(1, '#04070d');
    s.beginPath(); s.moveTo(-4, H + 2);
    for (i = 0; i < pts.length; i += 2) s.lineTo(pts[i], pts[i + 1]);
    s.lineTo(W + 4, H + 2); s.closePath(); s.fillStyle = g; s.fill();
    s.fillStyle = '#05080f';
    var scale = Math.max(0.7, H / 760);
    for (x = -6; x < W + 6; x += 5 + r() * 9) {
      if (r() < 0.35) continue;
      var idx = clamp(Math.round((x + 4) / 4), 0, pts.length / 2 - 1);
      tree(s, x, pts[idx * 2 + 1] + 3, (14 + r() * 34) * scale);
    }
  }

  function buildRoute() {
    route = [];
    var N = 240, yb = sy + pkH * 0.56;
    for (var i = 0; i <= N; i++) {
      var t = i / N, y = yb + (sy + 3 - yb) * t;
      var xl = edgeL(y);
      var zig = 0.5 + 0.5 * Math.sin(t * Math.PI * 9 + 0.5);
      route.push([sx - (sx - xl) * (0.08 + 0.82 * zig), y]);
    }
  }

  function build() {
    var narrow = W < 760, span = Math.max(W, H * 1.15);
    sx = W * (narrow ? 0.62 : 0.7); sy = H * (narrow ? 0.37 : 0.25);
    hL = span * 0.46; hR = span * 0.36; pkH = H * 1.05 - sy;
    scene = document.createElement('canvas');
    scene.width = cv.width; scene.height = cv.height;
    var s = scene.getContext('2d'); s.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRange(s, { base: H * 0.55, amp: H * 0.17, wl: 250, off: 3, top: '#5f7290', bot: '#2b3a55', rim: 'rgba(225,236,250,0.20)' });
    drawRange(s, { base: H * 0.66, amp: H * 0.22, wl: 330, off: 41, top: '#4a5d7a', bot: '#1e2c45', rim: 'rgba(225,236,250,0.16)' });
    drawPeak(s);
    drawRange(s, { base: H * 0.84, amp: H * 0.20, wl: 300, off: 77, top: '#2b3b56', bot: '#101a2b', rim: 'rgba(225,236,250,0.10)' });
    drawForeground(s);
    buildRoute();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vign = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vign.addColorStop(0, 'rgba(2,4,9,0)'); vign.addColorStop(1, 'rgba(2,4,9,0.6)');
  }

  function initParticles() {
    var n = Math.round(Math.min(1500, Math.max(260, W * H / 750))), i;
    parts = [];
    for (i = 0; i < n; i++) parts.push({
      x: Math.random() * W, y: Math.random() * H,
      z: 0.2 + 0.8 * Math.pow(Math.random(), 1.7),
      th: Math.random(), ph: Math.random() * 6.28, vx: 0, vy: 0
    });
    blobs = [];
    for (i = 0; i < 11; i++) blobs.push({
      x: Math.random() * W, y: H * (0.2 + 0.7 * Math.random()),
      r: H * (0.35 + 0.5 * Math.random()), z: 0.4 + 0.6 * Math.random(), ph: Math.random() * 6.28
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = hero.clientWidth, h = hero.clientHeight;
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    build(); initParticles();
    if (reduce) draw();
  }

  /* ---------- storm model ---------- */
  function stormTarget(t) {
    var slow = clamp((nT(t * 0.08) - 0.25) / 0.5, 0, 1);
    var g = Math.max(0, nG(t * 0.45) - 0.55) / 0.45;
    return clamp(intensity * (0.3 + 0.7 * slow) + 0.28 * intensity * g, 0, 1);
  }

  function update(dt) {
    time += dt;
    var tgt = stormTarget(time) * (1 - 0.88 * calm);
    sevS += (tgt - sevS) * Math.min(1, dt * 1.4);

    if (phase === 0) {
      p += dt / 60 * (1 - 0.78 * sevS);
      if (p >= 1) { p = 1; phase = 1; hold = 0; }
      if (fade > 0) fade = Math.max(0, fade - dt * 0.8);
    } else if (phase === 1) {
      calm = Math.min(1, calm + dt * 0.3); hold += dt;
      if (hold > 16) phase = 2;
    } else {
      fade = Math.min(1, fade + dt * 0.7);
      if (fade >= 1) { p = 0.02; calm = 0; phase = 0; }
    }
    sl += ((0.16 + 0.3 * p * p + 0.54 * calm) - sl) * Math.min(1, dt * 1.6);

    var wind = 26 + 230 * sevS, i, q;
    for (i = 0; i < parts.length; i++) {
      q = parts[i];
      q.vx = -wind * (0.35 + 0.65 * q.z) * (1 + 0.3 * Math.sin(time * 1.1 + q.y * 0.005));
      q.vy = (45 + 70 * q.z) * (0.55 + 0.6 * sevS) + Math.sin(time * 1.7 + q.ph) * 18 * sevS;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < -12) { q.x = W + 12 + Math.random() * 30; q.y = Math.random() * H; }
      if (q.x > W + 40) q.x = -10;
      if (q.y > H + 12) { q.y = -12; q.x = Math.random() * W; }
    }
    for (i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      b.x -= (15 + 120 * sevS) * b.z * dt;
      if (b.x < -b.r * 1.6) b.x = W + b.r * 1.6;
    }
  }

  /* ---------- drawing ---------- */
  function routePath(from, to) {
    ctx.beginPath();
    for (var i = from; i <= to; i++) { if (i === from) ctx.moveTo(route[i][0], route[i][1]); else ctx.lineTo(route[i][0], route[i][1]); }
  }

  function draw() {
    if (!scene) return;
    var g, i, q;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#050912'); g.addColorStop(0.35, '#0f1b31'); g.addColorStop(0.6, '#22344f'); g.addColorStop(1, '#4a5f7e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var a = 0.08 + 0.42 * sl;
    g = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.8);
    g.addColorStop(0, 'rgba(255,176,96,' + a + ')');
    g.addColorStop(0.3, 'rgba(255,140,80,' + (a * 0.35) + ')');
    g.addColorStop(1, 'rgba(255,140,80,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.drawImage(scene, 0, 0, W, H);

    ctx.globalCompositeOperation = 'screen';
    g = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.22);
    g.addColorStop(0, 'rgba(255,190,120,' + (0.12 + 0.3 * sl) + ')');
    g.addColorStop(1, 'rgba(255,170,100,0)');
    ctx.fillStyle = g; ctx.fillRect(sx - H * 0.25, sy - H * 0.25, H * 0.5, H * 0.5);
    ctx.globalCompositeOperation = 'source-over';

    // route ahead
    ctx.setLineDash([3, 5]); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    routePath(0, route.length - 1); ctx.stroke(); ctx.setLineDash([]);

    // drifting cloud banks
    for (i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      ctx.globalAlpha = (0.02 + 0.24 * sevS) * (0.6 + 0.4 * Math.sin(time * 0.3 + b.ph));
      ctx.drawImage(sprite, b.x - b.r * 1.6, b.y - b.r * 0.9, b.r * 3.2, b.r * 1.8);
    }
    ctx.globalAlpha = 1;

    // whiteout veil
    var va = 0.03 + 0.55 * sevS;
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(140,160,188,' + (va * 0.55) + ')');
    g.addColorStop(1, 'rgba(170,188,212,' + va + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // snow
    var thr = 0.1 + 0.9 * sevS, k = 0.04;
    ctx.fillStyle = 'rgba(222,234,250,0.55)';
    for (i = 0; i < parts.length; i++) {
      q = parts[i];
      if (q.th > thr || q.z >= 0.5) continue;
      var sz = 1 + q.z * 1.2; ctx.fillRect(q.x, q.y, sz, sz);
    }
    ctx.lineCap = 'round';
    var bands = [[0.5, 0.75, 1.1, 'rgba(226,237,252,0.6)'], [0.75, 2, 2, 'rgba(240,247,255,0.85)']];
    for (var bi = 0; bi < 2; bi++) {
      var bd = bands[bi];
      ctx.beginPath();
      for (i = 0; i < parts.length; i++) {
        q = parts[i];
        if (q.th > thr || q.z < bd[0] || q.z >= bd[1]) continue;
        ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * k, q.y - q.vy * k);
      }
      ctx.lineWidth = bd[2]; ctx.strokeStyle = bd[3]; ctx.stroke();
    }

    // trail behind the climber
    var fi = p * (route.length - 1), i0 = Math.floor(fi), fr = fi - i0;
    var i1 = Math.min(i0 + 1, route.length - 1);
    var lx = route[i0][0] + (route[i1][0] - route[i0][0]) * fr;
    var ly = route[i0][1] + (route[i1][1] - route[i0][1]) * fr;
    if (i0 > 0) {
      ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,196,120,0.55)';
      routePath(0, i0); ctx.lineTo(lx, ly); ctx.stroke();
    }

    // summit beam and flag
    ctx.globalCompositeOperation = 'screen';
    if (calm > 0.01) {
      var bh = H * 0.45;
      g = ctx.createLinearGradient(0, sy, 0, sy - bh);
      g.addColorStop(0, 'rgba(255,205,140,' + (0.3 * calm) + ')'); g.addColorStop(1, 'rgba(255,205,140,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 1.5, sy - bh, 3, bh);
      g = ctx.createLinearGradient(0, sy, 0, sy - bh);
      g.addColorStop(0, 'rgba(255,190,120,' + (0.12 * calm) + ')'); g.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 8, sy - bh, 16, bh);
    }

    // beacon
    var pulse = 0.5 + 0.5 * Math.sin(time * 2.1), A = 0.6 + 0.4 * pulse, br = 18 + 26 * sl + 6 * pulse;
    g = ctx.createRadialGradient(sx, sy - 2, 0, sx, sy - 2, br);
    g.addColorStop(0, 'rgba(255,228,176,' + A + ')');
    g.addColorStop(0.25, 'rgba(255,180,100,' + (A * 0.5) + ')');
    g.addColorStop(1, 'rgba(255,150,80,0)');
    ctx.fillStyle = g; ctx.fillRect(sx - br, sy - 2 - br, br * 2, br * 2);

    // lamp
    var jx = Math.sin(time * 9) * sevS * 0.6, lr = 14 + 4 * Math.sin(time * 3.3);
    g = ctx.createRadialGradient(lx + jx, ly, 0, lx + jx, ly, lr);
    g.addColorStop(0, 'rgba(255,236,200,0.95)');
    g.addColorStop(0.3, 'rgba(255,190,110,0.5)');
    g.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = g; ctx.fillRect(lx + jx - lr, ly - lr, lr * 2, lr * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff6e4';
    ctx.beginPath(); ctx.arc(lx + jx, ly, 1.8, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, sy - 2, 2, 0, 6.2832); ctx.fillStyle = '#fff1d6'; ctx.fill();

    if (calm > 0.01) {
      var fw = Math.sin(time * 5) * 2 * (0.4 + sevS);
      ctx.globalAlpha = calm;
      ctx.strokeStyle = '#ffe3b8'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 22); ctx.stroke();
      ctx.fillStyle = '#ffb45a';
      ctx.beginPath(); ctx.moveTo(sx, sy - 22); ctx.lineTo(sx + 14, sy - 18 + fw); ctx.lineTo(sx, sy - 13); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = vign; ctx.fillRect(0, 0, W, H);
    if (fade > 0.001) { ctx.fillStyle = 'rgba(4,7,12,' + fade + ')'; ctx.fillRect(0, 0, W, H); }

    elProg.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }

  function readouts() {
    elAlt.textContent = Math.round(3650 + p * 1158).toLocaleString('en-US') + ' m';
    elWind.textContent = Math.round(14 + sevS * 112 + (nS(time * 0.8) - 0.5) * 10) + ' km/h';
    var vis = 25 + 2600 * Math.pow(1 - sevS, 2.2);
    elVis.textContent = vis >= 1000 ? (vis / 1000).toFixed(1) + ' km' : (Math.round(vis / 5) * 5) + ' m';
    if (sevS > 0.6) whiteout = true; else if (sevS < 0.5) whiteout = false;
    elState.textContent = phase >= 1 ? 'Summit' : whiteout ? 'Whiteout, holding pace' : 'Ascending';
  }

  /* ---------- loop ---------- */
  var last = 0;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    update(dt); draw();
    readT += dt; if (readT > 0.25) { readT = 0; readouts(); }
    requestAnimationFrame(loop);
  }

  elStorm.addEventListener('input', function () {
    intensity = clamp(elStorm.value / 100, 0, 1);
    if (reduce) { sevS = stormTarget(time) * (1 - 0.88 * calm); draw(); readouts(); }
  });

  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(hero);
  window.addEventListener('resize', resize);

  if (reduce) {
    p = 0.78; time = 24; sevS = stormTarget(time); sl = 0.16 + 0.3 * p * p;
    draw(); readouts();
  } else {
    draw(); readouts();
    requestAnimationFrame(function (t) { last = t; requestAnimationFrame(loop); });
  }
})();
