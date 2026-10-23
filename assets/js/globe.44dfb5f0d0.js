/* The Tale Caravan — глобус на главной странице (ТЗ_сайт.md, разделы 6, 7, 9).
   Рисунок шара перенесён из прототипа v5 (компонент служебной программы редактора) на обычный JavaScript с d3. */
(function () {
  'use strict';

  var D = JSON.parse(document.getElementById('tc-data').textContent);
  var S = D.s, L = D.lang, TALES = D.tales, SOON = D.soon;
  var ALL = TALES.concat(SOON ? [SOON] : []);
  var ZMIN = 0.75, ZMAX = 12, HERO_H = 56, SOON_H = 30;   // герои вдвое мельче, чем в v5: главным остаётся шар (слово владельца 23.10)
  var D64 = 64 * Math.PI / 180, D81 = 81 * Math.PI / 180;
  var mq = function (q) { return window.matchMedia && matchMedia(q).matches; };
  var touchDevice = mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && mq('(hover: none)'));
  var reduced = mq('(prefers-reduced-motion: reduce)');

  var $ = function (id) { return document.getElementById(id); };
  var root = $('globe-root'), svgEl = $('globe-svg'), layer = $('markers'), labels = $('marker-labels');
  var header = $('gh'), strip = $('strip'), controls = $('controls');
  var modal = $('modal'), dialog = $('dialog'), videoBox = $('video-box');

  var last = TALES[TALES.length - 1];
  var st = {
    rot: [-last.ll[0], -last.ll[1], 0], zk: 1, theme: D.theme, spin: !reduced,
    open: null, dragging: false, flying: false, lastInteract: 0,
    W: 0, H: 0, cx: 0, cy: 0, base: 1, plaques: []
  };

  var proj, path, g = {}, lo, hi, hiLoading = false, curSet, landAll, regions = [], lakes = [], riversLo, riversHi;
  var markers = [], player = null, opener = null;

  function th() { return THEMES[st.theme] || THEMES.clay; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- Контраст (раздел 14): цвет серии темнеет, пока на кремовом фоне не станет 4,5:1 ---------- */
  function lum(hex) {
    var c = d3.rgb(hex), f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function inkOnCream(col) {
    var c = col, k = 0;
    while (ratio(c, '#fff4dc') < 4.5 && k < 40) { c = d3.color(c).darker(0.1).formatHex(); k++; }
    return c;
  }

  /* ---------- Данные карты ---------- */
  function getJSON(name) { return fetch(D.dataUrl + name).then(function (r) { if (!r.ok) throw new Error(name); return r.json(); }); }
  function features(w) {
    return w.objects.countries.geometries.filter(function (x) { return x.id !== '010'; })
      .map(function (x) { return topojson.feature(w, x); });
  }
  function prepRelief(R) {
    var fix = function (t, c) {
      var ft = { type: 'Feature', geometry: { type: t, coordinates: c } };
      if (/Polygon/.test(t) && d3.geoArea(ft) > 2 * Math.PI) {
        var rv = function (p) { return p.map(function (r) { return r.slice().reverse(); }); };
        ft.geometry.coordinates = t === 'Polygon' ? rv(c) : c.map(rv);
      }
      return ft;
    };
    var order = { u: 0, p: 1, b: 2, t: 3, d: 4, m: 5 };
    var ok = function (f) { return d3.geoArea(f) < 1.5; };
    regions = R.regions.slice().sort(function (a, b) { return order[a.k] - order[b.k]; })
      .map(function (r) { return Object.assign(fix(r.t, r.c), { k: r.k }); }).filter(ok);
    lakes = R.lakes.map(function (l) { return fix(l.t, l.c); }).filter(ok);
    var goodLine = function (c) {
      return Array.isArray(c) && c.length && c.every(function (x) {
        return Array.isArray(x) && x.length && (typeof x[0] === 'number' || x.every(function (y) { return Array.isArray(y) && typeof y[0] === 'number'; }));
      });
    };
    var rv = R.rivers.filter(function (r) { return r.c && goodLine(r.c); });
    var feat = function (r) { return { type: 'Feature', geometry: { type: r.t, coordinates: r.c } }; };
    riversLo = { type: 'FeatureCollection', features: rv.filter(function (r) { return r.s <= 5; }).map(feat) };
    riversHi = { type: 'FeatureCollection', features: rv.map(feat) };
  }

  /* ---------- Рисунок шара ---------- */
  function build() {
    var svg = d3.select(svgEl); svg.selectAll('*').remove();
    svg.append('defs').html(DEFS);
    proj = d3.geoOrthographic().clipAngle(90).precision(0.4);
    path = d3.geoPath(proj);
    g.stars = svg.append('g');
    g.shadow = svg.append('ellipse').attr('fill', '#0f3a5c').attr('opacity', 0.28).attr('filter', 'url(#soft)');
    g.sea = svg.append('circle').attr('class', 'sea');
    g.grat = svg.append('path').attr('class', 'grat').datum(d3.geoGraticule10()).attr('fill', 'none').attr('stroke-width', 1);
    g.rip = svg.append('g');
    g.land = svg.append('g');
    g.countries = g.land.append('g');
    g.relief = g.land.append('g');
    g.tale = g.land.append('g');
    g.water = g.land.append('g');
    g.route = svg.append('g').attr('class', 'route').attr('filter', 'url(#rope)');
    g.shade = svg.append('circle').attr('fill', 'url(#shade)').attr('pointer-events', 'none');
    g.rim = svg.append('circle').attr('fill', 'none').attr('pointer-events', 'none');
    buildRoute();
    layout();
    applyTheme();
  }

  function buildCountries(force) {
    var set = hi && st.zk >= 2 ? hi : lo;
    if (!set || (!force && curSet === set)) return;
    curSet = set; landAll = { type: 'FeatureCollection', features: set };
    var t = th(), R = t.relief;
    var taleBy = new Map(TALES.map(function (x) { return [x.iso, x]; }));
    var soonIso = SOON ? SOON.iso : null;
    var fill = function (f) {
      var x = taleBy.get(f.id);
      if (x) return x.color;
      if (f.id === soonIso) return '#f6c79a';
      if (f.id === '304') return R.t;
      return t.muted[hash(f.id || f.properties.name) % t.muted.length];
    };
    g.reliefSel = g.relief.selectAll('path').data(regions).join('path')
      .attr('fill', function (f) { return R[f.k]; }).attr('fill-opacity', R.op).attr('stroke', 'none');
    g.taleSel = g.tale.selectAll('path').data(set.filter(function (f) { return taleBy.has(f.id) || f.id === soonIso; }), function (f) { return f.id; }).join('path')
      .attr('fill', function (f) { return taleBy.has(f.id) ? taleBy.get(f.id).color : '#f6c79a'; }).attr('fill-opacity', 0.82)
      .attr('stroke', function (f) { return t.stroke(fill(f), true); }).attr('stroke-width', t.sw[0] + 0.6).attr('stroke-linejoin', 'round')
      .attr('stroke-dasharray', function (f) { return f.id === soonIso ? '3 3' : null; });
    g.lakeSel = g.water.selectAll('path.lake').data(lakes).join('path').attr('class', 'lake')
      .attr('fill', R.lake).attr('stroke', d3.color(R.lake).darker(0.4)).attr('stroke-width', 0.6);
    g.riverSel = g.water.selectAll('path.river').data([0]).join('path').attr('class', 'river')
      .attr('fill', 'none').attr('stroke', R.river).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
    g.countrySel = g.countries.selectAll('path').data(set, function (f) { return f.id + (f.properties && f.properties.name); }).join('path')
      .attr('fill', fill)
      .attr('stroke', function (f) { return t.stroke(fill(f), taleBy.has(f.id)); })
      .attr('stroke-width', function (f) { return taleBy.has(f.id) ? t.sw[0] : t.sw[1]; })
      .attr('stroke-linejoin', 'round')
      .attr('stroke-dasharray', function (f) { return f.id === soonIso ? '3 3' : t.dash; });
    g.ripple = g.rip.selectAll('path').data([16, 8]).join('path')
      .attr('fill', 'none').attr('stroke', t.rip[0]).attr('stroke-linejoin', 'round')
      .attr('stroke-opacity', function (d, i) { return i ? t.rip[2] : t.rip[1]; }).attr('stroke-width', function (d) { return d; });
  }

  function buildRoute() {
    var pts = ALL.map(function (x) { return x.ll; }), segs = [];
    for (var i = 0; i < pts.length - 1; i++) segs.push({ type: 'LineString', coordinates: [pts[i], pts[i + 1]], i: i });
    g.routeSel = g.route.selectAll('path').data(segs).join('path').attr('fill', 'none')
      .attr('data-from', function (d) { return ALL[d.i].id; }).attr('data-to', function (d) { return ALL[d.i + 1].id; })
      .attr('stroke-width', 4.5).attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', '0.1 11').attr('style', reduced ? null : 'animation:march 2.6s linear infinite');
  }

  function applyTheme() {
    var t = th();
    root.style.background = t.bg;
    root.dataset.theme = st.theme;
    g.sea.attr('fill', t.sea).attr('filter', t.seaF);
    g.land.attr('filter', t.land);
    g.rim.attr('stroke', t.rim[0]).attr('stroke-width', t.rim[1]).attr('stroke-dasharray', t.rim[2]).attr('stroke-opacity', t.rim[3]);
    g.grat.attr('stroke', t.grat[0]).attr('stroke-opacity', t.grat[1]);
    g.shade.attr('opacity', t.shade);
    g.routeSel.attr('stroke', t.route);
    drawStars();
    buildCountries(true);
    render();
    document.querySelectorAll('#styles button[data-theme]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.theme === st.theme ? 'true' : 'false');
    });
  }

  function drawStars() {
    var t = th();
    g.stars.selectAll('*').remove();
    if (!t.stars || !st.W) return;
    var rnd = d3.randomLcg(7);
    for (var i = 0; i < 180; i++) {
      g.stars.append('circle').attr('cx', rnd() * st.W).attr('cy', rnd() * st.H).attr('r', 0.5 + rnd() * 1.6)
        .attr('fill', t.stars).attr('opacity', 0.25 + rnd() * 0.6);
    }
  }

  function layout() {
    var W = root.clientWidth, H = root.clientHeight, rb = root.getBoundingClientRect();
    var top = header.getBoundingClientRect().bottom - rb.top;
    var stripTop = strip.getBoundingClientRect().top - rb.top;
    root.style.setProperty('--strip-h', Math.round(H - stripTop) + 'px');
    var ctr = controls.getBoundingClientRect(), ctrTop = ctr.top - rb.top;
    // На телефоне кнопки стоят рядом над полосой героев — шар рисуется выше них.
    var bottom = H - (ctrTop > H / 2 ? Math.min(stripTop, ctrTop) : stripTop);
    var free = Math.max(120, H - top - bottom);
    var sizeChanged = W !== st.W || H !== st.H;
    st.W = W; st.H = H;
    var side = W < 700 ? W * 0.47 : (W - 2 * (ctr.width + 34)) / 2;
    st.base = Math.max(50, Math.min(side, free / 2 - 6));
    st.cx = W / 2;
    st.cy = top + free / 2;
    st.plaques = [];
    header.querySelectorAll('.brand, .lang-pill, .info-wrap').forEach(function (n) {
      var b = n.getBoundingClientRect();
      if (b.width) st.plaques.push({ left: b.left - rb.left, right: b.right - rb.left, bottom: b.bottom - rb.top });
    });
    if (sizeChanged && g.stars) drawStars();
    if (st.zk >= 2) loadHi();
    buildCountries();
  }

  function loadHi() {
    if (hi || hiLoading) return;
    hiLoading = true;
    getJSON('world-50m.json').then(function (w) { hi = features(w); buildCountries(); render(); })
      .catch(function () { hiLoading = false; });
  }

  function render() {
    if (!proj || !st.W || !curSet) return;
    var r = st.base * st.zk, t = th();
    proj.scale(r).translate([st.cx, st.cy]).rotate(st.rot);
    var low = (st.dragging || st.flying) && (st.zk > 2 || touchDevice);
    g.land.attr('filter', low ? null : t.land);
    g.shadow.attr('cx', st.cx).attr('cy', st.cy + r * 1.02).attr('rx', r * 0.82).attr('ry', r * 0.12).attr('opacity', st.zk > 1.6 ? 0 : t.shadow);
    g.sea.attr('cx', st.cx).attr('cy', st.cy).attr('r', r);
    g.shade.attr('cx', st.cx).attr('cy', st.cy).attr('r', r);
    g.rim.attr('cx', st.cx).attr('cy', st.cy).attr('r', r + 3);
    g.grat.attr('d', path);
    g.countrySel.attr('d', path);
    g.reliefSel.attr('d', path);
    g.taleSel.attr('d', path);
    g.lakeSel.attr('d', path);
    var rv = st.zk >= 2.2 ? riversHi : riversLo;
    g.riverSel.attr('d', rv ? path(rv) : null).attr('stroke-width', Math.min(4, 1.1 + 0.35 * st.zk));
    g.ripple.attr('d', path(landAll));
    g.routeSel.attr('d', path);
    root.dataset.zoom = st.zk.toFixed(4);
    root.dataset.center = (-st.rot[0]).toFixed(3) + ',' + (-st.rot[1]).toFixed(3);
    root.dataset.radius = r.toFixed(2);
    updateMarkers();
  }

  /* ---------- Герои на шаре ---------- */
  function makeMarkers() {
    layer.innerHTML = ''; labels.innerHTML = '';
    markers = ALL.map(function (x, i) {
      var isSoon = x === SOON;
      var mk = document.createElement('div');
      mk.className = 'mk' + (isSoon ? ' soon' : '');
      mk.dataset.id = x.id;
      mk.innerHTML =
        '<div class="mk-in"><div class="mk-shadow"></div><div class="mk-base"></div>' +
        '<button class="mk-fig" type="button" tabindex="-1"><span class="mk-pop"><span class="mk-hover"><span class="mk-sway"><span class="mk-img"></span></span></span></span></button>' +
        '</div>';
      // Подпись страны — в своём слое над всеми героями: чужой герой её не закрывает и не перехватывает нажатие.
      var lab = document.createElement('div');
      lab.className = 'mkl' + (isSoon ? ' soon' : '');
      lab.dataset.id = x.id;
      lab.innerHTML = '<div class="mkl-in"><button class="mk-pill" type="button" tabindex="-1"><span class="dot"></span><span></span></button></div>';
      labels.appendChild(lab);
      var m = {
        el: mk, inn: mk.firstChild, shadow: mk.querySelector('.mk-shadow'), base: mk.querySelector('.mk-base'),
        fig: mk.querySelector('.mk-fig'), img: mk.querySelector('.mk-img'), pill: lab.querySelector('.mk-pill'), lab: lab, labIn: lab.firstChild,
        data: x, isSoon: isSoon, i: i, h: -1, kind: x.fig ? 'fig' : (x.icon ? 'icon' : 'num'), shown: true, labShown: true
      };
      var dark = d3.color(x.color).darker(0.9).formatHex();
      m.base.style.background = x.color;
      m.base.style.boxShadow = 'inset 0 2px 1px rgba(255,255,255,.5), inset 0 -2px 1px rgba(0,0,0,.18), 0 2px 0 ' + dark + ', 0 4px 6px rgba(12,38,60,.3)';
      m.pill.firstChild.style.background = x.color;
      m.pill.lastChild.textContent = isSoon ? x.country + ' · ' + S.soon : x.country;
      if (m.kind === 'fig') m.img.style.backgroundImage = 'url("' + x.fig + '")';
      else if (m.kind === 'icon') { m.img.classList.add('round'); m.img.style.backgroundImage = 'url("' + x.icon + '")'; }
      else { m.img.classList.add('round'); m.img.style.background = x.color; m.img.textContent = String(x.n); }
      m.fig.title = isSoon ? S.nextStop + ': ' + x.country : x.title;
      // все герои выскакивают за 1,8 с, сколько бы их ни было (при 195 сказках по 0,15 с выходило полминуты)
      mk.querySelector('.mk-pop').style.animationDelay = (0.6 + Math.min(1.2, i * 0.15 * Math.min(1, 8 / ALL.length))) + 's';
      var delay = ((i * 0.53) % 2.5) + 's';
      mk.querySelector('.mk-sway').style.animationDelay = delay;
      m.img.style.animationDelay = delay;
      if (!isSoon) {
        var go = function () { if (suppressClick) return; opener = null; openTale(i, true); };
        m.fig.addEventListener('click', go);
        m.pill.addEventListener('click', go);
      }
      layer.appendChild(mk);
      return m;
    });
  }

  /* Раздвигание: когда герои налезают друг на друга, видны те, что ближе к центру шара,
     остальные прячутся до поворота. Подпись прячется, если налезает на чужую подпись или героя.
     Пороги с запасом (прячем при 35 %, показываем снова при 15 %), чтобы при вращении не мигало. */
  function overlapShare(a, b) {
    var ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (ox <= 0 || oy <= 0) return 0;
    return ox * oy / Math.max(1, Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t)));
  }

  function updateMarkers() {
    var center = [-st.rot[0], -st.rot[1]];
    var k = clamp(st.base / 370, 0.62, 1.1);          // рост героя — от размера шара: на планшете не крошки
    var zf = Math.min(2.6, 1 + 0.42 * (st.zk - 1));   // приближаешь шар — герои растут
    var spread = st.zk >= 2.5 ? 0.25 : 1;
    var geo = [];
    markers.forEach(function (m) {
      var x = m.data, dist = d3.geoDistance(x.ll, center), xy = proj(x.ll);
      var edge = clamp((D81 - dist) / (D81 - D64), 0, 1);
      var off = x.off || [0, 0], ox = off[0] * k * spread, oy = off[1] * k * spread;
      var h = Math.round((m.isSoon ? SOON_H : HERO_H) * k * zf);
      var w = m.kind === 'fig' && x.fa ? h * x.fa : h * 0.62;
      if (m.kind !== 'fig') h = Math.round(w);
      // Герой у края экрана сдвигается внутрь, чтобы не уходить за край.
      var halfW = Math.max(w / 2, 24), bx = xy[0] + ox;
      if (bx - halfW < 6) ox += 6 - (bx - halfW);
      if (bx + halfW > st.W - 6) ox -= bx + halfW - (st.W - 6);
      bx = xy[0] + ox;
      var baseW = Math.max(14, Math.min(w * 0.9, h * 0.8)), cosd = Math.cos(Math.min(1.5, dist));
      var baseH = baseW * (0.22 + 0.2 * cosd);
      var by = xy[1] + oy, top = by - h - 4, hw = Math.max(w / 2, 16), cover = 0;
      st.plaques.forEach(function (r) {
        var ovx = Math.min(bx + hw, r.right) - Math.max(bx - hw, r.left), ovy = r.bottom - top;
        if (ovx > 0 && ovy > 0) cover = Math.max(cover, Math.min(1, ovy / 24));
      });
      if (!m.pw) { m.pw = m.pill.offsetWidth; m.ph = m.pill.offsetHeight; }
      var pillTop = Math.round(baseH / 2 + 4);
      // Рамка героя на экране — с тем же наклоном и масштабом, с которыми он нарисован (у края шара герой наклонён).
      var vis0 = edge * (1 - cover), sc0 = Math.max(0.6, 0.6 + 0.4 * vis0);
      var dx0 = xy[0] - st.cx, dy0 = xy[1] - st.cy;
      var th0 = Math.atan2(dx0, -dy0) * Math.sin(Math.min(1.5, dist)) * 0.42, cs0 = Math.cos(th0), sn0 = Math.sin(th0);
      var fy0 = baseH * 0.15 - h, fy1 = baseH * 0.15, xs = [], ys = [];
      [[-w / 2, fy0], [w / 2, fy0], [-w / 2, fy1], [w / 2, fy1]].forEach(function (pt) {
        xs.push(bx + sc0 * (pt[0] * cs0 - pt[1] * sn0)); ys.push(by + sc0 * (pt[0] * sn0 + pt[1] * cs0));
      });
      var lw2 = m.pw * sc0 / 2 + 2, lt = by + pillTop * sc0 - 1, lb = by + (pillTop + m.ph) * sc0 + 1;
      geo.push({ m: m, xy: xy, dist: dist, edge: edge, cover: cover, ox: ox, oy: oy, h: h, w: w, baseW: baseW, baseH: baseH, pillTop: pillTop,
        fig: { l: Math.min.apply(null, xs), r: Math.max.apply(null, xs), t: Math.min.apply(null, ys), b: Math.max.apply(null, ys) },
        lab: { l: bx - lw2, r: bx + lw2, t: lt, b: lb } });
    });
    // кто ближе к центру вида — того и видно; сначала раскладываются все герои, потом подписи
    var order = geo.filter(function (gm) { return gm.edge * (1 - gm.cover) > 0.01; }).sort(function (a, b) { return a.dist - b.dist; });
    var placedFig = [], placedLab = [];
    var grow = function (b, d) { return { l: b.l - d, r: b.r + d, t: b.t - d, b: b.b + d }; };
    order.forEach(function (gm) {
      var m = gm.m, worst = 0, box = grow(gm.fig, 2);
      placedFig.forEach(function (b) { worst = Math.max(worst, overlapShare(box, b)); });
      m.shown = m.shown ? worst < 0.12 : worst < 0.04;      // прячем, когда героя закрывают на 12 %; снова показываем ниже 4 %
      if (m.shown) { placedFig.push(box); gm.figBox = box; }
    });
    order.forEach(function (gm) {
      var m = gm.m;
      if (!m.shown) return;
      // подпись под героем; если там тесно — над ним; не помещается нигде — подписи нет
      var below = gm.lab, h = below.b - below.t;
      var above = { l: below.l, r: below.r, t: gm.fig.t - h - 3, b: gm.fig.t - 3 };
      var fits = function (cand) {
        var s = 0;
        placedLab.forEach(function (b) { s = Math.max(s, overlapShare(cand, b)); });
        placedFig.forEach(function (b) { if (b !== gm.figBox) s = Math.max(s, overlapShare(cand, b)); });
        return s;
      };
      var sb = fits(below), sa = sb < 0.05 ? 1 : fits(above);
      var pick = sb < 0.05 || (m.labAt === 'below' && sb < 0.2) ? 'below' : (sa < 0.05 || (m.labAt === 'above' && sa < 0.2) ? 'above' : null);
      m.labShown = !!pick;
      m.labAt = pick;
      if (pick) placedLab.push(pick === 'below' ? below : above);
    });
    geo.forEach(function (gm) {
      var m = gm.m, xy = gm.xy;
      var visible = order.indexOf(gm) >= 0 && m.shown;
      var vis = visible ? gm.edge * (1 - gm.cover) : 0, live = vis > 0.5;
      var lvis = visible && m.labShown ? vis : 0;
      var tr = 'translate(' + xy[0].toFixed(1) + 'px,' + xy[1].toFixed(1) + 'px)', z = Math.round(xy[1] + (live ? 1000 : 0));
      m.el.style.transform = tr; m.lab.style.transform = tr;
      m.el.style.opacity = vis.toFixed(3); m.lab.style.opacity = lvis.toFixed(3);
      m.el.style.zIndex = z; m.lab.style.zIndex = z;
      m.el.style.visibility = vis <= 0 ? 'hidden' : 'visible';
      m.lab.style.visibility = lvis <= 0 ? 'hidden' : 'visible';
      m.el.dataset.vis = vis.toFixed(3);
      m.inn.style.left = m.labIn.style.left = gm.ox.toFixed(1) + 'px'; m.inn.style.top = m.labIn.style.top = gm.oy.toFixed(1) + 'px';
      var dx = xy[0] - st.cx, dy = xy[1] - st.cy;
      var tilt = Math.atan2(dx, -dy) * 180 / Math.PI * Math.sin(Math.min(1.5, gm.dist)) * 0.42;
      var sc = 0.6 + 0.4 * vis;
      m.inn.style.transform = 'rotate(' + tilt.toFixed(2) + 'deg) scale(' + Math.max(sc, 0.6).toFixed(3) + ')';
      m.labIn.style.transform = 'scale(' + Math.max(sc, 0.6).toFixed(3) + ')';      // подпись всегда прямая — так её проще читать и раздвигать
      // область нажатия героя не меньше 44×44 точек, хотя сам герой мельче
      m.fig.style.minWidth = m.fig.style.minHeight = Math.ceil(44 / Math.max(sc, 0.6)) + 'px';
      var pe = live && !m.isSoon ? 'auto' : 'none';
      m.fig.style.pointerEvents = pe; m.pill.style.pointerEvents = lvis > 0.5 && !m.isSoon ? 'auto' : 'none';
      if (m.h !== gm.h || Math.abs((m.bh || 0) - gm.baseH) > 0.5) {
        m.h = gm.h; m.bh = gm.baseH;
        m.img.style.height = gm.h + 'px'; m.img.style.width = Math.round(gm.w) + 'px';
        if (m.kind === 'num') m.img.style.fontSize = Math.round(gm.h * 0.45) + 'px';
        m.base.style.width = Math.round(gm.baseW) + 'px'; m.base.style.height = Math.round(gm.baseH) + 'px';
        m.shadow.style.width = Math.round(gm.baseW * 1.5) + 'px'; m.shadow.style.height = Math.round(gm.baseH * 1.5) + 'px';
        m.fig.style.top = Math.round(gm.baseH * 0.15) + 'px';
      }
      var pt = m.labAt === 'above' ? -(gm.h + m.ph + 6) : gm.pillTop;
      if (m.pillAt !== pt) { m.pillAt = pt; m.pill.style.top = pt + 'px'; }
    });
  }

  /* ---------- Масштаб, вращение, жесты ---------- */
  function touch() { st.lastInteract = Date.now(); }
  function setZoom(z) {
    st.zk = clamp(z, ZMIN, ZMAX);
    touch(); if (st.zk >= 2) loadHi();
    buildCountries(); render();
  }
  // Частые нажатия складываются: следующий шаг считается от цели прежнего, а не от текущего кадра.
  function animZoom(f) {
    var z0 = st.zk, z1 = clamp((g.zt ? g.zTarget : z0) * f, ZMIN, ZMAX);
    if (g.zt) g.zt.stop();
    g.zTarget = z1;
    if (reduced) { g.zt = null; setZoom(z1); return; }
    g.zt = d3.timer(function (el) {
      var k = d3.easeCubicOut(Math.min(1, el / 350));
      setZoom(z0 * Math.pow(z1 / z0, k));
      if (k >= 1) { g.zt.stop(); g.zt = null; }
    });
  }

  /* Жесты принимаются и на шаре, и на героях: щипок поверх героя тоже меняет масштаб.
     Касание героя без сдвига — нажатие на сказку; сдвиг больше 6 точек — вращение. */
  var pointers = new Map(), pinch = null, suppressClick = false;
  function inGlobe(t) { return !!t && (svgEl.contains(t) || !!(t.closest && t.closest('#markers, #marker-labels'))); }
  function startDrag() {
    if (st.dragging) return;
    st.dragging = true; suppressClick = true;
    pointers.forEach(function (v, id) { try { root.setPointerCapture(id); } catch (e) {} });
    if (g.fly) { g.fly.stop(); st.flying = false; }
    svgEl.classList.add('grabbing');
  }
  function onDown(e) {
    if (!inGlobe(e.target) || st.open != null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    touch();
    if (pointers.size === 2) {
      var p = Array.from(pointers.values());
      pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, z: st.zk };
      startDrag();
    }
  }
  function onMove(e) {
    var prev = pointers.get(e.pointerId);
    if (!prev) return;
    var cur = { x: e.clientX, y: e.clientY, x0: prev.x0, y0: prev.y0 };
    pointers.set(e.pointerId, cur);
    if (pointers.size >= 2 && pinch) {
      var p = Array.from(pointers.values());
      setZoom(pinch.z * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / pinch.d);
      return;
    }
    if (!st.dragging) {
      if (Math.hypot(cur.x - cur.x0, cur.y - cur.y0) < 6) return;
      startDrag();
    }
    var s = 0.28 / st.zk;
    st.rot[0] += (cur.x - prev.x) * s;
    st.rot[1] = clamp(st.rot[1] - (cur.y - prev.y) * s, -85, 85);
    touch(); render();
  }
  function onUp(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size < 2) pinch = null;
    if (!pointers.size && st.dragging) {
      st.dragging = false; svgEl.classList.remove('grabbing'); touch(); render();
      setTimeout(function () { suppressClick = false; }, 0);
    }
  }

  function flyTo(i, dur) {
    var x = TALES[i];
    var from = st.rot.slice(), to = [-x.ll[0], -clamp(x.ll[1] - 6, -60, 60), 0];
    var d = to[0] - from[0]; d = ((d + 540) % 360) - 180; to[0] = from[0] + d;
    var z0 = st.zk, z1 = Math.max(z0, 2.2);
    if (g.fly) g.fly.stop();
    if (z1 >= 2) loadHi();
    if (reduced) { st.rot = to; st.zk = z1; st.flying = false; buildCountries(); render(); return; }
    var ir = d3.interpolate(from, to);
    dur = dur || 1300;
    st.flying = true;
    g.fly = d3.timer(function (el) {
      var k = d3.easeCubicInOut(Math.min(1, el / dur));
      st.rot = ir(k); st.zk = z0 + (z1 - z0) * k;
      buildCountries(); render();
      if (el >= dur) { g.fly.stop(); st.flying = false; touch(); render(); }
    });
  }

  function startTimer() {
    var prevT = performance.now();
    d3.timer(function (now) {
      var dt = now - prevT; prevT = now;
      var idle = !st.dragging && !st.flying && st.open == null && Date.now() - st.lastInteract > 2500;
      if (st.spin && idle && !document.hidden) { st.rot[0] += dt * 0.006 / Math.sqrt(st.zk); render(); }
    });
  }


  /* ---------- Окно сказки ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function fillDialog(x) {
    $('d-ep').textContent = S.episodeCountry.replace('{n}', x.n).replace('{country}', x.country);
    $('d-ep').style.color = inkOnCream(x.color);
    $('card-title').textContent = x.title;
    var stop = $('d-stop');
    stop.textContent = x.stop || '';
    stop.hidden = !x.stop;
    var hasVideo = (x.play || []).some(function (s) { return !s.release || Date.parse(s.release) <= Date.now(); });
    var src = x.sourceUrl ? '<a href="' + esc(x.sourceUrl) + '" target="_blank" rel="noopener">' + esc(x.source) + '</a>' : esc(x.source);
    $('d-scroll').innerHTML =
      (x.synopsis ? '<p class="syn">' + esc(x.synopsis) + '</p>' : '') +
      '<h3>' + esc(S.about) + '</h3>' + (x.origin ? '<p>' + esc(x.origin) + '</p>' : '') + (x.source ? '<p class="meta src">' + src + '</p>' : '') +
      (hasVideo ? '<p class="meta vlang">' + esc(S.videoLang.replace('{lang}', S.langNames[L])) + '</p>' : '') +
      '<p class="meta"><a href="' + esc(x.url) + '">' + esc(x.title) + '</a></p>';
    TCPlayer.buttons($('card-watch'), x);
    var old = dialog.querySelector('.copy-box');
    if (old) old.remove();
  }

  /* Окно «помещается» (раздел 12): в книжной ориентации ролик не ниже половины экрана,
     название, кнопки и «Назад/Дальше» видны без прокрутки, ничто ни на что не наезжает.
     Высота ролика подбирается по замеру: сколько места осталось под нижней кнопкой. */
  var PEEK = 28;            // столько точек прокручиваемой части стараемся оставить видимыми
  function fitDialog() {
    if (st.open == null) return;
    var vh = window.innerHeight, vw = window.innerWidth;
    var title = $('card-title'), stop = $('d-stop');
    title.style.fontSize = '';
    dialog.classList.remove('tight');
    stop.hidden = !x0().stop;
    if (vh < vw) {
      // Ролик слева во всю высоту окна; если справа не помещается длинное название — оно уменьшается.
      // Сначала ролику задаётся высота окна, и только потом меряется, помещается ли текст справа
      // (без высоты ячейка ролика раздувает строки окна, и замер всегда видел переполнение).
      var dc = getComputedStyle(dialog), ff = parseFloat(getComputedStyle(title).fontSize);
      var ih = dialog.clientHeight - parseFloat(dc.paddingTop) - parseFloat(dc.paddingBottom);
      videoBox.style.height = Math.floor(ih) + 'px'; videoBox.style.width = Math.floor(ih * 9 / 16) + 'px';
      var over = function () { return navOver(dc); };
      if (over() > 0 && !stop.hidden) stop.hidden = true;
      while (over() > 0 && ff > 14) { ff -= 1; title.style.fontSize = ff + 'px'; }
      dialog.dataset.fit = over() > 0 ? 'squeezed' : 'ok';
      return;
    }
    var cs = getComputedStyle(dialog);
    var innerW = dialog.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var minP = Math.ceil(vh * 0.5), maxP = Math.floor(Math.min(vh * 0.72, innerW * 16 / 9));
    var setH = function (h) { videoBox.style.height = h + 'px'; videoBox.style.width = Math.floor(h * 9 / 16) + 'px'; };
    // запас под кнопкой «Дальше»: высота прокручиваемой части минус то, что вылезло за окно
    var spare = function () { return $('d-scroll').offsetHeight - Math.max(0, navOver(cs)); };
    setH(minP);
    var s = spare();
    if (s < PEEK && !stop.hidden) { stop.hidden = true; s = spare(); }
    var fs = parseFloat(getComputedStyle(title).fontSize);
    while (s < 0 && fs > 16) { fs -= 1; title.style.fontSize = fs + 'px'; s = spare(); }
    if (s < 0) { dialog.classList.add('tight'); s = spare(); }
    // последняя мера: ролик ниже половины экрана лучше, чем ролик поверх кнопок
    var h = s < 0 ? Math.max(160, minP + Math.floor(s)) : Math.floor(clamp(minP + s - PEEK, minP, maxP));
    setH(h);
    dialog.dataset.fit = s < 0 ? 'squeezed' : 'ok';
  }
  // Насколько нижние кнопки вылезли за окно. Меряется по вёрстке (offsetTop/offsetHeight), а не по экрану:
  // окно появляется с анимацией увеличения, и пока она идёт, размеры на экране меньше настоящих.
  function navOver(cs) {
    var n = dialog.querySelector('.d-nav');
    return n.offsetTop + n.offsetHeight - (dialog.clientHeight - parseFloat(cs.paddingBottom));
  }
  var refitPending = false;
  function refitSoon() {
    if (refitPending || st.open == null) return;
    refitPending = true;
    requestAnimationFrame(function () { refitPending = false; fitDialog(); });
  }
  function x0() { return TALES[st.open] || {}; }

  function setLangLinks(slug) {
    document.querySelectorAll('[data-lang-link]').forEach(function (a) {
      var lg = a.getAttribute('hreflang');
      a.setAttribute('href', D.langPath[lg] + (slug ? '#' + slug : ''));
    });
  }

  function showTale(i) {
    var x = TALES[i];
    st.open = i;
    if (player) { player.destroy(); player = null; }
    fillDialog(x);
    modal.hidden = false;
    try { fitDialog(); } catch (err) { if (window.console) console.error('fitDialog:', err); }
    player = TCPlayer.mount(videoBox, x, S, L, { timeout: D.timeout, autoplay: true });
    $('d-scroll').scrollTop = 0;
    setLangLinks(x.slug);
    document.title = x.title + ' | ' + D.brand;
  }

  function openTale(i, push) {
    var x = TALES[i], wasOpen = st.open != null;
    if (!wasOpen && !opener) opener = document.activeElement;
    showTale(i);
    flyTo(i);
    var h = '#' + x.slug;
    if (push && !wasOpen) history.pushState({ tc: x.slug }, '', h);
    else history.replaceState(history.state && history.state.tc ? { tc: x.slug } : null, '', h);
    if (!wasOpen) $('modal-close').focus({ preventScroll: true });
  }

  function hideModal() {
    if (st.open == null) return;
    if (player) { player.destroy(); player = null; }
    st.open = null;
    modal.hidden = true;
    $('card-watch').innerHTML = '';
    document.title = D.pageTitle;
    setLangLinks(null);
    touch();
    var o = opener; opener = null;
    if (o && o.focus && document.contains(o)) o.focus({ preventScroll: true });
  }

  function closeTale() {
    if (st.open == null) return;
    if (history.state && history.state.tc) { history.back(); return; }
    hideModal();
    history.replaceState(null, '', location.pathname + location.search);
  }

  function step(d) {
    if (st.open == null) return;
    var n = TALES.length;
    openTale((st.open + d + n) % n, false);
  }

  function slugIndex(raw) {
    var slug = raw;
    try { slug = decodeURIComponent(raw); } catch (e) {}
    slug = slug.toLowerCase();
    for (var i = 0; i < TALES.length; i++) if (TALES[i].slug === slug) return i;
    return -1;
  }

  /* ---------- Кнопки, меню, стиль ---------- */
  function wireUi() {
    $('zoom-in').addEventListener('click', function () { animZoom(1.6); });
    $('zoom-out').addEventListener('click', function () { animZoom(1 / 1.6); });
    var spinBtn = $('spin');
    spinBtn.setAttribute('aria-pressed', st.spin ? 'true' : 'false');
    spinBtn.addEventListener('click', function () {
      st.spin = !st.spin; st.lastInteract = 0;
      spinBtn.setAttribute('aria-pressed', st.spin ? 'true' : 'false');
    });

    var pops = [['info-btn', 'info'], ['styles-btn', 'styles'], ['tales-btn', 'tales-list']];
    var closePops = function () {
      pops.forEach(function (p) { $(p[1]).classList.remove('open'); $(p[0]).setAttribute('aria-expanded', 'false'); });
    };
    pops.forEach(function (p) {
      $(p[0]).addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !$(p[1]).classList.contains('open');
        closePops();
        $(p[1]).classList.toggle('open', open);
        $(p[0]).setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#info, #styles, #tales-list')) closePops(); });

    document.querySelectorAll('#styles button[data-theme]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.theme = b.dataset.theme;
        applyTheme();
        closePops();
        $('styles-btn').focus({ preventScroll: true });
      });
    });

    document.querySelectorAll('.chips a[data-i]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button) return;
        e.preventDefault();
        closePops();
        opener = $('tales-btn');          // список закрывается — фокус после окна вернётся на кнопку «Сказки»
        openTale(+a.dataset.i, true);
      });
    });

    $('modal-close').addEventListener('click', closeTale);
    $('d-prev').addEventListener('click', function () { step(-1); });
    $('d-next').addEventListener('click', function () { step(1); });
    $('d-share').addEventListener('click', function () {
      var x = TALES[st.open];
      if (x) TCPlayer.share(x.shareUrl, x.title, S, $('d-share').parentNode);
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeTale(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (st.open != null) { e.preventDefault(); closeTale(); } else closePops(); return; }
      if (st.open == null) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      }
      if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(dialog.querySelectorAll('button, a[href], iframe, video, input, [tabindex]:not([tabindex="-1"])'),
          function (n) { return !n.hidden && n.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], lastF = f[f.length - 1], a = document.activeElement;
        if (!dialog.contains(a)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && a === first) { e.preventDefault(); lastF.focus(); }
        else if (!e.shiftKey && a === lastF) { e.preventDefault(); first.focus(); }
      }
    });
    // Фокус не уходит из окна, даже если его увели мышью или программой
    document.addEventListener('focusin', function (e) {
      if (st.open != null && !dialog.contains(e.target)) $('modal-close').focus({ preventScroll: true });
    });
    window.addEventListener('popstate', function () {
      var raw = location.hash.slice(1), i = raw ? slugIndex(raw) : -1;
      if (i >= 0) openTale(i, false);
      else { hideModal(); if (location.href.indexOf('#') >= 0) history.replaceState(null, '', location.pathname + location.search); }
    });
    window.addEventListener('resize', function () { if (st.open != null) fitDialog(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
      refitSoon();
      markers.forEach(function (m) { m.pw = 0; });     // ширину подписей перемерить своим шрифтом
      render();
    });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(refitSoon);
      ['card-watch', 'card-title', 'd-ep'].forEach(function (id) { ro.observe($(id)); });
    }

    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    root.addEventListener('wheel', function (e) {
      if (!inGlobe(e.target) || st.open != null) return;
      e.preventDefault(); setZoom(st.zk * Math.exp(-e.deltaY * 0.0016));
    }, { passive: false });

  }

  /* ---------- Запуск ---------- */
  Promise.all([getJSON('world-110m.json'), getJSON('relief.json').catch(function () { return null; })]).then(function (res) {
    lo = features(res[0]);
    if (res[1]) prepRelief(res[1]);
    wireUi();
    build();
    makeMarkers();
    render();
    new ResizeObserver(function () { layout(); render(); }).observe(root);
    startTimer();
    root.dataset.ready = '1';
    if (location.href.indexOf('#') >= 0) {
      var raw = location.hash.slice(1), i = raw ? slugIndex(raw) : -1;
      history.replaceState(null, '', location.pathname + location.search + (i >= 0 ? '#' + TALES[i].slug : ''));
      if (i >= 0) openTale(i, false);
    }
  }).catch(function (err) {
    root.dataset.ready = 'error';
    if (window.console) console.error('globe:', err);
  });
})();
