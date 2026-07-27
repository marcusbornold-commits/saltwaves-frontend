"use client";

// app/tools/ab-analyzer/AbAnalyzer.tsx
// Saltwaves A/B Loudness Analyzer — internal tool. All analysis runs locally
// in the browser; no audio ever leaves the machine.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AnalysisResult } from "@/lib/audio-analysis";
import {
  ABA_CSS,
  AbAnalysisResults,
  analyzeAudioFile,
  decodeAnalysisError,
} from "./ab-analysis-ui";

type Slot = "A" | "B";

interface SlotState {
  name: string | null;
  status: string;
  result: AnalysisResult | null;
  error: string | null;
}

const EMPTY: SlotState = { name: null, status: "", result: null, error: null };

async function urlToFile(url: string, slot: Slot): Promise<File> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(
      `Could not fetch file ${slot}. The URL may be invalid or blocked by CORS.`
    );
  }
  if (!res.ok) {
    throw new Error(
      `Could not fetch file ${slot}: server returned ${res.status} ${res.statusText}.`
    );
  }
  const blob = await res.blob();
  const name =
    decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "") ||
    `${slot}.audio`;
  return new File([blob], name, { type: blob.type || "audio/*" });
}

type RemoteLoadState =
  | { phase: "idle"; label: string | null }
  | { phase: "fetching"; label: string | null }
  | { phase: "analyzing"; label: string | null }
  | { phase: "error"; label: string | null; error: string };

export default function AbAnalyzer() {
  const searchParams = useSearchParams();
  const [slots, setSlots] = useState<Record<Slot, SlotState>>({
    A: EMPTY,
    B: EMPTY,
  });
  const [remoteLoad, setRemoteLoad] = useState<RemoteLoadState>({
    phase: "idle",
    label: null,
  });
  const inputA = useRef<HTMLInputElement>(null);
  const inputB = useRef<HTMLInputElement>(null);
  const urlLoadStarted = useRef(false);

  const setSlot = (slot: Slot, patch: Partial<SlotState>) =>
    setSlots((s) => ({ ...s, [slot]: { ...s[slot], ...patch } }));

  const handleFile = useCallback(async (slot: Slot, file: File) => {
    setSlot(slot, { ...EMPTY, name: file.name, status: "Decoding…" });
    try {
      const result = await analyzeAudioFile(file, (status) =>
        setSlot(slot, { status })
      );
      setSlot(slot, { status: "", result });
    } catch (e) {
      setSlot(slot, {
        status: "",
        error: decodeAnalysisError(e),
      });
    }
  }, []);

  useEffect(() => {
    const aUrl = searchParams.get("a");
    const bUrl = searchParams.get("b");
    const label = searchParams.get("label");

    if (!aUrl || !bUrl || urlLoadStarted.current) return;
    urlLoadStarted.current = true;

    setRemoteLoad({ phase: "fetching", label });

    void (async () => {
      try {
        const [fileA, fileB] = await Promise.all([
          urlToFile(aUrl, "A"),
          urlToFile(bUrl, "B"),
        ]);
        setRemoteLoad({ phase: "analyzing", label });
        await Promise.all([
          handleFile("A", fileA),
          handleFile("B", fileB),
        ]);
        setRemoteLoad({ phase: "idle", label });
      } catch (e) {
        setRemoteLoad({
          phase: "error",
          label,
          error:
            e instanceof Error
              ? e.message
              : "Could not load files from URL. Check the links and try again.",
        });
      }
    })();
  }, [searchParams, handleFile]);

  const onDrop = (slot: Slot) => (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(slot, f);
  };

  const a = slots.A.result;
  const b = slots.B.result;
  const remoteBusy =
    remoteLoad.phase === "fetching" || remoteLoad.phase === "analyzing";
  const resultLabel =
    remoteLoad.label && (a || b) ? remoteLoad.label : null;

  return (
    <div className="aba">
      <style>{ABA_CSS}</style>

      <header className="aba-head">
        <p className="aba-eyebrow">Saltwaves · internal instrument</p>
        <h1 className="aba-title">A/B Loudness Analyzer</h1>
        <p className="aba-sub">
          Drop two files — before and after — and read the difference the way a
          broadcast chain does: BS.1770-4 loudness, true peak, loudness range
          and a VAD-gated long-term spectrum, all measured locally in your
          browser. Nothing is uploaded.
        </p>
      </header>

      {remoteLoad.phase === "error" && (
        <div className="aba-remote-error" role="alert">
          <p className="aba-remote-error-title">Could not load files from URL</p>
          <p className="aba-remote-error-msg">{remoteLoad.error}</p>
          <p className="aba-remote-error-hint">
            Drop files manually below, or click to browse.
          </p>
        </div>
      )}

      {remoteBusy && (
        <div className="aba-remote-loading" role="status" aria-live="polite">
          <span className="aba-remote-spinner" aria-hidden />
          <span>
            {remoteLoad.phase === "fetching"
              ? "Fetching files from URL…"
              : "Analyzing fetched files…"}
          </span>
        </div>
      )}

      <div className="aba-drops">
        {(["A", "B"] as Slot[]).map((slot) => {
          const st = slots[slot];
          const ref = slot === "A" ? inputA : inputB;
          return (
            <div
              key={slot}
              className={`aba-drop aba-drop-${slot}${st.result ? " is-done" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop(slot)}
              onClick={() => ref.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") ref.current?.click();
              }}
            >
              <input
                ref={ref}
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.flac,.aac,.ogg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(slot, f);
                  e.target.value = "";
                }}
              />
              <span className="aba-drop-tag">
                {slot === "A" ? "A · Before" : "B · After"}
              </span>
              <span className="aba-drop-name">
                {st.name ?? "Drop audio here or click to browse"}
              </span>
              {st.status && <span className="aba-drop-status">{st.status}</span>}
              {st.error && <span className="aba-drop-error">{st.error}</span>}
              {st.result && (
                <span className="aba-drop-meta">
                  {(st.result.durationSec / 60).toFixed(1)} min ·{" "}
                  {st.result.ltas
                    ? `${st.result.ltas.framesKept}/${st.result.ltas.framesTotal} frames after gate`
                    : "no spectrum (file too short)"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <AbAnalysisResults a={a} b={b} label={resultLabel} />
    </div>
  );
}
