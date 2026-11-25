'use strict';

/* ---------- Speicher ---------- */
const KEY = 'bbstats_v1';
const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

function emptyState() { return { roster: [], games: [], current: null }; }
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || emptyState(); }
  catch (e) { return emptyState(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Speichern fehlgeschlagen!'); }
}

let S = load();
let view = S.current ? 'game' : 'roster';
let sel = null;      // ausgewählter Spieler (id)
let boxId = null;    // Spiel für die Statistik-Ansicht

/* ---------- Konstanten ---------- */
const ACTIONS = [
  { t: 'p1m', l: '1P ✓', c: 'ok' }, { t: 'p2m', l: '2P ✓', c: 'ok' }, { t: 'p3m', l: '3P ✓', c: 'ok' },
  { t: 'p1x', l: '1P ✗', c: 'miss' }, { t: 'p2x', l: '2P ✗', c: 'miss' }, { t: 'p3x', l: '3P ✗', c: 'miss' },
  { t: 'ast', l: 'Assist', c: 'neu' }, { t: 'oreb', l: 'Off. Reb', c: 'neu' }, { t: 'dreb', l: 'Def. Reb', c: 'neu' },
];
const LABEL = {
  p1m: 'Freiwurf (1P) Treffer', p1x: 'Freiwurf (1P) daneben',
  p2m: '2er Treffer', p2x: '2er daneben', p3m: '3er Treffer', p3x: '3er daneben',
  ast: 'Assist', oreb: 'Offensiv-Rebound', dreb: 'Defensiv-Rebound',
  opp1: 'Gegner +1', opp2: 'Gegner +2', opp3: 'Gegner +3',
};

/* ---------- Helfer ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmt(ms) {
  const t = Math.floor((ms || 0) / 1000);
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
const pct = (m, a) => (a ? Math.round((m / a) * 100) + '%' : '–');
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => { const [y, m, dd] = (d || '').split('-'); return y ? `${dd}.${m}.${y}` : ''; };
const cur = () => S.games.find((g) => g.id === S.current) || null;
const gameById = (id) => S.games.find((g) => g.id === id) || null;
const playerOf = (g, id) => g.players.find((p) => p.id === id);
const byNum = (a, b) => (Number(a.num) || 0) - (Number(b.num) || 0) || a.name.localeCompare(b.name);

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- Spielzeit ---------- */
// Bucht die seit dem letzten Tick vergangene Zeit auf Spieluhr und alle Spieler auf dem Feld.
function settle(g) {
  if (!g || !g.running) return;
  const now = Date.now();
  const d = now - g.lastTick;
  if (d > 0) {
    g.gameMs += d;
    g.onCourt.forEach((id) => { g.time[id] = (g.time[id] || 0) + d; });
  }
  g.lastTick = now;
}

/* ---------- Statistik ---------- */
function blank() { return { p1m: 0, p1a: 0, p2m: 0, p2a: 0, p3m: 0, p3a: 0, ast: 0, oreb: 0, dreb: 0, pts: 0 }; }
function computeStats(g) {
  const s = {};
  g.players.forEach((p) => (s[p.id] = blank()));
  let opp = 0;
  for (const e of g.events) {
    if (e.type.startsWith('opp')) { opp += Number(e.type.slice(3)); continue; }
    const x = s[e.pid];
    if (!x) continue;
    switch (e.type) {
      case 'p1m': x.p1m++; x.p1a++; break;
      case 'p1x': x.p1a++; break;
      case 'p2m': x.p2m++; x.p2a++; break;
      case 'p2x': x.p2a++; break;
      case 'p3m': x.p3m++; x.p3a++; break;
      case 'p3x': x.p3a++; break;
      default: x[e.type]++;
    }
  }
  const tot = blank();
  for (const id in s) {
    const x = s[id];
    x.pts = x.p1m + 2 * x.p2m + 3 * x.p3m;
    for (const k in tot) tot[k] += x[k];
  }
  return { s, tot, opp };
}

/* ---------- Ansichten ---------- */
let lastView = null;
function render() {
  if (view !== lastView) { window.scrollTo(0, 0); lastView = view; }
  document.querySelectorAll('nav button').forEach((b) =>
    b.classList.toggle('active', b.dataset.v === view || (view === 'box' && b.dataset.v === 'history')));
  const app = $('#app');
  if (view === 'roster') app.innerHTML = viewRoster();
  else if (view === 'game') app.innerHTML = viewGame();
  else if (view === 'history') app.innerHTML = viewHistory();
  else if (view === 'box') app.innerHTML = viewBox();
}

function viewRoster() {
  const roster = [...S.roster].sort(byNum);
  const g = cur();
  return `
  <section class="card">
    <h2>Kader</h2>
    <form id="addPlayer" class="row" autocomplete="off">
      <input name="num" type="number" inputmode="numeric" min="0" max="99" placeholder="Nr." class="num">
      <input name="name" placeholder="Name" required>
      <button class="primary">Hinzufügen</button>
    </form>
    ${roster.length ? `<ul class="list">${roster.map((p) => `
      <li><span class="jersey">${esc(p.num)}</span><span class="grow">${esc(p.name)}</span>
      <button class="danger" data-act="delPlayer" data-id="${p.id}" aria-label="Entfernen">✕</button></li>`).join('')}</ul>`
      : '<p class="hint">Noch keine Spieler. Lege zuerst deinen Kader an.</p>'}
  </section>

  <section class="card">
    <h2>Neues Spiel</h2>
    ${g ? `<p class="hint">Laufendes Spiel gegen <b>${esc(g.opponent)}</b>. <button data-act="nav" data-v="game">Fortsetzen</button></p>` : ''}
    <form id="newGame" autocomplete="off">
      <div class="row">
        <label class="field">Gegner<input name="opp" placeholder="z. B. TSV Musterstadt" required></label>
        <label class="field">Datum<input name="date" type="date" value="${today()}"></label>
      </div>
      <h3>Spieler im Kader für dieses Spiel</h3>
      ${roster.length ? `<div class="checks">${roster.map((p) => `
        <label><input type="checkbox" name="p" value="${p.id}" checked> #${esc(p.num)} ${esc(p.name)}</label>`).join('')}</div>`
        : '<p class="hint">Füge oben erst Spieler hinzu.</p>'}
      <button class="primary" ${roster.length ? '' : 'disabled'}>Spiel starten</button>
    </form>
  </section>

  <section class="card">
    <h2>Daten</h2>
    <p class="hint">Alle Daten werden nur auf diesem Gerät gespeichert. Mit einem Backup kannst du sie sichern oder auf ein anderes Gerät übertragen.</p>
    <div class="row">
      <button data-act="export">Backup exportieren</button>
      <button data-act="import">Backup importieren</button>
      <input type="file" id="importFile" accept=".json,application/json" hidden>
    </div>
  </section>`;
}

function card(g, p, st, on) {
  return `<div class="pcard ${on ? 'on' : ''} ${sel === p.id ? 'sel' : ''}" data-act="sel" data-id="${p.id}">
    <div class="ptop"><span class="pnum">#${esc(p.num)}</span><span class="pname">${esc(p.name)}</span></div>
    <div class="pline">${st.pts} Pkt · <span data-time="${p.id}">${fmt(g.time[p.id])}</span></div>
    <button class="sub" data-act="sub" data-id="${p.id}">${on ? '↓ Bank' : '↑ Feld'}</button>
  </div>`;
}

function viewGame() {
  const g = cur();
  if (!g) {
    return `<section class="card"><h2>Kein laufendes Spiel</h2>
      <p class="hint">Starte ein neues Spiel im Bereich „Kader“.</p>
      <button class="primary" data-act="nav" data-v="roster">Zum Kader</button></section>`;
  }
  const { s, tot, opp } = computeStats(g);
  const players = [...g.players].sort(byNum);
  const on = players.filter((p) => g.onCourt.includes(p.id));
  const off = players.filter((p) => !g.onCourt.includes(p.id));
  const sp = sel && playerOf(g, sel);
  const log = g.events.slice(-12).reverse();

  return `
  <div class="scoreboard">
    <div class="team"><div class="tn">Wir</div><div class="sc">${tot.pts}</div></div>
    <div class="mid">
      <div id="clock">${fmt(g.gameMs)}</div>
      <button data-act="clock" class="${g.running ? 'stop' : 'go'}">${g.running ? '⏸ Pause' : '▶ Start'}</button>
      <div class="period">
        <button data-act="per" data-d="-1" aria-label="Viertel zurück">‹</button>
        <span>${g.period > 4 ? 'OT' + (g.period - 4) : 'Q' + g.period}</span>
        <button data-act="per" data-d="1" aria-label="Nächstes Viertel">›</button>
      </div>
    </div>
    <div class="team"><div class="tn">${esc(g.opponent)}</div><div class="sc">${opp}</div>
      <div class="oppbtns">
        <button data-act="opp" data-v="1">+1</button><button data-act="opp" data-v="2">+2</button><button data-act="opp" data-v="3">+3</button>
      </div>
    </div>
  </div>

  <h3>Auf dem Feld <span class="oncount ${on.length > 5 ? 'warn' : ''}">(${on.length}/5)</span></h3>
  ${on.length ? `<div class="grid">${on.map((p) => card(g, p, s[p.id], true)).join('')}</div>`
    : '<p class="hint">Wähle deine Starting Five mit „↑ Feld“. Die Spielzeit läuft nur für Spieler auf dem Feld und nur, wenn die Uhr läuft.</p>'}

  <h3>Bank</h3>
  ${off.length ? `<div class="grid">${off.map((p) => card(g, p, s[p.id], false)).join('')}</div>` : '<p class="hint">Niemand auf der Bank.</p>'}

  <div class="actions ${sp ? '' : 'disabled'}">
    <div class="selinfo">${sp ? `Aktion für <b>#${esc(sp.num)} ${esc(sp.name)}</b>` : 'Erst einen Spieler antippen, dann die Aktion wählen'}</div>
    <div class="abtns">${ACTIONS.map((a) => `<button class="${a.c}" data-act="stat" data-t="${a.t}">${a.l}</button>`).join('')}</div>
  </div>

  <div class="row" style="margin-top:16px">
    <button data-act="undo" ${g.events.length ? '' : 'disabled'}>↶ Rückgängig</button>
    <button data-act="box" data-id="${g.id}">📊 Statistik</button>
    <button class="danger" data-act="finish">Spiel beenden</button>
  </div>

  <h3>Letzte Aktionen</h3>
  ${log.length ? `<ol class="log">${log.map((e) => {
    const p = e.pid && playerOf(g, e.pid);
    return `<li><span class="t">${e.period > 4 ? 'OT' + (e.period - 4) : 'Q' + e.period} ${fmt(e.clock)}</span>
      <span>${p ? `#${esc(p.num)} ${esc(p.name)} – ` : ''}${LABEL[e.type]}</span></li>`;
  }).join('')}</ol>` : '<p class="hint">Noch keine Aktionen erfasst.</p>'}`;
}

function viewHistory() {
  const games = [...S.games].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.created - a.created);
  return `<section class="card"><h2>Spiele</h2>
    ${games.length ? `<ul class="list gamelist">${games.map((g) => {
      const { tot, opp } = computeStats(g);
      const live = g.id === S.current;
      return `<li>
        <span class="grow"><b>${esc(g.opponent)}</b> <span class="muted">${fmtDate(g.date)}</span><br>
          <span class="final" style="font-size:1.1rem">${tot.pts} : ${opp}</span>
          ${live ? '<span class="badge live">läuft</span>' : ''}</span>
        <button data-act="box" data-id="${g.id}">Statistik</button>
        ${live ? '<button data-act="nav" data-v="game">Öffnen</button>' : `<button data-act="resume" data-id="${g.id}">Fortsetzen</button>`}
        <button class="danger" data-act="delGame" data-id="${g.id}" aria-label="Löschen">✕</button>
      </li>`;
    }).join('')}</ul>` : '<p class="hint">Noch keine Spiele.</p>'}
  </section>`;
}

function boxRows(g) {
  const { s, tot, opp } = computeStats(g);
  const players = [...g.players].sort(byNum);
  return { s, tot, opp, players };
}

function viewBox() {
  const g = gameById(boxId);
  if (!g) { view = 'history'; return viewHistory(); }
  const { s, tot, opp, players } = boxRows(g);
  const shot = (m, a) => `${m}/${a}<small>${pct(m, a)}</small>`;
  const row = (name, x, ms, cls = '') => {
    const fgm = x.p2m + x.p3m, fga = x.p2a + x.p3a;
    return `<tr class="${cls}">
      <td class="name">${name}</td><td>${ms === null ? '' : fmt(ms)}</td><td><b>${x.pts}</b></td>
      <td>${shot(x.p1m, x.p1a)}</td><td>${shot(x.p2m, x.p2a)}</td><td>${shot(x.p3m, x.p3a)}</td><td>${shot(fgm, fga)}</td>
      <td>${x.ast}</td><td>${x.oreb}</td><td>${x.dreb}</td><td>${x.oreb + x.dreb}</td></tr>`;
  };
  return `<section class="card">
    <div class="bighead">
      <div><div class="muted">${fmtDate(g.date)} · gegen ${esc(g.opponent)}</div>
        <div class="final">${tot.pts} : ${opp}</div>
        <div class="muted">Spielzeit gesamt: ${fmt(g.gameMs)}</div></div>
      <div class="row">
        <button data-act="csv" data-id="${g.id}">CSV / Excel</button>
        ${g.id === S.current ? '<button data-act="nav" data-v="game">Zurück zum Spiel</button>' : '<button data-act="nav" data-v="history">Zurück</button>'}
      </div>
    </div>
    <div class="tablewrap"><table>
      <thead><tr><th class="name">Spieler</th><th>Min</th><th>Pkt</th><th>1P (FW)</th><th>2P</th><th>3P</th><th>FG</th>
        <th>Ast</th><th>OReb</th><th>DReb</th><th>Reb</th></tr></thead>
      <tbody>
        ${players.map((p) => row(`#${esc(p.num)} ${esc(p.name)}`, s[p.id], g.time[p.id] || 0)).join('')}
        ${row('Team', tot, null, 'total')}
      </tbody>
    </table></div>
    <p class="hint">FG = Feldwürfe (2er + 3er). 1P = Freiwürfe. Unter den Werten steht die Trefferquote.</p>
  </section>`;
}

/* ---------- CSV ---------- */
function csvFor(g) {
  const { s, tot, opp, players } = boxRows(g);
  const head = ['Nr', 'Spieler', 'Minuten', 'Punkte', '1P Treffer', '1P Versuche', '1P %', '2P Treffer', '2P Versuche', '2P %',
    '3P Treffer', '3P Versuche', '3P %', 'FG Treffer', 'FG Versuche', 'FG %', 'Assists', 'Off Reb', 'Def Reb', 'Reb'];
  const line = (num, name, x, ms) => {
    const fgm = x.p2m + x.p3m, fga = x.p2a + x.p3a;
    return [num, name, ms === null ? '' : fmt(ms), x.pts, x.p1m, x.p1a, pct(x.p1m, x.p1a), x.p2m, x.p2a, pct(x.p2m, x.p2a),
      x.p3m, x.p3a, pct(x.p3m, x.p3a), fgm, fga, pct(fgm, fga), x.ast, x.oreb, x.dreb, x.oreb + x.dreb];
  };
  const rows = [
    [`Spiel gegen ${g.opponent}`, fmtDate(g.date), `Ergebnis ${tot.pts}:${opp}`],
    [],
    head,
    ...players.map((p) => line(p.num, p.name, s[p.id], g.time[p.id] || 0)),
    line('', 'Team', tot, g.gameMs),
  ];
  const cell = (v) => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

/* ---------- Events ---------- */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  const g = cur();

  switch (act) {
    case 'nav':
      view = el.dataset.v; sel = null; break;

    case 'delPlayer': {
      const p = S.roster.find((x) => x.id === id);
      if (!p || !confirm(`${p.name} aus dem Kader entfernen? (Vergangene Spiele bleiben erhalten.)`)) return;
      S.roster = S.roster.filter((x) => x.id !== id);
      break;
    }

    case 'sel':
      sel = sel === id ? null : id; break;

    case 'sub':
      if (!g) return;
      settle(g);
      if (g.onCourt.includes(id)) g.onCourt = g.onCourt.filter((x) => x !== id);
      else {
        g.onCourt.push(id);
        if (g.onCourt.length > 5) toast('Achtung: mehr als 5 Spieler auf dem Feld');
      }
      break;

    case 'clock':
      if (!g) return;
      if (g.running) { settle(g); g.running = false; }
      else {
        if (!g.onCourt.length) toast('Hinweis: Noch niemand auf dem Feld');
        g.running = true; g.lastTick = Date.now();
      }
      break;

    case 'per':
      if (!g) return;
      g.period = Math.max(1, g.period + Number(el.dataset.d));
      break;

    case 'stat': {
      if (!g) return;
      if (!sel) { toast('Erst einen Spieler antippen'); return; }
      settle(g);
      const t = el.dataset.t;
      g.events.push({ id: uid(), pid: sel, type: t, period: g.period, clock: g.gameMs, ts: Date.now() });
      const p = playerOf(g, sel);
      toast(`#${p.num} ${p.name}: ${LABEL[t]}`);
      navigator.vibrate?.(25);
      sel = null;
      break;
    }

    case 'opp':
      if (!g) return;
      settle(g);
      g.events.push({ id: uid(), pid: null, type: 'opp' + el.dataset.v, period: g.period, clock: g.gameMs, ts: Date.now() });
      navigator.vibrate?.(25);
      break;

    case 'undo': {
      if (!g || !g.events.length) return;
      const e = g.events.pop();
      const p = e.pid && playerOf(g, e.pid);
      toast('Rückgängig: ' + (p ? `#${p.num} ` : '') + LABEL[e.type]);
      break;
    }

    case 'finish':
      if (!g || !confirm('Spiel beenden? Du kannst es später unter „Spiele“ fortsetzen.')) return;
      settle(g); g.running = false; g.finished = true;
      S.current = null; boxId = g.id; view = 'box'; sel = null;
      break;

    case 'box':
      boxId = id; view = 'box'; break;

    case 'resume': {
      const t = gameById(id);
      if (!t) return;
      if (g && g.id !== id) {
        if (!confirm(`Das laufende Spiel gegen ${g.opponent} wird pausiert. Fortfahren?`)) return;
        settle(g); g.running = false; g.finished = true;
      }
      t.finished = false; S.current = id; view = 'game'; sel = null;
      break;
    }

    case 'delGame': {
      const t = gameById(id);
      if (!t || !confirm(`Spiel gegen ${t.opponent} (${fmtDate(t.date)}) endgültig löschen?`)) return;
      S.games = S.games.filter((x) => x.id !== id);
      if (S.current === id) S.current = null;
      break;
    }

    case 'csv': {
      const t = gameById(id);
      if (!t) return;
      const name = `stats_${t.date || 'spiel'}_${t.opponent.replace(/[^\w\-äöüÄÖÜß]+/g, '_')}.csv`;
      download(name, csvFor(t), 'text/csv;charset=utf-8');
      return;
    }

    case 'export':
      download(`basketball-stats-backup_${today()}.json`, JSON.stringify(S, null, 2), 'application/json');
      return;

    case 'import':
      $('#importFile')?.click();
      return;

    default: return;
  }
  save();
  render();
});

document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target;
  if (f.id === 'addPlayer') {
    const name = f.name.value.trim();
    if (!name) return;
    S.roster.push({ id: uid(), num: f.num.value.trim(), name });
    save(); render();
    $('#addPlayer input[name=num]')?.focus();
  } else if (f.id === 'newGame') {
    const ids = [...f.querySelectorAll('input[name=p]:checked')].map((c) => c.value);
    if (!ids.length) { toast('Mindestens einen Spieler auswählen'); return; }
    const old = cur();
    if (old) {
      if (!confirm(`Das laufende Spiel gegen ${old.opponent} wird beendet. Neues Spiel starten?`)) return;
      settle(old); old.running = false; old.finished = true;
    }
    const g = {
      id: uid(), created: Date.now(), date: f.date.value || today(), opponent: f.opp.value.trim(),
      players: S.roster.filter((p) => ids.includes(p.id)).map((p) => ({ ...p })),
      onCourt: [], time: {}, events: [], gameMs: 0, running: false, lastTick: 0, period: 1, finished: false,
    };
    S.games.push(g);
    S.current = g.id;
    view = 'game'; sel = null;
    save(); render();
  }
});

document.addEventListener('change', async (ev) => {
  if (ev.target.id !== 'importFile') return;
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.roster) || !Array.isArray(data.games)) throw new Error();
    if (!confirm('Backup importieren? Die aktuellen Daten auf diesem Gerät werden ersetzt.')) return;
    S = data; view = S.current ? 'game' : 'roster';
    save(); render(); toast('Backup importiert');
  } catch (e) {
    toast('Ungültige Backup-Datei');
  }
});

/* ---------- Uhr ---------- */
setInterval(() => {
  const g = cur();
  if (!g || !g.running) return;
  settle(g);
  save();
  if (view !== 'game') return;
  const c = $('#clock');
  if (c) c.textContent = fmt(g.gameMs);
  document.querySelectorAll('[data-time]').forEach((el) => { el.textContent = fmt(g.time[el.dataset.time]); });
}, 1000);

document.addEventListener('visibilitychange', () => { const g = cur(); if (g) { settle(g); save(); } });

/* ---------- Offline ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
