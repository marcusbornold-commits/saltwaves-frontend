"use client";
// saltwaves-ui.jsx — shared primitives: wordmark, upload zone, wave bars, VU meter, demo audio engine
import React, { useState, useRef, useEffect } from "react";
import {
  durationError,
  exceedsDuration,
  exceedsFileSize,
  fileSizeError,
  type AccessLevel,
} from "@/lib/access-limits";
import { uploadAudio, type MicType } from "@/lib/upload-client";

/* ---------- Brand wordmark ---------- */
export function Wordmark({ dark, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <a className="nav-brand" href={href} aria-label="Saltwaves.studio home">
      <img src={dark ? "/assets/emblem-paper.png" : "/assets/emblem-ink.png"} alt="Saltwaves emblem" />
      <span>saltwaves<span style={{ color: "var(--orange)" }}>.studio</span></span>
    </a>
  );
}

/* ---------- Deterministic wave bar heights ---------- */
export function barHeights(n: any, seed: any) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const v =
      0.42 +
      0.30 * Math.sin(t * Math.PI * 2.2 + seed) +
      0.18 * Math.sin(t * Math.PI * 9.1 + seed * 2.7) +
      0.10 * Math.sin(t * Math.PI * 23.7 + seed * 5.3);
    out.push(Math.min(1, Math.max(0.08, Math.abs(v))));
  }
  return out;
}

export function WaveBars({ n = 48, seed = 1, playing = false, color, height = 56, flat = 1 }: any) {
  const heights = React.useMemo(() => barHeights(n, seed), [n, seed]);
  return (
    <div
      className={"wavebars" + (playing ? " playing" : "")}
      style={{ color: color || "var(--orange)", height: height }}
      aria-hidden="true"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            height: Math.round(h * height * flat) + "px",
            animationDelay: (i % 7) * 0.09 + "s",
            animationDuration: 0.6 + (i % 5) * 0.13 + "s",
          }}
        ></span>
      ))}
    </div>
  );
}

/* ---------- VU meter strip ---------- */
export function VUMeter({ lit = 9, total = 14, live = true }: any) {
  return (
    <div className={"vu" + (live ? " live" : "")} aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <i key={i} className={i < lit ? (i >= lit - 2 ? "lit hot" : "lit") : ""}></i>
      ))}
    </div>
  );
}

/* ---------- Upload zone (functional; placeholder backend handler) ---------- */
function formatBytes(b: any) {
  if (b > 1048576) return (b / 1048576).toFixed(1) + " MB";
  if (b > 1024) return (b / 1024).toFixed(0) + " KB";
  return b + " B";
}

const MIC_OPTIONS: { value: MicType; label: string }[] = [
  { value: "dynamic", label: "Dynamic (SM7B, Samson Q2U, etc.)" },
  { value: "condenser", label: "Condenser (Blue Yeti, AT2020, etc.)" },
  { value: "headset", label: "Headset / AirPods" },
  { value: "unknown", label: "Multiple mics / Not sure" },
];

function MicDropdown({
  value,
  onChange,
}: {
  value: MicType;
  onChange: (value: MicType) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected =
    MIC_OPTIONS.find((option) => option.value === value) ?? MIC_OPTIONS[3];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="mic-dropdown" ref={rootRef}>
      <span className="mic-dropdown-label">What mic did you use?</span>
      <button
        type="button"
        className={"mic-dropdown-trigger" + (open ? " open" : "")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <svg
          className="mic-dropdown-chevron"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3.5 5.25 7 8.75l3.5-3.5" />
        </svg>
      </button>
      {open && (
        <div className="mic-dropdown-menu" role="listbox" aria-label="What mic did you use?">
          {MIC_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={
                "mic-dropdown-option" + (option.value === value ? " selected" : "")
              }
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/**
 * Reads duration from metadata only — the browser does not decode the file, so
 * this stays cheap even at 500 MB. Resolves null when the duration cannot be
 * determined (MP3s without a duration header report Infinity); the upload then
 * proceeds rather than rejecting a file we were unable to measure.
 */
function readDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () =>
      done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null);
    probe.src = url;
  });
}

function UploadErrorMessage({ message }: { message: string }) {
  return (
    <div style={{ color: "var(--orange)", fontWeight: 500, fontSize: 14, marginTop: 12 }}>
      <div>{message}</div>
      <a href="/faq" style={{ display: "inline-block", marginTop: 8, fontWeight: 600, color: "inherit" }}>
        See FAQ →
      </a>
    </div>
  );
}

export function UploadZone({
  dark,
  compact,
  access,
}: {
  dark?: boolean;
  compact?: boolean;
  access: AccessLevel;
}) {
  const [file, setFile] = useState<any>(null);
  const [dragging, setDragging] = useState(false);
  // idle | checking | ready | limit-error | working | queued
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<any>(null);
  const [hasLimitError, setHasLimitError] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [micType, setMicType] = useState<MicType>("unknown");
  const [email, setEmail] = useState("");
  const inputRef = useRef<any>(null);
  const [uploadBytes, setUploadBytes] = useState<{ loaded: number; total: number } | null>(null);

  const rejectForLimit = (f: any, message: string) => {
    setFile(f);
    setHasLimitError(true);
    setError(message);
    setStatus("limit-error");
  };

  const accept = async (f: any) => {
    if (!f) return;
    if (!/\.(wav|mp3|m4a)$/i.test(f.name)) {
      setError("This doesn't look like an audio file we can read. We support WAV, MP3, and M4A.");
      return;
    }
    if (exceedsFileSize(access, f.size)) {
      rejectForLimit(f, fileSizeError(access, f.size));
      return;
    }

    setHasLimitError(false);
    setError(null);
    setFile(f);
    setDurationSeconds(null);
    setStatus("checking");

    const seconds = await readDurationSeconds(f);
    setDurationSeconds(seconds);

    if (seconds !== null && exceedsDuration(access, seconds)) {
      rejectForLimit(f, durationError(access, seconds));
      return;
    }

    setStatus("ready");
  };

  const onDrop = (e: any) => {
    e.preventDefault();
    setDragging(false);
    void accept(e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  const startMastering = async (e: any) => {
    e.stopPropagation();
    if (!file) return;

    if (exceedsFileSize(access, file.size)) {
      rejectForLimit(file, fileSizeError(access, file.size));
      return;
    }

    if (durationSeconds !== null && exceedsDuration(access, durationSeconds)) {
      rejectForLimit(file, durationError(access, durationSeconds));
      return;
    }

    if (!isValidEmail(email)) {
      setError("Enter a valid email so we can send your mastered file.");
      return;
    }

    setStatus("working");
    setError(null);
    setUploadBytes({ loaded: 0, total: file.size });

    try {
      await uploadAudio(
        file,
        micType,
        email.trim(),
        access,
        durationSeconds,
        (loaded, total) => setUploadBytes({ loaded, total }),
      );
      setStatus("queued");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed — try again.",
      );
      setStatus("ready");
      setUploadBytes(null);
    }
  };

  const reset = (e: any) => {
    e.stopPropagation();
    setFile(null);
    setStatus("idle");
    setError(null);
    setHasLimitError(false);
    setDurationSeconds(null);
    setMicType("unknown");
    setEmail("");
    setUploadBytes(null);
  };

  return (
    <div
      className={"upload-zone" + (dark ? " dark" : "") + (dragging ? " dragging" : "")}
      style={compact ? { padding: "24px 22px" } : undefined}
      onClick={() => status === "idle" && inputRef.current && inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-label="Upload your podcast audio file"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
        style={{ display: "none" }}
        onChange={(e) => void accept(e.target.files && e.target.files[0])}
      />

      {status === "idle" && (
        <div>
          <div className="upload-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 16V4"></path>
              <path d="M5.5 9.5 11 4l5.5 5.5"></path>
              <path d="M4 18.5h14"></path>
            </svg>
          </div>
          <div className="upload-title">{dragging ? "Drop it — let's listen." : "Drop your episode here"}</div>
          <div className="microcopy">.wav, .mp3, or .m4a — or click to browse</div>
          {error && <UploadErrorMessage message={error} />}
        </div>
      )}

      {status !== "idle" && file && (
        <div onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
          <div className="upload-file-row">
            <WaveBars n={9} seed={3.2} height={30} playing={status === "working"} />
            <div style={{ flex: 1 }}>
              <div className="upload-file-name">{file.name}</div>
              <div className="microcopy">{formatBytes(file.size)}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={reset} aria-label="Remove file" style={{ padding: "8px 12px" }}>✕</button>
          </div>

          {status === "checking" && (
            <div className="microcopy" style={{ padding: "14px 0 4px" }}>Reading file…</div>
          )}

          {(status === "ready" || status === "limit-error") && (
            <>
              {error && <UploadErrorMessage message={error} />}
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="upload-email-input"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  marginBottom: 10,
                  borderRadius: 8,
                  border: "1px solid var(--line, rgba(0,0,0,0.15))",
                  background: "transparent",
                  color: "inherit",
                  fontSize: 15,
                }}
                aria-label="Email address for delivery"
              />
              <MicDropdown value={micType} onChange={setMicType} />
              <button
                className="btn btn-primary"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  opacity: !file || hasLimitError ? 0.5 : 1,
                  cursor: !file || hasLimitError ? "not-allowed" : "pointer",
                }}
                onClick={startMastering}
                disabled={!file || hasLimitError}
              >
                Start mastering
              </button>
              <div className="microcopy" style={{ marginTop: 8, textAlign: "center" }}>
                We email your file and delete it after. No account, no storage.
              </div>
            </>
          )}
          {status === "working" && (() => {
            const total = uploadBytes?.total || file.size;
            const loaded = Math.min(uploadBytes?.loaded ?? 0, total);
            const done = total > 0 && loaded >= total;
            if (done) {
              return (
                <div className="microcopy" style={{ padding: "14px 0 4px" }}>
                  Listening… measuring noise floor &amp; loudness
                </div>
              );
            }
            const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
            const loadedMb = (loaded / 1048576).toFixed(1);
            const totalMb = (total / 1048576).toFixed(1);
            return (
              <div style={{ padding: "14px 0 4px", textAlign: "left" }}>
                <div className="microcopy" style={{ marginBottom: 8 }}>
                  Uploading… {pct}% · {loadedMb} of {totalMb} MB
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "rgba(26, 26, 26, 0.12)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: "var(--orange)",
                      transition: "width 0.15s ease",
                    }}
                  />
                </div>
              </div>
            );
          })()}
          {status === "queued" && (
            <div style={{ fontWeight: 700, color: "var(--orange)", padding: "12px 0 2px", fontSize: 15 }}>
              Queued for mastering. We&apos;ll email you when it&apos;s ready — you can close this window.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Before/after demo audio ---------- */
export const demoAudio = (() => {
  const sources: Record<string, string> = {
    raw: "/hero/hero_before.mp3",
    mastered: "/hero/hero_after.mp3",
    "audiobook-raw": "/hero/hero_before.mp3",
    "audiobook-mastered": "/hero/hero_after_audiobook.mp3",
  };
  let current: HTMLAudioElement | null = null;
  let onEndCb: (() => void) | null = null;
  // Bumped on every stop(), and so on every play() too. play() returns a promise
  // that rejects when the clip is paused before playback starts — which is exactly
  // what a fast A/B toggle does. Without this token that stale rejection would
  // stop the clip that replaced it and fire the previous onEnd.
  let generation = 0;

  function handleEnded() {
    const cb = onEndCb;
    stop();
    cb?.();
  }

  function stop() {
    generation++;
    if (!current) return;
    current.pause();
    current.currentTime = 0;
    current.removeEventListener("ended", handleEnded);
    current = null;
    onEndCb = null;
  }

  function play(kind: string, onEnd?: () => void) {
    stop();
    const mine = generation;
    const audio = new Audio(sources[kind]);
    onEndCb = onEnd ?? null;
    current = audio;
    audio.addEventListener("ended", handleEnded);
    audio.play().catch(() => {
      // Superseded while starting up: a newer clip owns the state now.
      if (mine !== generation) return;
      stop();
      onEnd?.();
    });
  }

  return { play, stop };
})();
