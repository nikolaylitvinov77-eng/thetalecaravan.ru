/* The Tale Caravan — обычные страницы: меню на телефоне; на странице сказки — плеер и кнопки. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  function ready(fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var btn = document.getElementById('info-btn'), nav = document.getElementById('info');
    if (btn && nav) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !nav.classList.contains('open');
        nav.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!e.target.closest('#info')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
      });
    }

    var node = document.getElementById('tc-tale');
    if (!node || !window.TCPlayer) return;
    var D = JSON.parse(node.textContent);
    // Плеер грузится по нажатию «Смотреть»: до этого страница не обращается к чужим сайтам (К69).
    var box = document.getElementById('tale-player');
    var out = (D.tale.play || []).some(function (s) { return !s.release || Date.parse(s.release) <= Date.now(); });
    if (box && !out) TCPlayer.mount(box, D.tale, D.s, D.lang, { timeout: D.timeout });
    if (box && out) {
      var poster = box.querySelector('.video-poster');
      var play = document.createElement('button');
      play.type = 'button'; play.className = 'btn btn-red play-btn'; play.id = 'tale-play';
      play.textContent = '▶ ' + D.s.play;
      play.addEventListener('click', function () { TCPlayer.mount(box, D.tale, D.s, D.lang, { timeout: D.timeout, autoplay: true }); });
      if (poster) { var txt = poster.querySelector('p'); if (txt) txt.remove(); poster.appendChild(play); }
      box.dataset.state = 'poster';
    }
    var w = document.getElementById('tale-watch');
    if (w) TCPlayer.buttons(w, D.tale);
    var sh = document.getElementById('tale-share');
    if (sh) {
      sh.hidden = false;
      sh.addEventListener('click', function () { TCPlayer.share(D.tale.shareUrl, D.tale.title, D.s, sh.parentNode); });
    }
  });
})();
