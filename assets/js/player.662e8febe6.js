/* The Tale Caravan — плеер сказки (ТЗ_сайт.md, раздел 8).
   Источники только языка страницы, по порядку, который дал сборщик: своя площадка
   (EN — YouTube, RU — ВК), вторая встраиваемая, свой файл. Ролик с будущей датой пропускается.
   «Загрузился» — только по сигналу самого плеера: у YouTube событие onReady его программы,
   у ВК сообщение «inited» из окна плеера (адрес с js_api=1). Нет сигнала за отведённое
   время или плеер сообщил об ошибке — плеер убирается и пробуется следующий источник. */
(function () {
  'use strict';

  var ytApi = null;

  function released(item) {
    if (!item) return false;
    if (item.url === '') return false;
    return !item.release || Date.parse(item.release) <= Date.now();
  }

  function fmtDate(iso, lang) {
    try {
      return new Intl.DateTimeFormat(lang === 'ru' ? 'ru' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
    } catch (e) { return String(iso).slice(0, 10); }
  }

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function loadYouTubeApi(timeoutMs) {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytApi) return ytApi;
    ytApi = new Promise(function (resolve, reject) {
      var done = false;
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') try { prev(); } catch (e) {}
        if (!done) { done = true; resolve(window.YT); }
      };
      var s = el('script', { src: 'https://www.youtube.com/iframe_api', async: '' });
      s.onerror = function () { if (!done) { done = true; reject(new Error('youtube api')); } };
      document.head.appendChild(s);
      setTimeout(function () { if (!done) { done = true; reject(new Error('youtube api timeout')); } }, timeoutMs);
    });
    ytApi.catch(function () { ytApi = null; });
    return ytApi;
  }

  /* box — рамка 9:16; tale — данные сказки; S — надписи языка; lang — язык страницы.
     opts: timeout (с), autoplay, onState(state, kind). */
  function mount(box, tale, S, lang, opts) {
    opts = opts || {};
    var waitMs = (opts.timeout || 10) * 1000;
    var alive = true, timers = [], ytPlayer = null, msgHandler = null, attempt = 0;
    var sources = (tale.play || []).filter(function (s) { return !s.release || Date.parse(s.release) <= Date.now(); });
    var future = (tale.future || []).filter(function (r) { return Date.parse(r) > Date.now(); })
      .sort(function (a, b) { return Date.parse(a) - Date.parse(b); });

    function setState(state, kind) {
      box.dataset.state = state;
      box.dataset.kind = kind || '';
      if (opts.onState) opts.onState(state, kind || '');
    }

    function clear() {
      timers.forEach(clearTimeout); timers = [];
      if (msgHandler) { window.removeEventListener('message', msgHandler); msgHandler = null; }
      if (ytPlayer) { try { ytPlayer.destroy(); } catch (e) {} ytPlayer = null; }
      box.innerHTML = '';
    }

    function poster(text, busy) {
      clear();
      var p = el('div', { 'class': 'video-poster' });
      if (tale.icon) p.appendChild(el('img', { src: tale.icon, alt: '', width: 130, height: 130 }));
      if (busy) p.appendChild(el('div', { 'class': 'spinner', 'aria-hidden': 'true' }));
      p.appendChild(el('p', { role: 'status' }, text || ''));
      box.appendChild(p);
    }

    function title(kind) {
      return ((S.playerTitle && S.playerTitle[kind]) || '{title}').replace('{title}', tale.title || '');
    }

    function tryAt(i) {
      if (!alive) return;
      if (i >= sources.length) {
        if (sources.length) { poster(S.failed); setState('failed'); return; }
        if (future.length) poster(S.comesOut.replace('{date}', fmtDate(future[0], lang)));
        else poster(S.comingSoon);
        setState('none');
        return;
      }
      // Ошибка плеера переводит к следующему источнику и после готовности (YouTube сообщает
      // «ролик недоступен» уже после onReady); устаревшие вызовы прежней попытки отбрасываются.
      var src = sources[i], my = ++attempt, isReady = false;
      var next = function () { if (alive && my === attempt) { attempt++; clear(); tryAt(i + 1); } };
      var ready = function () { if (alive && my === attempt && !isReady) { isReady = true; timers.forEach(clearTimeout); timers = []; setState('ready', src.kind); } };
      poster(S.loading, true);
      setState('loading', src.kind);

      if (src.kind === 'youtube') {
        var t0 = setTimeout(next, waitMs);           // если не пришла и сама программа YouTube
        timers.push(t0);
        loadYouTubeApi(waitMs).then(function (YT) {
          if (!alive || my !== attempt) return;
          var host = el('div', { 'class': 'yt-host' });
          var inner = el('div');
          host.appendChild(inner);
          box.appendChild(host);
          clearTimeout(t0);
          timers.push(setTimeout(next, waitMs));      // отсчёт с момента, когда окно плеера вставлено
          ytPlayer = new YT.Player(inner, {
            videoId: src.vid, host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%',
            playerVars: { playsinline: 1, rel: 0, autoplay: opts.autoplay ? 1 : 0 },
            events: {
              onReady: function () {
                var p = box.querySelector('.video-poster'); if (p) p.remove();
                var fr = host.querySelector('iframe');       // программа YouTube ставит свой заголовок окна — возвращаем свой
                if (fr) { fr.setAttribute('title', title('youtube')); fr.setAttribute('tabindex', '-1'); }
                ready();
              },
              onError: next
            }
          });
          // Окно плеера не входит в обход клавишей Tab: из чужого окна клавиша Esc не доходит
          // до страницы, и окно сказки нельзя было бы закрыть с клавиатуры.
          var f = host.querySelector('iframe');
          if (f) { f.setAttribute('title', title('youtube')); f.setAttribute('tabindex', '-1'); }
        }, next);
        return;
      }

      if (src.kind === 'vk') {
        var url = src.embed + (src.embed.indexOf('?') < 0 ? '?' : '&') + 'hd=2&js_api=1' + (opts.autoplay ? '&autoplay=1' : '');
        var f = el('iframe', {
          src: url, title: title('vk'), allowfullscreen: '', tabindex: '-1',
          allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock',
          referrerpolicy: 'strict-origin-when-cross-origin'
        });
        // На паузе и в конце плеер ВК показывает свои рекомендации — чужие ролики, не для детского сайта.
        // Закрываем их своей заставкой; команда «играть» уходит в окно плеера сообщением (так делает и программа ВК).
        var vkSend = function (cmd) { try { f.contentWindow.postMessage(cmd, 'https://vk.com'); } catch (x) {} };
        var cover = null;
        var showCover = function (again) {
          if (cover) cover.remove();
          cover = el('div', { 'class': 'video-poster vk-cover' });
          if (tale.icon) cover.appendChild(el('img', { src: tale.icon, alt: '', width: 130, height: 130 }));
          var b = el('button', { type: 'button', 'class': 'btn btn-red' }, '▶ ' + (again ? S.again : S.resume));
          b.addEventListener('click', function () {
            if (again) vkSend({ method: 'seek', time: 0 });
            vkSend({ method: 'play' });
            if (cover) { cover.remove(); cover = null; }
          });
          cover.appendChild(b);
          box.appendChild(cover);
        };
        msgHandler = function (e) {
          if (e.source !== f.contentWindow) return;
          var d = e.data;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
          if (!d || typeof d !== 'object') return;
          if (d.event === 'inited') { var p = box.querySelector('.video-poster:not(.vk-cover)'); if (p) p.remove(); ready(); }
          else if (d.event === 'error') next();
          else if (d.event === 'paused') showCover(false);
          else if (d.event === 'ended') showCover(true);
          else if ((d.event === 'started' || d.event === 'resumed') && cover) { cover.remove(); cover = null; }
        };
        window.addEventListener('message', msgHandler);
        f.addEventListener('load', function () { vkSend({ method: 'init' }); });
        box.appendChild(f);
        timers.push(setTimeout(next, waitMs));
        return;
      }

      if (src.kind === 'file') {
        var v = el('video', { src: src.src, controls: '', playsinline: '', preload: 'metadata', title: title('file') });
        v.addEventListener('error', next);
        v.addEventListener('loadeddata', function () { var p = box.querySelector('.video-poster'); if (p) p.remove(); ready(); });
        box.appendChild(v);
        timers.push(setTimeout(next, waitMs));
        return;
      }
      next();
    }

    tryAt(0);
    return { destroy: function () { alive = false; clear(); } };
  }

  /* Кнопки площадок (раздел 8.5): вышедшие ролики любого языка. */
  function buttons(container, tale) {
    container.innerHTML = '';
    (tale.links || []).filter(released).forEach(function (l) {
      var a = el('a', { 'class': 'btn', href: l.url, target: '_blank', rel: 'noopener', 'data-p': l.p, 'data-lang': l.lang }, l.label);
      container.appendChild(a);
    });
  }

  var toastTimer = null;
  function toast(text) {
    var t = document.querySelector('.toast');
    if (!t) { t = el('div', { 'class': 'toast', role: 'status' }); document.body.appendChild(t); }
    t.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 2600);
  }

  /* «Поделиться» (раздел 9): системное окно, иначе буфер обмена, иначе поле с адресом. */
  function share(url, title, S, place) {
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    var fallback = function () {
      if (!place) return;
      var old = place.querySelector('.copy-box');
      if (old) old.remove();
      var box = el('label', { 'class': 'copy-box' }, S.copyHint);
      var inp = el('input', { type: 'text', readonly: '', value: url });
      box.appendChild(inp);
      place.appendChild(box);
      inp.focus(); inp.select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast(S.copied); }, fallback);
    } else fallback();
  }

  window.TCPlayer = { mount: mount, buttons: buttons, share: share, released: released, fmtDate: fmtDate };
})();
