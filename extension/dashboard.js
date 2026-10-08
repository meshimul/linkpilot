import {
  DEFAULT_SETTINGS, PROVIDERS, STATUSES, getSettings, getLeads, getRuntime, getStats, getLogs, get, set, dayKey, inviteQuota, parseLeadInput, setupIssues,
} from './common.js';

const $ = (s, r = document) => r.querySelector(s);
const send = (m) => chrome.runtime.sendMessage(m);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (ts) => { if (!ts) return '–'; const m = Math.round((Date.now() - ts) / 60000); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

let tab = 'overview';
let S, leads, rt, stats, logs;
let leadFilter = 'all', openLead = null, deferred = false;

async function load() { [S, leads, rt, stats, logs] = await Promise.all([getSettings(), getLeads(), getRuntime(), getStats(), getLogs()]); }

async function render() {
  await load();
  const drafts = Object.values(leads).filter((l) => l.draft && !l.draft.approved && (l.draft.text || l.draft.needsHuman));
  $('#badge').hidden = !drafts.length; $('#badge').textContent = drafts.length;
  const pill = $('#pill');
  pill.textContent = rt.paused ? 'safety pause' : rt.running ? 'running' : 'stopped';
  pill.className = 'pill ' + (rt.paused ? 'paused' : rt.running ? 'on' : '');
  const b = $('#banner'); b.hidden = !rt.paused;
  if (rt.paused) { b.innerHTML = `<b>Automation paused:</b> ${esc(rt.paused)} <button class="btn sm" id="resume">I've checked LinkedIn – resume</button>`; $('#resume').onclick = async () => { await send({ type: 'resume' }); }; }
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
  ({ overview, leads: leadsView, approvals: approvalsView, activity: activityView, settings: settingsView })[tab](drafts);
}

// ---------------- overview
function overview() {
  const t = stats[dayKey()] || {};
  const left = inviteQuota(S, stats, Date.now(), rt.invitesBlockedUntil);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  Object.values(leads).forEach((l) => counts[l.status]++);
  const week = Array.from({ length: 7 }, (_, i) => stats[dayKey(new Date(Date.now() - i * 864e5))] || {});
  const sum = (k) => week.reduce((a, d) => a + (d[k] || 0), 0);
  const acc = sum('invites') ? Math.round((sum('accepted') / sum('invites')) * 100) : 0;
  const rep = sum('messages') ? Math.round((sum('replies') / sum('messages')) * 100) : 0;
  $('#view').innerHTML = `
  <div class="toolbar">
    <button class="btn ${rt.running ? 'danger' : 'primary'}" id="toggle">${rt.paused ? 'Resume' : rt.running ? 'Pause automation' : 'Start automation'}</button>
    <button class="btn" id="runnow" ${rt.running && !rt.paused ? '' : 'disabled'}>Run next action now</button>
    <span class="mut">${rt.running ? `Next action ${rt.nextActionAt > Date.now() ? 'in ~' + Math.ceil((rt.nextActionAt - Date.now()) / 60000) + ' min' : 'due (waits for work hours ' + S.workStart + ':00–' + S.workEnd + ':00)'}` : 'Stopped'}</span>
  </div>
  <div class="grid">
    <div class="card stat"><b>${t.invites || 0}<small class="mut"> / ${Math.min(S.dailyInviteMax, (t.invites || 0) + left)}</small></b><span>invites today (limit incl. warm-up)</span></div>
    <div class="card stat"><b>${t.messages || 0}<small class="mut"> / ${S.dailyMessageMax}</small></b><span>messages today</span></div>
    <div class="card stat"><b>${sum('invites')}</b><span>invites, last 7 days (cap ${S.weeklyInviteCap})</span></div>
    <div class="card stat"><b>${acc}%</b><span>acceptance rate, 7 days</span></div>
    <div class="card stat"><b>${rep}%</b><span>reply rate, 7 days</span></div>
  </div>
  <div class="card"><h2>Pipeline</h2><div class="grid" style="margin:0">${STATUSES.map((s) => `<div class="stat"><b>${counts[s]}</b><span>${s.replace('_', ' ')}</span></div>`).join('')}</div></div>
  ${setupIssues(S).length ? `<div class="card" style="margin-top:16px"><h2>Before you start</h2>${setupIssues(S).map((i) => `<div class="${i.level === 'bad' ? 'issue bad' : 'issue'}">${i.level === 'bad' ? '✗' : '!'} ${esc(i.msg)}</div>`).join('')}</div>` : '<p class="mut">✓ Setup looks complete.</p>'}`;
  $('#toggle').onclick = async () => { await send({ type: rt.paused ? 'resume' : rt.running ? 'pause' : 'start' }); };
  $('#runnow').onclick = () => send({ type: 'runNow' });
}

// ---------------- leads
function leadsView() {
  const all = Object.values(leads).sort((a, b) => b.addedAt - a.addedAt);
  const rows = all.filter((l) => leadFilter === 'all' || l.status === leadFilter);
  $('#view').innerHTML = `
  <div class="card" style="margin-bottom:16px"><h2>Add leads</h2>
    <p class="mut">Paste LinkedIn profile URLs, one per line — or CSV lines like <code>url, name, company</code>. You can also capture a whole search-results page with the toolbar popup.</p>
    <textarea id="paste" placeholder="https://www.linkedin.com/in/jane-doe/, Jane Doe, Acme"></textarea>
    <p><button class="btn primary" id="addbtn">Add leads</button> <span id="addmsg" class="mut"></span></p></div>
  <div class="toolbar">
    <select id="filter" style="width:auto"><option value="all">All statuses (${all.length})</option>${STATUSES.map((s) => `<option value="${s}" ${leadFilter === s ? 'selected' : ''}>${s.replace('_', ' ')} (${all.filter((l) => l.status === s).length})</option>`).join('')}</select>
    <button class="btn sm" id="delsel">Delete selected</button><button class="btn sm" id="retrysel">Retry selected (→ new)</button>
  </div>
  <table><thead><tr><th></th><th>Lead</th><th>Status</th><th>Last activity</th><th></th></tr></thead><tbody>
  ${rows.map((l) => `<tr data-id="${esc(l.id)}"><td><input type="checkbox" class="sel" value="${esc(l.id)}"></td>
    <td><a href="${esc(l.url)}" target="_blank">${esc(l.name || l.id)}</a><div class="mut">${esc([l.headline, l.company].filter(Boolean).join(' · ')).slice(0, 110)}</div></td>
    <td><span class="st ${l.status}">${l.status.replace('_', ' ')}</span>${l.error ? `<div class="mut">${esc(l.error)}</div>` : ''}${l.stopReason ? `<div class="mut">${esc(l.stopReason)}</div>` : ''}${l.holdUntil > Date.now() ? `<div class="mut">on hold ${Math.ceil((l.holdUntil - Date.now()) / 3600000)}h${l.fails ? ' · ' + l.fails + ' failed attempt(s)' : ''}</div>` : ''}${l.unverified ? '<div class="mut">invite not confirmed on page</div>' : ''}</td>
    <td class="mut">${ago(l.lastInboundAt || l.lastMessageAt || l.connectedAt || l.invitedAt || l.addedAt)}</td>
    <td><button class="btn sm view" data-id="${esc(l.id)}">${openLead === l.id ? 'Hide' : 'Open'}</button></td></tr>
    ${openLead === l.id ? `<tr><td></td><td colspan="4">${leadDetail(l)}</td></tr>` : ''}`).join('') || '<tr><td colspan="5" class="mut">No leads yet.</td></tr>'}
  </tbody></table>`;
  $('#addbtn').onclick = async () => {
    const seeds = parseLeadInput($('#paste').value);
    if (!seeds.length) { $('#addmsg').textContent = 'No valid linkedin.com/in/… URLs found.'; return; }
    const r = await send({ type: 'addLeads', leads: seeds, source: 'import' });
    $('#paste').value = ''; $('#addmsg').textContent = `Added ${r.added}, skipped ${r.dup} duplicates.`;
  };
  $('#filter').onchange = (e) => { leadFilter = e.target.value; render(); };
  const ids = () => [...document.querySelectorAll('.sel:checked')].map((x) => x.value);
  $('#delsel').onclick = async () => { if (ids().length && confirm(`Delete ${ids().length} lead(s)?`)) await send({ type: 'deleteLeads', ids: ids() }); };
  $('#retrysel').onclick = async () => { for (const id of ids()) await send({ type: 'updateLead', id, patch: { status: 'new', error: null, stopReason: null, holdUntil: null, fails: 0, skipNote: false } }); };
  document.querySelectorAll('.view').forEach((b) => (b.onclick = () => { openLead = openLead === b.dataset.id ? null : b.dataset.id; render(); }));
  document.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
    const patch = { stop: { status: 'stopped', stopReason: 'manual' }, booked: { status: 'booked', stopReason: 'booked', draft: null } }[b.dataset.act];
    await send({ type: 'updateLead', id: b.dataset.id, patch });
  }));
}
function leadDetail(l) {
  return `<div class="thread">${(l.thread || []).map((m) => `<p class="${m.from}"><b>${m.from === 'me' ? 'Me' : esc(l.firstName || 'Them')}:</b> ${esc(m.text)}</p>`).join('') || '<span class="mut">No messages yet.</span>'}</div>
  ${l.note ? `<p class="mut">Connection note: ${esc(l.note)}</p>` : ''}
  <p><button class="btn sm" data-act="stop" data-id="${esc(l.id)}">Stop sequence</button> <button class="btn sm" data-act="booked" data-id="${esc(l.id)}">Mark booked</button></p>`;
}

// ---------------- approvals
function approvalsView(drafts) {
  $('#view').innerHTML = `<h2>Drafts awaiting approval</h2>
  <p class="mut">Nothing is sent until you approve. Approved messages go out at the next allowed action slot (within work hours, respecting gaps and daily limits).</p>
  ${drafts.map((l) => {
    const lastIn = [...(l.thread || [])].reverse().find((m) => m.from === 'them');
    return `<div class="card draft" data-id="${esc(l.id)}"><b>${esc(l.name || l.id)}</b> <span class="mut">${esc(l.headline || '')}</span>
      <span class="tag">${esc(l.draft.kind)}${l.draft.intent ? ' · ' + esc(l.draft.intent) : ''}</span>${l.draft.needsHuman ? '<span class="tag" style="background:#fee2e2">needs you – AI flagged</span>' : ''}${l.draft.flagged ? '<span class="tag" style="background:#fee2e2">possible prompt-injection in their text – AI skipped</span>' : ''}
      ${lastIn ? `<div class="thread" style="margin:8px 0"><p class="them">${esc(lastIn.text)}</p></div>` : ''}
      <textarea placeholder="${l.draft.text ? '' : 'The AI left this for you – write your reply here, then approve.'}">${esc(l.draft.text)}</textarea>
      <p><button class="btn primary sm ok">Approve &amp; queue</button> <button class="btn sm regen">Regenerate</button> <button class="btn sm no">Discard</button> ${l.draft.error ? `<span class="mut">last error: ${esc(l.draft.error)}</span>` : ''}</p></div>`;
  }).join('') || '<div class="card mut">Nothing waiting. Drafts appear here when the AI writes openers, follow-ups and replies.</div>'}`;
  document.querySelectorAll('.draft').forEach((d) => {
    const id = d.dataset.id;
    $('.ok', d).onclick = async () => { const r = await send({ type: 'approveDraft', id, text: $('textarea', d).value.trim() }); if (!r.ok) alert(r.error); };
    $('.no', d).onclick = () => send({ type: 'discardDraft', id });
    $('.regen', d).onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Working…'; const r = await send({ type: 'regenerate', id }); if (!r.ok) alert(r.error); };
  });
}

// ---------------- activity
function activityView() {
  $('#view').innerHTML = `<h2>Activity log</h2><div class="card log">${logs.map((e) => `<div class="${e.type}"><time>${new Date(e.ts).toLocaleString()}</time><span>${esc(e.msg)}</span></div>`).join('') || '<span class="mut">Nothing yet.</span>'}</div>`;
}

// ---------------- settings
const F = [
  ['AI', [
    ['provider', 'Provider', 'select', Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v.label]))],
    ['apiKey', 'API key', 'password', null, 'Stored only in this browser; sent only to the provider.'],
    ['model', 'Model', 'text', null, 'Groq free tier: openai/gpt-oss-20b (limits change – check console.groq.com)'],
    ['baseUrl', 'Base URL (auto-filled for presets)', 'text'],
  ]],
  ['Who you are & what you offer', [
    ['senderName', 'Your name', 'text'], ['senderRole', 'Your role', 'text'], ['company', 'Company', 'text'],
    ['offer', 'What you offer (be specific & truthful – the AI uses only this)', 'textarea', null, null, true],
    ['proof', 'Proof points: real clients, numbers, results the AI may cite (one per line)', 'textarea', null, 'The AI may cite nothing outside offer + proof. Empty = no claims at all.', true],
    ['audience', 'Ideal audience', 'textarea', null, null, true],
    ['tone', 'Tone', 'textarea', null, null, true],
    ['goal', 'Conversation goal', 'text'], ['calendarLink', 'Calendar link', 'text'],
    ['objectionNotes', 'Objection-handling notes (optional)', 'textarea', null, 'e.g. “Too expensive → mention the free audit”', true],
  ]],
  ['Behaviour', [
    ['sendNote', 'Send AI-personalised connection note', 'checkbox', null, 'Free accounts have a small monthly note allowance; LinkPilot falls back to no-note automatically.'],
    ['approvalMode', 'Require my approval before any AI message is sent (recommended)', 'checkbox'],
    ['keepTabVisible', 'Run in a small separate window instead of a hidden tab (recommended – hidden tabs are throttled by Chrome)', 'checkbox'],
    ['assistMode', 'Assist mode: LinkPilot fills the invite/message but YOU click Send (safest)', 'checkbox', null, 'The window comes to the front and waits up to 4 min for you.'],
  ]],
  ['Safety limits (stay conservative)', [
    ['dailyInviteMax', 'Max invites per day', 'number'], ['weeklyInviteCap', 'Max invites per 7 days', 'number'],
    ['warmupEnabled', 'Warm-up ramp', 'checkbox'], ['warmupStart', 'Warm-up: day-0 invites', 'number'], ['warmupStep', 'Warm-up: +invites per day', 'number'],
    ['dailyMessageMax', 'Max messages per day', 'number'],
    ['gapMinMin', 'Min minutes between actions', 'number'], ['gapMaxMin', 'Max minutes between actions', 'number'],
    ['workStart', 'Work hours start (0–23, browser time)', 'number'], ['workEnd', 'Work hours end (0–23)', 'number'],
    ['workDays', 'Work days', 'days'],
    ['followupDays', 'Follow up after (days)', 'number'], ['maxFollowups', 'Max follow-ups', 'number'],
    ['inboxScanMin', 'Inbox scan every (min)', 'number'], ['connScanMin', 'Acceptance scan every (min)', 'number'],
  ]],
];
function settingsView() {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const field = ([k, label, type, opts, hint, wide]) => {
    const v = S[k];
    const lab = `<label>${esc(label)}${hint ? ` <span class="hint">– ${esc(hint)}</span>` : ''}</label>`;
    let el;
    if (type === 'select') el = `<select data-k="${k}">${Object.entries(opts).map(([a, b]) => `<option value="${a}" ${v === a ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
    else if (type === 'textarea') el = `<textarea data-k="${k}">${esc(v)}</textarea>`;
    else if (type === 'checkbox') return `<div><label><input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}> ${esc(label)}</label>${hint ? `<div class="mut">${esc(hint)}</div>` : ''}</div>`;
    else if (type === 'days') el = `<div class="days">${DAYS.map((d, i) => `<label><input type="checkbox" data-day="${i}" ${v.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div>`;
    else el = `<input type="${type}" data-k="${k}" value="${esc(v)}">`;
    return `<div class="${wide ? 'wide' : ''}">${lab}${el}</div>`;
  };
  $('#view').innerHTML = F.map(([h, fs]) => `<div class="card" style="margin-bottom:16px"><h2>${h}</h2><div class="form">${fs.map(field).join('')}</div></div>`).join('') +
    `<div class="toolbar"><button class="btn primary" id="save">Save settings</button><button class="btn" id="test">Test AI connection</button><span id="smsg" class="mut"></span></div>`;
  $('[data-k="provider"]').onchange = (e) => {
    const p = PROVIDERS[e.target.value]; if (!p) return;
    if (p.baseUrl || e.target.value === 'anthropic') $('[data-k="baseUrl"]').value = p.baseUrl;
    if (p.model) $('[data-k="model"]').value = p.model;
  };
  $('#save').onclick = async () => {
    const next = { ...(await get('settings', {})) };
    document.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      next[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim();
    });
    if (!next.model && PROVIDERS[next.provider]?.model) next.model = PROVIDERS[next.provider].model;
    next.workDays = [...document.querySelectorAll('[data-day]:checked')].map((x) => Number(x.dataset.day));
    if (next.provider !== 'anthropic') {
      try {
        const origins = [new URL(next.baseUrl).origin + '/*'];
        if (!(await chrome.permissions.contains({ origins })) && !(await chrome.permissions.request({ origins }))) { $('#smsg').textContent = 'Permission to reach ' + origins[0] + ' was denied.'; return; }
      } catch { $('#smsg').textContent = 'Invalid base URL.'; return; }
    }
    await set('settings', next);
    $('#smsg').textContent = 'Saved.';
  };
  $('#test').onclick = async () => { $('#smsg').textContent = 'Testing…'; const r = await send({ type: 'testAI' }); $('#smsg').textContent = r.ok ? '✓ AI replied: ' + r.text : '✗ ' + r.error; };
}

// ---------------- wiring
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
chrome.storage.onChanged.addListener(() => {
  if (tab === 'settings') return; // never re-render the form while editing
  if (/TEXTAREA|INPUT|SELECT/.test(document.activeElement?.tagName || '')) { deferred = true; return; } // don't clobber typing
  render();
});
document.addEventListener('focusout', () => { if (deferred) { deferred = false; setTimeout(render, 200); } });
render();
