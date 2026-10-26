/* Счётчик посещений — Яндекс Метрика (подключён 26.10.2026 по слову владельца «поставь на сайты счётчики посещаемости»).
   Включается только после «Разрешить» в плашке: до этого страница к чужим сайтам не обращается (К69).
   Выбор посетителя хранится в localStorage «tc-schet»: «da» или «net»; кнопка «Статистика посещений» снова показывает плашку.
   Цель «skazka» — запуск сказки (окно на глобусе, «Смотреть» на странице сказки), параметр визита skazka = slug.
   Плашка не перехватывает клавиатуру (курсор на «Разрешить» не ставится — пробел и Enter не дают согласия случайно)
   и прячется, пока открыто окно сказки или список (по следам приёмки 27.10). */
(function () {
  'use strict';
  var KEY = 'tc-schet';
  var cfg = document.getElementById('tc-schet');
  var box = document.getElementById('schet');
  if (!cfg || !box) return;
  var ID;
  try { ID = JSON.parse(cfg.textContent).ym; } catch (e) { return; }
  if (!ID) return;
  var started = false, wanted = false;

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* без хранилища спросим снова на следующей странице */ } }

  function start() {
    if (started) return;
    started = true;
    // код вставки — справка Метрики «Инициализация счётчика»; Вебвизор и карта кликов выключены
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date(); k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(ID, 'init', { clickmap: false, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  }

  function forget() {
    // отказ: убрать метки Метрики этого сайта — cookie и записи хранилища браузера
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (/^_ym/.test(name)) {
        document.cookie = name + '=; Max-Age=0; path=/';
        document.cookie = name + '=; Max-Age=0; path=/; domain=.' + location.hostname;
      }
    });
    try {
      Object.keys(localStorage).forEach(function (k) { if (/^_ym/.test(k)) localStorage.removeItem(k); });
    } catch (e) { /* хранилища нет — нечего убирать */ }
  }

  // плашку не показывать поверх окна сказки и открытых списков; вернуть, когда их закроют
  var modal = document.getElementById('modal');
  function blocked() {
    return !!((modal && !modal.hidden) || document.querySelector('.popover.open'));
  }
  function sync() { box.hidden = !wanted || blocked(); }
  function show(on, focus) {
    wanted = on;
    sync();
    if (on && focus && !box.hidden) box.focus({ preventScroll: true });     // фокус на плашку, а не на кнопку
  }
  if (modal && window.MutationObserver) new MutationObserver(sync).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  ['click', 'keyup', 'popstate', 'hashchange'].forEach(function (ev) {
    window.addEventListener(ev, function () { setTimeout(sync, 0); }, true);
  });

  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-schet]');
    if (!b) return;
    var v = b.getAttribute('data-schet') === 'da' ? 'da' : 'net';
    set(v);
    show(false);
    if (v === 'da') { start(); return; }
    forget();
    // Метрика уже работала на этой странице — перезагрузить, чтобы она остановилась сразу
    if (started) location.reload();
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-schet-open]')) return;
    e.preventDefault();
    // кнопка на глобусе — в меню «О караване»: меню закрыть, иначе плашка за ним спрячется
    document.querySelectorAll('.popover.open').forEach(function (p) { p.classList.remove('open'); });
    document.querySelectorAll('[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    setTimeout(function () { show(true, true); }, 0);
  });

  // запуск сказки: окно на глобусе (TCPlayer.mount при открытии) или плеер на странице сказки (по кнопке «Смотреть сказку»)
  if (window.TCPlayer && typeof window.TCPlayer.mount === 'function') {
    var mount = window.TCPlayer.mount;
    window.TCPlayer.mount = function (where, tale, S, lang, opts) {
      // считается запуск, а не заготовка «Ролик выйдет …» при загрузке страницы
      if (started && get() !== 'net' && window.ym && tale && tale.slug && opts && opts.autoplay) {
        try { window.ym(ID, 'reachGoal', 'skazka', { skazka: tale.slug }); } catch (e) { /* счётчик не должен ломать плеер */ }
      }
      return mount.apply(this, arguments);
    };
  }

  var v = get();
  if (v === 'da') start();
  else if (v !== 'net') show(true, false);
})();
