import { PARTS, SYSTEMS, SYS, SRC, SPECS, MAINT, DIAG, SENSORS, STATUS } from './data.js';
import { createViewer } from './viewer3d.js';
import { h } from './svgkit.js';
import { PHASES, cyclePhi, phaseOf } from './geom.js';
import { motor } from './diagrams/motor.js';
import { combustible } from './diagrams/combustible.js';
import { encendido } from './diagrams/encendido.js';
import { refrigeracion } from './diagrams/refrigeracion.js';
import { lubricacion } from './diagrams/lubricacion.js';
import { escape } from './diagrams/escape.js';
import { transmision } from './diagrams/transmision.js';
import { frenos } from './diagrams/frenos.js';
import { chasis } from './diagrams/chasis.js';
import { sensorMap } from './diagrams/sensores.js';
import { qualitySheet, qualityNeeds, qualityTable, qualityLegend, qualityCardHTML } from './diagrams/calidad.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mq = matchMedia('(max-width: 899px)');
const isMobile = () => mq.matches;
const root = document.documentElement;
root.style.setProperty('--sens', SYS.sensores.color);

const IC = {
  back: '<svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg class="ic chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  right: '<svg class="ic chevr" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  search: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  play: '<svg class="ic" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg class="ic" viewBox="0 0 24 24"><rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor" stroke="none"/></svg>',
};

const used = new Set();
function srcBadge(key) {
  const sr = SRC[key]; if (!sr) return '';
  used.add(key);
  const cls = 'src k-' + sr.kind;
  return sr.url ? `<a class="${cls}" href="${sr.url}" target="_blank" rel="noopener" title="${sr.title}">${sr.short}</a>` : `<span class="${cls}" title="${sr.title}">${sr.short}</span>`;
}
const sysChip = id => `<span class="syschip" style="--c:${SYS[id].color}"><i></i>${SYS[id].name}</span>`;
const statusPill = st => `<span class="stpill" style="--c:${STATUS[st].color}">${STATUS[st].short || STATUS[st].label}</span>`;
const matchFocus = (P, f) => !!P && (P.sys === f || P.serves === f || (P.also || []).includes(f));
const kvRows = rows => rows.map(([k, v, s]) => `<div><dt>${k}</dt><dd>${v} ${srcBadge(s)}</dd></div>`).join('');
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

// esquemas animados por sistema
const TABS = [
  { id: 'motor', sys: 'motor', h: 'Cómo funciona: 4 tiempos y distribución', p: 'Cada cilindro aspira, comprime, explota y expulsa en dos vueltas de cigüeñal. La correa dentada sincroniza el árbol de levas con los pistones.', mount: motor, eng3d: true },
  { id: 'combustible', sys: 'combustible', h: 'Cómo funciona: bencina y carburador', p: 'La bomba eléctrica, en el larguero derecho, llena la cuba; el venturi y los chicleres dosifican la bencina según cuánto se abra la mariposa.', mount: combustible },
  { id: 'encendido', sys: 'electrico', h: 'Cómo funciona: encendido, carga y partida', p: 'El módulo corta la corriente de la bobina en el instante justo y el rotor reparte la chispa. El alternador mantiene la batería cargada.', mount: encendido },
  { id: 'refrigeracion', sys: 'refrigeracion', h: 'Cómo funciona: refrigeración y calefacción', p: 'La bomba hace circular el refrigerante; el termostato decide cuándo pasa por el radiador, y la calefacción toma agua caliente del múltiple de admisión.', mount: refrigeracion },
  { id: 'lubricacion', sys: 'lubricacion', h: 'Cómo funciona: lubricación a presión', p: 'La bomba de rotores lleva el aceite filtrado a bancadas, bielas, árbol de levas y balancines.', mount: lubricacion },
  { id: 'escape', sys: 'escape', h: 'Cómo funciona: escape y catalizador', p: 'Los gases salen en pulsos 1-3-4-2, se tratan en el catalizador y se silencian antes de la cola.', mount: escape },
  { id: 'transmision', sys: 'transmision', h: 'Cómo funciona: embrague, caja y diferencial', p: 'La fuerza pasa del volante motor al disco de embrague, la caja la multiplica y el diferencial la reparte entre las ruedas traseras.', mount: transmision },
  { id: 'frenos', sys: 'frenos', h: 'Cómo funciona: frenos de doble circuito', p: 'El servofreno multiplica la fuerza del pie y la bomba tándem la convierte en presión hidráulica para discos y tambores.', mount: frenos },
  { id: 'chasis', sys: 'chasis', h: 'Cómo funciona: dirección y suspensión', p: 'Cremallera adelante; McPherson adelante y paquetes de resortes atrás.', mount: chasis },
];
const DIAG_OF_SYS = { calefaccion: 'refrigeracion' };
const tabOfSys = sys => TABS.find(t => t.id === DIAG_OF_SYS[sys]) || TABS.find(t => t.sys === sys) || null;
const BLURB = {
  motor: 'F10A de 970 cm³ y 4 cilindros, inclinado bajo los asientos', combustible: 'Estanque, bomba eléctrica, filtro y carburador', electrico: 'Encendido, carga, partida, luces y tablero',
  refrigeracion: 'Radiador, bomba de agua, ventilador y termostato', lubricacion: 'Bomba, filtro, cárter y bulbo de aceite', escape: 'Múltiple, catalizador, silenciador y cola',
  transmision: 'Embrague, caja de 5, cardán y diferencial', chasis: 'McPherson adelante, resortes atrás y cremallera', frenos: 'Discos adelante, tambores atrás, doble circuito',
  carroceria: 'Furgón ciego, interior, asientos y parrilla', calefaccion: 'Calefactor, ventilador, ductos y mandos', sensores: 'Los 9 sensores e interruptores, con su cableado',
};

// ═══════════ Visor 3D ═══════════
const viewerEl = $('#viewer'), hud = $('#enghud');
let viewer, smap = null, quiet = false;
try {
  viewer = createViewer(viewerEl, { labelLayer: $('#labels'), onSelect: onViewerSelect, onTick: (th, m) => m === 'eng' && renderHud(th) });
  window.__viewer = viewer;
} catch (err) {
  viewerEl.classList.add('nogl'); $('#viewer-msg').hidden = false; $('#dock').hidden = true; console.error(err);
}
const mode = () => (viewer ? viewer.getMode() : 'van');
const inWorld = id => (viewer ? viewer.has(id) : true);
const sysAvailable = sy => Object.keys(PARTS).some(id => matchFocus(PARTS[id], sy) && inWorld(id));
const hideHint = () => $('#hint').classList.add('gone');
viewerEl.addEventListener('pointerdown', hideHint, { once: true });
setTimeout(hideHint, 12000);

let toastT = 0;
function toast(msg, ms = 5200) { const t = $('#toast'); t.textContent = msg; t.classList.remove('gone'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('gone'), ms); }

// ═══════════ Panel: pestañas y fichas ═══════════
const panel = $('#panel'), pview = $('#pview'), vDetail = $('#v-detail');
const views = { sistemas: $('#v-sistemas'), piezas: $('#v-piezas'), sensores: $('#v-sensores'), datos: $('#v-datos') };
let tab = 'sistemas', stack = [], focusSys = null;
const scrollMem = {}, built = {};

function saveScroll() { const top = stack[stack.length - 1]; if (top) top.scroll = pview.scrollTop; else scrollMem[tab] = pview.scrollTop; }
function setFocus(sys) {
  focusSys = sys || null;
  if (viewer) viewer.setFocus(focusSys);
  const pill = $('#focuspill');
  if (focusSys) { pill.style.setProperty('--c', SYS[focusSys].color); pill.firstElementChild.textContent = SYS[focusSys].name; }
  pill.hidden = !focusSys;
}
function updateTabbar() { $$('#tabbar [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab))); }

function render() {
  const top = stack[stack.length - 1];
  for (const k in views) views[k].hidden = !!top || k !== tab;
  vDetail.hidden = !top;
  activeDiag = null;
  if (top) {
    if (top.t === 'part') renderPart(top.id); else renderSys(top.id);
    if (top.anchor) { const a = $('#' + top.anchor, vDetail); top.anchor = null; requestAnimationFrame(() => a && a.scrollIntoView({ block: 'start' })); }
    else pview.scrollTop = top.scroll || 0;
  } else {
    buildTab(tab);
    pview.scrollTop = scrollMem[tab] || 0;
  }
  updateTabbar();
}
function buildTab(t, force) {
  if (built[t] && !force) return;
  built[t] = true;
  ({ sistemas: renderSistemas, piezas: renderPiezas, sensores: renderSensores, datos: renderDatos })[t]();
}

function showTab(t) {
  if (t === tab && !stack.length) { if (isMobile()) setSheet(sheet === 'peek' ? 'half' : 'peek'); return; }
  saveScroll();
  if (stack.some(e => e.t === 'part') && viewer && viewer.state.sel) { quiet = true; viewer.select(null, { fly: false }); quiet = false; }
  stack = []; tab = t;
  if (t === 'sensores') setFocus(sysAvailable('sensores') ? 'sensores' : null); else if (focusSys) setFocus(null);
  render();
  if (isMobile() && sheet === 'peek') setSheet('half');
}
function openSys(sys, { anchor } = {}) {
  hideHint();
  if (sys === 'sensores') { showTab('sensores'); return; }
  saveScroll();
  stack.push({ t: 'sys', id: sys, scroll: 0, anchor });
  setFocus(sys);
  render();
  if (isMobile() && sheet === 'peek') setSheet('half');
}
function back() {
  const top = stack[stack.length - 1]; if (!top) return;
  if (top.t === 'part' && viewer && viewer.state.sel) { viewer.select(null, { fly: false }); return; }   // onViewerSelect hace el resto
  stack.pop();
  if (top.t === 'sys') { const prev = stack[stack.length - 1]; setFocus(prev && prev.t === 'sys' ? prev.id : (tab === 'sensores' ? 'sensores' : null)); }
  render();
}
function goHome() {
  if (viewer && viewer.state.sel) { quiet = true; viewer.select(null, { fly: false }); quiet = false; }
  stack = []; tab = 'sistemas'; setFocus(null);
  if (viewer) { if (mode() !== 'van') setMode('van'); viewer.setView('iso'); }
  render(); if (isMobile()) setSheet('peek');
}

// selección desde el 3D (tocar una pieza o una etiqueta) o desde las listas
function onViewerSelect(id) {
  if (id) hideHint();
  smap && smap.highlight(id && PARTS[id].sensor ? id : null);
  if (quiet) return;
  const top = stack[stack.length - 1];
  if (id) {
    if (top && top.t === 'part') { if (top.id !== id) { top.id = id; top.scroll = 0; } }
    else { saveScroll(); stack.push({ t: 'part', id, scroll: 0 }); }
    render();
  } else if (top && top.t === 'part') { stack.pop(); render(); }
}
function openPart(id) {
  if (isMobile() && sheet === 'full') setSheet('half');
  if (!viewer) { saveScroll(); stack.push({ t: 'part', id, scroll: 0 }); render(); return; }
  const P = PARTS[id];
  const toEng = P.deep && mode() === 'van', toVan = mode() === 'eng' && !viewer.isEng(id);
  if (toEng || toVan) setMode(toEng ? 'eng' : 'van', id); else viewer.select(id);
}

// ——— vistas ———
const vhead = (title, sub, withBack) => `<div class="vhead">${withBack ? `<button type="button" class="back" data-back aria-label="Volver">${IC.back}</button>` : ''}<h2>${title}${sub ? `<span class="sub">${sub}</span>` : ''}</h2>${IC.chev}</div>`;
const SPECSTRIP = [['Motor', 'F10A · 970 cm³'], ['Potencia', '41 CV · 30 kW'], ['Caja', '5 vel. + R'], ['Diferencial', '5,125 : 1'], ['Entre ejes', '1.840 mm'], ['Estanque', '37 L']];

function renderSistemas() {
  const eng = mode() === 'eng';
  const avail = SYSTEMS.filter(sy => sysAvailable(sy.id));
  views.sistemas.innerHTML = vhead(eng ? 'Sistemas del motor' : 'Sistemas', 'Toca uno para verlo marcado en el modelo') + `
    ${eng ? '' : `<div class="idcard"><div class="idtop"><b>Super Carry 1000</b><span>Suzuki SK410 · furgón ciego 1996 · volante a la izquierda</span></div>
      <ul class="specstrip">${SPECSTRIP.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul></div>`}
    <div class="sysgrid">${avail.map(sy => {
      const n = Object.keys(PARTS).filter(id => matchFocus(PARTS[id], sy.id) && inWorld(id) && (eng || !PARTS[id].deep || sy.id === 'motor')).length;
      return `<button type="button" class="syscard" data-sys="${sy.id}" style="--c:${sy.color}"><b>${sy.short}</b><span>${BLURB[sy.id] || ''}</span><span>${plural(n, 'pieza', 'piezas')}</span></button>`;
    }).join('')}</div>`;
}

function rowHTML(id) {
  const P = PARTS[id], tags = [];
  if (P.sensor) tags.push(statusPill(P.sensor.status));
  if (P.deep) tags.push('<span class="tg">motor por dentro</span>');
  if (P.approx) tags.push('<span class="tg">aprox.</span>');
  return `<button type="button" class="prow" data-part="${id}" style="--c:${SYS[P.sys].color}">${P.sensor ? `<span class="snum">${P.sensor.n}</span>` : '<i></i>'}<span class="nm">${P.name}</span>${tags.join('')}${IC.right}</button>`;
}
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SEARCH = Object.keys(PARTS).map(id => { const P = PARTS[id]; return { id, key: norm([P.name, P.short || '', SYS[P.sys].name, SYS[P.sys].short].join(' ')), desc: norm(P.desc) }; });
function renderPiezas() {
  views.piezas.innerHTML = vhead('Piezas', `${Object.keys(PARTS).length} piezas del furgón y del motor`) + `
    <div class="search"><label>${IC.search}<input type="search" id="psearch" placeholder="Buscar: bomba, filtro, sensor…" aria-label="Buscar una pieza" autocomplete="off"></label></div>
    <div id="plist"></div>`;
  $('#psearch').addEventListener('input', e => listParts(e.target.value));
  listParts('');
}
function listParts(q) {
  const qq = norm(q.trim());
  const hits = qq ? SEARCH.filter(s => qq.split(/\s+/).every(w => s.key.includes(w))).map(s => s.id) : Object.keys(PARTS);
  const more = qq.length >= 3 ? SEARCH.filter(s => !hits.includes(s.id) && s.desc.includes(qq)).map(s => s.id) : [];
  let out = SYSTEMS.map(sy => { const ids = hits.filter(id => PARTS[id].sys === sy.id); return ids.length ? `<div class="group"><h4 style="--c:${sy.color}"><i></i>${sy.name}</h4><div class="rows">${ids.map(rowHTML).join('')}</div></div>` : ''; }).join('');
  if (more.length) out += `<div class="group"><h4>También mencionan “${q.trim()}”</h4><div class="rows">${more.map(rowHTML).join('')}</div></div>`;
  $('#plist').innerHTML = out || `<p class="empty">No hay piezas con “${q.trim()}”. Prueba con otra palabra, como “bomba”, “filtro” o “sensor”.</p>`;
}

function renderSensores() {
  views.sensores.innerHTML = vhead('Sensores', `${SENSORS.length} sensores e interruptores · se marcan en el modelo`) + `
    <p class="lead">Dónde está cada uno, qué detecta y adónde manda su señal. Este furgón no tiene computador de inyección: casi todo avisa directo al tablero.</p>
    <figure class="fig smapfig"><div id="senmap"></div><figcaption>Toca un número para abrir su ficha. Los sensores 3 y 4 eran del sistema catalítico original: con el carburador actual ya no influyen.</figcaption></figure>
    <div class="group"><h4>Lista</h4><div class="rows">${SENSORS.map(rowHTML).join('')}</div></div>`;
  try { smap = sensorMap($('#senmap'), { onPick: openPart }); } catch (err) { console.error(err); }
}

function renderPart(id) {
  const eng = mode() === 'eng';
  const P = PARTS[id], S = P.sensor;
  const sensorBlock = S ? `
    <div class="sblock" style="--c:${STATUS[S.status].color}">
      <div class="sb-top"><span class="snum">${S.n}</span>${statusPill(S.status)}</div>
      <dl class="kv"><div><dt>Qué detecta</dt><dd>${S.mide}</dd></div><div><dt>Tipo</dt><dd>${S.tipo}</dd></div><div><dt>Dónde está</dt><dd>${S.ubic}</dd></div><div><dt>Envía la señal a</dt><dd>${S.va}</dd></div></dl>
      <h4>Cómo probarlo</h4><p>${S.prueba}</p>
    </div>` : '';
  const how = P.diag && TABS.find(t => t.id === P.diag);
  const toEngine = !eng && viewer && viewer.isEng(id) ? `<button type="button" class="btn ghost" data-mode-go="eng" data-part-go="${id}">Ver en la vista Motor</button>` : '';
  const toVan = eng && viewer ? `<button type="button" class="btn ghost" data-mode-go="van" data-part-go="${id}">Ver en el furgón</button>` : '';
  vDetail.innerHTML = vhead(P.name, SYS[P.sys].name + (S ? ` · sensor ${S.n}` : ''), true) + `
    <div class="card-head">${sysChip(P.sys)}${P.serves ? sysChip(P.serves) : ''}${P.approx ? '<span class="approx">ubicación aprox.</span>' : ''}</div>
    <p class="lead">${P.desc}</p>
    ${sensorBlock}
    <h4>Datos técnicos</h4><dl class="kv">${kvRows(P.d)}</dl>
    <h4>Mantención</h4><ul class="ticks">${P.m.map(x => `<li>${x}</li>`).join('')}</ul>
    <h4>Fallas típicas</h4><ul class="warns">${P.f.map(x => `<li>${x}</li>`).join('')}</ul>
    ${qualityCardHTML(id)}
    <div class="btnrow">${how ? `<button type="button" class="btn" data-opensys="${how.sys}" data-anchor="s-diag">Cómo funciona</button>` : ''}${toEngine}${toVan}</div>`;
}

let activeDiag = null;
const diags = {};
function diagFor(tb) {
  if (!diags[tb.id]) {
    const wrap = h('div', { class: 'diag-body' });
    let api; try { api = tb.mount(wrap); } catch (err) { console.error(err); wrap.append(h('p', { class: 'muted' }, 'No se pudo cargar este esquema.')); api = { tick() {} }; }
    diags[tb.id] = { wrap, api };
  }
  return diags[tb.id];
}
function renderSys(sys) {
  const eng = mode() === 'eng';
  const ids = Object.keys(PARTS).filter(id => matchFocus(PARTS[id], sys) && inWorld(id) && (eng || !PARTS[id].deep || sys === 'motor'));
  const tb = tabOfSys(sys), specs = SPECS.find(sp => sp.sys === sys), maint = MAINT.filter(m => m.sys === sys), faults = DIAG.filter(d => d.sys === sys);
  const J = [['s-piezas', 'Piezas'], tb && ['s-diag', 'Cómo funciona'], specs && ['s-datos', 'Datos'], maint.length && ['s-mant', 'Mantención'], faults.length && ['s-fallas', 'Fallas']].filter(Boolean);
  vDetail.innerHTML = vhead(SYS[sys].name, `${plural(ids.length, 'pieza', 'piezas')} · marcadas en el modelo`, true) + `
    <p class="lead">${tb && tb.sys === sys ? tb.p : (BLURB[sys] || '') + '.'}</p>
    <nav class="jumps" aria-label="Ir a">${J.map(([a, t]) => `<a href="#${a}" data-jump="${a}">${t}</a>`).join('')}</nav>
    <div class="sect" id="s-piezas"><h3>Piezas</h3><div class="rows">${ids.map(rowHTML).join('')}</div></div>
    ${tb ? `<div class="sect" id="s-diag"><h3>${tb.h.replace('Cómo funciona: ', 'Cómo funciona · ')}</h3>${tb.sys !== sys ? `<p class="muted">${tb.p}</p>` : ''}<div class="diag-slot"></div>${tb.eng3d ? '<p><button type="button" class="btn ghost sm" data-eng3d>Ver el motor en 3D, por dentro</button></p>' : ''}</div>` : ''}
    ${specs ? `<div class="sect" id="s-datos"><h3>Datos técnicos</h3><dl class="kv">${kvRows(specs.rows)}</dl></div>` : ''}
    ${maint.length ? `<div class="sect" id="s-mant"><h3>Mantención</h3><div class="mlist">${maint.map(maintHTML).join('')}</div></div>` : ''}
    ${faults.length ? `<div class="sect" id="s-fallas"><h3>Si algo falla</h3><div class="dcards">${faults.map(diagHTML).join('')}</div></div>` : ''}`;
  if (tb) { const d = diagFor(tb); $('.diag-slot', vDetail).append(d.wrap); activeDiag = d; }
}
const maintHTML = m => `<div class="mitem"><b><span class="dot" style="--c:${SYS[m.sys].color}"></span>${m.item}${m.urgent ? ' <span class="pill">Prioridad</span>' : ''}</b><span class="when">${m.every}</span><p>${m.note} ${srcBadge(m.src)}</p></div>`;
const diagHTML = d => `<article class="dcard" style="--c:${SYS[d.sys].color}"><h5>${d.s}</h5><ol>${d.c.map(c => `<li>${c}</li>`).join('')}</ol><button type="button" class="btn ghost sm" data-part="${d.part}">Ver ${(PARTS[d.part].short || PARTS[d.part].name).replace(/\s*\(.*?\)/g, '').toLowerCase()}</button></article>`;

// ——— Datos ———
const DSUB = [['ficha', 'Ficha técnica'], ['mant', 'Mantención'], ['fallas', 'Fallas'], ['precision', 'Precisión'], ['fuentes', 'Fuentes']];
let dsub = 'ficha';
function renderDatos() {
  views.datos.innerHTML = vhead('Datos', 'Ficha técnica, mantención, fallas, precisión y fuentes') + `
    <nav class="subnav" id="dsubnav" aria-label="Datos">${DSUB.map(([k, t]) => `<button type="button" data-dsub="${k}" aria-pressed="${k === dsub}">${t}</button>`).join('')}</nav>
    <div data-dpage="ficha">
      <p class="lead">Cada dato lleva su fuente: <span class="src k-fab">Manual SK410</span> es el manual de servicio; <span class="src k-fab">Fábrica UK</span>, la especificación del Super Carry / Bedford Rascal SK410; <span class="src k-oem">OEM Chile</span>, piezas del catálogo de repuestos marcadas para Chile; <span class="src k-rec">Recomendación</span>, criterio práctico.</p>
      ${SPECS.map(sp => `<article class="speccard" style="--c:${SYS[sp.sys].color}"><h4>${SYS[sp.sys].name}</h4><dl class="kv">${kvRows(sp.rows)}</dl></article>`).join('')}
    </div>
    <div data-dpage="mant" hidden>
      <p class="lead">Pensado para uso urbano con trayectos cortos, que cuenta como servicio severo: el motor y el aceite pasan más tiempo fríos y la batería carga poco.</p>
      <div class="mlist">${MAINT.map(maintHTML).join('')}</div>
    </div>
    <div data-dpage="fallas" hidden>
      <p class="lead">Síntomas frecuentes con sus causas probables, en el orden en que conviene revisarlas.</p>
      <div class="chips" id="diagchips" role="toolbar" aria-label="Filtrar por sistema">${['', ...new Set(DIAG.map(d => d.sys))].map(id => `<button type="button" class="chip" aria-pressed="${!id}" data-ds="${id}" ${id ? `style="--c:${SYS[id].color}"` : ''}>${id ? `<i></i>${SYS[id].short}` : 'Todos'}</button>`).join('')}</div>
      <div class="dcards" id="diaglist"></div>
    </div>
    <div data-dpage="precision" hidden>
      <p class="lead">Cada pieza tiene tres notas: <b>dónde va</b> en el furgón, su <b>forma y medidas</b> en el 3D y los <b>datos</b> de su ficha. Azul es lo confirmado (medido en las fotos o sacado del manual), gris lo que viene de un catálogo y naranjo lo que todavía es una referencia general o una estimación. En el modelo, <b>Color → Precisión</b> lo pinta con la misma escala.</p>
      <div class="fig" id="qsheet"></div>
      <div class="sect"><h3>Lo que más subiría la precisión</h3><div id="qneeds"></div></div>
      <div class="sect"><h3>Pieza por pieza</h3><div id="qtable"></div></div>
    </div>
    <div data-dpage="fuentes" hidden>
      <div class="notes">
        <p><b>Manual de servicio:</b> el del SK410 en su versión de platinos, sin catalizador (traducción al español). Para este furgón valen el motor F10A, el carburador de tiro horizontal, la refrigeración, la transmisión y el chasis. No trae el encendido electrónico, el sensor de oxígeno ni el controlador del catalítico chileno 1993–99: esos datos salen del catálogo OEM.</p>
        <p><b>Qué es exacto:</b> dimensiones principales, relaciones de caja y diferencial, capacidades, reglajes y piezas de la versión chilena tal como figuran en las fuentes. El modelo 3D respeta distancia entre ejes, trochas, ruedas (175/70 R13), discos y tambores, y en el motor los diámetros de muñones, codos, pasadores, vástagos y la altura de leva del manual.</p>
        <p><b>Carrocería:</b> medida en fotos de costado, frente y atrás, con la distancia entre ejes (1.840 mm) y la patente (360 × 130 mm) como escala; el error típico es de 2 a 3 cm. Las diagonales de los vanos de la corredera y del portalón de la sección 19 del manual calzan con las fotos.</p>
        <p><b>Qué es aproximado:</b> la forma de las piezas en el 3D y la posición de las marcadas “aprox.” (estanque, radiador, catalizador, silenciador, controlador y varios sensores). La calefacción sigue el despiece del manual y las fotos del tablero, pero sus cotas y el recorrido de las mangueras son aproximados. En el motor, el largo de biela, el ángulo de las válvulas, la forma de los balancines y el ángulo exacto del distribuidor son aproximados.</p>
        <p><b>Sensores:</b> los números de parte del bulbo de aceite, del interruptor de luz de freno y del distribuidor salen del catálogo OEM del SK410; el bulbo de temperatura y el interruptor de retroceso, de catálogos de repuestos. El manual confirma dónde van el bulbo de temperatura, el bulbo de aceite, el aforador y el generador de señal, y da las resistencias y presiones de prueba.</p>
        <p><b>Qué no está:</b> el CO de ralentí y las cifras del encendido electrónico de la versión catalítica (resistencia del captador, entrehierro): no aparecen en el manual ni en otra fuente verificable. El punto de 8° APMS a 900 rpm coincide entre el manual y el dato UK.</p>
      </div>
      <ul id="srclist"></ul>
    </div>`;
  renderDiagList('');
  try {
    const tbl = qualityTable($('#qtable'), { onPick: openPart });
    qualitySheet($('#qsheet'), { onSys: sys => tbl.open(sys) });
    qualityNeeds($('#qneeds'), { onPick: openPart });
  } catch (err) { console.error(err); }
  for (const id in PARTS) PARTS[id].d.forEach(r => used.add(r[2]));
  const order = Object.keys(SRC).filter(k => used.has(k) && (SRC[k].url || k === 'MAN')).sort((a, b) => (b === 'MAN') - (a === 'MAN'));
  $('#srclist').innerHTML = order.map(k => `<li>${srcBadge(k)} ${SRC[k].url ? `<a href="${SRC[k].url}" target="_blank" rel="noopener">${SRC[k].title}</a>` : `<span>${SRC[k].title}</span>`}</li>`).join('');
  showDsub(dsub);
}
function renderDiagList(sys) { $('#diaglist').innerHTML = DIAG.filter(d => !sys || d.sys === sys).map(diagHTML).join(''); }
function showDsub(k) {
  dsub = k;
  $$('[data-dsub]', views.datos).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dsub === k)));
  $$('[data-dpage]', views.datos).forEach(p => p.hidden = p.dataset.dpage !== k);
  const nav = $('#dsubnav'); pview.scrollTop = 0;
  if (nav) nav.querySelector(`[data-dsub="${k}"]`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// ——— clics dentro del panel ———
pview.addEventListener('click', e => {
  const t = e.target;
  const pb = t.closest('[data-part]'); if (pb) { openPart(pb.dataset.part); return; }
  if (t.closest('[data-back]')) { back(); return; }
  const sc = t.closest('[data-sys]'); if (sc) { openSys(sc.dataset.sys); return; }
  const os = t.closest('[data-opensys]'); if (os) { openSys(os.dataset.opensys, { anchor: os.dataset.anchor }); return; }
  const mg = t.closest('[data-mode-go]'); if (mg) { setMode(mg.dataset.modeGo, mg.dataset.partGo); return; }
  const jp = t.closest('[data-jump]'); if (jp) { e.preventDefault(); const a = $('#' + jp.dataset.jump, vDetail); a && a.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); return; }
  if (t.closest('[data-eng3d]')) { setMode('eng'); if (viewer) { viewer.setCut('long'); pressSeg($('#tb-cut'), 'long'); } return; }
  const ds = t.closest('[data-dsub]'); if (ds) { showDsub(ds.dataset.dsub); return; }
  const dc = t.closest('[data-ds]'); if (dc) { $$('#diagchips .chip').forEach(c => c.setAttribute('aria-pressed', String(c === dc))); renderDiagList(dc.dataset.ds); }
});
$('#tabbar').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
$('#tabbar').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const tabs = ['sistemas', 'piezas', 'sensores', 'datos'], i = tabs.indexOf(tab), n = tabs[(i + (e.key === 'ArrowRight' ? 1 : 3)) % 4];
  e.preventDefault(); showTab(n); $(`#tabbar [data-tab="${n}"]`).focus();
});
// enlaces internos desde cualquier parte (por ejemplo, la leyenda de precisión)
document.addEventListener('click', e => {
  const n = e.target.closest('[data-nav]'); if (!n) return;
  e.preventDefault(); const [t, sub] = n.dataset.nav.split(':');
  showTab(t); if (t === 'datos' && sub) showDsub(sub);
  if (isMobile()) setSheet('full');
});
$('[data-home]').addEventListener('click', e => { e.preventDefault(); goHome(); });
$('#focuspill button').addEventListener('click', () => {
  const top = stack[stack.length - 1];
  if (top && top.t === 'sys') back(); else setFocus(null);
});

// ═══════════ Hoja deslizable (celular) ═══════════
let sheet = 'peek';
const PEEK = 70;
function sheetH(st) {
  const top = $('.stage').getBoundingClientRect().top, tabH = $('#tabbar').offsetHeight;
  const room = window.innerHeight - top - tabH;          // alto disponible entre la barra superior y las pestañas
  return st === 'peek' ? PEEK : st === 'half' ? Math.round(room * 0.5) : room - 6;
}
function setSheet(st) {
  if (!isMobile()) return;
  sheet = st; panel.dataset.sheet = st;
  const hh = sheetH(st);
  root.style.setProperty('--sheet-h', hh + 'px');
  root.style.setProperty('--sheet-v', (st === 'full' ? sheetH('half') : hh) + 'px');
}
{
  let drag = null;
  const start = e => {
    if (!isMobile() || e.button > 0 || e.target.closest('button:not(.grip), a, input, select')) return;
    drag = { y: e.clientY, h: panel.offsetHeight, t: performance.now(), moved: false, id: e.pointerId };
  };
  const move = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = drag.y - e.clientY;
    if (!drag.moved && Math.abs(dy) < 6) return;
    if (!drag.moved) { drag.moved = true; panel.classList.add('dragging'); try { panel.setPointerCapture(e.pointerId); } catch (_) {} }
    const hh = Math.max(PEEK, Math.min(sheetH('full'), drag.h + dy));
    root.style.setProperty('--sheet-h', hh + 'px');
  };
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; panel.classList.remove('dragging');
    if (!d.moved) { setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'half'); return; }
    const cur = panel.offsetHeight, v = (d.h - cur) / Math.max(1, performance.now() - d.t);   // >0 bajando
    const snaps = ['peek', 'half', 'full'].map(s => [s, sheetH(s)]);
    let best = snaps.reduce((a, b) => (Math.abs(b[1] - cur) < Math.abs(a[1] - cur) ? b : a))[0];
    if (v > 0.6) best = cur > sheetH('half') ? 'half' : 'peek'; else if (v < -0.6) best = cur < sheetH('half') ? 'half' : 'full';
    setSheet(best);
  };
  for (const el of [$('#grip'), pview]) {
    el.addEventListener('pointerdown', e => { if (el === pview && !e.target.closest('.vhead')) return; start(e); });
  }
  panel.addEventListener('pointermove', move);
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);
  $('#grip').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'peek'); } });
  const sync = () => { if (isMobile()) setSheet(sheet); else { root.style.removeProperty('--sheet-h'); root.style.removeProperty('--sheet-v'); } };
  mq.addEventListener('change', sync); window.addEventListener('resize', sync);
  sync();
}

// ═══════════ Barra de herramientas del visor ═══════════
function pressSeg(el, v) { el.querySelectorAll('button[data-v]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === v))); }
function segGroup(el, cb) { el.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; pressSeg(el, b.dataset.v); cb(b.dataset.v); }); }
let openPop = null;
function closePop() {
  if (!openPop) return;
  $('#pop-' + openPop).hidden = true; $(`#dock [data-pop="${openPop}"]`).setAttribute('aria-expanded', 'false'); openPop = null;
}
function togglePop(name, btn) {
  if (openPop === name) { closePop(); return; }
  closePop();
  const pop = $('#pop-' + name); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); openPop = name;
  const vr = viewerEl.getBoundingClientRect(), br = btn.getBoundingClientRect(), w = pop.offsetWidth;
  pop.style.left = Math.max(8, Math.min(vr.width - w - 8, br.left - vr.left + br.width / 2 - w / 2)) + 'px';
}
$('#dock').addEventListener('click', e => { const b = e.target.closest('[data-pop]'); if (b) togglePop(b.dataset.pop, b); });
document.addEventListener('pointerdown', e => { if (openPop && !e.target.closest('.pop, #dock')) closePop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

const VIEWS = {
  van: [['iso', '3/4'], ['lado', 'Lado conductor'], ['frente', 'Frente'], ['atras', 'Atrás'], ['arriba', 'Arriba'], ['abajo', 'Abajo']],
  eng: [['iso', '3/4'], ['escape', 'Lado escape'], ['admision', 'Lado admisión'], ['frente', 'Frente'], ['arriba', 'Arriba'], ['abajo', 'Abajo']],
};
function renderViews(m) { $('#tb-view').innerHTML = VIEWS[m].map(([v, t], i) => `<button type="button" data-v="${v}" aria-pressed="${i === 0}">${t}</button>`).join(''); }
const COLORNOTE = { real: 'Los colores de verdad de cada pieza.', sys: 'Cada sistema con su color, el mismo de la pestaña Sistemas.', qual: 'Azul = confirmado, gris = catálogo, naranjo = estimado.' };
const run = $('#tb-run');
const syncRun = () => { const on = viewer.isRunning(); run.innerHTML = (on ? IC.pause : IC.play) + `<span>${on ? 'Pausar' : 'Arrancar'}</span>`; run.setAttribute('aria-pressed', String(on)); run.setAttribute('aria-label', on ? 'Pausar el motor' : 'Arrancar el motor'); };

function setMode(m, focusPart) {
  if (!viewer) return;
  closePop();
  viewer.setMode(m);
  $$('#modebar [data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  $$('[data-only]').forEach(el => el.hidden = el.dataset.only !== m);
  renderViews(m);
  $('#tb-explode').value = 0; $('#tb-explode-v').textContent = '0 %';
  hud.hidden = m !== 'eng'; viewerEl.classList.toggle('is-eng', m === 'eng');
  if (m === 'eng') renderHud(viewer.state.theta, true);
  stack = stack.filter(en => en.t !== 'part');
  if (focusSys && !sysAvailable(focusSys)) { stack = stack.filter(en => en.t !== 'sys'); setFocus(null); } else if (focusSys) viewer.setFocus(focusSys);
  built.sistemas = false; render();
  if (m === 'eng' && !focusPart) toast('Motor F10A en su lugar, sin carrocería. Abre Capas → Corte para verlo por dentro y Arrancar para ponerlo en marcha.');
  if (focusPart) setTimeout(() => viewer.select(focusPart), reduced ? 0 : 750);
}
$('#modebar').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b && b.dataset.mode !== mode()) setMode(b.dataset.mode); });

if (viewer) {
  segGroup($('#tb-body'), v => viewer.setBody(v));
  segGroup($('#tb-color'), v => { viewer.setColorMode(v); $('#qlegend').hidden = v !== 'qual'; $('#colornote').textContent = COLORNOTE[v]; });
  segGroup($('#tb-view'), v => viewer.setView(v));
  segGroup($('#tb-cut'), v => viewer.setCut(v));
  segGroup($('#tb-speed'), v => viewer.setSpeed(+v));
  run.addEventListener('click', () => { viewer.setRunning(!viewer.isRunning()); syncRun(); }); syncRun();
  $('#tb-explode').addEventListener('input', e => { viewer.setExplode(+e.target.value / 100); $('#tb-explode-v').textContent = e.target.value + ' %'; });
  $('#tb-labels').addEventListener('change', e => viewer.setLabels(e.target.checked));
  $('#tb-rack').addEventListener('change', e => viewer.setRack(e.target.checked));
  $('#tb-angle').addEventListener('input', e => { if (viewer.isRunning()) { viewer.setRunning(false); syncRun(); } viewer.stepTo(+e.target.value); });
  renderViews('van');
}
try { $('#qlegend-keys').append(qualityLegend()); } catch (err) { console.error(err); }

// ——— tiempos de cada cilindro (vista Motor) ———
let hudLast = '';
function renderHud(theta, force) {
  const deg = ((theta * 180 / Math.PI) % 720 + 720) % 720;
  const ph = [0, 1, 2, 3].map(i => phaseOf(cyclePhi(deg, i)));
  const key = ph.join('') + Math.round(deg / 4);
  if (!force && key === hudLast) return; hudLast = key;
  hud.innerHTML = `<span class="hud-a">${Math.round(deg)}°</span>` + ph.map((p, i) => `<span class="hud-c" style="--c:${PHASES[p].color}"><b>${i + 1}</b>${PHASES[p].name}</span>`).join('');
  const ang = $('#tb-angle'); if (ang && document.activeElement !== ang) ang.value = Math.round(deg);
  $('#tb-angle-v').textContent = Math.round(deg) + '°';
}

// ═══════════ Acerca de ═══════════
const about = $('#about');
$('#helpbtn').addEventListener('click', () => { if (about.showModal) about.showModal(); else about.setAttribute('open', ''); });
about.addEventListener('click', e => { if (e.target === about || e.target.closest('[data-close-about]')) about.close(); });

// ═══════════ Animación de los esquemas ═══════════
let last = performance.now(), acc = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (activeDiag && !vDetail.hidden && !document.hidden) {
    const r = activeDiag.wrap.getBoundingClientRect(), pr = pview.getBoundingClientRect();
    if (r.bottom > pr.top && r.top < pr.bottom && r.height) {
      if (reduced) { acc += dt; if (acc > 0.25) { activeDiag.api.tick(acc); acc = 0; } }
      else activeDiag.api.tick(dt);
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

render();
window.__app = { showTab, openPart, openSys, setSheet, back, get state() { return { tab, stack: stack.map(e => e.t + ':' + e.id), sheet, focus: focusSys }; } };
