# How it works

LinkPilot is three small pieces that talk to each other with Chrome extension messages.

```
 popup.html / dashboard.html  ──messages──▶  background.js (service worker)  ──messages──▶  content.js (on linkedin.com)
        UI, no logic                          scheduler, limits, AI, storage               clicks, typing, scraping
```

## The scheduler

A Chrome **alarm** wakes the background worker every minute (`tick`). A tick does nothing unless:

- automation is running and not paused,
- the current time is inside your work hours and work days,
- the random gap since the last LinkedIn action has passed.

When it runs, it picks **one** task using this priority order:

1. **Send an approved draft** (if the daily message cap allows).
2. **Scan the inbox** (every 20 minutes by default) and record new replies.
3. **Scan your Connections list** (every 60 minutes) to detect accepted invitations.
4. **Draft a reply** for each lead who replied (AI only, no LinkedIn page load).
5. **Draft an opener** for each new connection.
6. **Draft a follow-up** for leads who have been silent long enough.
7. **Send an invitation** to the oldest `new` lead, if today's quota and the 7-day cap allow.

Steps that only call the AI are chained (up to six per tick) because they do not touch LinkedIn. Any step that touches LinkedIn ends the tick and starts a new random gap.

## Lead lifecycle

| Status | Meaning |
|---|---|
| `new` | Added, no invitation yet |
| `invited` | Invitation sent, waiting for acceptance |
| `connected` | Accepted; an opener is drafted next |
| `messaged` | You (or LinkPilot) sent a message |
| `replied` | They answered; a reply draft is created |
| `link_sent` | Your calendar link was included in a message |
| `booked` | You marked it booked; no more follow-ups ever |
| `stopped` | They declined or you stopped it; no more messages |
| `failed` | A deterministic problem (no Connect button, email required) or three failed attempts |

Leads can also carry a **hold** (`holdUntil`). A held lead is skipped by the scheduler. Holds are set when you discard a draft (7 days), when a step fails (30 minutes, then 1 hour), when you did not click Send in Assist mode (24 hours), and after the weekly invitation limit (48 hours).

## How a message is written

1. **Deterministic checks first.** For a reply, keyword rules look for "not interested", "stop messaging me" and similar (the lead is stopped with no AI call) and for bot questions, pricing, contracts and legal words (the draft is forced to human review).
2. **Injection screen.** Prospect text is cleaned and checked for instruction-like phrases. A flagged reply never reaches the model.
3. **Prompt.** A compact system prompt carries your offer, proof points, tone and rules. The prospect's profile and conversation go inside `<prospect_data>` tags and are declared to be data.
4. **JSON answer.** The model returns `{"intent": "...", "reply": "..."}`.
5. **Scrub.** The reply is converted to plain text: no emoji, markdown, placeholders or em dashes, and every URL is removed except your calendar link (replies only). It is trimmed to the length limit.
6. **Cliché check.** If the draft contains stock phrases ("leverage", "hope this finds you well", and so on), the model is asked once to rewrite it; the better version is kept.
7. **Approval.** The draft waits in Approvals (unless you turned approval mode off and nothing flagged it).

## Sending

When a draft is approved, the worker opens the lead's profile in the work window, confirms they are a 1st-degree connection, clicks **Message**, types the text with human-like timing and clicks Send. In **Assist mode** it types the text and waits for **you** to click Send; it detects success when the editor empties.

Invitations work the same way: open profile, read it, click **Connect**, add the note, send (or wait for you).

## Safety checks after every step

The content script reports on each page: sign-in or checkpoint URLs, restriction notices in dialogs and headings, and the weekly-invitation-limit notice. A restriction pauses automation immediately and raises a notification. The limit notice blocks invitations for 48 hours.

## Permissions, and why

| Permission | Used for |
|---|---|
| `storage`, `unlimitedStorage` | Settings, leads, logs |
| `alarms` | The 1-minute scheduler tick |
| `tabs`, `scripting` | Opening the work window and injecting the content script |
| `notifications` | Safety pauses, "needs your reply", assist-mode prompts |
| `https://www.linkedin.com/*` | Reading and acting on LinkedIn |
| AI provider hosts (Groq, Anthropic, OpenAI, and others) | Sending prompts to your chosen model |
| Optional: any `https://*/*`, localhost | Only requested if you pick a custom base URL or Ollama |

## Limits of this design

- The service worker can be suspended by Chrome. The alarm brings it back, and long waits ping an extension API to keep it alive.
- Scans are time-based, not instant.
- Selectors are the weak point. They live in the `SEL` block at the top of `content.js`.
