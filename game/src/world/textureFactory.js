// Solaris Bay — procedural canvas textures. Zero external images:
// every facade, road, sand and sign is drawn on a canvas at runtime.
window.SB = window.SB || {};

(function () {
  'use strict';

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function tex(canvas, repeatX, repeatY) {
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    if (repeatX) t.repeat.set(repeatX, repeatY || repeatX);
    t.anisotropy = 4;
    return t;
  }

  function noiseOn(ctx, w, h, n, alpha, dark) {
    for (var i = 0; i < n; i++) {
      var v = Math.floor(Math.random() * 60);
      ctx.fillStyle = dark
        ? 'rgba(0,0,0,' + (alpha * Math.random()) + ')'
        : 'rgba(255,255,255,' + (alpha * Math.random()) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }

  function asphaltTexture() {
    var c = makeCanvas(128, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#2e2e33'; ctx.fillRect(0, 0, 128, 128);
    noiseOn(ctx, 128, 128, 450, 0.09, false);
    noiseOn(ctx, 128, 128, 300, 0.12, true);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    for (var i = 0; i < 6; i++) {
      ctx.beginPath();
      var y = Math.random() * 128;
      ctx.moveTo(0, y); ctx.lineTo(128, y + (Math.random() * 8 - 4));
      ctx.stroke();
    }
    return tex(c);
  }

  function sidewalkTexture() {
    var c = makeCanvas(128, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#9a9a94'; ctx.fillRect(0, 0, 128, 128);
    noiseOn(ctx, 128, 128, 400, 0.12, true);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 126, 126);
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.moveTo(0, 64); ctx.lineTo(128, 64); ctx.stroke();
    return tex(c);
  }

  function sandTexture() {
    var c = makeCanvas(128, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#dcc08a'; ctx.fillRect(0, 0, 128, 128);
    noiseOn(ctx, 128, 128, 1200, 0.2, true);
    noiseOn(ctx, 128, 128, 400, 0.15, false);
    return tex(c);
  }

  function waterTexture() {
    var c = makeCanvas(128, 128), ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, '#1d6f8e'); g.addColorStop(0.5, '#2a8ab0'); g.addColorStop(1, '#16607e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
    for (var i = 0; i < 10; i++) {
      var y = Math.random() * 128;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(40, y - 4, 80, y + 4, 128, y);
      ctx.stroke();
    }
    return tex(c);
  }

  // Building facade: base colour, window grid, lit ratio, style variants.
  function facadeTexture(base, style, litRatio) {
    var c = makeCanvas(128, 256), ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 256);
    noiseOn(ctx, 128, 256, 300, 0.1, true);
    var cols = 5, rows = 12, ww = 128 / cols, wh = 256 / rows;
    for (var r = 0; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        var lit = Math.random() < litRatio;
        if (style === 'glass') {
          ctx.fillStyle = lit ? '#ffd98a' : (r % 2 ? '#5f7f96' : '#7498b4');
        } else if (style === 'pastel') {
          ctx.fillStyle = lit ? '#ffe9a8' : '#3d4a5c';
        } else if (style === 'warehouse') {
          ctx.fillStyle = lit ? '#ffcf7a' : '#2c2f36';
        } else {
          ctx.fillStyle = lit ? '#ffe1a0' : '#20242c';
        }
        ctx.fillRect(col * ww + 4, r * wh + 4, ww - 8, wh - 8);
      }
    }
    if (style === 'pastel') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, 0, 128, 10);
      ctx.fillRect(0, 246, 128, 10);
    }
    if (style === 'warehouse') {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
      for (var x = 8; x < 128; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
      }
    }
    return tex(c);
  }

  function containerTexture(color) {
    var c = makeCanvas(128, 64), ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
    for (var x = 6; x < 128; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 64); ctx.stroke();
    }
    noiseOn(ctx, 128, 64, 150, 0.15, true);
    return tex(c);
  }

  function signTexture(text, bg, fg, sub) {
    var c = makeCanvas(512, 128), ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.fillText(text, 256, sub ? 52 : 64);
    if (sub) {
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.fillText(sub, 256, 100);
    }
    return tex(c);
  }

  function crosswalkTexture() {
    var c = makeCanvas(128, 128), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var i = 0; i < 6; i++) ctx.fillRect(8 + i * 20, 0, 10, 128);
    return tex(c);
  }

  SB.textures = {
    asphalt: asphaltTexture,
    sidewalk: sidewalkTexture,
    sand: sandTexture,
    water: waterTexture,
    facade: facadeTexture,
    container: containerTexture,
    sign: signTexture,
    crosswalk: crosswalkTexture,
  };
})();
