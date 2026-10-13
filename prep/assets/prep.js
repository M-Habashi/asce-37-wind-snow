/* Shared helpers for the temporary-works study set: theme tokens, canvas sizing,
   an animation loop that pauses off-screen canvases, small plotting and UI helpers. */
window.__errs = [];
addEventListener('error', e => window.__errs.push(String(e.message) + ' @' + (e.lineno||'?')));
window.P = (function(){
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STILL_T = 1.3;            // the frame we freeze on when motion is reduced
  const C = {};
  const KEYS = ['paper','sheet','grid','rule','ink','ink-soft','pencil','storm','wind','snow','snow-pile',
    'steel','concrete','soil','water','timber','s1','s2','s3','s4','s5','good','warn','bad'];
  const $ = id => document.getElementById(id);

  const saved = localStorage.getItem('tw-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  function readTokens(){
    const s = getComputedStyle(document.documentElement);
    KEYS.forEach(k => C[k] = s.getPropertyValue('--'+k).trim());
  }
  readTokens();

  /* ---------- canvas ---------- */
  function fit(cv){
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio||1, 2);
    cv.width = Math.max(1, Math.round(r.width*d)); cv.height = Math.max(1, Math.round(r.height*d));
    const ctx = cv.getContext('2d'); ctx.setTransform(d,0,0,d,0,0);
    return {ctx, w:r.width, h:r.height};
  }

  // Animated canvases: draw(ctx,w,h,t,dt) every frame while on screen.
  const anims = [];
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => es.forEach(e => { const a = anims.find(x => x.cv === e.target); if (a) a.vis = e.isIntersecting; }), {rootMargin:'120px'})
    : null;
  function paint(a, t, dt){ const {ctx,w,h} = a.S; ctx.clearRect(0,0,w,h); a.draw(ctx,w,h,t,dt); }
  function anim(cv, draw){
    const a = {cv, draw, vis:true, S:fit(cv)};
    anims.push(a); if (io) io.observe(cv);
    if (reduce) paint(a, STILL_T, 0);
    return a;
  }
  let t0 = performance.now(), last = t0;
  function frame(now){
    const dt = Math.max(0, Math.min(0.05, (now-last)/1000)); last = now;
    const t = Math.max(0, (now-t0)/1000);   // rAF timestamps can predate t0 on the first frame
    for (const a of anims) if (a.vis) paint(a, t, dt);
    requestAnimationFrame(frame);
  }
  if (!reduce) requestAnimationFrame(frame);

  // Still canvases: redrawn only when inputs, theme or size change.
  const stills = [];
  function still(cv, draw){
    const s = {cv, draw, S:fit(cv)};
    s.render = () => { const {ctx,w,h} = s.S; ctx.clearRect(0,0,w,h); draw(ctx,w,h); };
    stills.push(s); s.render();
    return s;
  }
  function redraw(){
    stills.forEach(s => s.render());
    if (reduce) anims.forEach(a => paint(a, STILL_T, 0));
  }
  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => {
    anims.forEach(a => a.S = fit(a.cv)); stills.forEach(s => s.S = fit(s.cv)); redraw();
  }, 150); });
  const themeFns = [];
  function themeChanged(){ readTokens(); themeFns.forEach(f => f()); redraw(); }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged);
  new MutationObserver(themeChanged).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});

  /* ---------- drawing helpers ---------- */
  function font(size, kind){ return `${kind==='bold'?'600 ':''}${size}px ${kind==='display'?'"Big Shoulders Display", Impact, sans-serif':'"JetBrains Mono", ui-monospace, monospace'}`; }
  function text(ctx, s, x, y, o={}){
    ctx.save();
    ctx.font = font(o.size||11, o.weight);
    ctx.fillStyle = o.color || C.ink; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.halo){ ctx.lineWidth = 4; ctx.strokeStyle = o.halo; ctx.lineJoin='round'; ctx.strokeText(s, x, y); }
    ctx.fillText(s, x, y); ctx.restore();
  }
  function arrow(ctx, x1, y1, x2, y2, o={}){
    const hs = o.head || 7, a = Math.atan2(y2-y1, x2-x1);
    ctx.save(); ctx.strokeStyle = ctx.fillStyle = o.color || C.ink; ctx.lineWidth = o.width || 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2 - Math.cos(a)*hs*0.6, y2 - Math.sin(a)*hs*0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2,y2);
    ctx.lineTo(x2 - hs*Math.cos(a-0.45), y2 - hs*Math.sin(a-0.45));
    ctx.lineTo(x2 - hs*Math.cos(a+0.45), y2 - hs*Math.sin(a+0.45)); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function ground(ctx, x1, x2, y, color){
    ctx.save(); ctx.strokeStyle = color || C['ink-soft']; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x1,y); ctx.lineTo(x2,y); ctx.stroke();
    ctx.lineWidth = 1;
    for (let x = x1+4; x < x2; x += 12){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-6,y+7); ctx.stroke(); }
    ctx.restore();
  }
  function line(ctx, pts, o={}){
    if (pts.length < 2) return;
    ctx.save(); ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.width || 2; ctx.lineJoin = 'round'; ctx.lineCap='round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (o.close) ctx.closePath();
    if (o.fill){ ctx.fillStyle = o.fill; ctx.globalAlpha = o.alpha ?? 1; ctx.fill(); ctx.globalAlpha = 1; }
    if (o.stroke !== false) ctx.stroke();
    ctx.restore();
  }
  function niceStep(range, n){
    const raw = range / Math.max(1,n), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw/p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  // Recessive axes + grid. Returns data→pixel mappers.
  function axes(ctx, box, xr, yr, o={}){
    const X = v => box.l + (v-xr[0])/(xr[1]-xr[0])*(box.r-box.l);
    const Y = v => box.b - (v-yr[0])/(yr[1]-yr[0])*(box.b-box.t);
    const [xlo, xhi] = [Math.min(...xr), Math.max(...xr)], [ylo, yhi] = [Math.min(...yr), Math.max(...yr)];
    const xs = o.xstep || niceStep(xhi-xlo, o.xn||6), ys = o.ystep || niceStep(yhi-ylo, o.yn||5);
    ctx.save(); ctx.lineWidth = 1;
    for (let v = Math.ceil(ylo/ys)*ys; v <= yhi+1e-9; v += ys){
      ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(box.l, Y(v)); ctx.lineTo(box.r, Y(v)); ctx.stroke();
      text(ctx, (o.yfmt||fmtAuto)(v), box.l-6, Y(v)+3.5, {align:'right', size:10, color:C['ink-soft']});
    }
    for (let v = Math.ceil(xlo/xs)*xs; v <= xhi+1e-9; v += xs){
      ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(X(v), box.t); ctx.lineTo(X(v), box.b); ctx.stroke();
      text(ctx, (o.xfmt||fmtAuto)(v), X(v), box.b+14, {align:'center', size:10, color:C['ink-soft']});
    }
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(box.l, box.t); ctx.lineTo(box.l, box.b); ctx.lineTo(box.r, box.b); ctx.stroke();
    if (o.xlabel) text(ctx, o.xlabel, box.r, box.b+30, {align:'right', size:10, color:C['ink-soft']});
    if (o.ylabel) text(ctx, o.ylabel, box.l, box.t-8, {align:'left', size:10, color:C['ink-soft']});
    ctx.restore();
    return {X, Y, inv:{x: px => xr[0] + (px-box.l)/(box.r-box.l)*(xr[1]-xr[0]), y: py => yr[0] + (box.b-py)/(box.b-box.t)*(yr[1]-yr[0])}};
  }
  function fmtAuto(v){ const a = Math.abs(v); return a >= 1000 ? Math.round(v).toLocaleString('en-US') : a >= 10 || a === 0 ? String(Math.round(v*10)/10) : String(Math.round(v*100)/100); }

  // Hover layer: calls onMove(xpx, ypx | null) so the plot can draw a crosshair and fill the tooltip.
  function hover(cv, tip, onMove){
    const wrap = cv.parentElement;
    function at(e){
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const out = onMove(x, y);
      if (out && tip){
        tip.innerHTML = out; tip.classList.add('on');
        const tw = tip.offsetWidth, left = Math.min(Math.max(4, x + 14), r.width - tw - 4);
        tip.style.left = left + 'px'; tip.style.top = Math.max(4, y - 34) + 'px';
      } else if (tip) tip.classList.remove('on');
    }
    cv.addEventListener('pointermove', at);
    cv.addEventListener('pointerdown', at);
    cv.addEventListener('pointerleave', () => { onMove(null, null); if (tip) tip.classList.remove('on'); });
    return wrap;
  }

  /* ---------- UI helpers ---------- */
  function bind(ids, fn){
    ids.forEach(id => { const el = typeof id === 'string' ? $(id) : id; if (!el) return; el.addEventListener('input', fn); el.addEventListener('change', fn); });
    fn();
  }
  function chips(groupId, fn){
    const g = $(groupId), bs = [...g.querySelectorAll('.chip')];
    bs.forEach(b => b.addEventListener('click', () => { bs.forEach(x => x.setAttribute('aria-pressed','false')); b.setAttribute('aria-pressed','true'); fn(b.dataset, b); }));
    const on = bs.find(b => b.getAttribute('aria-pressed') === 'true') || bs[0];
    fn(on.dataset, on);
  }
  function fmt(x, d=1){ return Number.isFinite(x) ? x.toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d}) : '—'; }
  function set(id, html){ const el = $(id); if (el){ el.innerHTML = html; tex(el); } }
  function pill(el, ratio, words){
    if (typeof el === 'string') el = $(el);
    const w = words || ['OK','Tight','NG'];
    const k = ratio <= 0.9 ? 'ok' : ratio <= 1.0 ? 'warn' : 'ng';
    el.className = 'pill ' + k; el.textContent = (k==='ok'?w[0]:k==='warn'?w[1]:w[2]) + ' · ' + fmt(ratio, 2);
    return k;
  }
  // rows: [{name, ratio, note, gov}]; bar spans 0–1.5 with a tick at 1.0
  function meters(el, rows){
    if (typeof el === 'string') el = $(el);
    el.innerHTML = rows.map(r => {
      const k = r.ratio <= 0.9 ? '' : r.ratio <= 1 ? 'warn' : 'ng';
      const w = Math.min(r.ratio, 1.5)/1.5*100;
      return `<div class="meter"><span>${r.name}${r.gov?' <span class="label">governs</span>':''}</span>
        <span class="bar"><span class="fill ${k}${r.gov&&!k?' gov':''}" style="width:${w.toFixed(1)}%"></span><span class="one" style="left:66.67%"></span></span>
        <span class="num">${fmt(r.ratio,2)}${k==='ng'?' ✕':k==='warn'?' !':' ✓'}</span></div>`;
    }).join('');
  }
  function cards(el, QA){
    if (typeof el === 'string') el = $(el);
    QA.forEach(([q,a], i) => {
      el.insertAdjacentHTML('beforeend', `<button class="card" type="button" aria-label="Flashcard ${i+1}: ${q.replace(/<[^>]+>/g,'').replace(/"/g,'&quot;')}"><div class="card-in"><div class="face"><span class="label">Q${i+1}</span><span class="q">${q}</span><span class="tap">Tap to flip</span></div><div class="face back"><span class="label">Answer</span><span class="a">${a}</span><span class="tap">Tap to flip back</span></div></div></button>`);
    });
    tex(el);
    el.addEventListener('click', e => { const c = e.target.closest('.card'); if (c) c.classList.toggle('flip'); });
  }


  /* ---------- LaTeX (KaTeX) ---------- */
  const hasK = () => typeof window.katex !== 'undefined';
  function K(t, display){
    if (!hasK()) return '<code>' + t.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '</code>';
    return katex.renderToString(t, {throwOnError:false, displayMode:!!display, strict:'ignore'});
  }
  function tex(el){
    if (!el || typeof window.renderMathInElement === 'undefined') return;
    renderMathInElement(el, {delimiters:[{left:'$$', right:'$$', display:true}, {left:'\\(', right:'\\)', display:false}], throwOnError:false, strict:'ignore'});
  }
  // number for TeX: thousands separators become {,} so KaTeX keeps them tight
  function n(x, d=1){ return fmt(x, d).replace(/,/g, '{,}'); }

  /* Calc sheet: rows are
     ['h', title] · ['r', ref, tex] · ['c', ref, tex, ratio, words?] · ['n', html] */
  function sheet(el, rows){
    if (typeof el === 'string') el = $(el);
    if (!el) return;
    el.innerHTML = '<table class="calc"><tbody>' + rows.map(r => {
      if (r[0] === 'h') return `<tr class="head"><td colspan="3">${r[1]}</td></tr>`;
      if (r[0] === 'n') return `<tr class="note"><td colspan="3">${r[1]}</td></tr>`;
      const st = r[0] === 'c' ? statusPill(r[3], r[4]) : '';
      return `<tr class="${r[0]==='c'?'chk':''}"><td class="ref">${r[1]}</td><td class="ex"><div class="exs">${K(r[2])}</div></td><td class="st">${st}</td></tr>`;
    }).join('') + '</tbody></table>';
    tex(el);
  }
  function statusPill(ratio, words){
    const w = words || ['OK','Tight','NG'];
    const k = ratio <= 0.9 ? 'ok' : ratio <= 1.0 ? 'warn' : 'ng';
    return `<span class="pill ${k}">${k==='ok'?w[0]:k==='warn'?w[1]:w[2]} ${fmt(ratio,2)}</span>`;
  }

  /* Flowchart. spec items:
     {s, ref, end}                    process step (end = terminal)
     {q, ref, test, yes, no, main}    decision; yes/no are html or {s, ref, end}; main = branch that continues ('yes'|'no'|null = both merge) */
  function flow(el, spec){
    if (typeof el === 'string') el = $(el);
    const br = (b, lab) => { const o = typeof b === 'string' ? {s:b} : b; return `<div class="fbranch" data-b="${lab}"><span class="lab">${lab}</span><div>${o.s}</div>${o.ref?`<span class="fref">${o.ref}</span>`:''}${o.end?'<span class="fref">■ stop here</span>':''}</div>`; };
    el.classList.add('flow');
    el.innerHTML = spec.map((it, i) => {
      const conn = i ? '<div class="fconn"></div>' : '';
      if (it.q) return conn + `<div class="fnode dec" data-i="${i}"><span class="fq">◇</span><div>${it.q}</div>${it.ref?`<span class="fref">${it.ref}</span>`:''}</div><div class="fbranches" data-i="${i}">${br(it.yes,'yes')}${br(it.no,'no')}</div>`;
      return conn + `<div class="fnode ${it.end?'end':''}" data-i="${i}"><div>${it.s}</div>${it.ref?`<span class="fref">${it.ref}</span>`:''}</div>`;
    }).join('');
    tex(el);
    const nodes = [...el.querySelectorAll('.fnode')], conns = [...el.querySelectorAll('.fconn')];
    return {update(state){
      let alive = true, k = 0;
      spec.forEach((it, i) => {
        const node = el.querySelector(`.fnode[data-i="${i}"]`);
        const c = conns[i-1];
        node.classList.toggle('on', alive); node.classList.toggle('off', !alive);
        if (c){ c.classList.toggle('on', alive); }
        if (alive){ node.style.setProperty('--k', k++); }
        if (it.q){
          const bs = el.querySelector(`.fbranches[data-i="${i}"]`);
          const taken = state ? (it.test(state) ? 'yes' : 'no') : null;
          bs.querySelectorAll('.fbranch').forEach(b => {
            const on = alive && taken === b.dataset.b;
            b.classList.toggle('on', on); b.classList.toggle('off', alive && taken && !on);
            if (on) b.style.setProperty('--k', k++);
          });
          if (alive && taken){
            const t = typeof it[taken] === 'string' ? {} : it[taken];
            if (t.end || (it.main && it.main !== taken)) alive = false;
          }
        }
      });
    }};
  }

  const PAGES = [
    ['index.html','Hub'], ['loads.html','Loads 7 → 37'], ['steel.html','AISC'], ['lifting.html','Lifting'],
    ['bridges.html','Bridges'], ['falsework.html','Falsework'], ['ground.html','Ground'], ['../index.html','Wind & snow']
  ];
  function nav(active){
    const links = PAGES.map(([h,l]) => `<a href="${h}"${h===active?' aria-current="page"':''}>${l}</a>`).join('');
    document.body.insertAdjacentHTML('afterbegin', `<nav class="topnav" aria-label="Study modules"><div class="in"><a class="brand" href="index.html">TW·Prep</a>${links}<span class="spacer"></span><button type="button" id="themeBtn" aria-label="Toggle dark mode">◐ Theme</button></div></nav>`);
    $('themeBtn').addEventListener('click', () => {
      const dark = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim().toUpperCase() === '#111A15';
      const next = dark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next; localStorage.setItem('tw-theme', next);
    });
  }

  // Uppercase labels would turn φ into Φ and γ into Γ; wrap lowercase Greek so CSS can exempt it.
  function fixCase(root){
    (root||document).querySelectorAll('.label,.padhead,.tag,h1,h2,h3,h4,.pill').forEach(el => {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
      while (w.nextNode()) nodes.push(w.currentNode);
      nodes.forEach(n => {
        if (!/[α-ω]/.test(n.nodeValue) || n.parentElement.closest('.nc,.katex')) return;
        const tmp = document.createElement('span');
        tmp.innerHTML = n.nodeValue.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])).replace(/([α-ω]+)/g, '<span class="nc">$1</span>');
        n.replaceWith(...tmp.childNodes);
      });
    });
  }
  const boot = () => { tex(document.body); fixCase(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const lerp = (a,b,t) => a + (b-a)*t;
  const ease = t => t<.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;

  return {reduce, STILL_T, C, $, fit, anim, still, redraw, onTheme:f=>themeFns.push(f), text, arrow, ground, line, axes, hover, niceStep,
    bind, chips, fmt, set, pill, meters, cards, nav, clamp, lerp, ease, font, fixCase, K, tex, n, sheet, flow, statusPill};
})();
