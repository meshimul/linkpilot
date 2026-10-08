# Settings reference

Open **Dashboard → Settings**. Changes apply after **Save settings**. Defaults come from `extension/common.js` (`DEFAULT_SETTINGS`).

## AI

| Setting | Default | Notes |
|---|---|---|
| Provider | Groq | Presets for Anthropic, Groq, Cerebras, OpenRouter, Gemini, Mistral, Ollama, OpenAI and any OpenAI-compatible endpoint. Choosing a preset fills in the base URL and model. |
| API key | empty | Stored in `chrome.storage.local` on your machine. Not needed for Ollama. |
| Model | `openai/gpt-oss-20b` | Type the exact model name from your provider's console. |
| Base URL | Groq's OpenAI-compatible URL | Auto-filled for presets. LinkPilot asks Chrome for permission to reach a custom host the first time you save. |

## Who you are & what you offer

| Setting | Default | Notes |
|---|---|---|
| Your name / role / company | empty | Used in the system prompt so messages are written as you. |
| What you offer | empty | The AI uses only this plus proof points. See [Writing good settings](WRITING-GOOD-SETTINGS.md). |
| Proof points | empty | Real clients, numbers and results the AI may cite. Empty means no claims. |
| Ideal audience | empty | One line. |
| Tone | `Friendly, concise, professional. No hype, no emojis, no buzzwords.` | |
| Conversation goal | `Book a 15-minute intro call` | |
| Calendar link | empty | Shared only in replies, only when the prospect is interested. |
| Objection notes | empty | Optional rules for common pushback. |

## Behaviour

| Setting | Default | Notes |
|---|---|---|
| Send AI-personalised connection note | on | Free LinkedIn accounts have a small monthly note allowance. When it runs out LinkPilot retries that lead without a note. |
| Require my approval before any AI message is sent | **on** | Openers, follow-ups and replies wait in Approvals. Connection notes are not gated (use Assist mode). Drafts that need a human are always held, even when this is off. |
| Run in a small separate window | on | Hidden tabs are throttled by Chrome, which slows typing and can stop pages rendering. Turn off to use a background tab. |
| Assist mode | off | LinkPilot fills in the note or message; you click Send. Waits up to 4 minutes, then holds the lead for 24 hours. |

## Safety limits

| Setting | Default | Notes |
|---|---|---|
| Max invites per day | 20 | The warm-up ramp can lower today's cap. |
| Max invites per 7 days | 90 | Rolling 7 days, counted from LinkPilot's own stats. |
| Warm-up ramp | on | Starts when you first press Start. |
| Warm-up: day-0 invites | 5 | |
| Warm-up: +invites per day | 2 | Day 0 = 5, day 1 = 7, day 2 = 9, and so on, up to the daily max. |
| Max messages per day | 40 | Counts openers, follow-ups and replies sent. |
| Min / max minutes between actions | 3 / 9 | A random gap is chosen after every LinkedIn action. |
| Work hours start / end | 9 / 18 | Browser local time, 24-hour clock. |
| Work days | Mon to Fri | |
| Follow up after (days) | 4 | Days of silence after your last message. |
| Max follow-ups | 2 | Per lead. |
| Inbox scan every (min) | 20 | |
| Acceptance scan every (min) | 60 | Checks your Connections list for accepted invitations. |

## Where settings live

Everything is stored locally in `chrome.storage.local`: `settings`, `leads`, `stats` (last 35 days), `logs` (last 600 entries) and `runtime`. Removing the extension deletes it all. There is no server.
