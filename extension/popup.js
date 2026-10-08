import { getSettings, getLeads, getRuntime, getStats, dayKey, inviteQuota, slugFromUrl } from './common.js';

const $ = (id) => document.getElementById(id);
const send = (m) => chrome.runtime.sendMessage(m);
const say = (t) => { $('msg').textContent = t; };

async function render() {
  const [s, leads, rt, stats] = await Promise.all([getSettings(), getLeads(), getRuntime(), getStats()]);
  const today = stats[dayKey()] || {};
  const left = inviteQuota(s, stats, Date.now(), rt.invitesBlockedUntil);
  $('inv').textContent = `${today.invites || 0}` + (rt.running ? ` (+${left} left)` : '');
  $('msgs').textContent = today.messages || 0;
  $('drafts').textContent = Object.values(leads).filter((l) => l.draft && !l.draft.approved && (l.draft.text || l.draft.needsHuman)).length;
  $('leads').textContent = Object.keys(leads).length;
  const pill = $('pill');
  pill.textContent = rt.paused ? 'safety pause' : rt.running ? 'running' : 'stopped';
  pill.className = 'pill ' + (rt.paused ? 'paused' : rt.running ? 'on' : '');
  $('banner').hidden = !rt.paused;
  if (rt.paused) $('banner').textContent = rt.paused + ' – check LinkedIn in your browser, then resume from the dashboard.';
  const t = $('toggle');
  t.textContent = rt.paused ? 'Resume' : rt.running ? 'Pause' : 'Start';
  t.className = rt.running && !rt.paused ? 'warn' : 'primary';
  t.onclick = async () => { await send({ type: rt.paused ? 'resume' : rt.running ? 'pause' : 'start' }); render(); };
}

$('dash').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });

$('capture').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('linkedin.com')) return say('Open a LinkedIn search results page (or a profile) first.');
  try {
    let leads;
    if (/linkedin\.com\/in\//.test(tab.url)) {
      const r = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeProfile' });
      const p = r.profile; leads = [{ slug: slugFromUrl(tab.url), name: p.name, headline: p.headline, company: p.company }];
    } else {
      const r = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeSearch' });
      leads = r.leads || [];
    }
    if (!leads.length) return say('No profiles found on this page.');
    const res = await send({ type: 'addLeads', leads, source: 'capture' });
    say(`Added ${res.added} lead(s)` + (res.dup ? `, ${res.dup} already in list.` : '.'));
    render();
  } catch (e) { say('Could not read this page. Reload the LinkedIn tab and try again.\n' + e.message); }
};

$('diag').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { action: 'diagnose' });
    say(Object.entries(r.checks).map(([k, v]) => `${v === true || v > 0 ? '✓' : '✗'} ${k}${typeof v === 'number' ? ' (' + v + ')' : ''}`).join('\n'));
  } catch { say('Open a LinkedIn tab (profile, search, or messaging) and reload it first.'); }
};

render();
chrome.storage.onChanged.addListener(render);

// links in the popup must be opened via the tabs API
document.querySelectorAll('.credit a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: a.href }); }));
