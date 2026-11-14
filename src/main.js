import { PARTS, SYSTEMS, SYS, SRC, SPECS, MAINT, DIAG, SENSORS, STATUS } from './data.js';
import { createViewer } from './viewer3d.js';
import { h } from './svgkit.js';
import { PHASES, cyclePhi, phaseOf } from './geom.js';
import { FFAILS, MIXTXT, FK } from './fuelsim.js';
import { DFAILS, GNAME, DK, FINALR, PRIM, gearRatio } from './drivesim.js';
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
import { BK, FAILS } from './brakesim.js';
import { MODES as HMODES, HFAILS, tempColor } from './heatersim.js';

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
  { id: 'frenos', sys: 'frenos', h: 'Cómo funciona: frenos de doble circuito', p: 'El servofreno multiplica la fuerza del pie y la bomba tándem la convierte en presión: la cámara primaria alimenta los discos delanteros y la secundaria los tambores traseros.', mount: frenos },
  { id: 'chasis', sys: 'chasis', h: 'Cómo funciona: dirección y suspensión', p: 'Cremallera adelante; McPherson adelante y paquetes de resortes atrás.', mount: chasis },
];
const DIAG_OF_SYS = { calefaccion: 'refrigeracion' };
const tabOfSys = sys => TABS.find(t => t.id === DIAG_OF_SYS[sys]) || TABS.find(t => t.sys === sys) || null;
const BLURB = {
  motor: 'F10A de 970 cm³ y 4 cilindros, inclinado bajo los asientos', combustible: 'Estanque, bomba, carburador por dentro, acelerador y ahogador', electrico: 'Encendido, carga, partida, luces y tablero',
  refrigeracion: 'Radiador, bomba de agua, ventilador y termostato', lubricacion: 'Bomba, filtro, cárter y bulbo de aceite', escape: 'Múltiple, catalizador, silenciador y cola',
  transmision: 'Embrague, caja de 5 por dentro, palanca, cardán y diferencial', chasis: 'McPherson adelante, resortes atrás y cremallera', frenos: 'Discos adelante, tambores atrás y doble circuito',
  carroceria: 'Furgón ciego, interior, asientos y parrilla', calefaccion: 'Caja, ventilador, toma de aire, salidas y mandos', sensores: 'Los 9 sensores e interruptores, con su cableado',
};
// Cada sistema abre su vista del modelo: los que ya están detallados tienen una propia; el resto se marca sobre el furgón completo.
const SYSVIEW = { motor: 'eng', lubricacion: 'eng', frenos: 'brk', calefaccion: 'cal', combustible: 'ali', transmision: 'tra' };
const MODESYS = { eng: 'motor', brk: 'frenos', cal: 'calefaccion', ali: 'combustible', tra: 'transmision' };
const MODENAME = { eng: 'Motor', brk: 'Frenos', cal: 'Calefacción', ali: 'Alimentación', tra: 'Transmisión' };
const GRID = SYSTEMS.filter(sy => sy.id !== 'sensores');      // los sensores tienen su pestaña y aparecen en el sistema al que sirven

// ═══════════ Visor 3D ═══════════
const viewerEl = $('#viewer'), hud = $('#enghud'), bhud = $('#brkhud'), chud = $('#calhud'), ahud = $('#alihud'), thud = $('#trahud');
let viewer, smap = null, quiet = false, bhKey = '', simKey = '', seqWas = null, chKey = '', csimKey = '', ahKey = '', asimKey = '', thKey = '', tsimKey = '';
try {
  viewer = createViewer(viewerEl, { labelLayer: $('#labels'), onSelect: onViewerSelect, onTick: (th, m) => m === 'eng' && renderHud(th), onBrake: r => onBrake(r), onHeat: r => onHeat(r), onFuel: r => onFuel(r), onDrive: r => onDrive(r) });
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
function setFocus(sys, fly = true) {
  focusSys = sys || null;
  // en la vista Motor, el sistema «Motor» muestra el motor completo; los demás sistemas resaltan sus piezas
  if (viewer) viewer.setFocus(focusSys === 'motor' && mode() === 'eng' ? null : focusSys, { fly });
  syncCrumb();
}
// arriba a la izquierda: dónde se está y cómo volver al furgón completo
function syncCrumb() {
  const c = $('#crumb'), m = mode(), sys = focusSys || MODESYS[m];
  c.hidden = m === 'van' && !focusSys;
  if (c.hidden) return;
  c.style.setProperty('--c', sys ? SYS[sys].color : 'var(--ink)');
  $('#crumb-name').textContent = sys ? SYS[sys].short : MODENAME[m];
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
  if (t === 'sensores' && mode() === 'van') setFocus(sysAvailable('sensores') ? 'sensores' : null); else if (focusSys && mode() === 'van') setFocus(null);
  render();
  if (isMobile() && sheet === 'peek') setSheet('half');
}
function openSys(sys, { anchor } = {}) {
  hideHint();
  if (sys === 'sensores') { showTab('sensores'); return; }
  saveScroll();
  if (stack.some(e => e.t === 'part') && viewer && viewer.state.sel) { quiet = true; viewer.select(null, { fly: false }); quiet = false; }
  stack = stack.filter(e => e.t !== 'part' && !(e.t === 'sys' && e.id === sys));
  stack.push({ t: 'sys', id: sys, scroll: 0, anchor });
  const target = SYSVIEW[sys] || 'van';
  if (viewer && mode() !== target) setMode(target, null, { sys });
  else { setFocus(sys); render(); }
  if (isMobile() && sheet === 'peek') setSheet('half');
}
function back() {
  const top = stack[stack.length - 1]; if (!top) return;
  if (top.t === 'part' && viewer && viewer.state.sel) { viewer.select(null, { fly: false }); return; }   // onViewerSelect hace el resto
  stack.pop();
  if (top.t === 'sys') {
    const below = [...stack].reverse().find(e => e.t === 'sys'), sysB = below ? below.id : (tab === 'sensores' ? 'sensores' : null);
    const target = below ? (SYSVIEW[below.id] || 'van') : 'van';
    if (viewer && mode() !== target) { setMode(target, null, { sys: sysB, keep: true }); return; }
    setFocus(sysB);
  }
  render();
}
// vuelve al furgón completo sin cambiar de pestaña
function toVan() {
  if (viewer && viewer.state.sel) { quiet = true; viewer.select(null, { fly: false }); quiet = false; }
  stack = [];
  if (viewer && mode() !== 'van') setMode('van', null, { keep: true }); else { setFocus(tab === 'sensores' ? 'sensores' : null); render(); }
  if (viewer) viewer.setView('iso');
}
function goHome() {
  if (viewer && viewer.state.sel) { quiet = true; viewer.select(null, { fly: false }); quiet = false; }
  stack = []; tab = 'sistemas';
  if (viewer && mode() !== 'van') setMode('van', null, { keep: true }); else setFocus(null);
  if (viewer) viewer.setView('iso');
  render(); if (isMobile()) setSheet('peek');
}

// selección desde el 3D (tocar una pieza o una etiqueta) o desde las listas
function onViewerSelect(id) {
  if (id) hideHint();
  if (viewer) pressSeg($('#tb-bcut'), viewer.state.bcut ? 'in' : 'none');
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
  const P = PARTS[id], m = mode();
  const home = P.view || (P.deep ? 'eng' : 'van');
  const here = m === 'van' ? home === 'van' : viewer.inMode(id);
  if (here) viewer.select(id); else setMode(viewer.inModeOf(home, id) ? home : 'van', id);
}

// ——— vistas ———
const vhead = (title, sub, withBack) => `<div class="vhead">${withBack ? `<button type="button" class="back" data-back aria-label="Volver">${IC.back}</button>` : ''}<h2>${title}${sub ? `<span class="sub">${sub}</span>` : ''}</h2>${IC.chev}</div>`;
const SPECSTRIP = [['Motor', 'F10A · 970 cm³'], ['Potencia', '41 CV · 30 kW'], ['Caja', '5 vel. + R'], ['Diferencial', '5,125 : 1'], ['Entre ejes', '1.840 mm'], ['Estanque', '37 L']];

function renderSistemas() {
  const m = mode(), cur = focusSys || MODESYS[m];
  const avail = GRID.filter(sy => sysAvailable(sy.id));
  views.sistemas.innerHTML = vhead('Sistemas', 'Toca uno para abrirlo en el modelo') + `
    <div class="idcard"><div class="idtop"><b>Super Carry 1000</b><span>Suzuki SK410 · furgón ciego 1996 · volante a la izquierda</span></div>
      <ul class="specstrip">${SPECSTRIP.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul></div>
    <div class="sysgrid">${avail.map(sy => {
      const own = Object.keys(PARTS).filter(id => PARTS[id].sys === sy.id && inWorld(id)).length;
      const guests = Object.keys(PARTS).filter(id => PARTS[id].sys !== sy.id && matchFocus(PARTS[id], sy.id) && inWorld(id)).length;
      return `<button type="button" class="syscard${sy.id === cur ? ' on' : ''}" data-sys="${sy.id}" style="--c:${sy.color}"><b>${sy.short}</b><span>${BLURB[sy.id] || ''}</span><span>${plural(own, 'pieza', 'piezas')}${guests ? ` + ${guests} de otros sistemas` : ''}</span>${SYSVIEW[sy.id] ? '<em class="dv">Vista detallada</em>' : ''}</button>`;
    }).join('')}</div>
    <p class="muted sysnote">Cada pieza pertenece a un solo sistema, según para qué existe, y puede aparecer como invitada en otros: el radiador de calefacción es de Calefacción y participa en Refrigeración. Los sistemas con <b>vista detallada</b> se abren solos, con sus mandos; el resto se marca sobre el furgón completo.</p>`;
}

function rowHTML(id, guestOf) {
  const P = PARTS[id], tags = [];
  if (guestOf && P.sys !== guestOf && P.sys !== 'sensores') tags.push(`<span class="tg own" style="--c:${SYS[P.sys].color}">de ${SYS[P.sys].short}</span>`);
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
  let out = SYSTEMS.map(sy => { const ids = hits.filter(id => PARTS[id].sys === sy.id); return ids.length ? `<div class="group"><h4 style="--c:${sy.color}"><i></i>${sy.name}</h4><div class="rows">${ids.map(id => rowHTML(id)).join('')}</div></div>` : ''; }).join('');
  if (more.length) out += `<div class="group"><h4>También mencionan “${q.trim()}”</h4><div class="rows">${more.map(id => rowHTML(id)).join('')}</div></div>`;
  $('#plist').innerHTML = out || `<p class="empty">No hay piezas con “${q.trim()}”. Prueba con otra palabra, como “bomba”, “filtro” o “sensor”.</p>`;
}

function renderSensores() {
  views.sensores.innerHTML = vhead('Sensores', `${SENSORS.length} sensores e interruptores · se marcan en el modelo`) + `
    <p class="lead">Dónde está cada uno, qué detecta y adónde manda su señal. Este furgón no tiene computador de inyección: casi todo avisa directo al tablero.</p>
    <figure class="fig smapfig"><div id="senmap"></div><figcaption>Toca un número para abrir su ficha. Los sensores 3 y 4 eran del sistema catalítico original: con el carburador actual ya no influyen.</figcaption></figure>
    <div class="group"><h4>Lista</h4><div class="rows">${SENSORS.map(id => rowHTML(id)).join('')}</div></div>`;
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
  const m0 = mode(), goes = [];
  if (viewer) {
    for (const [mm, nm] of [['ali', 'Alimentación'], ['tra', 'Transmisión'], ['brk', 'Frenos'], ['cal', 'Calefacción'], ['eng', 'Motor']]) if (m0 !== mm && viewer.inModeOf(mm, id)) goes.push(`<button type="button" class="btn ghost" data-mode-go="${mm}" data-part-go="${id}">Ver en la vista ${nm}</button>`);
    if (m0 !== 'van' && !P.deep) goes.push(`<button type="button" class="btn ghost" data-mode-go="van" data-part-go="${id}">Ver en el furgón</button>`);
  }
  const others = [...new Set([P.serves, ...(P.also || [])].filter(x => x && x !== P.sys && x !== 'sensores'))];
  const alsoIn = others.length ? `<p class="alsoin">Pertenece a <b>${SYS[P.sys].name}</b> y también participa en ${others.map(x => `<button type="button" class="lk" data-opensys="${x}" style="--c:${SYS[x].color}">${SYS[x].short}</button>`).join(' y ')}.</p>` : '';
  vDetail.innerHTML = vhead(P.name, SYS[P.sys].name + (S ? ` · sensor ${S.n}` : ''), true) + `
    <div class="card-head">${sysChip(P.sys)}${P.serves ? sysChip(P.serves) : ''}${P.approx ? '<span class="approx">ubicación aprox.</span>' : ''}</div>
    <p class="lead">${P.desc}</p>
    ${alsoIn}
    ${sensorBlock}
    <h4>Datos técnicos</h4><dl class="kv">${kvRows(P.d)}</dl>
    <h4>Mantención</h4><ul class="ticks">${P.m.map(x => `<li>${x}</li>`).join('')}</ul>
    <h4>Fallas típicas</h4><ul class="warns">${P.f.map(x => `<li>${x}</li>`).join('')}</ul>
    ${qualityCardHTML(id)}
    <div class="btnrow">${how ? `<button type="button" class="btn" data-opensys="${how.sys}" data-anchor="s-diag">Cómo funciona</button>` : ''}${goes.join('')}</div>`;
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
  const all = Object.keys(PARTS).filter(id => inWorld(id));
  const own = all.filter(id => PARTS[id].sys === sys);
  const sens = all.filter(id => PARTS[id].sys !== sys && PARTS[id].serves === sys);
  const guests = all.filter(id => PARTS[id].sys !== sys && PARTS[id].serves !== sys && (PARTS[id].also || []).includes(sys));
  const tb = tabOfSys(sys), specs = SPECS.find(sp => sp.sys === sys), maint = MAINT.filter(m => m.sys === sys), faults = DIAG.filter(d => d.sys === sys);
  const J = [['s-piezas', 'Piezas'], tb && ['s-diag', 'Cómo funciona'], specs && ['s-datos', 'Datos'], maint.length && ['s-mant', 'Mantención'], faults.length && ['s-fallas', 'Fallas']].filter(Boolean);
  const m = mode(), sim = { frenos: ['brk', 'brksim', ''], calefaccion: ['cal', 'calsim', ' cal'], combustible: ['ali', 'alisim', ' ali'], transmision: ['tra', 'trasim', ' tra'] }[sys];
  const where = SYSVIEW[sys] ? (m === SYSVIEW[sys] ? 'vista detallada' : 'tiene vista detallada') : 'marcadas en el modelo';
  vDetail.innerHTML = vhead(SYS[sys].name, `${plural(own.length, 'pieza', 'piezas')} · ${where}`, true) + `
    <p class="lead">${tb && tb.sys === sys ? tb.p : (BLURB[sys] || '') + '.'}</p>
    ${sim ? (m === sim[0] ? `<div class="simbox${sim[2]}" id="${sim[1]}"></div>` : `<p><button type="button" class="btn sm" data-sys="${sys}">Abrir su vista en 3D</button></p>`) : ''}
    ${SYSVIEW[sys] === 'eng' && m !== 'eng' ? `<p><button type="button" class="btn sm" data-sys="${sys}">Abrir la vista del motor</button></p>` : ''}
    <nav class="jumps" aria-label="Ir a">${J.map(([a, t]) => `<a href="#${a}" data-jump="${a}">${t}</a>`).join('')}</nav>
    <div class="sect" id="s-piezas"><h3>Piezas</h3><div class="rows">${own.map(id => rowHTML(id)).join('')}</div>
      ${sens.length ? `<h4 class="subh">Sensores de este sistema</h4><div class="rows">${sens.map(id => rowHTML(id)).join('')}</div>` : ''}
      ${guests.length ? `<h4 class="subh">También participan</h4><p class="muted">Piezas de otros sistemas que trabajan con éste. Cada una tiene una sola ficha, en su sistema.</p><div class="rows">${guests.map(id => rowHTML(id, sys)).join('')}</div>` : ''}</div>
    ${tb ? `<div class="sect" id="s-diag"><h3>${tb.h.replace('Cómo funciona: ', 'Cómo funciona · ')}</h3>${tb.sys !== sys ? `<p class="muted">${tb.p}</p>` : ''}<div class="diag-slot"></div>${tb.eng3d ? '<p><button type="button" class="btn ghost sm" data-eng3d>Ver el motor en 3D, por dentro</button></p>' : ''}</div>` : ''}
    ${specs ? `<div class="sect" id="s-datos"><h3>Datos técnicos</h3><dl class="kv">${kvRows(specs.rows)}</dl></div>` : ''}
    ${maint.length ? `<div class="sect" id="s-mant"><h3>Mantención</h3><div class="mlist">${maint.map(maintHTML).join('')}</div></div>` : ''}
    ${faults.length ? `<div class="sect" id="s-fallas"><h3>Si algo falla</h3><div class="dcards">${faults.map(diagHTML).join('')}</div></div>` : ''}`;
  if (tb) { const d = diagFor(tb); $('.diag-slot', vDetail).append(d.wrap); activeDiag = d; }
  if ($('#brksim')) { simKey = ''; viewer && updateSim(viewer.brake()); }
  if ($('#calsim')) { csimKey = ''; viewer && updateCalSim(viewer.heat()); }
  if ($('#alisim')) { asimKey = ''; viewer && updateAliSim(viewer.fuel()); }
  if ($('#trasim')) { tsimKey = ''; viewer && updateTraSim(viewer.drive()); }
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
        <p><b>Qué es aproximado:</b> la forma de las piezas en el 3D y la posición de las marcadas “aprox.” (estanque, radiador, catalizador, silenciador, controlador y varios sensores). La calefacción sigue el despiece del manual y las fotos de la caja, pero sus cotas internas y el recorrido de las mangueras son aproximados. En el motor, el largo de biela, el ángulo de las válvulas, la forma de los balancines y el ángulo exacto del distribuidor son aproximados.</p>
        <p><b>Alimentación:</b> el orden estanque → filtro → bomba → carburador, el retorno, la línea de vapores, la bomba y el filtro en el larguero derecho, los circuitos del carburador y sus ajustes salen del manual; el pedal del acelerador, la perilla del ahogador, el filtro de aire y el cánister, de las fotos. La posición del estanque, el recorrido de las líneas y de las piolas y el interior del carburador son aproximados, y las rpm, el vacío, la mezcla y el consumo de la vista Alimentación son valores típicos.</p>
        <p><b>Bajo los asientos:</b> el motor, el radiador, los depósitos, el filtro de aire, el cánister y los apoyos de la suspensión se ubicaron con las dos fotos tomadas levantando los asientos; la manilla de la varilla del aceite es la argolla que el dueño señaló en una de ellas. La inclinación de los puntales es una estimación a partir de esas fotos.</p>
        <p><b>Transmisión:</b> salen del manual el embrague de diafragma con su disco de cuatro amortiguadores, el orden de los engranajes en los tres ejes de la caja con sus dientes y relaciones, los tres sincronizadores, el mando por dos cables, el cardán de una pieza con yugo deslizante, el diferencial hipoide en portador desmontable y los ajustes y aprietes. La rejilla de la palanca es la que indica el dueño. Son aproximados la distancia entre ejes de la caja, la forma de las carcasas, el selector por dentro, las palancas donde llegan los cables, el largo del cardán y los dientes de satélites y planetarios; los 41/8 dientes de corona y piñón se deducen de la relación 5,125. En la vista Transmisión, par, masa, roce y capacidad del embrague son valores típicos.</p>
        <p><b>Frenos:</b> discos, tambores, pastillas, balatas, pistón del caliper, recorrido del pedal y freno de mano siguen el manual, y el depósito está donde se ve en las fotos. La posición del servo, la bomba, la junta de 5 vías y la válvula DSP es aproximada. La vista Frenos usa valores típicos (palanca del pedal, ayuda del servo, diámetro de la bomba y de los cilindros de rueda, roce) para mostrar las proporciones, no para calcular un frenado real.</p>
        <p><b>Calefacción:</b> el tipo (agua caliente), el ventilador de 3 velocidades con su resistencia, la llave de agua por cable y las piezas de la caja salen del manual; la forma de la caja, los mandos, el tubo blanco al desempañador, la admisión con su rejilla y su esponja, la entrada del aire exterior por abajo de la admisión y las salidas, de las fotos y de lo que cuenta el dueño. El interior de la caja, las compuertas, dónde nace el tubo de la rejilla del extremo derecho, el ducto que lleva aire al parabrisas del lado del copiloto y los recorridos dentro del tablero son aproximados, y las temperaturas de la vista Calefacción son valores típicos.</p>
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
  const mg = t.closest('[data-mode-go]'); if (mg) { if (mg.dataset.modeGo !== mode() || mg.dataset.partGo) setMode(mg.dataset.modeGo, mg.dataset.partGo); return; }
  const jp = t.closest('[data-jump]'); if (jp) { e.preventDefault(); const a = $('#' + jp.dataset.jump, vDetail); a && a.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); return; }
  if (t.closest('[data-eng3d]')) { if (mode() !== 'eng') setMode('eng', null, { keep: true }); if (viewer) { viewer.setCut('long'); pressSeg($('#tb-cut'), 'long'); } return; }
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
$('#crumb-back').addEventListener('click', toVan);

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
  brk: [['iso', '3/4'], ['lado', 'Lado conductor'], ['ruedadel', 'Rueda delantera'], ['ruedatras', 'Rueda trasera'], ['pedal', 'Pedal y bomba'], ['arriba', 'Arriba'], ['abajo', 'Abajo']],
  cal: [['iso', '3/4'], ['cabina', 'Desde la cabina'], ['caja', 'Caja por dentro'], ['mandos', 'Mandos'], ['admision', 'Toma de aire'], ['arriba', 'Arriba']],
  tra: [['iso', '3/4'], ['embrague', 'Embrague por dentro'], ['caja', 'Caja por dentro'], ['selector', 'Selector y cables'], ['palanca', 'Palanca'], ['cardan', 'Cardán'], ['dif', 'Diferencial por dentro'], ['arriba', 'Arriba'], ['abajo', 'Abajo']],
  ali: [['iso', '3/4'], ['carb', 'Carburador por dentro'], ['palancas', 'Palancas y piolas'], ['estanque', 'Estanque y bomba'], ['pedal', 'Pedal y ahogador'], ['arriba', 'Arriba'], ['abajo', 'Abajo']],
};
function renderViews(m) { $('#tb-view').innerHTML = VIEWS[m].map(([v, t], i) => `<button type="button" data-v="${v}" aria-pressed="${i === 0}">${t}</button>`).join(''); }
const COLORNOTE = { real: 'Los colores de verdad de cada pieza.', sys: 'Cada sistema con su color, el mismo de la pestaña Sistemas.', qual: 'Azul = confirmado, gris = catálogo, naranjo = estimado.' };
const run = $('#tb-run');
const syncRun = () => { if (!viewer) return; const on = viewer.isRunning(); run.innerHTML = (on ? IC.pause : IC.play) + `<span>${on ? 'Pausar' : 'Arrancar'}</span>`; run.setAttribute('aria-pressed', String(on)); run.setAttribute('aria-label', on ? 'Pausar el motor' : 'Arrancar el motor'); };

const BCUTNOTE = {
  brk: 'Abre el caliper, el tambor, el cilindro de rueda, la bomba, el servo y la válvula DSP.',
  cal: 'Abre la caja por el lado del conductor (ventilador, radiador y compuertas) y deja transparentes la caja de admisión y la llave de agua.',
  tra: 'Abre la campana del embrague y la caja por el lado del conductor, y el puente trasero por arriba.',
  ali: 'Abre el carburador por la mitad (se mira desde el frente) y deja transparentes el estanque, la bomba, el filtro de aire, el cánister y la tapa del pedal.',
};
const MODETOAST = {
  eng: ['Motor F10A en su lugar. Capas → Corte lo abre; Arrancar lo pone en marcha.', 'Motor F10A en su lugar, sin carrocería. Abre Capas → Corte para verlo por dentro y Arrancar para ponerlo en marcha.'],
  brk: ['Pisar aprieta el pedal; Taller simula fallas, desgaste y freno de mano.', 'Los frenos solos, en su lugar. Pisar aprieta el pedal y la presión pinta cada cañería; Taller simula fallas, desgaste y el freno de mano; Capas → Cortes los abre por dentro.'],
  cal: ['Mandos cambia la salida del aire, la temperatura y el ventilador.', 'La calefacción sola, en su lugar. En Mandos mueves las mismas palancas del tablero y ves por dónde entra y sale el aire; Taller simula fallas; Capas → Cortes abre la caja.'],
  tra: ['Cambios: pasa las marchas y mira qué engranajes llevan la fuerza.', 'El tren motriz solo, del embrague a las ruedas, abierto en corte. En Cambios enciendes el motor, pasas las marchas y pisas el embrague: lo que lleva la fuerza se pinta naranjo. Taller simula fallas, una curva y una rueda sin agarre.'],
  ali: ['Acelerador mueve el pedal y el ahogador; Vista → Carburador por dentro lo abre.', 'La alimentación sola, del estanque al carburador. En Acelerador pisas el pedal y tiras el ahogador; Vista → Carburador por dentro lo muestra en corte; Taller simula fallas.'],
};
// m: vista del modelo · focusPart: pieza a mostrar · opt.sys: sistema que la abre · opt.keep: no tocar la pila de fichas
function setMode(m, focusPart, opt = {}) {
  if (!viewer) return;
  closePop();
  if (m === mode() && !focusPart) return;
  const changed = m !== mode();
  viewer.setMode(m);
  $$('[data-only]').forEach(el => el.hidden = !el.dataset.only.split(' ').includes(m));
  renderViews(m);
  $('#tb-explode').value = 0; $('#tb-explode-v').textContent = '0 %';
  hud.hidden = m !== 'eng'; bhud.hidden = m !== 'brk'; chud.hidden = m !== 'cal'; ahud.hidden = m !== 'ali'; thud.hidden = m !== 'tra';
  viewerEl.classList.toggle('is-eng', m === 'eng'); viewerEl.classList.toggle('is-brk', m === 'brk' || m === 'cal' || m === 'ali' || m === 'tra');
  $('#tb-bcut-note').textContent = BCUTNOTE[m] || '';
  pressSeg($('#tb-bcut'), viewer.state.bcut ? 'in' : 'none');
  if (m === 'eng') renderHud(viewer.state.theta, true);
  syncRun(); syncPress(); syncHeat(); syncFuel(); syncDrive();
  stack = stack.filter(en => en.t !== 'part');
  // qué sistema queda abierto: el que pidió la vista o, si se llegó por una pieza o un botón, el dueño de la vista
  let sys = opt.sys !== undefined ? opt.sys : (stack.length && stack[stack.length - 1].t === 'sys' ? stack[stack.length - 1].id : null);
  if (m !== 'van' && !opt.keep && !(sys && SYSVIEW[sys] === m)) {
    sys = focusPart && SYSVIEW[PARTS[focusPart].sys] === m ? PARTS[focusPart].sys : MODESYS[m];
    saveScroll(); tab = 'sistemas'; stack = [{ t: 'sys', id: sys, scroll: 0 }];
  }
  if (m === 'van' && !opt.keep) { stack = stack.filter(en => !(en.t === 'sys' && SYSVIEW[en.id])); sys = stack.length ? stack[stack.length - 1].id : null; }
  setFocus(sys && sysAvailable(sys) ? sys : null, false);
  if (m === 'brk') { bhKey = ''; onBrake(viewer.brake()); }
  if (m === 'cal') { chKey = ''; viewer.heat({ on: true }); syncHeat(); onHeat(viewer.heat()); }
  if (m === 'ali') { ahKey = ''; viewer.fuel({ on: true, pedal: 0 }); syncFuel(); onFuel(viewer.fuel()); }
  if (m === 'tra') { thKey = ''; resetDriveUI(); onDrive(viewer.drive()); }
  built.sistemas = false; render();
  if (changed && !focusPart && MODETOAST[m]) toast(MODETOAST[m][isMobile() ? 0 : 1], 7000);
  if (focusPart) setTimeout(() => viewer.select(focusPart), reduced ? 0 : 750);
}

if (viewer) {
  segGroup($('#tb-body'), v => viewer.setBody(v));
  segGroup($('#tb-color'), v => { viewer.setColorMode(v); $('#qlegend').hidden = v !== 'qual'; $('#colornote').textContent = COLORNOTE[v]; });
  segGroup($('#tb-view'), v => viewer.setView(v));
  segGroup($('#tb-cut'), v => viewer.setCut(v));
  segGroup($('#tb-speed'), v => viewer.setSpeed(+v));
  run.addEventListener('click', () => { viewer.setRunning(!viewer.isRunning()); syncRun(); }); syncRun();
  $('#tb-explode').addEventListener('input', e => { viewer.setExplode(+e.target.value / 100); $('#tb-explode-v').textContent = e.target.value + ' %'; });
  $('#tb-labels').addEventListener('change', e => viewer.setLabels(e.target.checked));
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

// ═══════════ Vista Frenos: pedal, fallas, desgaste y freno de mano ═══════════
function nf(n, d = 0) { return Number.isFinite(n) ? n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'; }
function kgOf(n) { return Math.round(n / 9.81); }
function mixHex(a, b, t) {
  const pa = a.match(/\w\w/g).map(x => parseInt(x, 16)), pb = b.match(/\w\w/g).map(x => parseInt(x, 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function pcol(p) { return mixHex('8a6a4f', 'd9341f', Math.min(1, p / 60)); }
function syncPress() {
  const b = $('#tb-press'); if (!b || !viewer) return;
  const on = viewer.brakeState.on;
  b.setAttribute('aria-pressed', String(on)); b.querySelector('span').textContent = on ? 'Soltar' : 'Pisar';
  b.setAttribute('aria-label', on ? 'Soltar el pedal de freno' : 'Pisar el pedal de freno');
}
function onBrake(r) {
  if (!r || mode() !== 'brk') return;
  // fin de una frenada de prueba
  if (seqWas && !r.seq && viewer.brakeState.lastResult) {
    const q = viewer.brakeState.lastResult;
    toast(q.stopped ? `Se detuvo en ${nf(q.dist, 1)} m frenando con ${kgOf(r.target)} kg de pie.` : `Después de 9 s seguía a ${nf(q.v * 3.6)} km/h: con esta falla casi no frena.`, 6000);
  }
  seqWas = r.seq;
  const key = [r.seq, Math.round(r.v * 3.6), Math.round(r.force), Math.round(r.pf), Math.round(r.pr), Math.round(r.a * 100), r.lockF, r.lockR, r.dsp, r.floor, r.fail, Math.round(r.wear.pad * 10), r.hb.notches, r.hb.stretched].join('|');
  if (key !== bhKey) { bhKey = key; renderBhud(r); }
  updateSim(r);
}
function renderBhud(r) {
  const chips = [];
  if (r.seq) chips.push(`<span class="bh v"><small>Velocidad</small><b>${nf(r.v * 3.6)} km/h</b></span>`);
  chips.push(`<span class="bh"><small>Pie</small><b>${kgOf(r.force)} kg</b></span>`);
  chips.push(`<span class="bh p" style="--c:${pcol(r.pf)}"><small>Adelante</small><b>${nf(r.pf)} bar</b></span>`);
  chips.push(`<span class="bh p" style="--c:${pcol(r.pr)}"><small>Atrás</small><b>${nf(r.pr)} bar</b></span>`);
  chips.push(`<span class="bh"><small>Frena</small><b>${nf(r.a, 2)} g</b></span>`);
  if (r.force > 0.5) chips.push(`<span class="bh"><small>Para en</small><b>${Number.isFinite(r.dist) && r.dist < 400 ? nf(r.dist) + ' m' : '—'}</b></span>`);
  let line;
  if (r.force > 0.5) {
    const dist = Number.isFinite(r.dist) && r.dist < 400 ? `Desde 50 km/h se detendría en ${nf(r.dist)} m` : 'Casi no frena';
    line = `${dist} · el pedal baja ${nf(r.travel)} mm y queda a ${nf(r.reserve)} mm del piso`;
  } else line = 'Pedal suelto: toca <b>Pisar</b>, o <b>Pedal → Frenada desde 50 km/h</b>';
  const tags = [];
  if (r.lockF) tags.push('<span class="bt w">Se bloquean las delanteras</span>');
  if (r.lockR) tags.push('<span class="bt w">Se bloquean las traseras</span>');
  if (r.floor) tags.push('<span class="bt w">Pedal a fondo</span>');
  if (r.force > 0 && r.reserve < BK.reserveMin && !r.floor) tags.push(`<span class="bt w">A menos de ${BK.reserveMin} mm del piso</span>`);
  if (r.fail !== 'ok') tags.push(`<span class="bt f">${FAILS[r.fail].name}</span>`);
  if (r.dsp) tags.push('<span class="bt i">La válvula DSP limita atrás</span>');
  if (r.wear.metal) tags.push('<span class="bt w">Metal contra metal</span>');
  if (r.hb.notches > 0) tags.push(`<span class="bt i">Freno de mano: ${r.hb.notches} ${r.hb.notches === 1 ? 'muesca' : 'muescas'}${r.hb.e > 0 ? ` · sostiene ~${nf(r.hb.grade)} %` : ' · aún suelto'}</span>`);
  bhud.innerHTML = `<div class="bh-row">${chips.join('')}</div><p class="bh-line">${line}</p>${tags.length ? `<div class="bh-tags">${tags.join('')}</div>` : ''}`;
}
const FAILTXT = {
  ok: 'Los dos circuitos están sanos. La cámara primaria de la bomba manda presión a los discos delanteros y la secundaria a los tambores traseros. En una frenada fuerte, la válvula DSP hace que la presión de atrás suba más lento para que las ruedas traseras no se bloqueen primero.',
  del: 'Circuito delantero cortado: el pistón primario avanza sin encontrar resistencia hasta tocar al secundario y lo empuja directo. El pedal baja más y sólo frenan los tambores: la distancia de frenado se multiplica. Por eso existe el doble circuito: una fuga no deja el furgón sin frenos.',
  tras: 'Circuito trasero cortado: el pistón secundario avanza hasta el fondo de la bomba y recién ahí el primario da presión. Frenan sólo los discos delanteros, que de todas formas hacen la mayor parte del trabajo, y el pedal baja más.',
  aire: 'Aire en las cañerías: el aire se comprime antes que el líquido, así que el pedal se siente esponjoso y baja mucho más para lograr la misma presión. Se corrige purgando, empezando por la rueda más lejana a la bomba (manual).',
  vacio: 'Servofreno sin vacío (manguera suelta o motor detenido): a la bomba sólo llega la fuerza del pie por la palanca del pedal. El pedal se pone duro y hay que pisar mucho más fuerte para frenar igual, pero el freno sigue funcionando (manual).',
};
function updateSim(r) {
  const box = $('#brksim'); if (!box || !r) return;
  const ws = r.wear, hb = r.hb;
  const key = [r.fail, Math.round(ws.pad * 10), hb.notches, hb.stretched, r.dsp, r.lockF, r.lockR].join('|');
  if (key === simKey) return; simKey = key;
  const lim = (v, min, u = 'mm') => `${nf(v, 1)} ${u}${v < min ? ' <b class="bad">bajo el mínimo</b>' : ''}`;
  const wearTxt = ws.metal ? 'Las pastillas pasaron el mínimo: el respaldo de acero roza el disco, chirría y frena menos.'
    : ws.padLow || ws.liningLow ? 'Llegaron al límite del manual: hay que cambiarlas.' : 'Dentro de lo que permite el manual.';
  const hbTxt = hb.notches === 0 ? 'Suelto.' : hb.e === 0 ? 'Todavía no aprieta: el cable recién se está estirando.'
    : `Con ${hb.notches} muescas sostiene el furgón en una pendiente de hasta ~${nf(hb.grade)} %.`;
  box.innerHTML = `<h4>Lo que muestra el modelo</h4>
    <p>${FAILTXT[r.fail]}</p>
    <dl class="kv">
      <div><dt>Pastillas</dt><dd>${lim(ws.pad, BK.pad[1])} (nuevas 15,5 · mín. 6,5)</dd></div>
      <div><dt>Balatas</dt><dd>${lim(ws.lining, BK.lining[1])} (nuevas 7,0 · mín. 3,0)</dd></div>
      <div><dt>Disco</dt><dd>${lim(ws.disc, BK.disc[1])} (nuevo 10 · mín. 8,5)</dd></div>
      <div><dt>Depósito</dt><dd>${ws.level > 0.05 ? `${nf(ws.level * 100)} % entre MIN y MAX` : 'En el MIN'} · bajó ${nf(ws.drop)} mL por el desgaste</dd></div>
      <div><dt>Freno de mano</dt><dd>${hbTxt} ${hb.outOfSpec ? '<b class="bad">Pasa de 8 muescas: ajustar el cable (manual).</b>' : 'El manual pide 3 a 8 muescas con 20 kg.'}</dd></div>
    </dl>
    <p class="muted">${wearTxt} A medida que se gastan pastillas y balatas, los pistones quedan más afuera y el nivel del depósito baja: un descenso leve es normal; uno rápido es una fuga (manual).</p>
    <p class="muted">Las cotas (discos, tambores, pastillas, balatas, pistón del caliper, recorrido del pedal) son del manual. Fuerzas, presiones y distancias usan valores típicos para mostrar proporciones; los movimientos dentro del caliper y del tambor están exagerados para que se vean.</p>`;
}
function wireBrakes() {
  const B = o => { const r = viewer.brake(o); onBrake(r); return r; };
  $('#tb-press').addEventListener('click', () => { const st = viewer.brakeState; if (st.seq) viewer.brakeAbort(); B({ on: !st.on }); syncPress(); });
  const setForce = v => { $('#tb-fz').value = v; $('#tb-fz-v').textContent = kgOf(v) + ' kg'; pressSeg($('#tb-force'), String(v)); B({ force: v }); };
  segGroup($('#tb-force'), v => setForce(+v));
  $('#tb-fz').addEventListener('input', e => { const v = +e.target.value; $('#tb-fz-v').textContent = kgOf(v) + ' kg'; pressSeg($('#tb-force'), ''); B({ force: v }); });
  $('#tb-stoptest').addEventListener('click', () => { closePop(); seqWas = null; viewer.brakeTest(); syncPress(); });
  segGroup($('#tb-fail'), v => { B({ fail: v }); if (v !== 'ok' && isMobile()) toast(`${FAILS[v].name}: la explicación está en el panel de Frenos.`, 4500); });
  const wearNote = () => {
    const r = viewer.brake(), ws = r.wear;
    $('#tb-wear-note').textContent = `Pastillas ${nf(ws.pad, 1)} mm · balatas ${nf(ws.lining, 1)} mm · disco ${nf(ws.disc, 1)} mm · depósito ${ws.level > 0.05 ? nf(ws.level * 100) + ' %' : 'en el MIN'}`;
  };
  $('#tb-wear').addEventListener('input', e => { $('#tb-wear-v').textContent = e.target.value + ' %'; B({ wear: +e.target.value / 100 }); wearNote(); });
  const hbNote = () => {
    const r = viewer.brake(), hb = r.hb;
    $('#tb-hb-v').textContent = `${hb.notches} ${hb.notches === 1 ? 'muesca' : 'muescas'}`;
    $('#tb-hb-note').textContent = hb.notches === 0 ? `Aprieta del todo en la muesca ${hb.full}${hb.outOfSpec ? ': pasa de 8, hay que ajustar el cable' : ' (manual: 3 a 8 con 20 kg)'}.`
      : hb.e === 0 ? 'Todavía no aprieta.' : `Sostiene en pendientes de hasta ~${nf(hb.grade)} %.`;
  };
  $('#tb-hb').addEventListener('input', e => { B({ hb: +e.target.value }); hbNote(); });
  $('#tb-hbs').addEventListener('change', e => { B({ stretched: e.target.checked }); hbNote(); });
  segGroup($('#tb-bcut'), v => viewer.setBCut(v === 'in'));
  wearNote(); hbNote();
}

// ═══════════ Vista Calefacción: mandos, recorrido del aire y del agua, fallas ═══════════
function syncHeat() {
  const b = $('#tb-heat'); if (!b || !viewer) return;
  const on = viewer.heatState.on;
  b.setAttribute('aria-pressed', String(on));
  b.innerHTML = (on ? IC.pause : IC.play) + `<span>${on ? 'Apagar' : 'Encender'}</span>`;
  b.setAttribute('aria-label', on ? 'Apagar la calefacción' : 'Encender el motor y la calefacción');
}
const tcol = t => { const c = tempColor(t); return `rgb(${c.join(',')})`; };
const tfmt = t => (t == null ? '—' : `${nf(t)} °C`);
function onHeat(r) {
  if (!r || mode() !== 'cal') return;
  const key = [r.on, r.mode, r.recirc, Math.round(r.temp * 20), r.fan, r.fanEff, r.engine, r.fail, Math.round(r.Thot)].join('|');
  if (key !== chKey) { chKey = key; renderChud(r); }
  updateCalSim(r);
}
function renderChud(r) {
  const chip = (lbl, t, flow) => `<span class="bh p" style="--c:${t == null ? '#c9b89c' : tcol(t)}"><small>${lbl}</small><b>${flow ? tfmt(t) : '—'}</b></span>`;
  const chips = [
    `<span class="bh p" style="--c:${tcol(r.Tw)}"><small>Agua</small><b>${nf(r.Tw)} °C</b></span>`,
    chip('Cara', r.out.cara, r.flows.cara > 0.001), chip('Pies', r.out.pies, r.flows.pies > 0.001), chip('Parabrisas', r.out.vidrio, r.flows.vidrio > 0.001),
    `<span class="bh"><small>Ventilador</small><b>${r.fan ? r.fan : 'OFF'}${r.fan && !r.fanEff ? ' ✕' : ''}</b></span>`,
  ];
  const line = !r.on ? 'Apagada: toca <b>Encender</b> para poner el motor en marcha y ver el aire y el agua.'
    : `${HMODES[r.mode].name} · ${r.recirc ? 'recircula el aire de la cabina' : 'aire de afuera'} · llave ${nf(r.valve * 100)} % · ${r.m3h ? `≈ ${nf(r.m3h)} m³/h` : 'sin aire'}${r.kW > 0.05 ? ` · ≈ ${nf(r.kW, 1)} kW de calor` : ''}`;
  const tags = [];
  if (r.fail !== 'ok') tags.push(`<span class="bt f">${HFAILS[r.fail].name}</span>`);
  if (r.fan && !r.fanEff && r.on) tags.push('<span class="bt w">Esa velocidad no anda: sólo la 3</span>');
  if (r.on && r.engine === 'frio') tags.push('<span class="bt i">Motor frío: el agua todavía no calienta</span>');
  if (r.on && r.mode === 'vidrio' && r.fail === 'desempanador') tags.push('<span class="bt w">Casi no sale aire al parabrisas</span>');
  if (r.on && r.mode !== 'cara' && r.Thot < 30 && r.Q > 0) tags.push('<span class="bt w">Sale casi fría</span>');
  chud.innerHTML = `<div class="bh-row">${chips.join('')}</div><p class="bh-line">${line}</p>${tags.length ? `<div class="bh-tags">${tags.join('')}</div>` : ''}`;
}
const HMODETXT = {
  cara: 'Cara: la compuerta de arriba cierra el paso al radiador y todo el aire sube sin calentarse a las 4 rejillas del tablero: las dos del centro por el distribuidor que sale de arriba de la caja, la del extremo izquierdo por el ducto negro y corrugado del costado izquierdo y la del extremo derecho por el tubo rígido del costado derecho y la manguera corrugada que pasa sobre la caja del foco. Sirve para ventilar.',
  bi: 'Cara y pies: la compuerta queda a medio camino. La mitad del aire sube a las rejillas sin pasar por el radiador (fresco a la cara) y la otra mitad pasa por el radiador y sale caliente por abajo de la caja, a los pies.',
  pies: 'Pies: la compuerta tapa la salida de arriba y todo el aire atraviesa el radiador. Sale por las aberturas de abajo de la caja, hacia los dos costados (también llega a los pedales) y hacia la cabina, y un poco sube al parabrisas.',
  vidrio: 'Parabrisas: el aire pasa por el radiador y la compuerta de abajo lo manda a las dos ranuras de la base del parabrisas: la del conductor por el tubo blanco y la manguera beige, y la del copiloto por un ducto que sube por delante de la caja. Una parte sigue saliendo a los pies.',
};
const HFAILTXT = {
  termostato: 'Termostato pegado abierto: el agua pasa siempre por el radiador del motor y no sube de unos 55 °C. La calefacción sale tibia y el indicador de temperatura queda bajo.',
  llave: 'Llave de agua trabada: la palanca COOL–HOT se mueve pero el agua no pasa al radiador de calefacción. Sale aire frío aunque el motor esté caliente. Revisar el cable y la llave (usar la calefacción una vez al mes ayuda a que no se pegue).',
  resistencia: 'Resistencia cortada: las velocidades 1 y 2 pasan por la resistencia, así que no andan; la 3 recibe los 12 V directos y sí funciona (manual). Es la falla típica.',
  radiador: 'Radiador de calefacción tapado (o con aire): pasa poca agua y el aire sale tibio. Se purga el aire o se lava o cambia el radiador.',
  desempanador: 'Compuerta del parabrisas desajustada: el mando queda en el parabrisas pero la compuerta de abajo no llega a su posición (cable estirado o mal ajustado, o varillaje trabado) y casi todo el aire sigue saliendo a los pies. En este furgón sale muy poco aire en modo parabrisas (dueño); esta es una de las causas posibles, junto con un ducto suelto (el tubo blanco o su manguera) o las salidas tapadas.',
};
function updateCalSim(r) {
  const box = $('#calsim'); if (!box || !r) return;
  const key = [r.mode, r.recirc, Math.round(r.temp * 10), r.fan, r.engine, r.fail, Math.round(r.Tw), Math.round(r.Tret)].join('|');
  if (key === csimKey) return; csimKey = key;
  box.innerHTML = `<h4>Lo que muestra el modelo</h4>
    <p>${HMODETXT[r.mode]}</p>
    ${r.fail !== 'ok' ? `<p><b>${HFAILS[r.fail].name}.</b> ${HFAILTXT[r.fail].replace(/^[^:]+: (.)/, (m, c) => c.toUpperCase())}</p>` : ''}
    <dl class="kv">
      <div><dt>De dónde viene el aire</dt><dd>${r.recirc ? 'Recircula: la compuerta de la caja de admisión, al costado derecho de la caja, toma el aire de la cabina por la rejilla cuadrada, que tiene una esponja detrás que hace de filtro (dueño).' : 'Exterior: la compuerta tapa la rejilla y abre el paso del aire de afuera, que entra por la parte baja de la caja de admisión, donde llega a la esquina del piso, adelante; por fuera del furgón la entrada no se nota (dueño).'}</dd></div>
      <div><dt>Temperatura</dt><dd>La palanca COOL–HOT mueve por cable la llave de agua (abierta ${nf(r.valve * 100)} %): decide cuánta agua caliente del motor pasa por el radiador de calefacción. Las rejillas de arriba siempre reciben aire sin calentar.</dd></div>
      <div><dt>Ventilador</dt><dd>${r.fan === 0 ? 'Apagado.' : r.fan < 3 ? (r.fail === 'resistencia' ? `Velocidad ${r.fan}: la corriente tendría que pasar por la resistencia, que está cortada, así que el motor no gira.` : `Velocidad ${r.fan}: la corriente pasa por la resistencia y el motor gira más lento.`) : 'Velocidad 3: el motor recibe los 12 V directos, sin resistencia.'} (manual)</dd></div>
      <div><dt>Agua</dt><dd>Sale caliente del múltiple de admisión, pasa por la llave y el radiador de calefacción y vuelve a la bomba de agua. ${r.engine === 'frio' ? 'Con el motor recién partido todavía está fría.' : `Llega a ${nf(r.Tw)} °C y vuelve a ${nf(r.Tret)} °C.`}</dd></div>
    </dl>
    <p class="muted">En este furgón la calefacción calienta y funciona en las 3 velocidades, y en modo parabrisas sale muy poco aire (dueño). Temperaturas, caudal y potencia son valores típicos para mostrar proporciones; el interior de la caja, dónde nace el tubo de la rejilla del extremo derecho, el ducto del desempañador del copiloto y los recorridos dentro del tablero son aproximados.</p>`;
}
function wireHeater() {
  const H = o => { const r = viewer.heat(o); onHeat(r); return r; };
  $('#tb-heat').addEventListener('click', () => { H({ on: !viewer.heatState.on }); syncHeat(); });
  segGroup($('#tb-hmode'), v => H({ mode: v }));
  segGroup($('#tb-hair'), v => H({ recirc: v === 'rec' }));
  segGroup($('#tb-hfan'), v => H({ fan: +v }));
  $('#tb-htemp').addEventListener('input', e => { $('#tb-htemp-v').textContent = e.target.value + ' %'; H({ temp: +e.target.value / 100 }); });
  segGroup($('#tb-heng'), v => H({ engine: v }));
  segGroup($('#tb-hfail'), v => { H({ fail: v }); if (v !== 'ok' && isMobile()) toast(`${HFAILS[v].name}: la explicación está en el panel de Calefacción.`, 4500); });
  $('#tb-hair-show').addEventListener('change', e => H({ showAir: e.target.checked }));
  $('#tb-hwater-show').addEventListener('change', e => H({ showWater: e.target.checked }));
}

// ═══════════ Vista Alimentación: acelerador, ahogador, recorrido de la bencina y del aire, fallas ═══════════
function syncFuel() {
  const b = $('#tb-fuel'); if (!b || !viewer) return;
  const on = viewer.fuelState.on;
  b.setAttribute('aria-pressed', String(on));
  b.innerHTML = (on ? IC.pause : IC.play) + `<span>${on ? 'Apagar' : 'Encender'}</span>`;
  b.setAttribute('aria-label', on ? 'Cortar el contacto' : 'Dar contacto y poner el motor en marcha');
}
const MIXCOL = { off: '#c9b89c', muyrica: '#3a2c22', rica: '#8a5a2b', ok: '#3d8f5a', pobre: '#d49a1a', muypobre: '#d9482b' };
function onFuel(r) {
  if (!r || mode() !== 'ali') return;
  const key = [r.on, r.running, Math.round(r.pedal * 40), Math.round(r.choke * 20), r.engine, r.fail, Math.round(r.rpm / 50), r.state, Math.round(r.bowl * 20), Math.round(viewer.fuelState.level * 100)].join('|');
  if (key !== ahKey) { ahKey = key; renderAhud(r); }
  updateAliSim(r);
}
function circuits(r) {
  const c = [];
  if (r.slow > 0.15) c.push('circuito lento');
  if (r.main > 0.15) c.push('circuito principal');
  if (r.power > 0.3) c.push('enriquecedor');
  if (viewer.fuelState.shot > 0.15) c.push('chorro de la bomba de aceleración');
  return c;
}
function renderAhud(r) {
  const lvl = viewer.fuelState.level;
  const chips = [
    `<span class="bh"><small>Motor</small><b>${r.running ? nf(Math.round(r.rpm / 50) * 50) + ' rpm' : 'Detenido'}</b></span>`,
    `<span class="bh"><small>Acelerador</small><b>${nf(r.pedal * 100)} %</b></span>`,
    `<span class="bh p" style="--c:${MIXCOL[r.state]}"><small>Mezcla</small><b>${r.afr ? nf(r.afr, 1) + ' : 1' : '—'}</b></span>`,
    `<span class="bh"><small>Vacío</small><b>${r.running ? nf(r.vac) + ' cmHg' : '—'}</b></span>`,
    `<span class="bh v"><small>Consumo</small><b>${r.running ? nf(r.lph, 1) + ' L/h' : '—'}</b></span>`,
  ];
  const cs = r.running ? circuits(r) : [];
  const line = !r.on ? 'Sin contacto: toca <b>Encender</b> para que la bomba mande bencina y el motor ande.'
    : !r.running ? (r.stall === 'estanque' ? 'El estanque está vacío: la bomba no tiene qué mandar.' : 'El motor se apagó: sin el circuito lento no se sostiene en ralentí. Acelera para que ande con el circuito principal.')
    : `Mezcla ${MIXTXT[r.state].toLowerCase()} · trabaja ${cs.length ? cs.join(' + ') : 'el circuito lento'} · estanque ${nf(lvl * FK.tank)} L`;
  const tags = [];
  if (r.fail !== 'ok') tags.push(`<span class="bt f">${FFAILS[r.fail].name}</span>`);
  if (r.running && r.choke > 0.05 && !r.cold) tags.push('<span class="bt w">Ahogador tirado con el motor caliente</span>');
  if (r.running && r.cold && r.choke < 0.3) tags.push('<span class="bt w">En frío y sin ahogador: mezcla pobre, tironea</span>');
  if (r.running && r.starve > 0.05) tags.push('<span class="bt w">No llega suficiente bencina</span>');
  if (r.on && lvl < 0.12 && lvl > 0.005) tags.push('<span class="bt i">Estanque en reserva</span>');
  ahud.innerHTML = `<div class="bh-row">${chips.join('')}</div><p class="bh-line">${line}</p>${tags.length ? `<div class="bh-tags">${tags.join('')}</div>` : ''}`;
}
const FFAILTXT = {
  filtro: 'El filtro deja pasar poca bencina. En ralentí alcanza, pero al acelerar la cuba se vacía más rápido de lo que se llena: la mezcla queda pobre y el motor tironea y pierde fuerza. Se cambia el filtro completo.',
  bomba: 'La bomba entrega mucho menos de los 500 cm³ por minuto que pide el manual. Igual que con el filtro tapado, el motor anda bien despacio y se queda sin bencina a fondo o en subidas.',
  aguja: 'La aguja no cierra contra su asiento (suciedad o desgaste): la bencina sigue entrando, la cuba se rebalsa y la mezcla queda muy rica. Hay olor a bencina, humo negro y cuesta partir en caliente.',
  aire: 'Entra aire por una manguera de vacío suelta o por la empaquetadura del múltiple, sin pasar por el carburador. En ralentí la mezcla queda pobre: el motor sube de vueltas, queda inestable y puede silbar. Acelerando casi no se nota.',
  solenoide: 'El solenoide no recibe los 12 V (o se pegó) y su aguja mantiene cerrado el circuito lento. El motor anda mientras se acelera, con el circuito principal, y se apaga al soltar el pedal.',
  filtroaire: 'El elemento sucio frena el aire. Entra menos aire para la misma bencina: mezcla rica, más consumo y menos fuerza, sobre todo a fondo.',
};
function updateAliSim(r) {
  const box = $('#alisim'); if (!box || !r) return;
  const key = [r.on, r.running, Math.round(r.pedal * 10), Math.round(r.choke * 4), r.engine, r.fail, r.state].join('|');
  if (key === asimKey) return; asimKey = key;
  const p = r.pedal;
  const how = !r.on ? 'Con el contacto cortado la bomba eléctrica no trabaja y el solenoide cierra el circuito lento.'
    : p < 0.08 ? 'Ralentí: la mariposa está casi cerrada. El aire pasa lento por el venturi y no alcanza a sacar bencina del circuito principal; la mezcla sale por los orificios del circuito lento, junto a la mariposa. El tornillo de mezcla regula cuánta.'
    : p < 0.35 ? 'Acelerando suave: la mariposa destapa los orificios de transición y el circuito principal empieza a entregar. El aire ya corre rápido por la garganta del venturi y su succión saca la bencina por el tubo de emulsión.'
    : r.power < 0.3 ? 'Crucero: trabaja el circuito principal con una mezcla algo pobre, que es la que menos gasta. El vacío del múltiple todavía mantiene cerrado el enriquecedor.'
    : 'A fondo: la mariposa queda paralela al aire, el vacío del múltiple cae y el diafragma del enriquecedor se abre. Entra bencina extra y la mezcla queda rica, que es la que da más fuerza.';
  const chk = r.choke > 0.05 ? (r.cold ? 'Ahogador tirado en frío: su mariposa tapa la boca del carburador, la succión sube y saca más bencina. Además la leva de ralentí rápido entreabre el acelerador. Es lo correcto para partir; hay que devolver la perilla apenas el motor ande parejo.'
      : 'Ahogador tirado con el motor caliente: la mezcla queda demasiado rica, sale humo negro y la bencina sin quemar lava el aceite de los cilindros. Hay que devolver la perilla.')
    : (r.cold ? 'Motor frío sin ahogador: parte de la bencina se queda pegada en las paredes frías del múltiple y a los cilindros llega una mezcla pobre. El motor tironea o se apaga; para eso está el ahogador.' : '');
  box.innerHTML = `<h4>Lo que muestra el modelo</h4>
    <p>${how}</p>
    ${chk ? `<p>${chk}</p>` : ''}
    ${r.fail !== 'ok' ? `<p><b>${FFAILS[r.fail].name}.</b> ${FFAILTXT[r.fail]}</p>` : ''}
    <dl class="kv">
      <div><dt>Bencina</dt><dd>Sale del estanque por un tubo con colador, pasa por el filtro y la bomba eléctrica del larguero derecho y llega a la cuba del carburador. Lo que el motor no usa vuelve al estanque por el retorno, que la mantiene fresca (manual).</dd></div>
      <div><dt>Aire</dt><dd>Entra por el filtro de aire, bajo el asiento del copiloto, cruza el carburador de lado y sigue al múltiple de admisión, que lo reparte a los 4 cilindros.</dd></div>
      <div><dt>Pedal</dt><dd>El acelerador tira de una piola hasta la palanca de la mariposa. Si se pisa de golpe, la bomba de aceleración lanza un chorro extra de bencina para que no haya un hueco.</dd></div>
      <div><dt>Vapores</dt><dd>Los vapores del estanque van al cánister, que los guarda en carbón activado, y de ahí al motor.</dd></div>
    </dl>
    <p class="muted">Los puntos naranjos son bencina, los celestes aire, los crema mezcla y los verdosos vapores. Rpm, vacío, mezcla y consumo son valores típicos para mostrar proporciones; el ralentí, el vacío en ralentí y el caudal de la bomba son del manual. El estanque y el recorrido de las líneas bajo el piso son supuestos, y el interior del carburador es esquemático.</p>`;
}
function wireFuel() {
  const F = o => { const r = viewer.fuel(o); onFuel(r); return r; };
  $('#tb-fuel').addEventListener('click', () => { F({ on: !viewer.fuelState.on }); syncFuel(); });
  const setPedal = v => { $('#tb-acc').value = v; $('#tb-acc-v').textContent = v + ' %'; pressSeg($('#tb-accseg'), String(v)); F({ pedal: v / 100 }); };
  segGroup($('#tb-accseg'), v => setPedal(+v));
  $('#tb-acc').addEventListener('input', e => { const v = +e.target.value; $('#tb-acc-v').textContent = v + ' %'; pressSeg($('#tb-accseg'), ''); F({ pedal: v / 100 }); });
  $('#tb-kick').addEventListener('click', () => { closePop(); setPedal(0); setTimeout(() => setPedal(100), 450); setTimeout(() => setPedal(0), 2600); });
  $('#tb-choke').addEventListener('input', e => { const v = +e.target.value; $('#tb-choke-v').textContent = v === 0 ? 'Adentro' : v === 100 ? 'Tirado' : v + ' %'; F({ choke: v / 100 }); });
  segGroup($('#tb-feng'), v => F({ engine: v }));
  segGroup($('#tb-ffail'), v => { F({ fail: v }); if (v !== 'ok' && isMobile()) toast(`${FFAILS[v].name}: la explicación está en el panel de Alimentación.`, 4500); });
  $('#tb-flevel').addEventListener('input', e => { const v = +e.target.value; $('#tb-flevel-v').textContent = nf(v / 100 * FK.tank) + ' L'; F({ level: v / 100 }); });
  $('#tb-ffuel-show').addEventListener('change', e => F({ showFuel: e.target.checked }));
  $('#tb-fair-show').addEventListener('change', e => F({ showAir: e.target.checked }));
  $('#tb-fvap-show').addEventListener('change', e => F({ showVap: e.target.checked }));
}

// ═══════════ Vista Transmisión: cambios, embrague, camino de la fuerza, diferencial y fallas ═══════════
function syncDrive() {
  const b = $('#tb-drive'); if (!b || !viewer) return;
  const on = viewer.driveState.sim.on;
  b.setAttribute('aria-pressed', String(on));
  b.innerHTML = (on ? IC.pause : IC.play) + `<span>${on ? 'Apagar' : 'Encender'}</span>`;
  b.setAttribute('aria-label', on ? 'Apagar el motor' : 'Encender el motor');
}
const tr3 = x => nf(Math.floor(Math.abs(x) * 1000 + 1e-6) / 1000, 3);   // el manual da las relaciones truncadas a 3 decimales
const GSHORT = { N: 'N', 1: '1.ª', 2: '2.ª', 3: '3.ª', 4: '4.ª', 5: '5.ª', R: 'R' };
const CLSTATE = { acoplado: 'acoplado', patina: 'patinando', libre: 'desacoplado', neutro: 'acoplado' };
const wheelsOf = r => { const l = r.noGrip ? r.kmh / 3.6 / DK.rw * 30 / Math.PI : r.rpmWheel * (1 + 0.16 * r.turn); return [l, r.noGrip ? 2 * r.rpmWheel - l : r.rpmWheel * (1 - 0.16 * r.turn)]; };
let driveOn = null;
function onDrive(r) {
  if (!r || mode() !== 'tra') return;
  const ds = viewer.driveState;
  if (r.on !== driveOn) { driveOn = r.on; syncDrive(); }
  const key = [r.on, r.stalled, r.stallMsg, r.gear, r.phase, r.target, Math.round(r.rpm / 50), Math.round(r.kmh), Math.round(r.rpmIn / 50), r.state, r.grind > 0, r.fail, r.turn, r.noGrip, r.demo, r.brake].join('|');
  if (key !== thKey) {
    thKey = key; renderThud(r);
    pressSeg($('#tb-gear'), String(r.phase === 'idle' ? r.gear : r.target));
    const sb = $('#tb-dstop'); sb.setAttribute('aria-pressed', String(!!r.brake)); sb.textContent = r.brake ? 'Soltar el freno' : 'Frenar';
  }
  const cl = $('#tb-clutch'), cv = Math.round(r.clutch * 100);
  if (document.activeElement !== cl && +cl.value !== cv) { cl.value = cv; $('#tb-clutch-v').textContent = cv === 0 ? 'Suelto' : cv === 100 ? 'A fondo' : cv + ' %'; }
  const ac = $('#tb-dacc'), av = Math.round(ds.throttle * 100);
  if (document.activeElement !== ac && +ac.value !== av) { ac.value = av; $('#tb-dacc-v').textContent = av + ' %'; }
  updateTraSim(r);
}
function renderThud(r) {
  const [wl, wr] = wheelsOf(r), split = r.turn || r.noGrip, back = r.kmh < -0.5;
  const chips = [
    `<span class="bh"><small>Motor</small><b>${r.on ? nf(Math.round(r.rpm / 50) * 50) + ' rpm' : r.stalled && r.stallMsg !== 'marcha' ? 'Se caló' : 'Detenido'}</b></span>`,
    `<span class="bh v"><small>Marcha</small><b>${GSHORT[r.gear]}</b></span>`,
    `<span class="bh"><small>Velocidad</small><b>${nf(Math.abs(r.kmh))} km/h${back ? ' atrás' : ''}</b></span>`,
    `<span class="bh"><small>Eje de entrada</small><b>${nf(Math.round(Math.abs(r.rpmIn) / 10) * 10)} rpm</b></span>`,
    `<span class="bh"><small>Cardán</small><b>${nf(Math.round(Math.abs(r.rpmOut) / 10) * 10)} rpm</b></span>`,
    `<span class="bh"><small>Ruedas${split ? ' izq · der' : ''}</small><b>${split ? nf(Math.abs(wl)) + ' · ' + nf(Math.abs(wr)) : nf(Math.abs(r.rpmWheel)) + ' rpm'}</b></span>`,
  ];
  const line = r.gear === 'N' ? (r.on ? 'Punto muerto: giran el eje de entrada y el contraeje, pero ningún manguito está enganchado.' : 'Motor detenido: toca <b>Encender</b> y elige una marcha en <b>Cambios</b>.')
    : `${GNAME[r.gear]} · ${tr3(r.ratio)} × ${nf(FINALR, 3)} = ${nf(Math.abs(r.total), 2)} vueltas de motor por vuelta de rueda · embrague ${CLSTATE[r.state]}`;
  const tags = [];
  if (r.stalled && !r.on) tags.push(`<span class="bt w">${r.stallMsg === 'marcha' ? 'No parte: hay una marcha puesta y el embrague está suelto' : 'Se caló: el embrague se soltó muy rápido o la marcha es muy alta'}</span>`);
  if (r.state === 'patina' && r.on) tags.push(`<span class="bt w">El embrague patina: ${nf(Math.abs(r.slip) / 10 * 10)} rpm de diferencia</span>`);
  if (r.grind > 0) tags.push(`<span class="bt w">${r.grindMsg === 'no' ? 'Rasca y no entra: falta pisar el embrague' : r.grindMsg === 'sincro' ? 'Rasca al entrar la 2.ª' : 'Rasca al entrar: el embrague no corta del todo'}</span>`);
  if (r.fail !== 'ok') tags.push(`<span class="bt f">${DFAILS[r.fail].name}</span>`);
  if (r.noGrip) tags.push('<span class="bt i">Rueda derecha sin agarre: se lleva todo el giro</span>');
  else if (r.turn) tags.push(`<span class="bt i">Curva a la ${r.turn < 0 ? 'izquierda' : 'derecha'}: la rueda de afuera gira más</span>`);
  if (r.demo) tags.push('<span class="bt i">Recorrido automático</span>');
  if (r.brake) tags.push('<span class="bt i">Frenando</span>');
  thud.innerHTML = `<div class="bh-row">${chips.join('')}</div><p class="bh-line">${line}</p>${tags.length ? `<div class="bh-tags">${tags.join('')}</div>` : ''}`;
}
const DFAILTXT = {
  disco: 'Los forros están gastados y la prensa ya no aprieta el disco con toda su fuerza. Con poca carga no se nota; al acelerar a fondo en una marcha alta, las rpm suben y el furgón no acelera igual: el disco patina entre el volante y el plato. Se cambia el disco y se revisa la prensa.',
  juego0: 'La piola quedó sin juego libre: el collarín vive apoyado en los dedos del diafragma y el plato no aprieta del todo. El embrague patina con carga, y el collarín y los dedos se gastan rápido. Se regula la tuerca de la piola hasta tener 20–30 mm de juego en el pedal (manual).',
  estirada: 'La piola tiene demasiado juego: buena parte del recorrido del pedal se pierde antes de mover la horquilla y, aun a fondo, el plato no alcanza a soltar el disco. El eje de entrada sigue arrastrado por el motor: las marchas rascan al entrar y el furgón quiere avanzar con el pedal pisado. Se regula la piola o se cambia si está estirada.',
  sincro: 'El anillo de bronce del sincronizador de 2.ª está gastado y ya no iguala la velocidad del engranaje antes de que llegue el manguito: los dientes se encuentran girando distinto y la 2.ª rasca al entrar con el furgón en movimiento. Detenido entra bien. Se cambia el anillo (manual: luz anillo–engranaje bajo 0,5 mm).',
  cruceta: 'Una cruceta tiene juego en sus rodamientos de agujas: el cardán queda descentrado y vibra, y se siente un golpe seco al soltar el embrague o al pasar de avanzar a retroceder. En el modelo, el tubo del cardán gira bamboleando.',
};
function gearPath(g) {
  const pri = `El eje de entrada (${DK.prim[0]} dientes) mueve el contraeje (${DK.prim[1]}): primera reducción, ${tr3(PRIM)}.`;
  if (g === 4) return 'El manguito de alta, corrido hacia adelante, engancha el eje de entrada directamente con el eje principal: giran como uno solo (1,000). El contraeje sigue dando vueltas, pero sin llevar fuerza; por eso la 4.ª es la marcha más silenciosa y la que menos pierde.';
  const [nc, nm] = DK.pair[g], rr = nm / nc, tot = Math.abs(gearRatio(g));
  const sl = { 1: 'El manguito de baja, corrido hacia atrás,', 2: 'El manguito de baja, corrido hacia adelante,', 3: 'El manguito de alta, corrido hacia atrás,', 5: 'El manguito de 5.ª y marcha atrás, corrido hacia atrás,', R: 'El manguito de 5.ª y marcha atrás, corrido hacia adelante,' }[g];
  if (g === 'R') return `${pri} El engranaje de marcha atrás del contraeje (${nc}) mueve el piñón loco y éste al engranaje del eje principal (${nm}): ${tr3(rr)}, y con un engranaje de más en la cadena el giro sale invertido. ${sl} lo engancha al eje. Total: ${tr3(PRIM)} × ${tr3(rr)} = ${tr3(tot)}.`;
  return `${pri} El engranaje de ${GNAME[g]} del contraeje (${nc}) mueve al del eje principal (${nm}): ${tr3(rr)}${rr < 1 ? ', o sea que el eje principal gira más rápido que el contraeje' : ''}. ${sl} lo engancha al eje. Total: ${tr3(PRIM)} × ${tr3(rr)} = ${tr3(tot)}${g === 5 ? ': sobremarcha, el cardán gira más rápido que el motor' : ''}.`;
}
function updateTraSim(r) {
  const box = $('#trasim'); if (!box || !r) return;
  const key = [r.on, r.stalled, r.gear, r.state, r.fail, r.turn, r.noGrip, Math.round(r.free * 20), Math.round(r.lift * 4)].join('|');
  if (key === tsimKey) return; tsimKey = key;
  const g = r.gear, tot = Math.abs(r.total);
  const how = g === 'N' ? 'Punto muerto: con el embrague acoplado, el disco gira con el motor y arrastra el eje de entrada, el contraeje y todos los engranajes del eje principal, que dan vueltas sueltos sobre él. Como ningún manguito está enganchado, el eje principal y el cardán no reciben fuerza.' : gearPath(g);
  const cl = r.lift >= 0.999 ? 'Embrague desacoplado: el collarín hundió los dedos del diafragma, el plato se separó y el disco quedó libre. El motor gira sin arrastrar la caja: es el momento de mover la palanca.'
    : r.lift > 0.02 ? 'Embrague a medio camino: el plato aprieta sólo en parte y el disco patina. Es el punto de contacto, el que se usa un instante para salir desde detenido; sostenerlo calienta y gasta el disco.'
    : r.state === 'patina' ? 'El pedal está suelto, pero el disco patina: la fuerza que pide el motor es más que la que el embrague puede sujetar.'
    : 'Embrague acoplado: el diafragma aprieta el plato y el disco queda prensado contra el volante; motor y eje de entrada giran juntos.';
  const [wl, wr] = wheelsOf(r);
  const dif = r.noGrip ? 'Una rueda sin agarre: el diferencial reparte la misma fuerza a los dos lados, y la rueda que patina casi no opone resistencia, así que se lleva todo el giro (al doble de la corona) y la otra queda quieta. El furgón no avanza.'
    : r.turn ? `En curva la rueda de afuera recorre más camino. Los satélites giran sobre su eje y dejan que un planetario se adelante lo mismo que el otro se atrasa: ahora ${nf(Math.abs(wl))} rpm a la izquierda y ${nf(Math.abs(wr))} a la derecha; el promedio sigue siendo el de la corona.`
    : 'En línea recta los satélites no giran sobre su eje: corona, caja de satélites, planetarios y palieres dan vueltas como un solo bloque.';
  box.innerHTML = `<h4>Lo que muestra el modelo</h4>
    <p>${how}</p>
    <p>${cl}</p>
    ${r.fail !== 'ok' ? `<p><b>${DFAILS[r.fail].name}.</b> ${DFAILTXT[r.fail]}</p>` : ''}
    <dl class="kv">
      ${g !== 'N' ? `<div><dt>Reducción total</dt><dd>${tr3(r.ratio)} (caja) × ${nf(FINALR, 3)} (piñón y corona) = ${nf(tot, 2)} : 1. La fuerza en las ruedas se multiplica casi lo mismo.</dd></div>
      <div><dt>A 1.000 rpm</dt><dd>${nf(1000 / tot * DK.rw * 2 * Math.PI * 60 / 1000, 1)} km/h con el 175/70 R13</dd></div>` : ''}
      <div><dt>Juego libre del pedal</dt><dd>≈ ${nf(r.free * DK.pedalMM)} mm antes de que el collarín toque el diafragma (manual: 20–30 mm)</dd></div>
      <div><dt>Diferencial</dt><dd>${dif}</dd></div>
    </dl>
    <p class="muted">El giro se muestra al 4,5 % de la velocidad real para que se alcance a ver; las rpm de los indicadores son las reales. Dientes y relaciones son del manual; el par del motor, la masa, el roce y lo que aguanta el embrague son valores típicos. El movimiento de la prensa está exagerado, y el selector por dentro es esquemático.</p>`;
}
function resetDriveUI() {
  for (const [id, v] of [['#tb-tfail', 'ok'], ['#tb-turn', '0'], ['#tb-gear', 'N']]) pressSeg($(id), v);
  $('#tb-nogrip').checked = false; $('#tb-autocl').checked = true; $('#tb-tpath').checked = true;
  viewer.drive({ fail: 'ok', turn: 0, noGrip: false, auto: true, showPath: true, brake: false, throttle: 0, clutch: 0 });
  driveOn = null; syncDrive();
}
function wireDrive() {
  const T = o => { const r = viewer.drive(o); onDrive(r); return r; };
  $('#tb-drive').addEventListener('click', () => { T({ on: !viewer.driveState.sim.on }); syncDrive(); });
  segGroup($('#tb-gear'), v => { const r = T({ gear: isNaN(+v) ? v : +v }); if (!r.on && Math.abs(r.kmh) < 0.5 && v !== 'N') toast('Con el motor detenido la marcha entra igual: enciende el motor para ver pasar la fuerza.', 4200); });
  $('#tb-autocl').addEventListener('change', e => T({ auto: e.target.checked }));
  $('#tb-clutch').addEventListener('input', e => { const v = +e.target.value; $('#tb-clutch-v').textContent = v === 0 ? 'Suelto' : v === 100 ? 'A fondo' : v + ' %'; T({ clutch: v / 100 }); });
  $('#tb-dacc').addEventListener('input', e => { const v = +e.target.value; $('#tb-dacc-v').textContent = v + ' %'; T({ throttle: v / 100, demo: false }); });
  $('#tb-ddemo').addEventListener('click', () => { closePop(); T({ demo: true }); syncDrive(); });
  $('#tb-dstop').addEventListener('click', () => T({ brake: !viewer.driveState.sim.brake, throttle: 0, demo: false }));
  segGroup($('#tb-tfail'), v => { T({ fail: v }); if (v !== 'ok' && isMobile()) toast(`${DFAILS[v].name}: la explicación está en el panel de Transmisión.`, 4500); });
  segGroup($('#tb-turn'), v => T({ turn: +v }));
  $('#tb-nogrip').addEventListener('change', e => T({ noGrip: e.target.checked }));
  $('#tb-tpath').addEventListener('change', e => T({ showPath: e.target.checked }));
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
if (viewer) { wireBrakes(); wireHeater(); wireFuel(); wireDrive(); }
window.__app = { showTab, openPart, openSys, setSheet, back, get state() { return { tab, stack: stack.map(e => e.t + ':' + e.id), sheet, focus: focusSys }; } };
