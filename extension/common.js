// Shared helpers + defaults. Imported by background.js, popup.js and dashboard.js.
// Pure functions here are unit-tested in node (see test/logic.test.mjs).

export const DEFAULT_SETTINGS = {
  // AI
  provider: 'groq', // see PROVIDERS; 'anthropic' uses the Messages API, everything else is OpenAI-compatible
  apiKey: '',
  model: 'openai/gpt-oss-20b',
  baseUrl: 'https://api.groq.com/openai/v1',
  // Persona / offer
  senderName: '',
  senderRole: '',
  company: '',
  offer: '',
  proof: '', // real facts/numbers/clients the AI is allowed to cite (it may cite nothing else)
  audience: '',
  tone: 'Friendly, concise, professional. No hype, no emojis, no buzzwords.',
  goal: 'Book a 15-minute intro call',
  calendarLink: '',
  objectionNotes: '',
  // Behaviour
  sendNote: true,
  approvalMode: true, // AI drafts wait for your approval before sending
  // Safety limits
  dailyInviteMax: 20,
  weeklyInviteCap: 90,
  warmupEnabled: true,
  warmupStart: 5,
  warmupStep: 2,
  warmupStartedAt: null,
  dailyMessageMax: 40,
  gapMinMin: 3,
  gapMaxMin: 9,
  workStart: 9,
  workEnd: 18,
  workDays: [1, 2, 3, 4, 5],
  followupDays: 4,
  maxFollowups: 2,
  inboxScanMin: 20,
  connScanMin: 60,
  keepTabVisible: true, // run in a small separate window (hidden tabs get their timers throttled by Chrome)
  assistMode: false, // fill the invite note / message but let YOU click Send (safest; no synthetic Send click)
};

export const PROVIDERS = {
  anthropic:  { label: 'Anthropic (Claude)',            baseUrl: '',                                                      model: 'claude-sonnet-5-5' },
  groq:       { label: 'Groq (free tier, gpt-oss-20b)', baseUrl: 'https://api.groq.com/openai/v1',                        model: 'openai/gpt-oss-20b' },
  cerebras:   { label: 'Cerebras (free tier)',          baseUrl: 'https://api.cerebras.ai/v1',                            model: 'llama3.1-8b' },
  openrouter: { label: 'OpenRouter (:free models)',     baseUrl: 'https://openrouter.ai/api/v1',                          model: 'meta-llama/llama-3.3-70b-instruct:free' },
  gemini:     { label: 'Google Gemini (AI Studio)',     baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  mistral:    { label: 'Mistral (free Experiment)',     baseUrl: 'https://api.mistral.ai/v1',                             model: 'mistral-small-latest' },
  ollama:     { label: 'Ollama (local, no key needed)', baseUrl: 'http://localhost:11434/v1',                             model: 'llama3.2' },
  openai:     { label: 'OpenAI',                        baseUrl: 'https://api.openai.com/v1',                             model: 'gpt-4o-mini' },
  custom:     { label: 'Other OpenAI-compatible',       baseUrl: '',                                                      model: '' },
};

export const STATUSES = ['new', 'invited', 'connected', 'messaged', 'replied', 'link_sent', 'booked', 'stopped', 'failed'];

// ---------- storage ----------
const store = () => chrome.storage.local;
export const get = async (k, d) => { const o = await store().get(k); return o[k] ?? d; };
export const set = (k, v) => store().set({ [k]: v });
export const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await get('settings', {})) });
export const getLeads = () => get('leads', {});
export const getStats = () => get('stats', {});
export const getLogs = () => get('logs', []);
export const getRuntime = async () => ({ running: false, paused: null, nextActionAt: 0, lastInboxScan: 0, lastConnScan: 0, invitesBlockedUntil: 0, ...(await get('runtime', {})) });

export async function addLog(type, msg, leadId) {
  const logs = await getLogs();
  logs.unshift({ ts: Date.now(), type, msg, leadId: leadId || null });
  await set('logs', logs.slice(0, 600));
}

// ---------- pure helpers ----------
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (a, b) => a + Math.random() * (b - a);
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Vanity slugs are case-insensitive (we lowercase them to dedupe), but member-ID slugs ("ACoAA…") are case-sensitive.
export const normSlug = (s) => (/^ACo[A-Za-z0-9_-]{10,}$/.test(s) ? s : s.toLowerCase());
export function slugFromUrl(url) {
  const m = String(url || '').match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (!m) return null;
  let s = m[1];
  try { s = decodeURIComponent(s); } catch { /* keep raw */ }
  return normSlug(s);
}
export const profileUrl = (slug) => `https://www.linkedin.com/in/${slug}/`;

export const normName = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

export const firstName = (full) => String(full || '').trim().split(/\s+/)[0] || '';

export function inWorkHours(s, d = new Date()) {
  return s.workDays.includes(d.getDay()) && d.getHours() >= s.workStart && d.getHours() < s.workEnd;
}

// How many more invites may be sent right now (daily cap incl. warm-up, weekly cap, temp block).
export function inviteQuota(s, stats, now = Date.now(), blockedUntil = 0) {
  if (now < blockedUntil) return 0;
  const today = stats[dayKey(new Date(now))]?.invites || 0;
  let cap = s.dailyInviteMax;
  if (s.warmupEnabled && s.warmupStartedAt) {
    const days = Math.max(0, Math.floor((now - s.warmupStartedAt) / 864e5));
    cap = Math.min(cap, s.warmupStart + s.warmupStep * days);
  }
  let week = 0;
  for (let i = 0; i < 7; i++) week += stats[dayKey(new Date(now - i * 864e5))]?.invites || 0;
  return Math.max(0, Math.min(cap - today, s.weeklyInviteCap - week));
}

export function extractJSON(text) {
  if (!text) return null;
  const t = String(text).replace(/```(?:json)?/gi, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

// Trim to a character budget, preferring a sentence/word boundary.
export function fitLength(text, max) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (end > max * 0.6) return cut.slice(0, end + 1).trim();
  return cut.slice(0, cut.lastIndexOf(' ')).trim();
}

// Names match if first + last tokens agree (handles "Dr." / middle names / credentials).
const TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'prof', 'eng', 'md', 'phd', 'mba', 'cpa']);
export function sameName(a, b) {
  const toks = (s) => normName(s).split(' ').filter((t) => t && !TITLES.has(t));
  const x = toks(a), y = toks(b);
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  return x[0] === y[0] && (x.length === 1 || y.length === 1 || x[x.length - 1] === y[y.length - 1]);
}

// Parse pasted text (URLs, or CSV: url,name,company) into lead seeds.
export function parseLeadInput(raw) {
  const out = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    const cols = l.split(/,|\t/).map((c) => c.trim().replace(/^"|"$/g, ''));
    const url = cols.find((c) => /linkedin\.com\/in\//i.test(c));
    const slug = slugFromUrl(url);
    if (!slug) continue;
    const rest = cols.filter((c) => c !== url);
    out.push({ slug, name: rest[0] || '', company: rest[1] || '' });
  }
  return out;
}

// ---------- safety / quality helpers for AI-written text (pure, unit-tested) ----------

// Per-lead backoff after a failed task: 30 min, 60 min, 2 h … (callers stop retrying after 3 fails).
export const backoffMs = (fails) => Math.min(8, 2 ** Math.max(0, fails - 1)) * 30 * 60000;
export const leadReady = (l, now = Date.now()) => !(l.holdUntil > now);

// Prospect-supplied text (headline, About, messages) is DATA. Remove anything that could close our
// delimiter tags or fake a role marker, collapse whitespace and cap the length.
export function neutralize(text, max = 600) {
  return String(text || '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

const INJECTION = [
  /ignore\s+(all\s+|any\s+)?(your\s+|the\s+|my\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(the\s+|your\s+|all\s+)?(previous|prior|above|system|instructions?)/i,
  /(system|developer)\s+prompt/i,
  /(reveal|show|print|repeat)\s+(me\s+)?(your|the)\s+(instructions?|prompt|rules)/i,
  /new\s+instructions?\s*:/i,
  /you\s+are\s+(now|actually)\s+(a|an|my)\b/i,
  /\b(do\s+not|don'?t)\s+(follow|obey)\s+(the\s+)?(above|previous|prior)/i,
  /\[\/?(system|inst)\]|<\/?(system|assistant|instructions?)\b/i,
];
export const looksLikeInjection = (text) => INJECTION.some((re) => re.test(String(text || '')));

// Cheap deterministic intent checks run BEFORE the AI so a small model can't miss them.
export function quickIntent(text) {
  const t = String(text || '');
  if (/\b(not interested|no,? thanks?|no thank you|unsubscribe|stop (messaging|contacting|emailing|sending|writing)|please stop|remove me|take me off|(do not|don'?t) (message|contact|email) me|leave me alone|not a (good )?fit|not for us)\b/i.test(t)) return 'not_interested';
  if (/\b(are you (a |an )?(bot|ai|robot|chat ?gpt|automated|real person|human)|is this (a |an )?(bot|automated|ai)|chat ?gpt|automation tool|pric(e|ing)|how much|cost|quote|contract|\bnda\b|legal|lawyer|refund|scam|spam|report you)\b/i.test(t)) return 'needs_human';
  return null;
}

// Phrases that make a message read as AI/template-written (see linkedin-skills humanizer notes).
const TELLS = [
  /\b(delve|leverage[sd]?|synerg(y|ies)|tapestry|landscape|unlock(s|ing)?|elevate|seamless(ly)?|robust|cutting-edge|game-?chang(er|ing)|revolutioni[sz]e|streamline|empower(s|ing)?|holistic|testament|ever-evolving|thrilled|passionate|pivotal|realm|spearhead)\b/i,
  /hope (this|you)[^.]{0,40}(finds you|are (doing )?well)/i,
  /\b(i )?(came|stumbled) across your (profile|post|work)/i,
  /\b(impressive|incredible|remarkable|inspiring) (background|work|journey|profile|experience)/i,
  /\b(pick your brain|circle back|touch base|synergy|low-hanging fruit)\b/i,
  /\bnot (just|only) [^,.]{1,50}, but\b/i,
  /\b(would|i'?d) love to (connect|chat)\b/i,
  /\bin today'?s (fast-paced|digital|competitive)\b/i,
];
export const aiTells = (text) => TELLS.map((re) => (String(text || '').match(re) || [])[0]).filter(Boolean);

// Final scrub applied to every AI-written message before it is stored/sent:
// plain text only, no emoji, no em/en-dash clauses, no placeholders, and no URL except the user's own calendar link.
export function sanitizeMessage(text, { allowedUrl = '' } = {}) {
  const keep = String(allowedUrl || '').trim();
  const scrub = (chunk) => String(chunk)
    .replace(/https?:\/\/\S+|www\.\S+/gi, '')
    .replace(/\*\*|__|`+/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/[“”„]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\[[^\]]{1,40}\]|\{\{[^}]*\}\}/g, '')
    .replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;!?])/g, '$1').replace(/,\s*,/g, ',');
  const parts = keep ? String(text || '').split(keep) : [String(text || '')];
  let out = parts.map(scrub).join(keep).trim();
  out = out.replace(/^["']|["']$/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

// What still needs filling in before the first run (shown on the dashboard).
export function setupIssues(s) {
  const out = [];
  if (!s.apiKey && s.provider !== 'ollama') out.push({ level: 'bad', msg: 'Add your AI API key (Settings → AI) and press “Test AI connection”.' });
  if (!s.senderName) out.push({ level: 'bad', msg: 'Add your name.' });
  if (!s.offer || s.offer.trim().length < 40) out.push({ level: 'bad', msg: 'Describe what you offer in 2–3 specific sentences – the AI can only use what you write.' });
  if (!s.audience) out.push({ level: 'warn', msg: 'Describe your ideal audience.' });
  if (!s.proof) out.push({ level: 'warn', msg: 'Add “proof points” (real clients, numbers, results). Without them messages stay generic – the AI is not allowed to invent any.' });
  if (!s.calendarLink) out.push({ level: 'warn', msg: 'Add a calendar link so interested leads can book.' });
  if (!s.approvalMode) out.push({ level: 'warn', msg: 'Approval mode is OFF – AI messages will be sent without your review.' });
  return out;
}
