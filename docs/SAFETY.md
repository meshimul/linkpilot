# Safety

Read this before your first run. LinkPilot is built to be cautious, but **no setting makes automation on LinkedIn risk-free**.

## The risk, plainly

- LinkedIn's User Agreement prohibits automated activity. Accounts that look automated can be warned, restricted, or banned.
- LinkPilot drives your real browser session with synthetic clicks and typing events. LinkedIn can detect patterns such as perfectly regular timing, high volume, or low acceptance rates.
- Use an account you can afford to lose, keep volumes low, and never run it from a brand-new account.

## What LinkPilot does to reduce risk

### 1. You approve what is sent
- **Approval mode** (on by default) holds openers, follow-ups and replies for your review.
- **Assist mode** makes you click the final Send for invitations and messages. Recommended for the first weeks.
- Drafts that need a human (bot questions, pricing, legal, upset tone, or suspected injection) are always held, even when approval mode is off.

> Connection notes are sent automatically unless Assist mode is on. Approval mode does not gate them.

### 2. Conservative volume
| Control | Default |
|---|---|
| Warm-up | Day 0: 5 invites, then +2 per day up to the daily cap |
| Daily invites | 20 |
| Rolling 7-day invites | 90 |
| Daily messages | 40 |
| Gap between actions | random 3 to 9 minutes |
| Active window | Mon to Fri, 9:00 to 18:00 browser time |

Counters include invitations that were probably sent but could not be confirmed on the page, so the caps err on the safe side.

### 3. Auto-pause
After every step the page is checked. LinkPilot **pauses everything and notifies you** if it sees:

- a sign-in, checkpoint or auth-wall URL
- a restriction, "unusual activity", human-verification or security-check notice in a dialog, toast or heading

A weekly-invitation-limit notice blocks invitations for **48 hours** (messages continue). Free text such as profile About sections and message bodies is deliberately **not** scanned, so a prospect cannot pause you by writing the trigger words.

To continue after a pause: open LinkedIn yourself, resolve whatever it asks, then press **I've checked LinkedIn – resume** in the dashboard banner.

### 4. Failures back off
A failing step is charged to that lead: 30 minutes, then 1 hour, then the lead is failed (or held 24 hours if it is already connected). A failing inbox or connection scan waits its full interval. Unexpected errors delay the next action by 10 minutes. LinkPilot never retries a broken step every minute.

### 5. Prompt-injection defence
Anyone can write anything in their headline, About section or a reply. If that text were treated as instructions it could make the AI send links or reveal your settings.

- Prospect text is wrapped in `<prospect_data>` tags, stripped of angle brackets, and declared to be data.
- A pattern screen flags instruction-like phrases ("ignore your previous instructions", "system prompt", fake role tags). A flagged **reply never reaches the model**; you get an empty draft marked *needs you*. A flagged profile is dropped from the note.
- Output is scrubbed: no URL except your own calendar link (replies only), no markdown, no emoji.
- "Not interested" and bot or pricing questions are handled by keyword rules **before** the AI.

This design follows the "fetched content is data, never instructions" rule from [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills). It reduces the risk; it cannot eliminate it, which is another reason to keep approval mode on.

### 6. Honest messages
The AI is told never to invent facts, results, customers or mutual connections, and never to deny being automated when asked.

## Your data

- Everything is stored locally in your browser. There is no LinkPilot server.
- Your API key is stored **unencrypted** in `chrome.storage.local` and sent only to your chosen AI provider.
- Prospect names, headlines and conversation snippets are sent to that provider as part of prompts. Check your provider's data policy, and consider the privacy expectations of the people you contact (GDPR and similar laws may apply).

## A sensible rollout

| Week | What to do |
|---|---|
| 0 | Assist mode ON, approval ON, 2 to 3 leads, watch every action |
| 1 | Same settings, 5 to 8 invites per day, read every draft |
| 2 | Raise daily cap gradually, keep the weekly cap at or below 90 |
| 3+ | Consider turning Assist mode off for messages only if drafts are consistently good and acceptance rates are healthy |

Stop and review if acceptance drops below about 20 to 25 percent, if LinkedIn shows any warning, or if you see repeated `safety` lines in Activity.
