# Getting started

This walks you from zero to a safe first run. Allow about 20 minutes, most of it spent writing good settings.

## 0. What you need

- Google Chrome (or another Chromium browser that supports Manifest V3 extensions).
- A LinkedIn account you are logged in to in that browser. Use one you can afford to risk (see [Safety](SAFETY.md)).
- An AI API key. The free Groq tier is enough to start.

## 1. Install the extension

1. Get the code: `git clone https://github.com/meshimul/linkpilot.git`, or download the ZIP and unzip it.
2. In Chrome open `chrome://extensions`.
3. Switch on **Developer mode** (top right).
4. Click **Load unpacked** and choose the **`extension/`** folder.
5. Click the puzzle-piece icon and **pin** LinkPilot so the toolbar button is always visible.

If you change any file later, press the circular **reload** arrow on the LinkPilot card, then reload your LinkedIn tabs.

## 2. Connect an AI model

1. Create an account at [console.groq.com](https://console.groq.com) and make an API key.
2. Click the LinkPilot icon, **Open dashboard**, then **Settings**.
3. Under **AI** keep **Provider = Groq (free tier, gpt-oss-20b)**, paste the key, and leave the model as `openai/gpt-oss-20b`.
4. Press **Save settings**, then **Test AI connection**. You should see `✓ AI replied: OK`.

If it fails, see [AI providers](AI-PROVIDERS.md) and [Troubleshooting](TROUBLESHOOTING.md).

## 3. Tell LinkPilot who you are

Still in Settings, fill in **Who you are & what you offer**. This is the most important step: the AI may use only what you write here. Read [Writing good settings](WRITING-GOOD-SETTINGS.md) first. At minimum:

- Your name and company
- **What you offer**: two or three specific sentences
- **Proof points**: real clients, numbers, results (one per line). Leave empty if you have none; the AI will then make no claims.
- Your **calendar link**

The Overview tab shows a **Before you start** checklist and tells you what is still missing.

## 4. Choose your safety mode for the first run

In **Settings → Behaviour**:

- Keep **Require my approval before any AI message is sent** ON.
- Turn **Assist mode** ON. LinkPilot will fill in each invite and message and bring its window to the front, and **you click Send**.
- Keep **Run in a small separate window** ON.

Leave the **Safety limits** at their defaults for now. Press **Save settings**.

## 5. Add a few leads

Start with **2 or 3** people, ideally people who will not mind if something goes wrong.

**From a search page**
1. In LinkedIn, run a people search.
2. Click the LinkPilot toolbar icon, then **Capture leads from this page**.

**From a list**
1. Dashboard → **Leads → Add leads**.
2. Paste profile URLs, one per line, or CSV lines like `https://www.linkedin.com/in/jane-doe/, Jane Doe, Acme`.

## 6. Run the Selector check

LinkedIn changes its page markup regularly, so LinkPilot includes a self-test.

1. Open any LinkedIn **profile**, click the LinkPilot icon, press **Selector check (this tab)**. Expect ✓ for profile name, headline, Connect button or Message button.
2. Do the same on a **people-search page** (expect search result links) and on **Messaging** (expect conversation cards, names, message editor).
3. Every ✗ means a selector needs attention. See [Troubleshooting](TROUBLESHOOTING.md#fixing-a-selector).

## 7. Start, and watch the first invite

1. Click **Start** in the popup or on the Overview tab. LinkPilot only acts inside your **work hours** (default Mon to Fri, 9:00 to 18:00 browser time). Press **Run next action now** to skip the wait while testing.
2. A small LinkPilot window opens and loads the first lead's profile.
3. In Assist mode the window comes to the front, the note is typed into the invite box, and LinkPilot waits. **Read the note, then click Send yourself.**
4. Check the **Activity** tab. You should see `Invitation sent with note to …`.

## 8. After people accept

- Every 60 minutes (default) LinkPilot scans your Connections list. Accepted leads move to **connected** and an opener draft appears in **Approvals**.
- Every 20 minutes it scans Messaging. A reply moves the lead to **replied** and a reply draft appears in **Approvals** (you also get a desktop notification).
- In **Approvals** you can edit the text, **Approve & queue**, **Regenerate**, or **Discard**. Approved messages go out at the next allowed slot.

## 9. Going further

When the first few leads behave as expected:

1. Raise volume slowly (daily cap, then weekly cap). Do not jump straight to the maximums.
2. Keep approval mode ON until the drafts have been consistently good for a couple of weeks.
3. Review **Activity** daily for `safety` and `error` lines.
4. If you pause or LinkedIn shows a verification page, open LinkedIn yourself, resolve it, then press **I've checked LinkedIn – resume**.
