// Ark Passport — space pirate passport generator with audio-reactive story export.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const W = 1080, H = 1920;
  const canvas = $('stage');
  const ctx = canvas.getContext('2d');

  // Passport data page, drawn once per change at 2x and composited every frame
  const CW = 960, CH = 676, CS = 1;
  const CARD_Y = 955;
  const card = document.createElement('canvas');
  card.width = CW * CS; card.height = CH * CS;
  const cc = card.getContext('2d');

  // ---------- Utils ----------
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  const sparklePath = (c, x, y, r, pinch = 0.18) => {
    const p = r * pinch;
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x + p, y - p, x + r, y);
    c.quadraticCurveTo(x + p, y + p, x, y + r);
    c.quadraticCurveTo(x - p, y + p, x - r, y);
    c.quadraticCurveTo(x - p, y - p, x, y - r);
    c.closePath();
  };
  const heartPath = (c, x, y, s) => {
    c.moveTo(x, y + s * 0.35);
    c.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.45, y - s * 0.95, x, y - s * 0.45);
    c.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
    c.closePath();
  };

  // Draw text with manual tracking; align: 'left' | 'center' | 'right'
  const tracked = (c, text, x, y, spacing, align = 'left', stroke = false) => {
    const chars = [...text];
    const widths = chars.map((ch) => c.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const prev = c.textAlign;
    c.textAlign = 'left';
    chars.forEach((ch, i) => { stroke ? c.strokeText(ch, cx, y) : c.fillText(ch, cx, y); cx += widths[i] + spacing; });
    c.textAlign = prev;
    return total;
  };
  const fitFont = (c, text, weight, family, maxSize, maxW) => {
    let size = maxSize;
    c.font = `${weight} ${size}px ${family}`;
    const w = c.measureText(text).width;
    if (w > maxW) size = Math.max(10, Math.floor(size * (maxW / w)));
    c.font = `${weight} ${size}px ${family}`;
    return size;
  };

  const F_DISPLAY = '"Unbounded", "Arial Black", sans-serif';
  const F_BODY = '"Space Grotesk", ui-sans-serif, system-ui, sans-serif';
  const F_MONO = '"Space Mono", ui-monospace, Menlo, monospace';
  const F_SCRIPT = '"Pacifico", "Brush Script MT", cursive';

  // ---------- Themes ----------
  const THEMES = [
    { name: 'Bubblegum', bg: ['#12031f', '#2d0a44', '#4a0d4f'], neb: ['#ff4fb8', '#9b5cff', '#3ad7ff'], accent: '#ff5fc1', accent2: '#9b6bff', card: ['#ffe1f5', '#ecdcff', '#d6f4ff'], ink: '#2b1142', stamp: '#ff2f92', glow: '#ff8fd6', grid: '#ff5fc1' },
    { name: 'Lilac Haze', bg: ['#0a0620', '#22154f', '#3a1a5e'], neb: ['#b388ff', '#ff9de2', '#7ee8fa'], accent: '#c49bff', accent2: '#ff9de2', card: ['#f0e6ff', '#ffe4f6', '#e2f3ff'], ink: '#24124a', stamp: '#8f4dff', glow: '#cfa9ff', grid: '#b388ff' },
    { name: 'Cyber Mint', bg: ['#020d14', '#062a36', '#15173f'], neb: ['#3dffc5', '#ff5fd2', '#5a8bff'], accent: '#3ff5c9', accent2: '#ff6ad5', card: ['#dcfff4', '#f4e4ff', '#dcecff'], ink: '#0f2a33', stamp: '#ff2fa8', glow: '#7fffe0', grid: '#3ff5c9' },
    { name: 'Sunset Rave', bg: ['#1a0510', '#3d0c2e', '#5a1633'], neb: ['#ff7a59', '#ff4fa3', '#ffd166'], accent: '#ff7eb0', accent2: '#ffb35c', card: ['#fff0e2', '#ffe2f0', '#fff6cf'], ink: '#3a0f22', stamp: '#ff3d6e', glow: '#ffb199', grid: '#ff7eb0' },
  ];
  let th = THEMES[0];

  // ---------- Passport data ----------
  const RANKS = ['Glitter Gunner', 'Stardust Deckhand', 'Nebula Navigator', 'Captain of Vibes', 'Bass Boatswain', 'Laser Quartermaster', 'First Mate of Mischief', 'Comet Cannoneer', 'Rave Rigger', 'Treasure Keeper', 'Starlight Stowaway'];
  const PLANETS = ['Club Andromeda', 'Planet Bubblegum', 'Nebula Nine', 'Saturn’s Rings', 'Moon Base Luv', 'Glitterfall IV', 'Neon Venus', 'Crystal Caverns', 'Cyclone Station', 'The Void (VIP)'];
  const CALLSIGNS = ['Glitterbomb', 'Starbby', 'Cosmic Kitty', 'Pixie Dust', 'Laser Lash', 'Moonbeam', 'Honey Comet', 'Stardoll', 'Blaster Babe', 'Nebby', 'Sparkle Siren', 'Space Cadet'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const now = new Date();
  const saved = store.get('ark-passport') || {};
  const data = {
    first: saved.first || '',
    last: saved.last || '',
    call: saved.call || '',
    rank: saved.rank || RANKS[0],
    planet: saved.planet || '',
    number: saved.number || String(100000 + ((Math.random() * 900000) | 0)),
    issued: `${String(now.getDate()).padStart(2, '0')} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
  };
  const val = (k, fallback) => (data[k] || '').trim() || fallback;

  // ---------- Photo ----------
  const PHOTO = { x: 36, y: 126, w: 246, h: 312, r: 26 };
  const photo = { src: null, processed: null, zoom: 1, ox: 0, oy: 0, style: 'natural' };

  const processPhoto = () => {
    if (!photo.src) { photo.processed = null; return; }
    const s = photo.src;
    const k = Math.min(1, 1100 / Math.max(s.width, s.height));
    const w = Math.round(s.width * k), h = Math.round(s.height * k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(s, 0, 0, w, h);
    if (photo.style !== 'natural') {
      const id = x.getImageData(0, 0, w, h), d = id.data;
      const ink = hex(th.ink), light = hex(th.card[0]), acc = hex(th.accent);
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (photo.style === 'duotone') {
          let l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          l = clamp01((l - 0.5) * 1.15 + 0.52);
          const m = l < 0.5 ? l * 2 : (l - 0.5) * 2;
          const a = l < 0.5 ? ink : acc, bb = l < 0.5 ? acc : light;
          d[i] = a[0] + (bb[0] - a[0]) * m;
          d[i + 1] = a[1] + (bb[1] - a[1]) * m;
          d[i + 2] = a[2] + (bb[2] - a[2]) * m;
        } else {
          // dreamy: lifted shadows, soft contrast, pink cast
          d[i] = Math.min(255, 22 + r * 0.9 + acc[0] * 0.08);
          d[i + 1] = Math.min(255, 14 + g * 0.86 + acc[1] * 0.06);
          d[i + 2] = Math.min(255, 26 + b * 0.88 + acc[2] * 0.1);
        }
      }
      x.putImageData(id, 0, 0);
      if (photo.style === 'dreamy') {
        // cheap bloom: downscale + upscale, screen on top
        const s2 = document.createElement('canvas');
        s2.width = Math.max(1, w >> 4); s2.height = Math.max(1, h >> 4);
        s2.getContext('2d').drawImage(c, 0, 0, s2.width, s2.height);
        x.globalCompositeOperation = 'screen';
        x.globalAlpha = 0.35;
        x.imageSmoothingQuality = 'high';
        x.drawImage(s2, 0, 0, w, h);
        x.globalAlpha = 1;
        x.globalCompositeOperation = 'source-over';
      }
    }
    photo.processed = c;
  };

  const photoRect = () => {
    const img = photo.processed;
    const sc = Math.max(PHOTO.w / img.width, PHOTO.h / img.height) * photo.zoom;
    const dw = img.width * sc, dh = img.height * sc;
    const mx = (dw - PHOTO.w) / 2, my = (dh - PHOTO.h) / 2;
    photo.ox = Math.max(-mx, Math.min(mx, photo.ox));
    photo.oy = Math.max(-my, Math.min(my, photo.oy));
    return { x: PHOTO.x + (PHOTO.w - dw) / 2 + photo.ox, y: PHOTO.y + (PHOTO.h - dh) / 2 + photo.oy, w: dw, h: dh };
  };

  // ---------- Passport art ----------
  const drawSkull = (c, x, y, s) => {
    c.save();
    c.translate(x, y);
    c.scale(s / 100, s / 100);
    // crossbones
    c.fillStyle = '#fff';
    c.strokeStyle = th.ink;
    c.lineWidth = 5;
    for (const a of [-0.7, 0.7]) {
      c.save();
      c.rotate(a);
      rrect(c, -58, -8, 116, 16, 8); c.fill(); c.stroke();
      for (const e of [-58, 58]) {
        c.beginPath(); c.arc(e, -8, 10, 0, 6.3); c.arc(e, 8, 10, 0, 6.3); c.fill();
      }
      c.restore();
    }
    // head
    c.beginPath();
    c.ellipse(0, -6, 40, 36, 0, 0, Math.PI * 2);
    c.fill(); c.stroke();
    rrect(c, -22, 18, 44, 24, 10); c.fill(); c.stroke();
    // heart eyes
    c.fillStyle = th.stamp;
    c.beginPath(); heartPath(c, -15, -4, 17); heartPath(c, 15, -4, 17); c.fill();
    // nose + teeth
    c.fillStyle = th.ink;
    c.beginPath(); c.moveTo(0, 8); c.lineTo(-4, 15); c.lineTo(4, 15); c.closePath(); c.fill();
    c.lineWidth = 3;
    c.beginPath(); for (const tx of [-9, 0, 9]) { c.moveTo(tx, 24); c.lineTo(tx, 36); } c.stroke();
    // bow
    c.fillStyle = th.accent;
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(18, -38); c.lineTo(46, -56); c.lineTo(48, -24); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(18, -38); c.lineTo(-6, -58); c.lineTo(-10, -26); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.arc(18, -38, 8, 0, 6.3); c.fill(); c.stroke();
    c.restore();
  };

  const drawStamp = (c, x, y, r, rot) => {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha = 0.82;
    c.strokeStyle = c.fillStyle = th.stamp;
    c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.stroke();
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, r - 9, 0, 6.3); c.stroke();
    c.beginPath(); c.arc(0, 0, r - 34, 0, 6.3); c.stroke();
    // ring text
    c.font = `700 13px ${F_MONO}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const ring = '✦ ARK CUSTOMS ✦ RAVE READY ✦ ARK CUSTOMS ✦ RAVE READY ';
    const chars = [...ring];
    chars.forEach((ch, i) => {
      const a = (i / chars.length) * Math.PI * 2 - Math.PI / 2;
      c.save();
      c.rotate(a + Math.PI / 2);
      c.fillText(ch, 0, -(r - 21));
      c.restore();
    });
    c.font = `900 17px ${F_DISPLAY}`;
    c.fillText('APPROVED', 0, -4);
    c.beginPath(); heartPath(c, 0, 18, 13); c.fill();
    c.restore();
    c.globalAlpha = 1;
  };

  const mrzCheck = (s) => {
    const w = [7, 3, 1];
    let sum = 0;
    [...s].forEach((ch, i) => {
      const v = ch === '<' ? 0 : /\d/.test(ch) ? +ch : ch.charCodeAt(0) - 55;
      sum += v * w[i % 3];
    });
    return String(sum % 10);
  };
  const mrzName = (s) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z ]/g, '').trim().replace(/\s+/g, '<');

  const drawCard = () => {
    const c = cc;
    c.setTransform(CS, 0, 0, CS, 0, 0);
    c.clearRect(0, 0, CW, CH);
    c.textBaseline = 'alphabetic';
    c.save();
    rrect(c, 0, 0, CW, CH, 34);
    c.clip();

    // holographic pastel base
    const g = c.createLinearGradient(0, 0, CW, CH);
    th.card.forEach((col, i) => g.addColorStop(i / (th.card.length - 1), col));
    c.fillStyle = g;
    c.fillRect(0, 0, CW, CH);

    // guilloche line work
    c.lineWidth = 1.1;
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    for (let k = 0; k < 30; k++) {
      c.beginPath();
      for (let x = 0; x <= CW; x += 6) {
        const y = 20 + k * 23 + Math.sin(x * 0.017 + k * 0.45) * 13 + Math.sin(x * 0.0061 - k * 0.8) * 9;
        x ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    // rosette
    c.strokeStyle = rgba(th.accent2, 0.22);
    c.lineWidth = 1.2;
    for (let i = 0; i < 24; i++) {
      c.beginPath();
      c.ellipse(700, 330, 190, 58, (i * Math.PI) / 24, 0, Math.PI * 2);
      c.stroke();
    }
    // tiny star field print
    c.fillStyle = rgba(th.ink, 0.07);
    for (let i = 0; i < 26; i++) {
      c.beginPath();
      sparklePath(c, (i * 197) % CW, 120 + ((i * 131) % 420), 5 + (i % 3) * 3);
      c.fill();
    }

    // header
    drawSkull(c, 64, 62, 64);
    c.fillStyle = rgba(th.ink, 0.62);
    c.font = `700 13px ${F_MONO}`;
    tracked(c, 'ENCY FLEET ✦ THE ARK ✦ ARMORY-01', 118, 38, 2.2);
    c.fillStyle = th.ink;
    fitFont(c, 'INTERGALACTIC PASSPORT', 900, F_DISPLAY, 31, 540);
    c.fillText('INTERGALACTIC PASSPORT', 118, 78);

    c.textAlign = 'right';
    c.fillStyle = rgba(th.ink, 0.55);
    c.font = `700 11px ${F_MONO}`;
    c.fillText('PASSPORT NO. / N° DE PASSEPORT', CW - 34, 40);
    c.fillStyle = th.stamp;
    c.font = `700 24px ${F_MONO}`;
    c.fillText(`ARK${data.number}`, CW - 34, 72);
    c.textAlign = 'left';

    const hg = c.createLinearGradient(0, 0, CW, 0);
    hg.addColorStop(0, th.accent); hg.addColorStop(1, th.accent2);
    c.fillStyle = hg;
    c.fillRect(34, 102, CW - 68, 3);

    // photo
    c.save();
    c.shadowColor = rgba(th.accent, 0.55);
    c.shadowBlur = 22;
    c.fillStyle = '#fff';
    rrect(c, PHOTO.x - 6, PHOTO.y - 6, PHOTO.w + 12, PHOTO.h + 12, PHOTO.r + 5);
    c.fill();
    c.restore();
    c.save();
    rrect(c, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, PHOTO.r);
    c.clip();
    if (photo.processed) {
      const r = photoRect();
      c.drawImage(photo.processed, r.x, r.y, r.w, r.h);
    } else {
      const pg = c.createLinearGradient(0, PHOTO.y, 0, PHOTO.y + PHOTO.h);
      pg.addColorStop(0, th.card[1]); pg.addColorStop(1, th.card[2]);
      c.fillStyle = pg;
      c.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
      c.fillStyle = rgba(th.ink, 0.16);
      c.beginPath(); c.arc(PHOTO.x + PHOTO.w / 2, PHOTO.y + 130, 56, 0, 6.3); c.fill();
      c.beginPath(); c.ellipse(PHOTO.x + PHOTO.w / 2, PHOTO.y + PHOTO.h + 20, 110, 120, 0, 0, 6.3); c.fill();
      c.fillStyle = rgba(th.ink, 0.55);
      c.font = `700 14px ${F_MONO}`;
      tracked(c, 'ADD YOUR PHOTO', PHOTO.x + PHOTO.w / 2, PHOTO.y + 250, 1.5, 'center');
    }
    c.restore();

    // signature
    c.fillStyle = rgba(th.ink, 0.5);
    c.font = `700 10px ${F_MONO}`;
    tracked(c, "HOLDER'S SIGNATURE", PHOTO.x, 524, 1.5);
    c.save();
    c.translate(PHOTO.x + 6, 506);
    c.rotate(-0.06);
    c.fillStyle = th.ink;
    const sig = val('call', '') || val('first', 'Luna');
    fitFont(c, sig, 400, F_SCRIPT, 36, 236);
    c.fillText(sig, 0, 0);
    c.restore();

    // fields
    const field = (label, value, x, y, maxW, color = th.ink) => {
      c.fillStyle = rgba(th.ink, 0.55);
      c.font = `700 11px ${F_MONO}`;
      tracked(c, label, x, y, 1.4);
      c.fillStyle = color;
      fitFont(c, value, 700, F_BODY, 27, maxW);
      c.fillText(value, x, y + 31);
    };
    const X1 = 314, X2 = 604;
    field('SURNAME / NOM', val('last', 'Stardust').toUpperCase(), X1, 136, 470);
    field('GIVEN NAMES / PRÉNOMS', val('first', 'Luna').toUpperCase(), X1, 204, 470);
    field('CALLSIGN / ALIAS', `“${val('call', 'Glitterbomb')}”`, X1, 272, 270, th.stamp);
    field('RANK / GRADE', data.rank, X2, 272, 320);
    field('HOME PLANET', val('planet', 'Club Andromeda'), X1, 340, 270);
    field('VESSEL', 'THE ARK', X2, 340, 320);
    field('DATE OF ISSUE', data.issued, X1, 408, 270);
    field('EXPIRES', 'NEVER ♡', X2, 408, 320, th.stamp);

    // ghost photo
    if (photo.processed) {
      c.save();
      c.globalAlpha = 0.22;
      rrect(c, 812, 124, 112, 138, 14);
      c.clip();
      const r = photoRect();
      const k = 112 / PHOTO.w;
      c.filter = 'grayscale(1)';
      c.drawImage(photo.processed, 812 + (r.x - PHOTO.x) * k, 124 + (r.y - PHOTO.y) * k, r.w * k, r.h * k);
      c.restore();
    } else {
      c.fillStyle = rgba(th.ink, 0.06);
      rrect(c, 812, 124, 112, 138, 14); c.fill();
    }

    // stamps
    const box = { x: 330, y: 478, w: 212, h: 58 };
    c.save();
    c.translate(box.x + box.w / 2, box.y + box.h / 2);
    c.rotate(0.07);
    c.globalAlpha = 0.72;
    c.strokeStyle = c.fillStyle = th.accent2;
    c.lineWidth = 3;
    rrect(c, -box.w / 2, -box.h / 2, box.w, box.h, 10); c.stroke();
    c.font = `900 15px ${F_DISPLAY}`;
    c.textAlign = 'center';
    c.fillText('ENTRY ✦ SATURN', 0, -2);
    c.font = `700 11px ${F_MONO}`;
    c.fillText(data.issued, 0, 17);
    c.restore();
    c.globalAlpha = 1;
    drawStamp(c, 800, 452, 76, -0.22);

    // MRZ
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(0, 556, CW, CH - 556);
    const l1 = (`P<ARK${mrzName(val('last', 'Stardust'))}<<${mrzName(val('first', 'Luna'))}`).padEnd(44, '<').slice(0, 44);
    const num = `ARK${data.number}`;
    const l2 = (`${num}${mrzCheck(num)}ARK${String(now.getFullYear()).slice(2)}0101F${mrzCheck('NEVER')}NEVER<<<<`).padEnd(43, '<').slice(0, 43) + '8';
    c.fillStyle = th.ink;
    c.font = `700 27px ${F_MONO}`;
    const adv = (CW - 72) / 44;
    for (const [line, y] of [[l1, 606], [l2, 648]]) {
      [...line].forEach((ch, i) => { c.fillText(ch, 36 + i * adv, y); });
    }

    c.restore();
    // edge
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    rrect(c, 1.5, 1.5, CW - 3, CH - 3, 33);
    c.stroke();
  };

  let cardDirty = true;
  const invalidate = () => { cardDirty = true; };

  // ---------- Scene ----------
  const stars = Array.from({ length: 240 }, () => ({
    x: Math.random() * W, y: Math.random() * H, r: rand(0.8, 2.6), sp: rand(0.6, 2.4), ph: Math.random() * 6.28,
  }));
  let parts = [];
  const spawn = (n, burst) => {
    for (let i = 0; i < n; i++) {
      const fromCard = burst && Math.random() < 0.85;
      const ang = Math.random() * Math.PI * 2;
      parts.push({
        x: fromCard ? W / 2 + Math.cos(ang) * rand(420, 520) : rand(0, W),
        y: fromCard ? CARD_Y + Math.sin(ang) * rand(300, 380) : H + 30,
        vx: fromCard ? Math.cos(ang) * rand(80, 260) : rand(-20, 20),
        vy: fromCard ? Math.sin(ang) * rand(80, 260) - 60 : rand(-140, -60),
        s: rand(10, burst ? 30 : 22),
        rot: rand(0, 6.28), vr: rand(-2, 2),
        type: Math.random() < 0.38 ? 'heart' : Math.random() < 0.5 ? 'dot' : 'spark',
        col: pick([th.accent, th.accent2, '#ffffff', th.neb[2]]),
        life: 0, max: rand(2.2, 4.2),
      });
    }
  };
  let shooting = [];

  let bgCache = null, bgTheme = null;
  const background = () => {
    if (bgTheme === th) return bgCache;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(0.55, th.bg[1]); g.addColorStop(1, th.bg[2]);
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    bgCache = c; bgTheme = th;
    return c;
  };

  const drawPlanet = (x, y, r, t) => {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 0.5) * 8);
    ctx.rotate(-0.35);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.35, th.neb[1]);
    g.addColorStop(1, th.bg[1]);
    // back half of ring
    ctx.lineWidth = r * 0.12;
    ctx.strokeStyle = rgba(th.accent, 0.8);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.8, r * 0.42, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.9);
    ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.8, r * 0.42, 0, 0, Math.PI); ctx.stroke();
    ctx.restore();
  };

  const drawGrid = (t) => {
    const top = 1440, vx = W / 2;
    ctx.save();
    const fade = ctx.createLinearGradient(0, top, 0, H);
    fade.addColorStop(0, rgba(th.grid, 0));
    fade.addColorStop(1, rgba(th.grid, 0.55 + S.kick * 0.35));
    ctx.strokeStyle = fade;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -12; i <= 12; i++) {
      ctx.moveTo(vx + i * 40, top);
      ctx.lineTo(vx + i * 260, H);
    }
    const speed = (t * 0.55) % 1;
    for (let k = 0; k < 10; k++) {
      const z = (k + speed) / 10;
      const y = top + (H - top) * z * z;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  const drawParticle = (p) => {
    const a = Math.min(1, p.life * 3) * (1 - smoothstep(p.max * 0.6, p.max, p.life));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.col;
    ctx.beginPath();
    if (p.type === 'heart') heartPath(ctx, 0, 0, p.s);
    else if (p.type === 'spark') sparklePath(ctx, 0, 0, p.s);
    else ctx.arc(0, 0, p.s * 0.22, 0, 6.3);
    ctx.fill();
    ctx.restore();
  };

  let cardXf = { x: W / 2, y: CARD_Y, rot: 0, s: 1 };
  let trackLabel = 'CRYSTALS';
  let spec = null; // last spectrum used (for EQ bars)
  let specSr = 48000;

  // Glows are pre-rendered into sprites (shadowBlur per frame is what makes export slow)
  const NEB_K = 4;
  const neb = document.createElement('canvas');
  neb.width = W / NEB_K; neb.height = H / NEB_K;
  const nctx = neb.getContext('2d');
  const sprite = { card: null, title: null, pill: null };
  const PILL_TEXT = 'CLEARED FOR TAKEOFF ♡';
  const buildSprites = () => {
    const pad = 160;
    let c = document.createElement('canvas');
    c.width = CW + pad * 2; c.height = CH + pad * 2;
    let x = c.getContext('2d');
    x.shadowColor = rgba(th.glow, 0.9);
    x.shadowBlur = 90;
    x.fillStyle = rgba(th.glow, 0.9);
    rrect(x, pad, pad, CW, CH, 34); x.fill();
    sprite.card = c;

    c = document.createElement('canvas');
    c.width = W; c.height = 300;
    x = c.getContext('2d');
    x.textAlign = 'center';
    x.shadowColor = th.glow;
    x.shadowBlur = 34;
    const tg = x.createLinearGradient(140, 0, W - 140, 0);
    tg.addColorStop(0, th.accent); tg.addColorStop(0.5, '#ffffff'); tg.addColorStop(1, th.accent2);
    x.fillStyle = tg;
    x.font = `900 118px ${F_DISPLAY}`;
    x.fillText('WELCOME', W / 2, 150);
    x.fillStyle = '#fff';
    x.font = `900 58px ${F_DISPLAY}`;
    x.fillText('ABOARD THE ARK', W / 2, 228);
    sprite.title = c;

    x.font = `900 30px ${F_DISPLAY}`;
    const pw = Math.ceil(x.measureText(PILL_TEXT).width + 80);
    c = document.createElement('canvas');
    c.width = pw + 120; c.height = 200;
    x = c.getContext('2d');
    const pg = x.createLinearGradient(60, 0, 60 + pw, 0);
    pg.addColorStop(0, th.accent); pg.addColorStop(1, th.accent2);
    x.fillStyle = pg;
    x.shadowColor = th.glow;
    x.shadowBlur = 36;
    rrect(x, 60, 60, pw, 80, 40); x.fill();
    x.shadowBlur = 0;
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.font = `900 30px ${F_DISPLAY}`;
    x.fillText(PILL_TEXT, c.width / 2, 111);
    sprite.pill = c;
  };

  const render = (t, dt) => {
    if (cardDirty) { drawCard(); buildSprites(); cardDirty = false; }
    const k = S.kick;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(background(), 0, 0);

    // nebula (quarter res, upscaled — it's all soft anyway)
    nctx.globalCompositeOperation = 'source-over';
    nctx.clearRect(0, 0, neb.width, neb.height);
    nctx.globalCompositeOperation = 'lighter';
    const blobs = [
      [0.2 + Math.sin(t * 0.13) * 0.08, 0.22 + Math.cos(t * 0.11) * 0.05, 620, th.neb[0]],
      [0.85 + Math.cos(t * 0.09) * 0.06, 0.5 + Math.sin(t * 0.12) * 0.06, 700, th.neb[1]],
      [0.3 + Math.sin(t * 0.1 + 2) * 0.07, 0.82 + Math.cos(t * 0.14) * 0.04, 640, th.neb[2]],
    ];
    for (const [bx, by, r, col] of blobs) {
      const rr = (r * (1 + k * 0.12)) / NEB_K, cx = (bx * W) / NEB_K, cy = (by * H) / NEB_K;
      const g = nctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, rgba(col, 0.22 + S.level * 0.1 + k * 0.14));
      g.addColorStop(1, rgba(col, 0));
      nctx.fillStyle = g;
      nctx.fillRect(0, 0, neb.width, neb.height);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(neb, 0, 0, W, H);

    // stars
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      ctx.globalAlpha = Math.min(1, tw * (0.6 + k * 0.6));
      const r = s.r * (1 + k * 0.5);
      ctx.fillRect(s.x - r / 2, s.y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    drawPlanet(118, 1400, 52, t);
    drawGrid(t);

    // shooting stars
    for (const sh of shooting) {
      sh.life += dt;
      const p = sh.life / 0.7;
      const x = sh.x + sh.dx * p, y = sh.y + sh.dy * p;
      const g = ctx.createLinearGradient(x - sh.dx * 0.25, y - sh.dy * 0.25, x, y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, `rgba(255,255,255,${1 - p})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x - sh.dx * 0.25, y - sh.dy * 0.25); ctx.lineTo(x, y); ctx.stroke();
    }
    shooting = shooting.filter((s) => s.life < 0.7);

    // title
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = th.accent;
    ctx.font = `700 26px ${F_MONO}`;
    tracked(ctx, '✦ PASSPORT CONTROL ✦', W / 2, 262, 6, 'center');
    ctx.drawImage(sprite.title, 0, 250);
    if (k > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k * 0.45;
      ctx.drawImage(sprite.title, 0, 250);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.textAlign = 'left';

    // card
    const s = 1 + k * 0.035;
    const rot = Math.sin(t * 0.6) * 0.022;
    const cy = CARD_Y + Math.sin(t * 0.9) * 10 - k * 8;
    cardXf = { x: W / 2, y: cy, rot, s };
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.rotate(rot);
    ctx.scale(s, s);
    const gs = 1 + k * 0.06;
    ctx.globalAlpha = 0.55 + k * 0.45;
    ctx.drawImage(sprite.card, (-sprite.card.width / 2) * gs, (-sprite.card.height / 2) * gs, sprite.card.width * gs, sprite.card.height * gs);
    ctx.globalAlpha = 1;
    ctx.drawImage(card, -CW / 2, -CH / 2, CW, CH);
    // holo shine sweep
    ctx.save();
    rrect(ctx, -CW / 2, -CH / 2, CW, CH, 34);
    ctx.clip();
    const sweep = ((t * 0.28) % 1.6) - 0.3;
    const sx = -CW / 2 + sweep * CW * 1.4;
    const sg = ctx.createLinearGradient(sx - 220, -CH / 2, sx + 220, CH / 2);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.35, rgba(th.neb[2], 0.18));
    sg.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    sg.addColorStop(0.65, rgba(th.neb[0], 0.18));
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = sg;
    ctx.fillRect(-CW / 2, -CH / 2, CW, CH);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    // holo sticker on photo corner
    const hx = -CW / 2 + PHOTO.x + PHOTO.w - 10, hy = -CH / 2 + PHOTO.y + PHOTO.h - 12;
    if (ctx.createConicGradient) {
      const hg = ctx.createConicGradient(t * 1.5, hx, hy);
      ['#ff9de2', '#b388ff', '#7ee8fa', '#a0ffcf', '#fff39e', '#ff9de2'].forEach((c2, i, a) => hg.addColorStop(i / (a.length - 1), c2));
      ctx.fillStyle = hg;
    } else ctx.fillStyle = th.neb[2];
    ctx.beginPath(); sparklePath(ctx, hx, hy, 38 + k * 8, 0.3); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    // cleared pill
    const py = 1385;
    ctx.save();
    ctx.translate(W / 2, py);
    ctx.scale(1 + k * 0.06, 1 + k * 0.06);
    ctx.drawImage(sprite.pill, -sprite.pill.width / 2, -100);
    ctx.restore();

    // EQ bars
    const bars = 28, bw = 16, gap = 10, total = bars * bw + (bars - 1) * gap;
    const baseY = 1540;
    const eg = ctx.createLinearGradient(0, baseY - 90, 0, baseY);
    eg.addColorStop(0, th.accent); eg.addColorStop(1, th.accent2);
    ctx.fillStyle = eg;
    ctx.beginPath();
    for (let i = 0; i < bars; i++) {
      let v;
      if (spec) {
        const lo = 40 * Math.pow(12000 / 40, i / bars), hi = 40 * Math.pow(12000 / 40, (i + 1) / bars);
        v = bandAvg(spec, specSr, lo, hi);
        v = clamp01((v - 0.3) / 0.6);
      } else v = 0.25 + 0.25 * Math.sin(t * 3 + i * 0.6) * Math.sin(t * 1.3 + i);
      const h = 10 + v * 80;
      const x = W / 2 - total / 2 + i * (bw + gap);
      ctx.roundRect(x, baseY - h, bw, h, 8);
    }
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `700 28px ${F_MONO}`;
    tracked(ctx, `NOW PLAYING — ${trackLabel}`, W / 2, 1602, 4, 'center');
    ctx.fillStyle = rgba('#ffffff', 0.6);
    ctx.font = `600 26px ${F_DISPLAY}`;
    tracked(ctx, 'ENCY ✦ ARMORY-01', W / 2, 1656, 5, 'center');

    // particles on top
    for (const p of parts) {
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.exp(-dt * 0.8); p.vy = p.vy * Math.exp(-dt * 0.8) - 18 * dt;
      p.rot += p.vr * dt;
      drawParticle(p);
    }
    parts = parts.filter((p) => p.life < p.max);
  };

  // ---------- Audio + signals (shared model with Heat Figure) ----------
  const FFT_N = 2048;
  const bandAvg = (f, sr, loHz, hiHz) => {
    const binHz = sr / FFT_N;
    const a = Math.max(1, Math.floor(loHz / binHz)), b = Math.max(a, Math.min(f.length - 1, Math.ceil(hiHz / binHz)));
    let s = 0;
    for (let i = a; i <= b; i++) s += f[i];
    return s / ((b - a + 1) * 255);
  };
  const makeRange = () => ({ lo: null, hi: null });
  const rnorm = (n, v, dt) => {
    if (n.lo === null) { n.lo = v; n.hi = v + 0.1; }
    const k = 1 - Math.exp(-dt * 0.07);
    n.hi = v > n.hi ? v : n.hi + (v - n.hi) * k;
    n.lo = v < n.lo ? v : n.lo + (v - n.lo) * k;
    return clamp01((v - n.lo) / Math.max(0.06, n.hi - n.lo));
  };
  const follow = (cur, target, up, down, dt) => cur + (target - cur) * (1 - Math.exp(-(target > cur ? up : down) * dt));
  let nLoud = makeRange();
  const S = { level: 0.5, punch: 0, kick: 0, bassSlow: 0, onsetPeak: 0.05, prevDiff: 0, lastBeat: -1, pb: 1, ambient: 0 };
  const resetSignals = () => {
    nLoud = makeRange();
    Object.assign(S, { punch: 0, kick: 0, bassSlow: 0, onsetPeak: 0.05, prevDiff: 0, lastBeat: -1 });
    parts = []; shooting = [];
  };

  const audio = new Audio();
  audio.preload = 'auto';
  let actx = null, analyser = null, freq = null, streamDest = null;
  const ensureAudio = () => {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaElementSource(audio);
    analyser = actx.createAnalyser();
    analyser.fftSize = FFT_N;
    analyser.smoothingTimeConstant = 0.55;
    freq = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    analyser.connect(actx.destination);
    streamDest = actx.createMediaStreamDestination();
    analyser.connect(streamDest);
  };
  const playing = () => !audio.paused && !audio.ended;

  const updateSignals = (t, dt, f = null, sr = 0) => {
    let punch, loudN, beat = false;
    if (!f && playing() && analyser) { analyser.getByteFrequencyData(freq); f = freq; sr = actx.sampleRate; }
    spec = f; specSr = sr || 48000;
    if (f) {
      const bass = bandAvg(f, sr, 25, 150);
      S.bassSlow = follow(S.bassSlow, bass, 2.5, 2.5, dt);
      const diff = bass - S.bassSlow;
      S.onsetPeak = Math.max(diff, S.onsetPeak * Math.exp(-dt * 0.4), 0.04);
      punch = Math.pow(clamp01(diff / S.onsetPeak), 1.6);
      beat = diff > S.onsetPeak * 0.45 && diff > 0.03 && diff > S.prevDiff && t - S.lastBeat > 0.18;
      S.prevDiff = diff;
      loudN = rnorm(nLoud, bandAvg(f, sr, 25, 8000), dt);
    } else {
      const bpm = (t * 2) % 1;
      punch = Math.exp(-bpm * 6) * 0.6;
      loudN = 0.5;
      beat = bpm < S.pb;
      S.pb = bpm;
    }
    S.punch = follow(S.punch, punch, 40, 10, dt);
    S.level = follow(S.level, smoothstep(0.1, 0.85, loudN), 9, 1.6, dt);
    S.kick = Math.max(0, S.kick - dt * 3.2);
    if (beat) {
      S.lastBeat = t;
      S.kick = Math.max(S.kick, (f ? 0.6 + 0.4 * S.punch : 0.45));
      spawn(f ? 10 : 4, true);
      if (Math.random() < 0.18) shooting.push({ x: rand(0, W * 0.6), y: rand(80, 700), dx: rand(500, 800), dy: rand(200, 380), life: 0 });
    }
    // ambient float-up
    S.ambient += dt * (2 + S.level * 4);
    while (S.ambient > 1) { S.ambient -= 1; spawn(1, false); }
  };

  // ---------- UI: tracks ----------
  const TRACKS = { crystals: { src: 'tracks/crystals.m4a', name: 'CRYSTALS' }, cyclones: { src: 'tracks/cyclones.m4a', name: 'CYCLONES' } };
  const trackBtns = [...document.querySelectorAll('.track-btn')];
  const playBtn = $('playBtn'), playPath = $('playPath');
  let trackKey = 'crystals';
  const syncPlay = () => {
    playPath.setAttribute('d', playing() ? 'M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z' : 'M7 4.5v15l13-7.5z');
    playBtn.setAttribute('aria-label', playing() ? 'Pause' : 'Play');
  };
  const setTrack = (key, autoplay) => {
    trackKey = key;
    trackLabel = TRACKS[key].name;
    trackBtns.forEach((b) => { const on = b.dataset.track === key; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); });
    audio.src = TRACKS[key].src;
    resetSignals();
    if (autoplay) { ensureAudio(); actx.resume(); audio.play().catch(() => {}); }
    syncPlay();
  };
  trackBtns.forEach((b) => b.addEventListener('click', () => { if (!exporting()) setTrack(b.dataset.track, true); }));
  playBtn.addEventListener('click', async () => {
    if (exporting()) return;
    ensureAudio();
    await actx.resume();
    if (playing()) audio.pause(); else await audio.play().catch(() => {});
    syncPlay();
  });
  audio.addEventListener('ended', () => { audio.currentTime = 0; audio.play().catch(() => {}); });
  ['play', 'pause'].forEach((e) => audio.addEventListener(e, syncPlay));

  // ---------- UI: details ----------
  const fFirst = $('fFirst'), fLast = $('fLast'), fCall = $('fCall'), fRank = $('fRank'), fPlanet = $('fPlanet');
  RANKS.forEach((r) => { const o = document.createElement('option'); o.textContent = r; fRank.appendChild(o); });
  PLANETS.forEach((p) => { const o = document.createElement('option'); o.value = p; $('planetList').appendChild(o); });
  const persist = () => store.set('ark-passport', { first: data.first, last: data.last, call: data.call, rank: data.rank, planet: data.planet, number: data.number, theme: th.name });
  const syncFields = () => { fFirst.value = data.first; fLast.value = data.last; fCall.value = data.call; fRank.value = data.rank; fPlanet.value = data.planet; };
  syncFields();
  for (const [el, key] of [[fFirst, 'first'], [fLast, 'last'], [fCall, 'call'], [fRank, 'rank'], [fPlanet, 'planet']]) {
    el.addEventListener('input', () => { data[key] = el.value; invalidate(); persist(); });
  }
  $('surpriseBtn').addEventListener('click', () => {
    data.call = pick(CALLSIGNS.filter((c) => c !== data.call));
    data.rank = pick(RANKS.filter((r) => r !== data.rank));
    data.planet = pick(PLANETS.filter((p) => p !== data.planet));
    syncFields(); invalidate(); persist();
    S.kick = 1; spawn(18, true);
  });

  // ---------- UI: themes ----------
  const themesEl = $('themes');
  const setTheme = (t) => {
    th = t;
    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--accent-2', t.accent2);
    document.documentElement.style.setProperty('--bg', t.bg[0]);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', t.bg[0]);
    $('themeName').textContent = t.name;
    [...themesEl.children].forEach((b) => { const on = b.dataset.name === t.name; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); });
    processPhoto();
    invalidate();
    persist();
  };
  THEMES.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'theme';
    b.dataset.name = t.name;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', t.name);
    b.style.background = `linear-gradient(135deg, ${t.accent}, ${t.accent2} 60%, ${t.neb[2]})`;
    b.addEventListener('click', () => setTheme(t));
    themesEl.appendChild(b);
  });

  // ---------- UI: photo ----------
  const zoomEl = $('zoom');
  const loadPhotoFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setPhotoSource(img); URL.revokeObjectURL(url); };
    img.src = url;
  };
  const setPhotoSource = (src) => {
    photo.src = src;
    photo.zoom = 1; photo.ox = 0; photo.oy = 0;
    zoomEl.value = 100;
    processPhoto();
    invalidate();
    S.kick = 1; spawn(24, true);
  };
  $('photoInput').addEventListener('change', (e) => loadPhotoFile(e.target.files[0]));
  $('selfieInput').addEventListener('change', (e) => loadPhotoFile(e.target.files[0]));
  zoomEl.addEventListener('input', () => { photo.zoom = zoomEl.value / 100; invalidate(); });
  document.querySelectorAll('[data-style]').forEach((b) => b.addEventListener('click', () => {
    photo.style = b.dataset.style;
    document.querySelectorAll('[data-style]').forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-checked', String(on)); });
    processPhoto();
    invalidate();
  }));

  // Selfie: native camera sheet on phones, live preview dialog on desktop
  const camDialog = $('camDialog'), camVideo = $('camVideo'), camErr = $('camErr');
  let camStream = null;
  const stopCam = () => { camStream?.getTracks().forEach((t) => t.stop()); camStream = null; };
  $('selfieBtn').addEventListener('click', async () => {
    if (matchMedia('(pointer: coarse)').matches || !navigator.mediaDevices?.getUserMedia) { $('selfieInput').click(); return; }
    camErr.hidden = true;
    camDialog.showModal();
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1600 } }, audio: false });
      camVideo.srcObject = camStream;
    } catch (e) {
      camErr.textContent = 'Camera blocked or not found. Allow camera access, or use Upload instead.';
      camErr.hidden = false;
    }
  });
  $('camCancel').addEventListener('click', () => camDialog.close());
  camDialog.addEventListener('close', stopCam);
  $('camShoot').addEventListener('click', () => {
    if (!camStream || !camVideo.videoWidth) return;
    const vw = camVideo.videoWidth, vh = camVideo.videoHeight;
    // crop to the 4:5 preview, mirrored like the preview
    const tw = Math.min(vw, vh * 0.8), tHt = tw / 0.8;
    const c = document.createElement('canvas');
    c.width = tw; c.height = tHt;
    const x = c.getContext('2d');
    x.translate(tw, 0); x.scale(-1, 1);
    x.drawImage(camVideo, (vw - tw) / 2, (vh - tHt) / 2, tw, tHt, 0, 0, tw, tHt);
    camDialog.close();
    setPhotoSource(c);
  });

  // Drag / wheel on the passport photo
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const toCard = (p) => {
    const { x, y, rot, s } = cardXf;
    const dx = (p.x - x) / s, dy = (p.y - y) / s;
    const c = Math.cos(-rot), sn = Math.sin(-rot);
    return { x: dx * c - dy * sn + CW / 2, y: dx * sn + dy * c + CH / 2 };
  };
  const inPhoto = (q) => q.x >= PHOTO.x && q.x <= PHOTO.x + PHOTO.w && q.y >= PHOTO.y && q.y <= PHOTO.y + PHOTO.h;
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const q = toCard(toCanvas(e));
    if (!inPhoto(q)) return;
    if (!photo.processed) { $('photoInput').click(); return; }
    drag = { q, ox: photo.ox, oy: photo.oy };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const q = toCard(toCanvas(e));
    canvas.style.cursor = drag ? 'grabbing' : inPhoto(q) ? (photo.processed ? 'grab' : 'pointer') : '';
    if (!drag) return;
    photo.ox = drag.ox + (q.x - drag.q.x);
    photo.oy = drag.oy + (q.y - drag.q.y);
    invalidate();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    if (!photo.processed || !inPhoto(toCard(toCanvas(e)))) return;
    e.preventDefault();
    photo.zoom = Math.max(1, Math.min(3, photo.zoom * Math.exp(-e.deltaY * 0.0015)));
    zoomEl.value = Math.round(photo.zoom * 100);
    invalidate();
  }, { passive: false });

  // Drop a photo anywhere
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) loadPhotoFile(f);
  });

  // ---------- Export ----------
  const FPS = 30;
  const exportBtn = $('exportBtn'), stillBtn = $('stillBtn'), shareBtn = $('shareBtn'), downloadLink = $('downloadLink');
  const exportNote = $('exportNote'), lenSelect = $('lenSelect'), badge = $('badge'), badgeText = $('badgeText');
  let job = null, recorder = null, lastFile = null;
  const exporting = () => !!(job || recorder);
  const yieldTick = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });

  const makeOfflineAnalyser = (buffer) => {
    const sr = buffer.sampleRate, len = buffer.length, chs = buffer.numberOfChannels;
    const mono = new Float32Array(len);
    for (let c = 0; c < chs; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / chs; }
    const N = FFT_N, half = N / 2;
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N) + 0.08 * Math.cos((4 * Math.PI * i) / N);
    const rev = new Uint32Array(N);
    for (let i = 0, bits = Math.log2(N); i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
    const cosT = new Float64Array(half), sinT = new Float64Array(half);
    for (let i = 0; i < half; i++) { cosT[i] = Math.cos((-2 * Math.PI * i) / N); sinT[i] = Math.sin((-2 * Math.PI * i) / N); }
    const re = new Float64Array(N), im = new Float64Array(N), smooth = new Float64Array(half), out = new Uint8Array(half);
    return (tSec) => {
      const end = Math.round(tSec * sr);
      for (let i = 0; i < N; i++) { const j = end - N + i; re[rev[i]] = (j >= 0 && j < len ? mono[j] : 0) * win[i]; im[i] = 0; }
      for (let size = 2; size <= N; size <<= 1) {
        const h = size >> 1, step = N / size;
        for (let i = 0; i < N; i += size) {
          for (let k = 0; k < h; k++) {
            const c = cosT[k * step], sn = sinT[k * step], a = i + k, b = a + h;
            const tr = re[b] * c - im[b] * sn, ti = re[b] * sn + im[b] * c;
            re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          }
        }
      }
      for (let k = 0; k < half; k++) {
        smooth[k] = 0.55 * smooth[k] + 0.45 * (Math.hypot(re[k], im[k]) / N);
        const db = smooth[k] > 0 ? 20 * Math.log10(smooth[k]) : -1000;
        const v = Math.floor((255 * (db + 100)) / 70);
        out[k] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      return out;
    };
  };

  const decoded = {};
  const getDecoded = async (key) => {
    if (decoded[key]) return decoded[key];
    const buf = await (await fetch(TRACKS[key].src)).arrayBuffer();
    // decode at a fixed 48 kHz: the live context follows the output device (e.g. 24 kHz on Bluetooth), which AAC may reject
    decoded[key] = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(buf);
    return decoded[key];
  };

  const pickConfigs = async (sr, ch) => {
    if (!window.VideoEncoder || !window.AudioEncoder || !window.VideoFrame || !window.Mp4Muxer) return null;
    let video = null;
    for (const codec of ['avc1.640033', 'avc1.640028', 'avc1.4d0033', 'avc1.42e033']) {
      const cfg = { codec, width: W, height: H, bitrate: 10_000_000, framerate: FPS, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) { video = cfg; break; } } catch { /* next */ }
    }
    if (!video) return null;
    const audioCfg = { codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 192_000 };
    try { if (!(await AudioEncoder.isConfigSupported(audioCfg)).supported) return null; } catch { return null; }
    return { video, audio: audioCfg };
  };

  const fileName = (ext) => `ark-passport-${(val('first', 'babe') + '-' + val('last', '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.${ext}`;

  const deliver = (blob, ext, msg) => {
    lastFile = new File([blob], fileName(ext), { type: blob.type });
    if (downloadLink.href) URL.revokeObjectURL(downloadLink.href);
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = lastFile.name;
    const canShare = navigator.canShare && navigator.canShare({ files: [lastFile] }) && matchMedia('(pointer: coarse)').matches;
    shareBtn.hidden = !canShare;
    downloadLink.hidden = canShare;
    stillBtn.hidden = false;
    if (!canShare) downloadLink.click();
    exportNote.classList.remove('warn');
    exportNote.textContent = msg || (canShare ? 'Ready! Tap Share to post it to your story.' : `Saved ${lastFile.name} (${(blob.size / 1e6).toFixed(1)} MB).`);
  };
  shareBtn.addEventListener('click', async () => {
    if (!lastFile) return;
    try { await navigator.share({ files: [lastFile], title: 'My Ark Passport' }); } catch { /* dismissed */ }
  });

  const setBusy = (on, msg) => {
    badge.hidden = !on;
    exportBtn.textContent = on ? 'Cancel' : 'Export video';
    exportBtn.classList.toggle('busy', on);
    [lenSelect, stillBtn, playBtn, ...trackBtns].forEach((el) => { el.disabled = on; });
    if (on) { downloadLink.hidden = shareBtn.hidden = true; exportNote.classList.remove('warn'); }
    if (msg) exportNote.textContent = msg;
  };

  const fastExport = async (buffer, cfg, start, end) => {
    const sr = buffer.sampleRate, ch = cfg.audio.numberOfChannels;
    const frames = Math.round((end - start) * FPS);
    let err = null;
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H, frameRate: FPS },
      audio: { codec: 'aac', numberOfChannels: ch, sampleRate: sr },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { err = e; } });
    venc.configure(cfg.video);
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { err = e; } });
    aenc.configure(cfg.audio);

    const s0 = Math.floor(start * sr), s1 = Math.min(buffer.length, Math.floor(end * sr));
    const chData = Array.from({ length: ch }, (_, c) => buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1)));
    for (let off = s0; off < s1; off += 4096) {
      const n = Math.min(4096, s1 - off);
      const d = new Float32Array(n * ch);
      for (let c = 0; c < ch; c++) d.set(chData[c].subarray(off, off + n), c * n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(((off - s0) / sr) * 1e6), data: d });
      aenc.encode(ad);
      ad.close();
    }

    const an = makeOfflineAnalyser(buffer);
    resetSignals();
    const step = 1 / 60;
    for (let tt = Math.max(0, start - 3); tt < start; tt += step) updateSignals(tt, step, an(tt), sr);
    // pre-fill the sky with floaters so frame one isn't empty
    for (let i = 0; i < 90; i++) { updateSignals(start, step, an(start), sr); for (const p of parts) { p.life += step; p.x += p.vx * step; p.y += p.vy * step; } }

    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      if (job.cancelled || err) break;
      const tt = start + f / FPS;
      updateSignals(tt - step, step, an(tt - step), sr);
      updateSignals(tt, step, an(tt), sr);
      render(tt, 1 / FPS);
      const vf = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(vf, { keyFrame: f % (FPS * 2) === 0 });
      vf.close();
      while (venc.encodeQueueSize > 8) await yieldTick();
      if (f % 4 === 0) {
        const pct = (f + 1) / frames, el = (performance.now() - t0) / 1000;
        badgeText.textContent = `RENDERING ${Math.round(pct * 100)}%`;
        exportNote.textContent = `Rendering… ${Math.round(pct * 100)}% · about ${Math.ceil(Math.max(0, el / pct - el))}s left`;
        await yieldTick();
      }
    }
    if (job.cancelled || err) {
      try { venc.close(); aenc.close(); } catch { /* closed */ }
      throw err || new Error('cancelled');
    }
    exportNote.textContent = 'Finishing up…';
    await venc.flush();
    await aenc.flush();
    muxer.finalize();
    venc.close(); aenc.close();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  };

  const realtimeExport = (start, end) => new Promise((resolve, reject) => {
    const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      .find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime || !canvas.captureStream) { reject(new Error("This browser can't export video — try Chrome or Safari.")); return; }
    const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...streamDest.stream.getAudioTracks()]);
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stream.getVideoTracks().forEach((t) => t.stop());
      recorder = null;
      audio.pause();
      if (job.cancelled) reject(new Error('cancelled'));
      else resolve(new Blob(chunks, { type: mime.split(';')[0] }));
    };
    audio.currentTime = start;
    audio.play().then(() => recorder.start(1000)).catch(reject);
    badgeText.textContent = 'REC';
    exportNote.textContent = 'Recording in real time on this browser — keep this tab open.';
    const tick = () => {
      if (!recorder) return;
      if (job.cancelled || audio.currentTime >= end || audio.ended) { recorder.stop(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  exportBtn.addEventListener('click', async () => {
    if (job) { job.cancelled = true; return; }
    ensureAudio();
    await actx.resume();
    audio.pause();
    job = { cancelled: false, fast: false };
    setBusy(true, 'Preparing…');
    badgeText.textContent = 'RENDERING';
    const len = Number(lenSelect.value);
    try {
      const buffer = await getDecoded(trackKey);
      const start = 0, end = Math.min(buffer.duration, len);
      const cfg = await pickConfigs(buffer.sampleRate, Math.min(2, buffer.numberOfChannels));
      job.fast = !!cfg;
      const blob = cfg ? await fastExport(buffer, cfg, start, end) : await realtimeExport(start, end);
      deliver(blob, blob.type.includes('mp4') ? 'mp4' : 'webm');
    } catch (e) {
      exportNote.textContent = e.message === 'cancelled' ? 'Export cancelled.' : `Export failed: ${e.message || e}`;
      exportNote.classList.toggle('warn', e.message !== 'cancelled');
    } finally {
      job = null;
      resetSignals();
      setBusy(false);
      syncPlay();
    }
  });

  stillBtn.addEventListener('click', () => {
    canvas.toBlob((b) => b && deliver(b, 'png', null), 'image/png');
  });

  // ---------- Boot ----------
  setTheme(THEMES.find((t) => t.name === saved.theme) || THEMES[0]);
  setTrack('crystals', false);
  Promise.all([
    `900 20px ${F_DISPLAY}`, `600 20px ${F_DISPLAY}`, `700 20px ${F_BODY}`, `700 20px ${F_MONO}`, `400 20px ${F_SCRIPT}`,
  ].map((f) => document.fonts.load(f).catch(() => {}))).then(invalidate);
  document.fonts.addEventListener?.('loadingdone', invalidate);

  let last = performance.now(), t = 0;
  const loop = (nowMs) => {
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    if (!job?.fast) {
      t += dt;
      updateSignals(t, dt);
      render(t, dt);
    }
    requestAnimationFrame(loop);
  };
  for (let i = 0; i < 120; i++) { updateSignals(i / 60, 1 / 60); for (const p of parts) { p.life += 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60; } }
  requestAnimationFrame(loop);
})();
