// LinkPilot content script – runs on linkedin.com and performs page-level actions on request
// from the background worker. LinkedIn changes its markup often: every selector lives in SEL / the
// text-based finders below so it's easy to tune. Use the popup's "Selector check" to see what matched.
(() => {
  if (window.__linkpilotLoaded) return;
  window.__linkpilotLoaded = true;

  // ---------- selectors (tune here) ----------
  const SEL = {
    headline: 'main .text-body-medium.break-words, main div.text-body-medium',
    location: 'main span.text-body-small.inline.t-black--light.break-words',
    degree: '.dist-value, [class*="distance-badge"]',
    aboutSection: '#about',
    convoCard: 'li.msg-conversation-listitem, li.msg-conversation-card, li[class*="msg-conversation"]',
    convoName: '.msg-conversation-listitem__participant-names, .msg-conversation-card__participant-names, h3',
    convoSnippet: '.msg-conversation-card__message-snippet, .msg-conversation-card__message-snippet-body, p[class*="snippet"]',
    convoClick: '.msg-conversation-listitem__link, a, div[role="button"]',
    threadGroup: '.msg-s-message-group',
    groupName: '.msg-s-message-group__name, .msg-s-message-group__profile-link',
    msgBody: '.msg-s-event-listitem__body',
    editor: 'div.msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable [contenteditable="true"], div[role="textbox"][contenteditable="true"]',
    sendBtn: 'button.msg-form__send-button, button.msg-form__send-btn',
  };

  // ---------- helpers ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const txt = (el) => clean(el && (el.innerText || el.textContent));
  const norm = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isVisible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  // vanity slugs are case-insensitive (lowercase to dedupe); member-ID slugs ("ACoAA…") are case-sensitive – keep as is
  const slugFromHref = (h) => {
    const m = String(h || '').match(/linkedin\.com\/in\/([^/?#]+)/i) || String(h || '').match(/^\/in\/([^/?#]+)/i);
    if (!m) return null;
    let s = m[1]; try { s = decodeURIComponent(s); } catch { /* keep raw */ }
    return /^ACo[A-Za-z0-9_-]{10,}$/.test(s) ? s : s.toLowerCase();
  };

  async function waitFor(fn, timeout = 8000, step = 250) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { try { const v = fn(); if (v) return v; } catch { /* keep waiting */ } await sleep(step); }
    return null;
  }

  function findButton(re, root = document) {
    const cands = $$('button, a[role="button"], a.artdeco-button, [role="button"], [role="menuitem"]', root);
    return cands.find((el) => isVisible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' &&
      (re.test(clean(el.getAttribute('aria-label'))) || re.test(txt(el)))) || null;
  }

  async function humanClick(el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await sleep(rand(400, 900));
    const r = el.getBoundingClientRect();
    const x = r.left + r.width * rand(0.3, 0.7), y = r.top + r.height * rand(0.3, 0.7);
    for (const t of ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    }
    await sleep(rand(300, 700));
  }

  function setValue(el, v) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function humanType(el, text) {
    el.focus();
    await sleep(rand(300, 700));
    if (el.isContentEditable) {
      document.execCommand('selectAll', false);
      document.execCommand('delete', false);
      const lines = text.split('\n');
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        for (let i = 0; i < line.length;) {
          const n = Math.ceil(rand(1, 4));
          document.execCommand('insertText', false, line.slice(i, i + n));
          i += n;
          await sleep(rand(25, 90));
          if (Math.random() < 0.02) await sleep(rand(200, 600));
        }
        if (li < lines.length - 1) document.execCommand('insertParagraph');
      }
    } else {
      setValue(el, '');
      let cur = '';
      for (let i = 0; i < text.length;) {
        const n = Math.ceil(rand(1, 4));
        cur += text.slice(i, i + n); i += n;
        setValue(el, cur);
        await sleep(rand(25, 90));
      }
    }
  }

  async function browse() {
    window.scrollBy({ top: rand(200, 600), behavior: 'smooth' });
    await sleep(rand(800, 1800));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(rand(500, 1000));
  }

  const topCard = () => ($('main h1') || $('h1'))?.closest('section') || $('main') || document.body;

  // ---------- safety ----------
  // Only look where LinkedIn puts notices (dialogs, toasts, headings, or a nearly empty interstitial page) –
  // never at free text such as profile About sections or message bodies, which could contain these phrases.
  function safetyText() {
    const parts = $$('[role="dialog"], [role="alertdialog"], .artdeco-modal, .artdeco-toast-item, #captcha-internal, h1, h2').slice(0, 14).map(txt);
    const whole = document.body?.innerText || '';
    if (whole.length < 800) parts.push(whole);
    return parts.join('\n').slice(0, 4000);
  }
  function safety() {
    const u = location.href;
    if (/\/checkpoint\/|\/authwall|\/uas\/login|\/login\b/.test(u)) return { restricted: true, reason: 'LinkedIn asked for sign-in/verification: ' + u };
    const body = safetyText();
    if (/temporarily restricted|unusual activity|verify (that )?you('|’)?re (a )?human|account (has been )?restricted|security verification/i.test(body)) {
      return { restricted: true, reason: 'LinkedIn shows a restriction / verification notice' };
    }
    if (/reached the weekly invitation limit|weekly invitation limit|invitation limit/i.test(body)) return { limit: true };
    return {};
  }

  // ---------- actions ----------
  const actions = {
    async ping() { return { ready: document.readyState }; },
    async safety() { return {}; },

    // Lead capture from a search-results page
    async scrapeSearch() {
      const seen = new Map();
      for (const a of $$('main a[href*="/in/"]')) {
        const slug = slugFromHref(a.href);
        if (!slug || seen.has(slug)) continue;
        const card = a.closest('li') || a.closest('[data-view-name]') || a.parentElement?.parentElement;
        if (!card) continue;
        const lines = (card.innerText || '').split('\n').map(clean).filter(Boolean);
        let name = clean((a.querySelector('span[aria-hidden="true"]') || a).innerText.split('\n')[0]);
        if (!name || /linkedin member/i.test(name)) name = lines[0] || '';
        if (!name || name.length > 80) continue;
        const rest = lines.slice(lines.indexOf(name) + 1).filter((l) => !/^[•·]/.test(l) && !/^(1st|2nd|3rd)/i.test(l) && !/degree connection|^view .*profile|^connect$|^message$|^follow$|status is/i.test(l));
        seen.set(slug, { slug, name, headline: rest[0] || '', company: (rest[0] || '').match(/\bat\s+(.+?)(?:\s*[|•·]|$)/i)?.[1] || '' });
      }
      return { leads: [...seen.values()] };
    },

    async scrapeProfile() {
      await browse();
      const top = topCard();
      const name = txt($('main h1') || $('h1'));
      const headline = txt($(SEL.headline));
      const location_ = txt($(SEL.location));
      let degree = (txt($(SEL.degree, top)).match(/(1st|2nd|3rd)/) || [])[1];
      if (!degree) degree = (txt(top).match(/·\s*(1st|2nd|3rd)\b/) || [])[1];
      const aboutSec = $(SEL.aboutSection)?.closest('section');
      const about = aboutSec ? txt($('.inline-show-more-text, span[aria-hidden="true"]', aboutSec) || aboutSec).replace(/^About\s*/i, '').slice(0, 900) : '';
      const company = (headline.match(/\bat\s+(.+?)(?:\s*[|•·]|$)/i) || [])[1] || '';
      return {
        profile: {
          name, headline, location: location_, about, company, degree: degree || null,
          canMessage: !!findButton(/^message$/i, top), pending: !!findButton(/^pending/i, top), canConnect: !!findButton(/^connect$|^invite .* to connect$/i, top),
        },
      };
    },

    // assist=true: fill everything in but let the human click the final Send (waits up to 4 min for them).
    async connect({ note, assist } = {}) {
      const top = topCard();
      if (findButton(/^pending/i, top)) return { ok: true, already: 'pending' };
      let btn = findButton(/^connect$|^invite .* to connect$/i, top);
      if (!btn) {
        const more = findButton(/^more( actions)?$/i, top);
        if (more) {
          await humanClick(more);
          await sleep(700);
          // exact match only: /connect/i would also hit "Remove connection"
          btn = findButton(/^connect$|invite .* to connect/i, $('[role="menu"], .artdeco-dropdown__content') || document);
        }
      }
      if (!btn) return { ok: false, reason: findButton(/^message$/i, top) ? 'already_connected' : 'no_connect_button' };
      await humanClick(btn);

      const modal = await waitFor(() => { const m = $('[role="dialog"], .artdeco-modal'); return isVisible(m) ? m : null; }, 4000);
      if (!modal) {
        const sent = await waitFor(() => findButton(/^pending/i, top), 3500);
        return sent ? { ok: true } : { ok: false, reason: 'no_modal' };
      }
      const closeModal = async () => { const x = findButton(/^dismiss$|^close$/i, modal); if (x) await humanClick(x); };
      if ($('input[type="email"]', modal)) { await closeModal(); return { ok: false, reason: 'email_required' }; }
      const userSends = async () => {
        const gone = await waitFor(() => !isVisible($('[role="dialog"], .artdeco-modal')), 240000, 500);
        if (!gone) { await closeModal(); return { ok: false, reason: 'not_sent_by_user' }; }
        const sent = await waitFor(() => findButton(/^pending/i, top), 4000);
        return sent ? { ok: true } : { ok: false, reason: 'not_sent_by_user' };
      };

      if (note) {
        const add = findButton(/add a note/i, modal);
        if (!add) { await closeModal(); return { ok: false, reason: 'note_limit' }; }
        await humanClick(add);
        const ta = await waitFor(() => $('textarea', modal), 3000);
        if (!ta) { await closeModal(); return { ok: false, reason: 'note_limit' }; }
        await humanType(ta, note.slice(0, 300));
        await sleep(rand(600, 1400));
        if (assist) return await userSends();
        const send = findButton(/^send( invitation)?$/i, modal);
        if (!send) { await closeModal(); return { ok: false, reason: 'no_send_button' }; }
        await humanClick(send);
      } else {
        if (assist) return await userSends();
        const send = findButton(/send without a note/i, modal) || findButton(/^send( invitation)?$/i, modal);
        if (!send) { await closeModal(); return { ok: false, reason: 'no_send_button' }; }
        await humanClick(send);
      }
      await sleep(1500);
      const sf = safety();
      if (sf.limit) return { ok: false, reason: 'weekly_limit' };
      const confirmed = await waitFor(() => findButton(/^pending/i, top) || !isVisible($('[role="dialog"], .artdeco-modal')), 5000);
      return confirmed ? { ok: true } : { ok: false, reason: 'not_confirmed' };
    },

    // Send a message via the profile's Message button (opens the overlay incl. history)
    async sendMessage({ text, assist }) {
      const top = topCard();
      const btn = findButton(/^message$/i, top);
      if (!btn) return { ok: false, reason: 'no_message_button' };
      await humanClick(btn);
      const box = await waitFor(() => { const e = $(SEL.editor); return isVisible(e) ? e : null; }, 7000);
      if (!box) return { ok: false, reason: 'no_editor' };
      await humanType(box, text);
      await sleep(rand(700, 1500));
      if (assist) {   // human reviews the pre-filled text and presses Send; we only watch for the editor emptying
        const sent = await waitFor(() => !txt($(SEL.editor)), 240000, 500);
        return sent ? { ok: true } : { ok: false, reason: 'not_sent_by_user' };
      }
      const send = await waitFor(() => { const b = $(SEL.sendBtn); return b && !b.disabled ? b : null; }, 4000)
        || findButton(/^send$/i, $('.msg-form') || document);
      if (!send) return { ok: false, reason: 'no_send_button' };
      await humanClick(send);
      await sleep(1500);
      const cleared = await waitFor(() => !txt($(SEL.editor)), 4000);
      const close = findButton(/close your conversation|^close$/i, $('.msg-overlay-conversation-bubble, .msg-overlay-bubble-header') || document);
      if (close) await humanClick(close).catch(() => {});
      return cleared ? { ok: true } : { ok: false, reason: 'not_confirmed' };
    },

    async scanConnections() {
      const sc = $('main') || document.scrollingElement;
      for (let i = 0; i < 4; i++) {
        window.scrollTo(0, document.body.scrollHeight); sc?.scrollTo?.(0, sc.scrollHeight);
        await sleep(rand(1200, 2000));
      }
      const slugs = [...new Set($$('main a[href*="/in/"]').map((a) => slugFromHref(a.href)).filter(Boolean))];
      return { slugs };
    },

    async scanInbox() {
      await waitFor(() => $$(SEL.convoCard).length, 8000);
      const cards = $$(SEL.convoCard).map((li) => ({
        name: txt($(SEL.convoName, li)),
        snippet: txt($(SEL.convoSnippet, li)),
        unread: !!$('.msg-conversation-card__unread-count, .notification-badge--show, [class*="unread"]', li) || /unread/i.test(li.className),
      })).filter((c) => c.name);
      return { cards };
    },

    async openAndRead({ name, leadName }) {
      const li = $$(SEL.convoCard).find((c) => norm(txt($(SEL.convoName, c))) === norm(name));
      if (!li) return { messages: [], reason: 'conversation_not_found' };
      const clickable = $(SEL.convoClick, li) || li;
      await humanClick(clickable);
      await waitFor(() => $$(SEL.threadGroup).length, 6000);
      await sleep(rand(800, 1600));
      const messages = [];
      let last = '';
      const lead = norm(leadName || name).split(' ')[0];
      for (const g of $$(SEL.threadGroup)) {
        const gn = txt($(SEL.groupName, g)) || last;
        last = gn;
        const fromThem = norm(gn).split(' ')[0] === lead;
        for (const b of $$(SEL.msgBody, g)) { const t = txt(b); if (t) messages.push({ from: fromThem ? 'them' : 'me', text: t }); }
      }
      return { messages };
    },

    // Reports what matched on the current page – used by the popup's "Selector check".
    async diagnose() {
      const top = topCard();
      return {
        url: location.href,
        checks: {
          'profile name (h1)': !!$('main h1, h1'),
          'headline': !!$(SEL.headline),
          'degree badge': !!$(SEL.degree, top),
          'Connect button': !!findButton(/^connect$|^invite .* to connect$/i, top),
          'Message button': !!findButton(/^message$/i, top),
          'More button': !!findButton(/^more( actions)?$/i, top),
          'search result links': $$('main a[href*="/in/"]').length,
          'inbox conversation cards': $$(SEL.convoCard).length,
          'inbox names': $$(SEL.convoName).length,
          'thread message groups': $$(SEL.threadGroup).length,
          'thread message bodies': $$(SEL.msgBody).length,
          'message editor': !!$(SEL.editor),
        },
      };
    },
  };

  chrome.runtime.onMessage.addListener((m, _s, send) => {
    (async () => {
      try {
        const fn = actions[m.action];
        if (!fn) return send({ ok: false, error: 'unknown action ' + m.action });
        const r = await fn(m.args || {});
        send({ ok: true, ...r, safety: safety() });
      } catch (e) { send({ ok: false, error: String(e?.message || e) }); }
    })();
    return true;
  });
})();
