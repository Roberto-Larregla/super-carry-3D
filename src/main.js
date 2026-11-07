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

// ═══════════ Visor 3D ═══════════
const viewerEl = $('#viewer');
const card = $('#infocard');
const hud = $('#enghud');
let smap = null;
let viewer;
let currentSys = null;
try {
  viewer = createViewer(viewerEl, { labelLayer: $('#labels'), onSelect: id => { renderCard(id); renderPeek(id); smap && smap.highlight(id && PARTS[id].sensor ? id : null); }, onTick: (th, mode) => mode === 'eng' && renderHud(th) });
  window.__viewer = viewer;
} catch (err) {
  viewerEl.classList.add('nogl');
  $('#viewer-msg').hidden = false;
  console.error(err);
}
const mode = () => (viewer ? viewer.getMode() : 'van');
const inWorld = id => (viewer ? viewer.has(id) : true);

const peek = $('#peek');
function renderPeek(id) {
  if (!id) { peek.hidden = true; return; }
  const P = PARTS[id];
  peek.style.setProperty('--c', SYS[P.sys].color);
  peek.innerHTML = `<i></i><b>${P.sensor ? P.sensor.n + '. ' : ''}${P.name}</b><button type="button" class="btn sm go" data-peek="card">Ver ficha ↓</button><button type="button" class="btn ghost sm" data-peek="close" aria-label="Quitar selección">×</button>`;
  peek.hidden = false;
}
peek.addEventListener('click', e => {
  const b = e.target.closest('[data-peek]'); if (!b) return;
  if (b.dataset.peek === 'card') card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  else viewer && viewer.select(null, { fly: false });
});
viewerEl.addEventListener('pointerdown', () => $('.hint').classList.add('gone'), { once: true });

function partList(sys) {
  const eng = mode() === 'eng';
  let ids = Object.keys(PARTS).filter(id => (!sys || matchFocus(PARTS[id], sys)) && inWorld(id) && (eng || !PARTS[id].deep || sys === 'motor'));
  if (sys === 'sensores') ids.sort((a, b) => (PARTS[a].sensor?.n ?? 99) - (PARTS[b].sensor?.n ?? 99));
  return `<div class="partlist">${ids.map(id => { const P = PARTS[id]; return `<button type="button" class="pbtn${P.sensor ? ' sn' : ''}" data-part="${id}" style="--c:${SYS[P.sys].color}">${P.sensor ? `<b>${P.sensor.n}</b>` : '<i></i>'}${P.name}</button>`; }).join('')}</div>`;
}
function renderCard(id) {
  const eng = mode() === 'eng';
  if (!id) {
    const sys = currentSys;
    if (sys) {
      card.innerHTML = `
        <div class="card-head">${sysChip(sys)}</div>
        <h3>${SYS[sys].name}${eng ? ' del motor' : ''}</h3>
        ${sys === 'sensores' ? `<p>Los números coinciden con el <a href="#sensores">mapa de sensores</a>. <span class="stpill" style="--c:${STATUS.activo.color}">Activo</span> funciona hoy; <span class="stpill" style="--c:${STATUS.sin_uso.color}">Sin uso</span> quedó del sistema catalítico original.</p>` : '<p class="muted">Toca una pieza en el modelo o elige una de la lista.</p>'}
        ${partList(sys)}
        ${tabFor(sys) ? `<button type="button" class="btn ghost" data-goto="${tabFor(sys)}">Ver cómo funciona →</button>` : ''}`;
      return;
    }
    card.innerHTML = eng ? `
      <div class="card-head"><span class="eyebrow">Motor F10A en su lugar</span></div>
      <h3>Toca cualquier pieza del motor</h3>
      <p>Es el mismo motor del furgón, montado inclinado bajo los asientos; aquí se ocultan la carrocería y el interior. Usa <b>Corte</b> para abrirlo: el corte largo quita la mitad del lado escape y deja ver pistones, bielas, cigüeñal, válvulas y árbol de levas; el transversal lo rebana por el cilindro 2. Con el motor en marcha, el color de cada cilindro muestra en qué tiempo está.</p>
      <p class="muted">Lo marcado <span class="approx">aprox.</span> tiene forma o ubicación esquemática. Diámetro, carrera, orden de encendido, medidas del cigüeñal, holguras y la ubicación del distribuidor, el filtro de aceite y el carburador salen del manual.</p>
      ${partList(null)}` : `
      <div class="card-head"><span class="eyebrow">Cómo usar el modelo</span></div>
      <h3>Toca cualquier pieza</h3>
      <p>Arrastra para girar, pellizca o usa la rueda para acercar y arrastra con dos dedos para desplazar. Los chips de arriba aíslan un sistema y dejan el resto en transparencia; <b>Sensores</b> muestra los 9 sensores e interruptores con su cableado. Con la carrocería <b>Sólida</b> ves este furgón por fuera.</p>
      <p class="muted">Un solo modelo: el motor completo va adentro; la vista <b>Motor</b> lo enfoca en su lugar. Las piezas marcadas <span class="approx">aprox.</span> están en una ubicación esquemática.</p>
      ${partList(null)}`;
    return;
  }
  const P = PARTS[id], S = P.sensor;
  const sensorBlock = S ? `
    <div class="sblock" style="--c:${STATUS[S.status].color}">
      <div class="sb-top"><span class="snum">${S.n}</span>${statusPill(S.status)}</div>
      <dl class="kv">
        <div><dt>Qué detecta</dt><dd>${S.mide}</dd></div>
        <div><dt>Tipo</dt><dd>${S.tipo}</dd></div>
        <div><dt>Dónde está</dt><dd>${S.ubic}</dd></div>
        <div><dt>Envía la señal a</dt><dd>${S.va}</dd></div>
      </dl>
      <h4>Cómo probarlo</h4><p>${S.prueba}</p>
    </div>` : '';
  const toEngine = !eng && viewer && viewer.isEng(id) ? `<button type="button" class="btn ghost" data-mode-go="eng" data-part-go="${id}">Ver en la vista Motor →</button>` : '';
  const toVan = eng && viewer ? `<button type="button" class="btn ghost" data-mode-go="van" data-part-go="${id}">Ver en el furgón completo →</button>` : '';
  card.innerHTML = `
    <div class="card-head">${sysChip(P.sys)}${P.serves ? sysChip(P.serves) : ''}${P.approx ? '<span class="approx">ubicación aprox.</span>' : ''}<button type="button" class="x" aria-label="Cerrar ficha" data-close>×</button></div>
    <h3>${P.name}</h3>
    <p>${P.desc}</p>
    ${sensorBlock}
    ${qualityCardHTML(id)}
    <h4>Datos técnicos</h4>
    <dl class="kv">${P.d.map(([k, v, s]) => `<div><dt>${k}</dt><dd>${v} ${srcBadge(s)}</dd></div>`).join('')}</dl>
    <h4>Mantención</h4><ul class="ticks">${P.m.map(x => `<li>${x}</li>`).join('')}</ul>
    <h4>Fallas típicas</h4><ul class="warns">${P.f.map(x => `<li>${x}</li>`).join('')}</ul>
    <div class="btnrow">${P.diag ? `<button type="button" class="btn" data-goto="${P.diag}">Ver cómo funciona →</button>` : ''}${toEngine}${toVan}${S ? '<a class="btn ghost" href="#sensores">Mapa de sensores ↓</a>' : ''}</div>`;
}
card.addEventListener('click', e => {
  const b = e.target.closest('[data-part]'); if (b && viewer) { viewer.select(b.dataset.part); return; }
  if (e.target.closest('[data-close]') && viewer) { viewer.select(null, { fly: false }); return; }
  const mg = e.target.closest('[data-mode-go]'); if (mg) { setMode(mg.dataset.modeGo, mg.dataset.partGo); return; }
  const g = e.target.closest('[data-goto]'); if (g) { openTab(g.dataset.goto, true); }
});

// ——— chips de sistemas (según el modo) ———
const chips = $('#syschips');
function renderChips() {
  const avail = SYSTEMS.filter(sy => Object.keys(PARTS).some(id => matchFocus(PARTS[id], sy.id) && inWorld(id)));
  if (currentSys && !avail.some(sy => sy.id === currentSys)) currentSys = null;
  chips.innerHTML = `<button type="button" class="chip" aria-pressed="${!currentSys}" data-sys="">Todo</button>` + avail.map(sy => `<button type="button" class="chip${sy.id === 'sensores' ? ' sens' : ''}" aria-pressed="${currentSys === sy.id}" data-sys="${sy.id}" style="--c:${sy.color}"><i></i>${sy.short}</button>`).join('');
}
chips.addEventListener('click', e => {
  const b = e.target.closest('[data-sys]'); if (!b) return;
  currentSys = b.dataset.sys || null;
  chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
  viewer && viewer.setFocus(currentSys);
  renderCard(null);
});

// ——— modo: furgón / motor en detalle ———
const VIEWS = {
  van: [['iso', '3/4'], ['lado', 'Lado conductor'], ['frente', 'Frente'], ['atras', 'Atrás'], ['arriba', 'Arriba'], ['abajo', 'Abajo']],
  eng: [['iso', '3/4'], ['escape', 'Lado escape (abajo)'], ['admision', 'Lado admisión (arriba)'], ['frente', 'Frente'], ['arriba', 'Arriba'], ['abajo', 'Abajo']],
};
function renderViews(m) { $('#tb-view').innerHTML = VIEWS[m].map(([v, t], i) => `<button type="button" data-v="${v}" aria-pressed="${i === 0}">${t}</button>`).join(''); }
function setMode(m, focusPart) {
  if (!viewer) return;
  viewer.setMode(m);
  $$('#modebar [data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  $$('[data-only]').forEach(el => el.hidden = el.dataset.only !== m);
  $('#modelo-intro').textContent = m === 'eng'
    ? 'El mismo motor F10A, en su lugar bajo los asientos y sin carrocería ni interior. Ábrelo con el corte, gíralo a mano con el ángulo del cigüeñal o míralo en movimiento.'
    : 'Un solo modelo: la carrocería sigue las fotos de este furgón y adentro van todos los sistemas, con el motor F10A completo inclinado bajo los asientos, la caja, el cardán corto y el puente trasero de resortes.';
  renderViews(m);
  $('#tb-explode').value = 0; $('#tb-explode-v').textContent = '0 %';
  hud.hidden = m !== 'eng'; viewerEl.classList.toggle('is-eng', m === 'eng');
  if (m === 'eng') renderHud(viewer.state.theta, true);
  renderChips(); renderCard(null);
  if (currentSys) viewer.setFocus(currentSys);
  if (focusPart) setTimeout(() => viewer.select(focusPart), reduced ? 0 : 750);
}
$('#modebar').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });

// ——— barra de herramientas ———
function segGroup(el, cb) { el.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); cb(b.dataset.v); }); }
const run = $('#tb-run');
const syncRun = () => { run.textContent = viewer.isRunning() ? 'Pausar motor' : 'Arrancar motor'; run.setAttribute('aria-pressed', String(viewer.isRunning())); };
if (viewer) {
  segGroup($('#tb-body'), v => viewer.setBody(v));
  segGroup($('#tb-color'), v => { viewer.setColorMode(v); $('#qlegend').hidden = v !== 'qual'; });
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
renderChips();
renderCard(null);

// ——— tiempos de cada cilindro (motor en detalle) ———
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

// ═══════════ Mapa de sensores ═══════════
function sensorCards() {
  $('#sencards').innerHTML = SENSORS.map(id => {
    const P = PARTS[id], S = P.sensor;
    const srcs = [...new Set(P.d.map(r => r[2]))].map(srcBadge).join(' ');
    return `<article class="scard" id="sc-${id}" data-sid="${id}" style="--c:${STATUS[S.status].color}">
      <header><span class="snum">${S.n}</span><h3>${P.name}</h3>${statusPill(S.status)}</header>
      <dl class="kv">
        <div><dt>Qué detecta</dt><dd>${S.mide}</dd></div>
        <div><dt>Dónde está</dt><dd>${S.ubic}</dd></div>
        <div><dt>Señal a</dt><dd>${S.va}</dd></div>
        <div><dt>Tipo</dt><dd>${S.tipo}</dd></div>
      </dl>
      <p class="sc-test"><b>Cómo probarlo:</b> ${S.prueba}</p>
      <footer>${srcs}<button type="button" class="btn ghost sm" data-show3d="${id}">Ver en 3D</button></footer>
    </article>`;
  }).join('');
}
sensorCards();
try { smap = sensorMap($('#senmap'), { onPick: id => pickSensor(id, true) }); } catch (err) { console.error(err); }
function pickSensor(id, scroll) {
  $$('.scard').forEach(c => c.classList.toggle('on', c.dataset.sid === id));
  smap && smap.highlight(id);
  if (scroll) $('#sc-' + id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
}
$('#sencards').addEventListener('click', e => {
  const b = e.target.closest('[data-show3d]');
  if (b && viewer) {
    const id = b.dataset.show3d;
    if (mode() !== 'van') setMode('van');
    $('#modelo').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => viewer.select(id), reduced ? 0 : 450);
    return;
  }
  const c = e.target.closest('.scard'); if (c && !e.target.closest('a')) pickSensor(c.dataset.sid, false);
});

// ═══════════ Diagramas ═══════════
const TABS = [
  { id: 'motor', sys: 'motor', t: 'Motor', h: 'Motor de 4 tiempos y distribución', p: 'Cada cilindro aspira, comprime, explota y expulsa en dos vueltas de cigüeñal. La correa dentada sincroniza el árbol de levas con los pistones.', mount: motor, eng3d: true },
  { id: 'combustible', sys: 'combustible', t: 'Alimentación', h: 'Bencina y carburador', p: 'La bomba eléctrica, en el larguero derecho, llena la cuba; el venturi y los chicleres dosifican la bencina según cuánto abras la mariposa. Compara el carburador actual con el original catalítico.', mount: combustible },
  { id: 'encendido', sys: 'electrico', t: 'Encendido', h: 'Encendido, carga y partida', p: 'El módulo corta la corriente de la bobina en el instante justo y el rotor reparte la chispa. El alternador mantiene la batería cargada.', mount: encendido },
  { id: 'refrigeracion', sys: 'refrigeracion', t: 'Refrigeración', h: 'Refrigeración y calefacción', p: 'La bomba hace circular el refrigerante; el termostato decide cuándo pasa por el radiador, y la calefacción toma agua caliente del múltiple de admisión. Mueve la temperatura para verlo.', mount: refrigeracion },
  { id: 'lubricacion', sys: 'lubricacion', t: 'Aceite', h: 'Lubricación a presión', p: 'La bomba de rotores lleva el aceite filtrado a bancadas, bielas, árbol de levas y balancines.', mount: lubricacion },
  { id: 'escape', sys: 'escape', t: 'Escape', h: 'Escape y catalizador', p: 'Los gases salen en pulsos 1-3-4-2, se tratan en el catalizador y se silencian antes de la cola.', mount: escape },
  { id: 'transmision', sys: 'transmision', t: 'Tren motriz', h: 'Embrague, caja, cardán y diferencial', p: 'La fuerza pasa del volante motor al disco de embrague, la caja la multiplica y el diferencial la reparte entre las ruedas traseras.', mount: transmision },
  { id: 'frenos', sys: 'frenos', t: 'Frenos', h: 'Frenos hidráulicos de doble circuito', p: 'El servofreno multiplica tu fuerza y la bomba tándem la convierte en presión hidráulica para discos y tambores.', mount: frenos },
  { id: 'chasis', sys: 'chasis', t: 'Suspensión', h: 'Dirección y suspensión', p: 'Cremallera adelante; McPherson adelante y paquetes de resortes atrás.', mount: chasis },
];
const tabFor = sys => (TABS.find(tb => tb.sys === sys) || {}).id;
const tablist = $('#tabs'), panels = $('#panels');
const mounted = {};
TABS.forEach((tb, i) => {
  tablist.append(h('button', { type: 'button', role: 'tab', id: 'tab-' + tb.id, 'aria-controls': 'pan-' + tb.id, 'aria-selected': String(i === 0), tabindex: i === 0 ? '0' : '-1', style: `--c:${SYS[tb.sys].color}` }, h('i'), tb.t));
  const specs = SPECS.find(sp => sp.sys === tb.sys);
  const faults = DIAG.filter(dg => dg.sys === tb.sys);
  panels.append(h('section', { role: 'tabpanel', id: 'pan-' + tb.id, 'aria-labelledby': 'tab-' + tb.id, hidden: i !== 0, class: 'panel' },
    h('header', { class: 'panel-head' }, h('h3', {}, tb.h), h('p', {}, tb.p), tb.eng3d ? h('button', { type: 'button', class: 'btn ghost sm', 'data-eng3d': '' }, 'Ver el motor en 3D, por dentro →') : null),
    h('div', { class: 'diag-body' }),
    h('div', { class: 'panel-foot' },
      specs ? h('div', { class: 'mini' }, h('h4', {}, 'Datos técnicos'), h('dl', { class: 'kv', html: specs.rows.map(([k, v, s]) => `<div><dt>${k}</dt><dd>${v} ${srcBadge(s)}</dd></div>`).join('') })) : null,
      faults.length ? h('div', { class: 'mini' }, h('h4', {}, 'Si algo falla'), h('ul', { class: 'warns', html: faults.map(dg => `<li><b>${dg.s}:</b> ${dg.c.slice(0, 3).join('; ').toLowerCase()}.</li>`).join('') })) : null,
    )));
});
panels.addEventListener('click', e => {
  if (!e.target.closest('[data-eng3d]')) return;
  setMode('eng');
  if (viewer) { viewer.setCut('long'); $$('#tb-cut button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === 'long'))); }
  $('#modelo').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
});
function openTab(id, scroll) {
  TABS.forEach(tb => {
    const on = tb.id === id;
    const btn = $('#tab-' + tb.id); btn.setAttribute('aria-selected', String(on)); btn.tabIndex = on ? 0 : -1;
    $('#pan-' + tb.id).hidden = !on;
  });
  ensureMounted(id);
  active = id;
  if (scroll) $('#como-funciona').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  const b = $('#tab-' + id); b.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function ensureMounted(id) {
  if (mounted[id]) return;
  const tb = TABS.find(x => x.id === id);
  const body = $('#pan-' + id + ' .diag-body');
  try { mounted[id] = tb.mount(body); } catch (err) { console.error(err); body.append(h('p', { class: 'muted' }, 'No se pudo cargar este diagrama.')); mounted[id] = { tick() {} }; }
}
tablist.addEventListener('click', e => { const b = e.target.closest('[role=tab]'); if (b) openTab(b.id.slice(4)); });
tablist.addEventListener('keydown', e => {
  const ids = TABS.map(x => x.id); const i = ids.indexOf(active);
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length]; openTab(n); $('#tab-' + n).focus(); }
});
let active = 'motor';
ensureMounted('motor');

// bucle de animación de diagramas
let diagVisible = true, last = performance.now(), acc = 0;
new IntersectionObserver(es => { diagVisible = es[0].isIntersecting; }, { rootMargin: '100px' }).observe($('#como-funciona'));
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (diagVisible && mounted[active] && !document.hidden) {
    if (reduced) { acc += dt; if (acc > 0.25) { mounted[active].tick(acc); acc = 0; } }
    else mounted[active].tick(dt);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ═══════════ Ficha técnica ═══════════
$('#specgrid').innerHTML = SPECS.map(sp => `
  <article class="speccard" style="--c:${SYS[sp.sys].color}">
    <h3><i></i>${SYS[sp.sys].name}</h3>
    <dl class="kv">${sp.rows.map(([k, v, s]) => `<div><dt>${k}</dt><dd>${v} ${srcBadge(s)}</dd></div>`).join('')}</dl>
  </article>`).join('');

// ═══════════ Mantención ═══════════
$('#maint').innerHTML = `<table class="data maint"><thead><tr><th scope="col">Ítem</th><th scope="col">Cada</th><th scope="col">Detalle</th><th scope="col">Fuente</th></tr></thead><tbody>${MAINT.map(m => `
  <tr${m.urgent ? ' class="urgent"' : ''}><th scope="row"><span class="dot" style="--c:${SYS[m.sys].color}"></span>${m.item}${m.urgent ? ' <span class="pill">Prioridad</span>' : ''}</th><td class="when">${m.every}</td><td>${m.note}</td><td>${srcBadge(m.src)}</td></tr>`).join('')}</tbody></table>`;

// ═══════════ Diagnóstico ═══════════
const dsys = [...new Set(DIAG.map(d => d.sys))];
const dchips = $('#diagchips');
dchips.innerHTML = `<button type="button" class="chip" aria-pressed="true" data-ds="">Todos</button>` + dsys.map(id => `<button type="button" class="chip" aria-pressed="false" data-ds="${id}" style="--c:${SYS[id].color}"><i></i>${SYS[id].short}</button>`).join('');
function renderDiag(sys) {
  $('#diaglist').innerHTML = DIAG.filter(d => !sys || d.sys === sys).map(d => `
    <article class="dcard" style="--c:${SYS[d.sys].color}">
      <h3>${d.s}</h3>
      <ol>${d.c.map(c => `<li>${c}</li>`).join('')}</ol>
      <button type="button" class="btn ghost sm" data-show="${d.part}">Ver ${(PARTS[d.part].short || PARTS[d.part].name).replace(/\s*\(.*?\)/g, '').toLowerCase()} en 3D</button>
    </article>`).join('');
}
renderDiag('');
dchips.addEventListener('click', e => { const b = e.target.closest('[data-ds]'); if (!b) return; dchips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b))); renderDiag(b.dataset.ds); });
$('#diaglist').addEventListener('click', e => {
  const b = e.target.closest('[data-show]'); if (!b || !viewer) return;
  if (mode() !== 'van') setMode('van');
  $('#modelo').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  setTimeout(() => viewer.select(b.dataset.show), reduced ? 0 : 450);
});

// ═══════════ Fuentes ═══════════
// todas las fuentes que aparecen en fichas de piezas (aunque la ficha no esté abierta)
for (const id in PARTS) PARTS[id].d.forEach(r => used.add(r[2]));
const order = Object.keys(SRC).filter(k => used.has(k) && (SRC[k].url || k === 'MAN')).sort((a, b) => (b === 'MAN') - (a === 'MAN'));
$('#srclist').innerHTML = order.map(k => `<li>${srcBadge(k)} ${SRC[k].url ? `<a href="${SRC[k].url}" target="_blank" rel="noopener">${SRC[k].title}</a>` : `<span>${SRC[k].title}</span>`}</li>`).join('');

// ═══════════ Mapa de calidad de la información ═══════════
{
  const show3d = id => {
    if (!viewer) return;
    if (mode() !== 'van') setMode('van');
    $('#modelo').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => viewer.select(id), reduced ? 0 : 450);
  };
  try {
    $('#qlegend-keys').append(qualityLegend());
    const tbl = qualityTable($('#qtable'), { onPick: show3d });
    qualitySheet($('#qsheet'), { onSys: sys => tbl.open(sys) });
    qualityNeeds($('#qneeds'), { onPick: show3d });
  } catch (err) { console.error(err); }
}
