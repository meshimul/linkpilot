# Troubleshooting

## Where to look first

1. **Dashboard → Activity.** Every action, error and safety event is logged. Red lines are `error` and `safety`.
2. **The service worker console.** `chrome://extensions` → LinkPilot → **service worker** (Inspect). Errors from the scheduler and AI calls appear here.
3. **The LinkedIn tab console.** Right-click the work window → Inspect → Console, for content-script errors.

## Selector check

LinkedIn changes its page markup often. **Selector check** (popup) tells you what LinkPilot can find on the current tab. Run it on three pages:

| Page | Expect ✓ for | Fix in `content.js` if ✗ |
|---|---|---|
| A profile (`/in/…`) | profile name (h1), headline, degree badge, Connect or Message button, More button | `SEL.headline`, `SEL.degree`, button text rules |
| People search | search result links | `scrapeSearch` (uses `main a[href*="/in/"]`) |
| Messaging | inbox conversation cards, inbox names, message editor | `SEL.convoCard`, `SEL.convoName`, `SEL.editor` |
| An open conversation | thread message groups, thread message bodies | `SEL.threadGroup`, `SEL.groupName`, `SEL.msgBody` |

Buttons (Connect, Message, More, Send, Pending) are found by their visible text or `aria-label`, not by class, so they usually survive redesigns. Text matches are English; on a non-English LinkedIn, switch your LinkedIn language to English or edit the regular expressions.

### Fixing a selector

1. Open the page, right-click the element that failed (for example the headline), choose **Inspect**.
2. Find a stable attribute: a `data-…` attribute, `aria-label`, `role`, or a class that is not obviously generated (avoid random-looking class names).
3. Edit the matching line in the `SEL` block at the top of `extension/content.js`. Selectors can be comma-separated alternatives.
4. Reload the extension at `chrome://extensions`, reload the LinkedIn tab, and run Selector check again.

## Common problems

| Symptom | Likely cause and fix |
|---|---|
| `Test AI connection` says "No AI API key set" | Paste the key and press **Save settings** first. |
| `AI error: Invalid API Key` | Wrong key, or the key belongs to a different provider than the preset selected. |
| `AI used its whole token budget thinking…` | Reasoning model ran out of budget. Retry; if it repeats, choose a non-reasoning model. |
| `AI rate limit reached – pausing AI work for 15 min` | Provider quota hit. It resumes automatically. Check your provider console for limits. |
| Ollama returns 403 | Start Ollama with `OLLAMA_ORIGINS="chrome-extension://*"`. See [AI providers](AI-PROVIDERS.md). |
| "Content script did not respond on …" | The LinkedIn page did not finish loading or the script was not injected. Reload the extension and any LinkedIn tabs. Check that the work window is not blocked by a popup. |
| Nothing happens after Start | You are outside work hours or inside the gap since the last action. Press **Run next action now**. Check the Overview line "Next action in …". |
| Overview says "safety pause" | LinkedIn showed a verification or restriction page. Open LinkedIn, resolve it, then press **I've checked LinkedIn – resume**. |
| Invites stop at a low number | Warm-up cap (starts at 5 per day), the daily or 7-day cap, or a 48-hour block after LinkedIn's weekly-limit notice. The Overview card shows today's allowance. |
| Lead shows "on hold" | A step failed (backoff), you discarded a draft (7 days), or you did not click Send in Assist mode (24 hours). Select it in Leads and press **Retry selected** to clear the hold. |
| Lead is `failed` | See the error text under the status. `no_connect_button` or `email_required` mean LinkedIn will not let you connect without extra info. Use **Retry selected** after fixing the cause. |
| Drafts are generic | The offer is vague or there are no proof points. See [Writing good settings](WRITING-GOOD-SETTINGS.md). |
| Reply was not detected | The inbox scan only opens up to 5 conversations per scan and matches names. Check names in Leads match LinkedIn exactly (titles like "Dr." are handled), and run Selector check on Messaging. |
| Typing is very slow | The work tab is hidden and throttled. Turn on **Run in a small separate window**, and keep that window open (do not minimise it). |

## Starting over

- **Clear a lead's problems:** Leads → select → **Retry selected (→ new)**.
- **Reset everything:** `chrome://extensions` → LinkPilot → **Remove**, then load the folder again. All local data is deleted.
- **Export your data:** in the service worker console run `chrome.storage.local.get(null).then(console.log)`.

## Running the tests

```bash
node extension/test/logic.test.mjs        # limits, warm-up, scrubbing, intent rules
node extension/test/background.test.mjs   # scheduler and AI calls with a fake chrome + fake network
```

Both should end with `… tests passed`. The tests do not touch LinkedIn.
