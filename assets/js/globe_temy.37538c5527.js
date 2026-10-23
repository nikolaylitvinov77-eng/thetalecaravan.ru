/* Темы глобуса и фильтры SVG — перенесены из прототипа v5 (index_template.html, строки 339-468); правка одна: window.d3 заменено на d3. */
const MUTED = ['#f1e2bf', '#ead6ad', '#f4e7c9', '#e6d3ae', '#eedcb6', '#f0deb8'];
const RAINBOW = ['#9ed36a', '#f7d35c', '#ffb26b', '#f59bb0', '#b9a2ef', '#7fd6c4', '#c6e477', '#ffc98b'];
const THEMES = {
  clay: { ru: 'Пластилин', en: 'Clay', swatch: '#4fa8d8', bg: 'radial-gradient(ellipse at 50% 40%, #e3f5fc 0%, #a9dbf2 55%, #7cc3e6 100%)', hint: '#2c5f86',
    sea: 'url(#seaG)', seaF: 'url(#seatex)', land: 'url(#clay)', relief: { p: '#a6d36e', b: '#7cc06a', u: '#e2c27f', d: '#f7d98f', m: '#c4956a', t: '#eef3ee', op: 0.62, river: '#3ea7e3', lake: '#56b6e8', peak: ['#b98457', '#ffffff'], peakF: 'url(#clay)' }, muted: ['#c7e39a', '#bfdd8f', '#cde6a3', '#bad88a', '#d2e9a9', '#c3df95'],
    stroke: (c, tale) => d3.color(c).darker(tale ? 0.9 : 0.45), sw: [1.4, 0.7], dash: null,
    rim: ['#fff4dc', 6, null, 0.9], rip: ['#ffffff', 0.1, 0.22], shade: 1, grat: ['#ffffff', 0.14], route: '#fff4dc', stars: null, shadow: 0.28 },
  felt: { ru: 'Войлок', en: 'Felt', swatch: '#c9a27e', bg: 'radial-gradient(ellipse at 50% 40%, #f8f1e6 0%, #e6d7c2 65%, #d3bfa3 100%)', hint: '#6b4a2e',
    sea: 'url(#seaFelt)', seaF: 'url(#feltSea)', land: 'url(#felt)', relief: { p: '#b9cf8a', b: '#9fc07c', u: '#dcc38f', d: '#efd8a0', m: '#b38a6a', t: '#f3efe6', op: 0.6, river: '#5d8fb8', lake: '#6d9cc3', peak: ['#a07a5c', '#fff8ea'], peakF: 'url(#felt)' }, muted: ['#cfd8a8', '#e3cf9c', '#d9b99b', '#c7d3b0', '#e8d9b5', '#d2c2a0'],
    stroke: () => '#fff8ea', sw: [1.1, 0.9], dash: '2.5 2.5',
    rim: ['#fff8ea', 4, '7 5', 0.95], rip: ['#ffffff', 0.08, 0.16], shade: 0.7, grat: ['#fff8ea', 0.16], route: '#fff8ea', stars: null, shadow: 0.25 },
  paper: { ru: 'Бумага', en: 'Paper', swatch: '#1d2b55', bg: 'radial-gradient(ellipse at 50% 42%, #2c3c72 0%, #1a2550 65%, #111836 100%)', hint: '#f3e9d2',
    sea: '#f1e6cf', seaF: 'url(#paperSea)', land: 'url(#paper)', relief: { p: '#9dbb66', b: '#7da55a', u: '#cdb27c', d: '#e8cf8f', m: '#a7825c', t: '#f4eee0', op: 0.75, river: '#7fb3c9', lake: '#e4d6b8', peak: ['#9b7550', '#fffaf0'], peakF: 'url(#paper)' }, muted: ['#8fae5e', '#a3bd6c', '#c9b48a', '#b99872', '#d4c193', '#9fb57a'],
    stroke: () => '#f1e6cf', sw: [0.8, 0.8], dash: null,
    rim: ['#c9a571', 6, null, 1], rip: ['#cdbf9f', 0, 0.35], shade: 0.35, grat: ['#b9a582', 0.25], route: '#c4552f', stars: '#f3c98b', shadow: 0 },
  night: { ru: 'Ночь', en: 'Night', swatch: '#0f1733', bg: 'radial-gradient(ellipse at 50% 45%, #1f2c5e 0%, #0f1733 70%, #090e22 100%)', hint: '#e6d6b5',
    sea: 'url(#seaNight)', seaF: null, land: 'url(#glow)', relief: { p: '#3b5c8c', b: '#36598a', u: '#4b5f8e', d: '#5a6590', m: '#6a7bb0', t: '#8fa3cf', op: 0.55, river: '#7fb8ff', lake: '#1f3670', peak: ['#7b8cc4', '#e8eeff'], peakF: 'url(#glow)' }, muted: ['#2f4a7a', '#35507f', '#2b4371', '#3a5686', '#314c7c'],
    stroke: (c, tale) => tale ? '#fff1d6' : '#5f7fb8', sw: [1, 0.5], dash: null,
    rim: ['#f3c98b', 2, null, 0.5], rip: ['#9cc4ff', 0.05, 0.1], shade: 0.8, grat: ['#f3c98b', 0.12], route: '#f3c98b', stars: '#fff1d6', shadow: 0 },
  watercolor: { ru: 'Акварель', en: 'Watercolor', swatch: '#8fc1d2', bg: 'radial-gradient(ellipse at 50% 40%, #fbf5e6 0%, #efe3c6 65%, #e2d1aa 100%)', hint: '#6b4a2e',
    sea: 'url(#seaWc)', seaF: 'url(#wcSea)', land: 'url(#wc)', relief: { p: '#c9d99a', b: '#b3cf8f', u: '#e5cfa0', d: '#f0dca8', m: '#c3a07a', t: '#f4f0e4', op: 0.55, river: '#6aa7c0', lake: '#93c4d6', peak: ['#a8835e', '#fffaf0'], peakF: 'url(#wc)' }, muted: ['#e9d9b0', '#dfe2b0', '#ecd0a8', '#d8dcb8', '#efdcb6'],
    stroke: () => '#7a5638', sw: [1, 0.6], dash: null,
    rim: ['#7a5638', 1.5, null, 0.7], rip: ['#4f8fae', 0.08, 0.18], shade: 0.4, grat: ['#7a5638', 0.12], route: '#7a5638', stars: null, shadow: 0.18 },
};
const THEME_KEYS = Object.keys(THEMES);
function hash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }

const DEFS = `
<filter id="clay" x="-5%" y="-5%" width="110%" height="115%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b"/>
  <feDiffuseLighting in="b" surfaceScale="3.5" diffuseConstant="1.18" lighting-color="#ffffff" result="d"><feDistantLight azimuth="235" elevation="52"/></feDiffuseLighting>
  <feSpecularLighting in="b" surfaceScale="3.5" specularConstant="0.6" specularExponent="18" lighting-color="#ffffff" result="s"><feDistantLight azimuth="235" elevation="52"/></feSpecularLighting>
  <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1" result="m"/>
  <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
  <feComposite in="m" in2="s2" operator="arithmetic" k2="1" k3="0.5" result="lit"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="11" result="g"/>
  <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.23  0 0 0 0 0.16  0 0 0 0 0.12  0.32 0 0 0 -0.11" result="g2"/>
  <feComposite in="g2" in2="SourceAlpha" operator="in" result="g3"/>
  <feMerge result="lit2"><feMergeNode in="lit"/><feMergeNode in="g3"/></feMerge>
  <feComposite in="lit2" in2="SourceAlpha" operator="in" result="fin"/>
  <feOffset in="SourceAlpha" dy="2.5" result="o"/>
  <feFlood flood-color="#0f3a5c" flood-opacity="0.35"/>
  <feComposite in2="o" operator="in" result="sh"/>
  <feMerge><feMergeNode in="sh"/><feMergeNode in="fin"/></feMerge>
</filter>
<filter id="seatex" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="2" result="n"/>
  <feDiffuseLighting in="n" surfaceScale="4" diffuseConstant="1.08" lighting-color="#ffffff" result="d"><feDistantLight azimuth="235" elevation="64"/></feDiffuseLighting>
  <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.1" result="m"/>
  <feComposite in="m" in2="SourceAlpha" operator="in"/>
</filter>
<filter id="rope" x="-5%" y="-5%" width="110%" height="120%">
  <feOffset in="SourceAlpha" dy="2" result="o"/>
  <feFlood flood-color="#0f3a5c" flood-opacity="0.35"/>
  <feComposite in2="o" operator="in" result="sh"/>
  <feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="felt" x="-5%" y="-5%" width="110%" height="115%" color-interpolation-filters="sRGB">
  <feTurbulence type="turbulence" baseFrequency="0.9" numOctaves="2" seed="3" result="t"/>
  <feDisplacementMap in="SourceGraphic" in2="t" scale="3" xChannelSelector="R" yChannelSelector="G" result="fz"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b"/>
  <feDiffuseLighting in="b" surfaceScale="2.5" diffuseConstant="1.12" lighting-color="#ffffff" result="d"><feDistantLight azimuth="235" elevation="55"/></feDiffuseLighting>
  <feComposite in="fz" in2="d" operator="arithmetic" k1="1" result="m"/>
  <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.35 0 0 0 -0.12" result="fib"/>
  <feComposite in="fib" in2="fz" operator="in" result="fib2"/>
  <feMerge result="mm"><feMergeNode in="m"/><feMergeNode in="fib2"/></feMerge>
  <feOffset in="SourceAlpha" dy="2" result="o"/><feGaussianBlur in="o" stdDeviation="1.5" result="ob"/>
  <feFlood flood-color="#3b2a20" flood-opacity="0.3"/><feComposite in2="ob" operator="in" result="sh"/>
  <feMerge><feMergeNode in="sh"/><feMergeNode in="mm"/></feMerge>
</filter>
<filter id="feltSea" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="turbulence" baseFrequency="0.7" numOctaves="2" seed="8" result="t"/>
  <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.3 0 0 0 -0.1" result="f"/>
  <feComposite in="f" in2="SourceAlpha" operator="in" result="f2"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="f2"/></feMerge>
</filter>
<filter id="paper" x="-5%" y="-5%" width="110%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="5" result="g"/>
  <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.22 0 0 0 -0.07" result="g2"/>
  <feComposite in="g2" in2="SourceAlpha" operator="in" result="g3"/>
  <feMerge result="pp"><feMergeNode in="SourceGraphic"/><feMergeNode in="g3"/></feMerge>
  <feOffset in="SourceAlpha" dx="1.5" dy="3.5" result="o"/><feGaussianBlur in="o" stdDeviation="2.2" result="ob"/>
  <feFlood flood-color="#2a1a10" flood-opacity="0.5"/><feComposite in2="ob" operator="in" result="sh"/>
  <feMerge><feMergeNode in="sh"/><feMergeNode in="pp"/></feMerge>
</filter>
<filter id="paperSea" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="6" result="g"/>
  <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0 0.2  0.2 0 0 0 -0.06" result="g2"/>
  <feComposite in="g2" in2="SourceAlpha" operator="in" result="g3"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="g3"/></feMerge>
</filter>
<filter id="glow" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
  <feColorMatrix in="b" type="saturate" values="1.8" result="b2"/>
  <feMerge><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="wc" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" result="w"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="12" result="blot"/>
  <feColorMatrix in="blot" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.7 0 0 0 -0.3" result="bl"/>
  <feComposite in="bl" in2="w" operator="in" result="bl2"/>
  <feMerge><feMergeNode in="w"/><feMergeNode in="bl2"/></feMerge>
</filter>
<filter id="wcSea" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="21" result="blot"/>
  <feColorMatrix in="blot" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 0 0 0 -0.35" result="bl"/>
  <feComposite in="bl" in2="SourceAlpha" operator="in" result="bl2"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="bl2"/></feMerge>
</filter>
<radialGradient id="seaFelt" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#86b3d6"/><stop offset="60%" stop-color="#5d8fb8"/><stop offset="100%" stop-color="#3e6d98"/></radialGradient>
<radialGradient id="seaNight" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#34589e"/><stop offset="60%" stop-color="#1f3670"/><stop offset="100%" stop-color="#12204a"/></radialGradient>
<radialGradient id="seaWc" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="#c3e2ea"/><stop offset="60%" stop-color="#93c4d6"/><stop offset="100%" stop-color="#6aa7c0"/></radialGradient>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
<radialGradient id="seaG" cx="38%" cy="32%" r="75%">
  <stop offset="0%" stop-color="#7fd0f5"/><stop offset="55%" stop-color="#3f9fd6"/><stop offset="100%" stop-color="#21679f"/>
</radialGradient>
<radialGradient id="shade" cx="36%" cy="30%" r="72%">
  <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38"/>
  <stop offset="28%" stop-color="#ffffff" stop-opacity="0.06"/>
  <stop offset="70%" stop-color="#0b2d4a" stop-opacity="0"/>
  <stop offset="100%" stop-color="#0b2d4a" stop-opacity="0.42"/>
</radialGradient>`;
