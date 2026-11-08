// Mapa de calidad de la información: resumen por sistema, lo que falta y tabla pieza por pieza.
// Escala ordenada (azul = confirmado → naranjo = estimado); cada color va siempre con su nombre escrito.
import { h } from '../svgkit.js';
import { PARTS, SYSTEMS, QLEV, QASP, QUAL, qualOf, NEEDS } from '../data.js';

const ORDER = ['usr', 'man', 'oem', 'sec', 'est'];
const nameOf = id => PARTS[id].short || PARTS[id].name;
const pill = k => h('span', { class: 'qpill', style: `--q:${QLEV[k].color}` }, h('i'), QLEV[k].short);
const partsOf = sys => Object.keys(QUAL).filter(id => PARTS[id] && PARTS[id].sys === sys);

export function qualityLegend() {
  return h('div', { class: 'qlegend-row', role: 'list', 'aria-label': 'Niveles de precisión' },
    ORDER.map(k => h('span', { class: 'qkey', role: 'listitem', title: QLEV[k].label }, h('i', { style: `--q:${QLEV[k].color}` }), QLEV[k].short)));
}

// barra apilada (100 %) de una lista de niveles, con tooltip por segmento
function bar(levels, label) {
  const n = levels.length, wrap = h('span', { class: 'qbar', role: 'img', 'aria-label': `${label}: ` + ORDER.filter(k => levels.includes(k)).map(k => `${QLEV[k].short} ${levels.filter(x => x === k).length}`).join(', ') });
  for (const k of ORDER) {
    const c = levels.filter(x => x === k).length; if (!c) continue;
    wrap.append(h('b', { style: `flex:${c};--q:${QLEV[k].color}`, title: `${label} · ${QLEV[k].label}: ${c} de ${n}` }));
  }
  return wrap;
}

export function qualitySheet(host, { onSys } = {}) {
  const all = Object.keys(QUAL).filter(id => PARTS[id]);
  const head = h('div', { class: 'qs-row qs-head' }, h('span'), h('span'), ...QASP.map(a => h('span', {}, a)));
  const row = (label, ids, sys) => h('div', { class: 'qs-row' + (sys ? '' : ' qs-total'), 'data-qsys': sys || '' },
    h('span', { class: 'qs-name', title: label }, sys ? h('i', { style: `--c:${SYSTEMS.find(s => s.id === sys).color}` }) : null, label), h('span', { class: 'qs-n' }, String(ids.length)),
    ...[0, 1, 2].map(a => bar(ids.map(id => qualOf(id)[a]), `${label} · ${QASP[a]}`)));
  const sheet = h('div', { class: 'qsheet' }, head, row('Todas', all, null),
    ...SYSTEMS.filter(s => partsOf(s.id).length).map(s => row(s.short || s.name, partsOf(s.id), s.id)));
  sheet.addEventListener('click', e => { const r = e.target.closest('[data-qsys]'); if (r && r.dataset.qsys && onSys) onSys(r.dataset.qsys); });
  host.append(qualityLegend(), sheet);
}

export function qualityNeeds(host, { onPick } = {}) {
  const items = NEEDS.map(nd => {
    // piezas que hoy están bajo "manual" en ubicación o forma: son las que más ganan
    const gain = nd.parts.filter(id => PARTS[id] && qualOf(id).slice(0, 2).some(k => QLEV[k].n < QLEV.man.n));
    return { ...nd, gain };
  }).sort((a, b) => b.gain.length - a.gain.length);
  const ol = h('ol', { class: 'qneeds' }, items.map(nd => h('li', {},
    h('p', {}, h('b', {}, nd.label)),
    h('p', { class: 'muted' }, `Mejora ${nd.gain.length} pieza${nd.gain.length === 1 ? '' : 's'} que hoy son aproximadas o estimadas:`),
    h('div', { class: 'qparts' }, nd.gain.map(id => h('button', { type: 'button', class: 'qpart', 'data-qpart': id, style: `--q:${QLEV[qualOf(id)[0]].color}` }, nameOf(id)))))));
  ol.addEventListener('click', e => { const b = e.target.closest('[data-qpart]'); if (b && onPick) onPick(b.dataset.qpart); });
  host.append(ol);
}

export function qualityTable(host, { onPick } = {}) {
  const frag = [];
  for (const s of SYSTEMS) {
    const ids = partsOf(s.id); if (!ids.length) continue;
    const rows = ids.map(id => h('tr', {},
      h('th', { scope: 'row' }, h('button', { type: 'button', class: 'linkbtn', 'data-qpart': id }, nameOf(id))),
      ...qualOf(id).map(k => h('td', {}, pill(k)))));
    frag.push(h('details', { class: 'qdet', 'data-qdet': s.id },
      h('summary', {}, h('i', { style: `--c:${s.color}` }), s.name, h('small', {}, `${ids.length} piezas`)),
      h('div', { class: 'tablewrap' }, h('table', { class: 'data qtable' },
        h('caption', { class: 'sr-only' }, `Precisión de cada pieza: ${s.name}`),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Pieza'), ...QASP.map(a => h('th', { scope: 'col' }, a)))),
        h('tbody', {}, rows)))));
  }
  const wrap = h('div', { class: 'qtables' }, frag);
  wrap.addEventListener('click', e => { const b = e.target.closest('[data-qpart]'); if (b && onPick) onPick(b.dataset.qpart); });
  host.append(wrap);
  return { open(sys) { const d = wrap.querySelector(`[data-qdet="${sys}"]`); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } } };
}

// bloque para la ficha de una pieza
export function qualityCardHTML(id) {
  const lv = qualOf(id);
  const needs = NEEDS.filter(nd => nd.parts.includes(id));
  return `<div class="qcard"><h4>Precisión de esta pieza</h4><dl class="kv">${lv.map((k, a) => `<div><dt>${QASP[a]}</dt><dd><span class="qpill" style="--q:${QLEV[k].color}"><i></i>${QLEV[k].label}</span></dd></div>`).join('')}</dl>${needs.length ? `<p class="muted">La mejoraría: ${needs.map(n => n.label.charAt(0).toLowerCase() + n.label.slice(1)).join('; ')}.</p>` : ''}</div>`;
}
