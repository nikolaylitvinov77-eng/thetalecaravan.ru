/* Счётчик посещений — Яндекс Метрика (подключён 26.10.2026 по слову владельца «поставь на сайты счётчики посещаемости»).
   С 27.10.2026 по слову владельца («категорически не хочу эту всплывающую панель») Метрика включается сразу при открытии
   страницы, плашки при входе нет. Плашка с объяснением — только по кнопке «Статистика посещений» (меню «О караване»
   на глобусе, низ остальных страниц): там же «Не считать меня» (условия Метрики 07.08.2026, п. 2.1 и 5.8 — сообщить
   посетителям об обработке данных и о «Блокировщике Яндекс.Метрики»).
   Выбор посетителя хранится в localStorage «tc-schet»: «net» — не считать (в том числе отказ в прежней плашке), «da» — считать.
   Цель «skazka» — запуск сказки (окно на глобусе, «Смотреть» на странице сказки), параметр визита skazka = slug.
   Плашка не перехватывает клавиатуру (курсор ставится на саму плашку, не на кнопку) и прячется, пока открыто окно сказки
   или список (по следам приёмки 27.10). */
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

  /* С 09.11.2026 (слово владельца «Все пять», Скорость_сайта_предложения_2026-11-09.md, П5) сама программа Метрики
     (tag.js, 87 КБ) скачивается не сразу, а когда шар глобуса уже нарисован (событие tc-globe-ready из globe.js),
     на остальных страницах — после загрузки страницы. Очередь вызовов ym заводится сразу: запуск сказки,
     случившийся раньше, ждёт в очереди и уходит, когда tag.js придёт. Если шар так и не нарисовался — через 15 с. */
  var tagAdded = false;
  function addTag() {
    if (tagAdded) return;
    tagAdded = true;
    var k = document.createElement('script'), a = document.getElementsByTagName('script')[0];
    k.async = 1; k.src = 'https://mc.yandex.ru/metrika/tag.js'; a.parentNode.insertBefore(k, a);
  }
  function addTagLater() {
    var globe = document.getElementById('globe-root');
    if (globe) {
      if (globe.dataset.ready === '1') { addTag(); return; }
      document.addEventListener('tc-globe-ready', addTag);
    } else if (document.readyState === 'complete') { addTag(); return; }
    else window.addEventListener('load', addTag);
    setTimeout(addTag, 15000);
  }

  function start() {
    if (started) return;
    started = true;
    // код вставки — справка Метрики «Инициализация счётчика» (очередь ym и init); Вебвизор и карта кликов выключены
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = 1 * new Date();
    window.ym(ID, 'init', { clickmap: false, trackLinks: true, accurateTrackBounce: true, webvisor: false });
    addTagLater();
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

  // «назад» и «вперёд» достают страницу из памяти браузера такой, какой её оставили (GitHub Pages разрешает это 10 минут):
  // если на другой странице выбрали «Не считать меня», здесь Метрика ещё работает — перезагрузить уже без неё (по следам приёмки 27.10)
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    var v = get();
    if (started && v === 'net') { forget(); location.reload(); }
    else if (!started && v !== 'net') start();
  });

  if (get() !== 'net') start(); else forget();      // у отказавшихся метки Метрики стираются на каждой странице
})();
