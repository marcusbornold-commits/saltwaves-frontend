"use client";

import {
  DISTANS_DEMO_ACCESS,
  distansDemoDurationError,
  distansDemoFileSizeError,
} from "@/lib/distans-demo-limits";
import { exceedsDuration, exceedsFileSize } from "@/lib/access-limits";
import { uploadDistansDemoAudio } from "@/lib/distans-demo-upload";
import {
  BACKEND_DOWN_MESSAGE,
  useBackendHealth,
} from "@/lib/backend-health";
import { UploadError, type MicType } from "@/lib/upload-client";
import type { DistansDemoLinkPublic } from "@/types/distans-demo";
import { useRef, useState } from "react";

function formatBytes(bytes: number): string {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

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

const MIC_OPTIONS: { value: MicType; label: string }[] = [
  { value: "dynamic", label: "Dynamic (SM7B, Samson Q2U, etc.)" },
  { value: "condenser", label: "Condenser (Blue Yeti, AT2020, etc.)" },
  { value: "headset", label: "Headset / AirPods" },
  { value: "unknown", label: "Multiple mics / Not sure" },
];

type Status =
  | "idle"
  | "checking"
  | "ready"
  | "limit-error"
  | "working"
  | "queued";

export function DistansDemoClient({
  link,
}: {
  link: DistansDemoLinkPublic;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasLimitError, setHasLimitError] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [micType, setMicType] = useState<MicType>("unknown");
  const [email, setEmail] = useState(link.prospectEmail ?? "");
  const [uploadBytes, setUploadBytes] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadController = useRef<AbortController | null>(null);
  const { health, recheck } = useBackendHealth();
  const backendDown = health === "down";

  const rejectForLimit = (selected: File, message: string) => {
    setFile(selected);
    setHasLimitError(true);
    setError(message);
    setStatus("limit-error");
  };

  const accept = async (selected: File | undefined | null) => {
    if (status === "working" || !selected) return;
    if (!/\.(wav|mp3|m4a)$/i.test(selected.name)) {
      setError(
        "This doesn't look like an audio file we can read. We support WAV, MP3, and M4A.",
      );
      return;
    }
    if (exceedsFileSize(DISTANS_DEMO_ACCESS, selected.size)) {
      rejectForLimit(selected, distansDemoFileSizeError(selected.size));
      return;
    }

    setHasLimitError(false);
    setError(null);
    setFile(selected);
    setDurationSeconds(null);
    setStatus("checking");

    const seconds = await readDurationSeconds(selected);
    setDurationSeconds(seconds);

    if (seconds !== null && exceedsDuration(DISTANS_DEMO_ACCESS, seconds)) {
      rejectForLimit(selected, distansDemoDurationError(seconds));
      return;
    }

    setStatus("ready");
  };

  const startDemo = async () => {
    if (!file) return;

    if (exceedsFileSize(DISTANS_DEMO_ACCESS, file.size)) {
      rejectForLimit(file, distansDemoFileSizeError(file.size));
      return;
    }
    if (
      durationSeconds !== null &&
      exceedsDuration(DISTANS_DEMO_ACCESS, durationSeconds)
    ) {
      rejectForLimit(file, distansDemoDurationError(durationSeconds));
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email so we can send your mastered file.");
      return;
    }
    if ((await recheck()) === "down") {
      setError(BACKEND_DOWN_MESSAGE);
      return;
    }

    setStatus("working");
    setError(null);
    setUploadBytes({ loaded: 0, total: file.size });
    uploadController.current = new AbortController();

    try {
      await uploadDistansDemoAudio({
        file,
        token: link.token,
        email: email.trim(),
        micType,
        durationSeconds,
        onProgress: (loaded, total) => setUploadBytes({ loaded, total }),
        signal: uploadController.current.signal,
      });
      setStatus("queued");
    } catch (err) {
      setError(
        err instanceof Error && err.name === "AbortError"
          ? "Upload cancelled. You can start again when ready."
          : err instanceof UploadError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Upload failed — try again.",
      );
      setStatus("ready");
      setUploadBytes(null);
    }
  };

  const reset = () => {
    if (status === "working") {
      uploadController.current?.abort();
      return;
    }
    setFile(null);
    setStatus("idle");
    setError(null);
    setHasLimitError(false);
    setDurationSeconds(null);
    setMicType("unknown");
    setUploadBytes(null);
  };

  return (
    <section className="distans-demo-panel" aria-label="Distans demo upload">
      <ul className="distans-demo-rules">
        <li>Raw single-track only — never a published episode.</li>
        <li>Max 2 GB · max 1 hour.</li>
        <li>WAV, MP3, or M4A.</li>
        <li>We email the mastered file. Links stay available for 48 hours.</li>
      </ul>

      <div
        className={"upload-zone" + (dragging ? " dragging" : "")}
        onClick={() => status === "idle" && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void accept(event.dataTransfer.files?.[0]);
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload raw single-track audio"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (status === "idle") inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
          style={{ display: "none" }}
          onChange={(event) => void accept(event.target.files?.[0])}
        />

        {status === "idle" && (
          <div>
            <div className="upload-icon" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 16V4" />
                <path d="M5.5 9.5 11 4l5.5 5.5" />
                <path d="M4 18.5h14" />
              </svg>
            </div>
            <div className="upload-title">
              {dragging ? "Drop your raw track" : "Drop your raw single-track"}
            </div>
            <div className="microcopy">
              .wav, .mp3, or .m4a — max 2 GB / 1 hour — or click to browse
            </div>
            {backendDown && (
              <p className="distans-demo-error">{BACKEND_DOWN_MESSAGE}</p>
            )}
            {error && <p className="distans-demo-error">{error}</p>}
          </div>
        )}

        {status !== "idle" && file && (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ cursor: "default" }}
          >
            <div className="upload-file-row">
              <div style={{ flex: 1, textAlign: "left" }}>
                <div className="upload-file-name">{file.name}</div>
                <div className="microcopy">{formatBytes(file.size)}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={reset}
                aria-label={
                  status === "working" ? "Cancel upload" : "Remove file"
                }
              >
                ✕
              </button>
            </div>

            {status === "checking" && (
              <div className="microcopy" style={{ padding: "14px 0 4px" }}>
                Reading file…
              </div>
            )}

            {(status === "ready" || status === "limit-error") && (
              <>
                {backendDown && !error && (
                  <p className="distans-demo-error">{BACKEND_DOWN_MESSAGE}</p>
                )}
                {error && <p className="distans-demo-error">{error}</p>}
                <label
                  className="distans-demo-field-label"
                  htmlFor="distans-demo-email"
                >
                  Email for delivery
                </label>
                <input
                  id="distans-demo-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="distans-demo-input"
                />
                <label
                  className="distans-demo-field-label"
                  htmlFor="distans-demo-mic"
                >
                  What mic did you use?
                </label>
                <select
                  id="distans-demo-mic"
                  className="distans-demo-input"
                  value={micType}
                  onChange={(event) =>
                    setMicType(event.target.value as MicType)
                  }
                >
                  {MIC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary distans-demo-submit"
                  onClick={() => void startDemo()}
                  disabled={!file || hasLimitError || backendDown}
                >
                  {backendDown ? "Mastering offline" : "Start Distans demo"}
                </button>
                <p className="microcopy distans-demo-footnote">
                  Runs through the real Distans / PodMaster chain. We email your
                  download link when it&apos;s ready.
                </p>
              </>
            )}

            {status === "working" &&
              (() => {
                const total = uploadBytes?.total || file.size;
                const loaded = Math.min(uploadBytes?.loaded ?? 0, total);
                const done = total > 0 && loaded >= total;
                if (done) {
                  return (
                    <div className="microcopy" style={{ padding: "14px 0 4px" }}>
                      Upload received. Adding your track to the queue…
                    </div>
                  );
                }
                const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
                return (
                  <div style={{ padding: "14px 0 4px", textAlign: "left" }}>
                    <div className="microcopy" style={{ marginBottom: 8 }}>
                      Uploading… {pct}% · {(loaded / 1048576).toFixed(1)} of{" "}
                      {(total / 1048576).toFixed(1)} MB
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="distans-demo-progress"
                    >
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

            {status === "queued" && (
              <div className="distans-demo-success" role="status">
                Queued for Distans mastering. We&apos;ll email you when it&apos;s
                ready — you can close this window.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
