# AI providers

LinkPilot talks to the model directly from your browser. Anthropic uses its Messages API; everything else uses the OpenAI-compatible `/chat/completions` format.

## Recommended: Groq free tier with `openai/gpt-oss-20b`

1. Create a key at [console.groq.com](https://console.groq.com).
2. In Settings choose **Groq (free tier, gpt-oss-20b)**, paste the key, **Save**, **Test AI connection**.

`gpt-oss-20b` is a **reasoning** model: it thinks before it answers, and that thinking uses part of the token budget. LinkPilot handles this for you:

- sends `reasoning_effort: low` and `include_reasoning: false`
- requests at least 1500 completion tokens so the visible answer is never starved
- asks for JSON output (`response_format: json_object`)
- if Groq rejects any of those optional parameters, retries without it

If you ever see **"AI used its whole token budget thinking and returned nothing"**, just retry; if it repeats, switch to a non-reasoning model.

### Rate limits

Free tiers have per-minute and per-day limits that change over time. Check your current numbers in the Groq console under Settings → Limits. LinkPilot's behaviour:

- A `429` with a short `retry-after` is waited out and retried (up to two times).
- A **per-day** quota error pauses AI work for 15 minutes and logs `AI rate limit reached`. Leads are not penalised.
- LinkPilot makes few calls: roughly one per lead per step, with a gap of several minutes between LinkedIn actions, so a typical day sits well inside free limits.

## Other providers

| Preset | Default model | Notes |
|---|---|---|
| Anthropic (Claude) | `claude-sonnet-5-5` | Needs an Anthropic API key (paid). |
| Groq | `openai/gpt-oss-20b` | Free tier available. |
| Cerebras | `llama3.1-8b` | Free tier. Small model; expect plainer drafts. |
| OpenRouter | `meta-llama/llama-3.3-70b-instruct:free` | `:free` models are rate limited. |
| Google Gemini (AI Studio) | `gemini-2.5-flash` | Uses Gemini's OpenAI-compatible endpoint. |
| Mistral | `mistral-small-latest` | Free "Experiment" plan. |
| OpenAI | `gpt-4o-mini` | Newer OpenAI reasoning models may need different parameters. |
| Ollama (local) | `llama3.2` | No key. See below. |
| Other OpenAI-compatible | you choose | Enter base URL and model. |

Model names change. If a model is rejected, copy the exact name from your provider's console into **Model**.

## Ollama (local, no key)

1. Install Ollama and pull a model: `ollama pull llama3.2`.
2. In Settings choose **Ollama**. Base URL: `http://localhost:11434/v1`.
3. Ollama blocks requests from browser extensions by default (you will see a 403). Allow them by starting Ollama with the origin set, for example:

   ```bash
   OLLAMA_ORIGINS="chrome-extension://*" ollama serve
   ```

4. Accept Chrome's permission prompt for `localhost` when you save.

Small local models follow the "JSON only" and style rules less reliably. Keep approval mode on.

## Tips for small models

- Keep your offer and proof points short and concrete. Long, vague text hurts small models most.
- Leave the tone line short.
- If drafts drift, press **Regenerate** rather than editing the prompt every time.
- LinkPilot already trims length, strips formatting, and removes disallowed links, so small formatting slips are corrected automatically.
