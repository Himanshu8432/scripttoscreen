# ScriptToScreen

**Turn any script into a cinematic video — fully automated, end to end.**

Write a story, a pitch, a poem, or a scene. ScriptToScreen breaks it into scenes, locks a consistent protagonist and visual style, records a voiceover in a single take, renders every scene as a video clip in parallel, and assembles everything with cross-fade transitions — all while you watch it happen in real time.

---

## How It Works

```
Your Script
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  01  Decompose          GPT-4o-mini splits the script   │
│      Script             into 8–12 × 10-second scenes    │
├─────────────────────────────────────────────────────────┤
│  02  Lock Character     GPT-4o-mini designs one         │
│      & Style            protagonist + cinematic style   │
│                         OpenAI generates a portrait     │
├─────────────────────────────────────────────────────────┤
│  03  Generate           OpenAI TTS voices the entire    │
│      Voiceover          script in a single take, then   │
│                         splits it into per-scene clips  │
├─────────────────────────────────────────────────────────┤
│  04  Generate           Pixazo (Wan-2.6 image-to-video) │
│      Video Clips        renders all scenes in parallel  │
│                         (up to 5 at a time)             │
├─────────────────────────────────────────────────────────┤
│  05  Assemble           FFmpeg joins clips with         │
│      Final Video        xfade cross-fade transitions    │
├─────────────────────────────────────────────────────────┤
│  06  Upload             Vercel Blob hosts the final     │
│                         MP4 at a public URL             │
└─────────────────────────────────────────────────────────┘
    │
    ▼
Your Video
```

Every stage streams live back to the browser over SSE — you see the character portrait appear, can listen to the voiceover mid-pipeline, and watch each scene thumbnail fill in as clips complete.

---

## Features

- **Fully automated pipeline** — one click, one video
- **Consistent protagonist** — character and visual style locked once, held across every scene
- **Single-take voiceover** — uniform pacing and tone across the whole script
- **Parallel clip generation** — scenes render concurrently (up to 5 at a time)
- **Live progress UI** — watch each stage complete in real time; clip thumbnails auto-play as they finish
- **Listen while it renders** — voiceover audio is playable mid-pipeline before clips are done
- **BYOK (Bring Your Own Keys)** — no backend credential store; keys live in your browser's `localStorage` only
- **Slide-in log drawer** — detailed pipeline logs on demand, without cluttering the UI
- **Fast error recovery** — auth errors fail immediately; transient errors retry with exponential backoff

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| LLM | GPT-4o-mini via Vercel AI SDK (`generateObject`) |
| Image generation | OpenAI `gpt-image-1` / `dall-e-3` fallback |
| Text-to-speech | OpenAI TTS (`tts-1-hd`) |
| Video generation | Pixazo — Wan-2.6 image-to-video (default) / Seedance-2.0-fast |
| Video assembly | FFmpeg (`@ffmpeg-installer/ffmpeg`) with xfade filter |
| File hosting | Vercel Blob |
| Streaming | Server-Sent Events (SSE) — one persistent connection for the full pipeline |
| Key scoping | `AsyncLocalStorage` — keys are scoped per-request, never bleed across concurrent users |

---

## Project Structure

```
├── app/
│   ├── page.tsx                  # Main UI — 4-state machine (idle / running / done / error)
│   ├── layout.tsx
│   └── api/
│       └── pipeline/route.ts     # SSE endpoint — orchestrates the full pipeline
│
├── components/
│   ├── keys-gate.tsx             # BYOK setup screen + keys management drawer
│   ├── log-stream.tsx            # Slide-in log drawer
│   ├── pipeline-rail.tsx
│   ├── scene-grid.tsx
│   ├── character-card.tsx
│   ├── audio-preview.tsx
│   └── video-output.tsx
│
├── hooks/
│   ├── use-script-pipeline.ts    # SSE client — accumulates live pipeline state
│   └── use-keys.ts               # localStorage BYOK hook
│
└── lib/
    ├── api-config.ts             # AsyncLocalStorage key context (per-request scoping)
    ├── ffmpeg.ts
    ├── types.ts                  # Shared pipeline event + scene types
    └── pipeline/
        ├── decomposer.ts         # Stage 1 — script → scenes via GPT-4o-mini
        ├── character-lock.ts     # Stage 2 — protagonist + cinematic style
        ├── openai-image.ts       # Stage 2b — character portrait generation
        ├── voiceover.ts          # Stage 3 — TTS + proportional audio split
        ├── clips.ts              # Stage 4 — parallel Pixazo generation + retry
        ├── assembler.ts          # Stage 5 — FFmpeg xfade assembly
        ├── pixazo.ts             # Pixazo client (submit + async polling)
        └── pixazo-models.ts      # Model adapter registry (wan-2-6, seedance)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- `pnpm` (recommended) or `npm`
- API keys for:
  - [OpenAI](https://platform.openai.com/api-keys) — GPT-4o-mini + TTS + image generation
  - [Pixazo](https://gateway.pixazo.ai) — video clip generation

### Install & Run

```bash
# Clone
git clone https://github.com/himanshu8432/scripttoscreen.git
cd scripttoscreen

# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

On first visit you'll see the **API keys setup screen**. Enter your keys — they are saved to `localStorage` on your machine and sent directly to the respective APIs over HTTPS. Nothing is stored server-side.

---

## BYOK — Bring Your Own Keys

ScriptToScreen has no backend credential store. Every API call uses keys that you provide and that never leave your browser except to call the API they belong to.

| Key | Where to get it | Used for |
|---|---|---|
| **OpenAI API Key** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | GPT-4o-mini, TTS, image generation |
| **Pixazo API Key** | [gateway.pixazo.ai](https://gateway.pixazo.ai) | Video clip generation |

Keys flow like this:

```
Browser localStorage
      │
      │  (HTTPS request headers)
      ▼
Next.js API Route  ──▶  AsyncLocalStorage (per-request scope)
      │
      ├──▶ OpenAI API   (decompose, character lock, voiceover, portrait)
      ├──▶ Pixazo API   (video clips)
      └──▶ Vercel Blob  (upload audio + final video)
```

`AsyncLocalStorage` ensures keys from one user's request never reach another concurrent request.

---

## Deploying to Vercel

```bash
vercel deploy
```

The `next.config.mjs` already bundles the FFmpeg binary into the serverless function via `outputFileTracingIncludes` and excludes it from webpack via `serverExternalPackages`.

### Switching Video Models

Set `PIXAZO_MODEL` in your Vercel environment variables:

| Value | Model | Notes |
|---|---|---|
| `wan-2-6-image-to-video-477` | Wan-2.6 image-to-video | **Default.** Higher quality; requires a character portrait |
| `seedance-2-0-fast` | Seedance 2.0 Fast | Text-only; no portrait needed; faster |

---

## Script Tips

| Script length | Scenes | Approx. video |
|---|---|---|
| ~150 words (~1 min) | 4–6 scenes | 45–60s |
| **~250–320 words (~2 min)** | **8–12 scenes** | **90–120s** ← sweet spot |
| ~400 words (~2.5 min) | 12–16 scenes | 120–150s |

- Write in present tense — AI video models respond better to active, immediate descriptions
- Short, punchy sentences work best — each sentence naturally becomes one scene
- Avoid naming characters in the script body; the LLM designs the protagonist from context
- 250–320 words gives you enough narrative arc without hitting clip-count limits

---

## Design Decisions

**Why SSE instead of polling?**
One persistent connection eliminates client polling overhead and lets each pipeline stage push events the instant they complete — the UI updates in real time with no delay.

**Why one TTS call for the entire script?**
A single call gives uniform voice, pacing, and breath across the whole video. Per-scene calls produce audible discontinuities at every cut.

**Why `generateObject` instead of `generateText` + `experimental_output`?**
`generateObject` is the stable, purpose-built Vercel AI SDK API for structured output. It has built-in validation and retry. `experimental_output` silently returns nothing on parse failure, which caused intermittent `AI_NoOutputGeneratedError` errors in production.

**Why fail immediately on Pixazo 401?**
An auth error will never succeed on retry. Retrying wastes ~90 seconds. We detect 401/403 in the error message and break the retry loop immediately.

**Why `AsyncLocalStorage` for key threading?**
Passing keys through every function signature across 6 pipeline stages is invasive and error-prone. `AsyncLocalStorage` scopes keys to the current async call chain — each pipeline function calls `getApiKeys()` and always gets the correct keys for its request, even under concurrency.

---

## License

MIT

---

<div align="center">
  <sub>Built with Next.js · Vercel AI SDK · OpenAI · Pixazo · FFmpeg · Vercel Blob</sub>
</div>
