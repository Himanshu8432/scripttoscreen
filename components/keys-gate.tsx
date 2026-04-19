"use client"

import { useEffect, useState } from "react"
import { KeyRound, Eye, EyeOff, ArrowRight, CheckCircle2, ExternalLink, X, RotateCcw, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AppKeys } from "@/hooks/use-keys"

interface KeysGateProps {
  onSave: (keys: AppKeys) => void
}

const STEPS = [
  { label: "01", title: "Write your script" },
  { label: "02", title: "Pick a voice & ratio" },
  { label: "03", title: "Hit Generate" },
  { label: "04", title: "Watch it become a video" },
]

export function KeysGate({ onSave }: KeysGateProps) {
  const [openai, setOpenai] = useState("")
  const [pixazo, setPixazo] = useState("")
  const [showOpenai, setShowOpenai] = useState(false)
  const [showPixazo, setShowPixazo] = useState(false)

  const ready = openai.trim().length > 10 && pixazo.trim().length > 10

  function handleSave() {
    if (!ready) return
    onSave({ openaiKey: openai.trim(), pixazoKey: pixazo.trim() })
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      <div className="relative z-10 w-full max-w-2xl">
        {/* Hero */}
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <KeyRound className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Before we make anything cool —
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            ScriptToScreen runs entirely on your own API keys. Nothing is stored on a server.
            Paste them once and you're ready to go.
          </p>
        </div>

        {/* How it works — the 10-year-old walkthrough */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-1.5 rounded-lg border border-border/50 bg-card/30 p-3"
            >
              <span className="font-mono text-[10px] text-primary/70">{s.label}</span>
              <span className="text-xs font-medium leading-snug">{s.title}</span>
            </div>
          ))}
        </div>

        {/* Key inputs */}
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-border/40 pb-4">
            <span className="text-sm font-medium">Set up your keys</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
              stored locally only
            </span>
          </div>

          <KeyField
            id="openai"
            label="OpenAI API Key"
            hint="Used for GPT-4o-mini (script decomposition) and TTS (voiceover)"
            placeholder="sk-..."
            value={openai}
            onChange={setOpenai}
            show={showOpenai}
            onToggleShow={() => setShowOpenai((v) => !v)}
            docsUrl="https://platform.openai.com/api-keys"
          />

          <KeyField
            id="pixazo"
            label="Pixazo API Key"
            hint="Used to generate each video clip via Seedance"
            placeholder="Your Pixazo subscription key"
            value={pixazo}
            onChange={setPixazo}
            show={showPixazo}
            onToggleShow={() => setShowPixazo((v) => !v)}
            docsUrl="https://gateway.pixazo.ai"
          />

          <Button onClick={handleSave} disabled={!ready} className="mt-2 w-full gap-2">
            {ready ? (
              <>
                <CheckCircle2 className="size-4" />
                Save keys &amp; open studio
              </>
            ) : (
              <>
                <ArrowRight className="size-4" />
                Fill in both keys to continue
              </>
            )}
          </Button>
        </div>

        <p className="mt-4 text-center font-mono text-[10px] text-muted-foreground">
          Keys are saved to your browser's localStorage. They never leave your machine except to
          call the respective APIs over HTTPS.
        </p>
      </div>
    </div>
  )
}

interface KeyFieldProps {
  id: string
  label: string
  hint: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  docsUrl: string
}

// ---------------------------------------------------------------------------
// KeysDrawer — shown when the user clicks "Keys" in the header while already
// set up. Lets them view (masked), update, or reset their keys.
// ---------------------------------------------------------------------------

interface KeysDrawerProps {
  open: boolean
  onClose: () => void
  currentKeys: AppKeys
  onSave: (keys: AppKeys) => void
  onReset: () => void
}

export function KeysDrawer({ open, onClose, currentKeys, onSave, onReset }: KeysDrawerProps) {
  const [openai, setOpenai] = useState(currentKeys.openaiKey)
  const [pixazo, setPixazo] = useState(currentKeys.pixazoKey)
  const [showOpenai, setShowOpenai] = useState(false)
  const [showPixazo, setShowPixazo] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // Sync inputs when drawer opens with fresh values
  useEffect(() => {
    if (open) {
      setOpenai(currentKeys.openaiKey)
      setPixazo(currentKeys.pixazoKey)
      setShowOpenai(false)
      setShowPixazo(false)
      setConfirmReset(false)
    }
  }, [open, currentKeys])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  const changed =
    openai.trim() !== currentKeys.openaiKey || pixazo.trim() !== currentKeys.pixazoKey
  const valid = openai.trim().length > 10 && pixazo.trim().length > 10

  function handleSave() {
    if (!valid) return
    onSave({ openaiKey: openai.trim(), pixazoKey: pixazo.trim() })
    onClose()
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return }
    onReset()
    onClose()
  }

  function mask(key: string) {
    if (key.length <= 8) return "••••••••"
    return key.slice(0, 6) + "••••••••" + key.slice(-4)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border/60 bg-background shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <span className="text-sm font-semibold">Your API Keys</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Current key summary */}
        <div className="border-b border-border/60 bg-card/30 px-5 py-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Currently saved
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-md border border-border/40 bg-background/50 px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">OpenAI</span>
                <span className="font-mono text-xs text-foreground/80">{mask(currentKeys.openaiKey)}</span>
              </div>
              <ShieldCheck className="size-3.5 text-chart-2" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/40 bg-background/50 px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">Pixazo</span>
                <span className="font-mono text-xs text-foreground/80">{mask(currentKeys.pixazoKey)}</span>
              </div>
              <ShieldCheck className="size-3.5 text-chart-2" />
            </div>
          </div>
        </div>

        {/* Edit keys */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Update keys
          </p>

          <KeyField
            id="drawer-openai"
            label="OpenAI API Key"
            hint="GPT-4o-mini + TTS voiceover"
            placeholder="sk-..."
            value={openai}
            onChange={setOpenai}
            show={showOpenai}
            onToggleShow={() => setShowOpenai((v) => !v)}
            docsUrl="https://platform.openai.com/api-keys"
          />

          <KeyField
            id="drawer-pixazo"
            label="Pixazo API Key"
            hint="Video clip generation via Seedance"
            placeholder="Your Pixazo subscription key"
            value={pixazo}
            onChange={setPixazo}
            show={showPixazo}
            onToggleShow={() => setShowPixazo((v) => !v)}
            docsUrl="https://gateway.pixazo.ai"
          />

          <Button onClick={handleSave} disabled={!changed || !valid} className="w-full gap-2">
            <CheckCircle2 className="size-4" />
            Save updated keys
          </Button>
        </div>

        {/* Danger zone */}
        <div className="border-t border-border/60 p-5">
          <button
            onClick={handleReset}
            className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 font-mono text-xs transition-colors ${
              confirmReset
                ? "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "border-border/50 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
            }`}
          >
            <RotateCcw className="size-3.5" />
            {confirmReset ? "Are you sure? Click again to clear all keys" : "Reset & re-enter keys"}
          </button>
          <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground/40">
            Keys live in localStorage · Press Esc to close
          </p>
        </div>
      </aside>
    </>
  )
}

function KeyField({ id, label, hint, placeholder, value, onChange, show, onToggleShow, docsUrl }: KeyFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary"
        >
          get key <ExternalLink className="size-3" />
        </a>
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-9 font-mono text-xs"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={show ? "Hide key" : "Show key"}
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    </div>
  )
}
