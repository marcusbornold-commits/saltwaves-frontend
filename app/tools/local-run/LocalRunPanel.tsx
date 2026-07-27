"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decodeFileTo48k, analyzeChannels, type AnalysisResult } from "@/lib/audio-analysis";
import {
  ABA_CSS,
  AbAnalysisResults,
  decodeAnalysisError,
  fmt,
} from "../ab-analyzer/ab-analysis-ui";

const API = "http://127.0.0.1:8766";

type Mode = "mild" | "standard" | "strong";
type MicType = "dynamic" | "condenser" | "headset" | "unknown";

type SpecEntry = {
  label: string;
  lufs: number;
  dbtp: number;
  brusgolv: number;
};

type SpecsMap = Record<string, SpecEntry>;

type JobPhase =
  | "idle"
  | "uploading"
  | "running"
  | "analyzing"
  | "done"
  | "error";

const MODES: { value: Mode; label: string }[] = [
  { value: "mild", label: "mild (80 Hz)" },
  { value: "standard", label: "standard (90 Hz)" },
  { value: "strong", label: "strong (100 Hz)" },
];

const MICS: { value: MicType; label: string }[] = [
  { value: "dynamic", label: "dynamic" },
  { value: "condenser", label: "condenser" },
  { value: "headset", label: "headset" },
  { value: "unknown", label: "Okänd / auto" },
];

function estimateNoiseFloorDb(channels: Float32Array[]): number {
  const mono = new Float64Array(channels[0].length);
  for (let i = 0; i < mono.length; i++) {
    let s = 0;
    for (const ch of channels) s += ch[i];
    mono[i] = s / channels.length;
  }
  const frameSize = 2048;
  const hop = 512;
  const rmsValues: number[] = [];
  for (let off = 0; off + frameSize <= mono.length; off += hop) {
    let e = 0;
    for (let i = 0; i < frameSize; i++) e += mono[off + i] * mono[off + i];
    rmsValues.push(10 * Math.log10(e / frameSize + 1e-20));
  }
  if (!rmsValues.length) return NaN;
  rmsValues.sort((a, b) => a - b);
  const idx = Math.floor(rmsValues.length * 0.1);
  return rmsValues[idx];
}

async function analyzeWithNoiseFloor(
  file: File,
  onStatus: (s: string) => void,
): Promise<{ result: AnalysisResult; noiseFloorDb: number }> {
  onStatus("Decoding…");
  const channels = await decodeFileTo48k(file);
  const durMin = channels[0].length / 48000 / 60;
  if (durMin > 30) {
    onStatus(`Long file (${durMin.toFixed(0)} min) — this can take a while…`);
  }
  const result = await analyzeChannels(channels, (stage, frac) =>
    onStatus(`Analyzing ${stage} ${(frac * 100).toFixed(0)} %`),
  );
  return { result, noiseFloorDb: estimateNoiseFloorDb(channels) };
}

function SpecCompliance({
  spec,
  after,
  noiseFloorDb,
}: {
  spec: SpecEntry;
  after: AnalysisResult;
  noiseFloorDb: number;
}) {
  const lufsOk = Math.abs(after.integratedLufs - spec.lufs) <= 1.0;
  const dbtpOk = after.truePeakDb <= spec.dbtp;
  const brusOk = isFinite(noiseFloorDb) && noiseFloorDb <= spec.brusgolv;

  const rows = [
    {
      label: "LUFS",
      target: `${spec.lufs.toFixed(1)} LUFS`,
      measured: fmt(after.integratedLufs, " LUFS"),
      ok: lufsOk,
    },
    {
      label: "dBTP",
      target: `${spec.dbtp.toFixed(1)} dBTP`,
      measured: fmt(after.truePeakDb, " dBTP"),
      ok: dbtpOk,
    },
    {
      label: "Brusgolv",
      target: `${spec.brusgolv.toFixed(0)} dBFS`,
      measured: fmt(noiseFloorDb, " dBFS", 0),
      ok: brusOk,
    },
  ];

  return (
    <section className="lr-spec" aria-label="Spec compliance">
      <h2 className="aba-h2">Spec — {spec.label}</h2>
      <div className="lr-spec-grid">
        {rows.map((row) => (
          <div key={row.label} className="lr-spec-row">
            <span className="lr-spec-label">{row.label}</span>
            <span className="lr-spec-target">{row.target}</span>
            <span className="lr-spec-measured">{row.measured}</span>
            <span className={`lr-spec-badge${row.ok ? " is-ok" : " is-fail"}`}>
              {row.ok ? "OK" : "UTANFÖR"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LocalRunPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [specs, setSpecs] = useState<SpecsMap>({});
  const [specKey, setSpecKey] = useState("");
  const [mode, setMode] = useState<Mode>("standard");
  const [mic, setMic] = useState<MicType>("unknown");
  const [phase, setPhase] = useState<JobPhase>("idle");
  const [statusText, setStatusText] = useState("");
  const [jobLog, setJobLog] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [serverError, setServerError] = useState("");
  const [specsError, setSpecsError] = useState("");

  const [beforeResult, setBeforeResult] = useState<AnalysisResult | null>(null);
  const [afterResult, setAfterResult] = useState<AnalysisResult | null>(null);
  const [noiseFloorDb, setNoiseFloorDb] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState("");

  useEffect(() => {
    void fetch(`${API}/specs`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<SpecsMap>;
      })
      .then((data) => {
        setSpecs(data);
        const keys = Object.keys(data);
        if (keys.length) setSpecKey(keys[0]);
      })
      .catch((e) => {
        setSpecsError(
          e instanceof Error
            ? `Kunde inte hämta specs: ${e.message}. Kör runner.py på Mac Mini och SSH-forward port 8766.`
            : "Kunde inte hämta specs.",
        );
      });
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const resetResults = () => {
    setBeforeResult(null);
    setAfterResult(null);
    setNoiseFloorDb(null);
    setAnalysisError("");
    setJobLog("");
    setServerError("");
    setJobId(null);
  };

  const onFile = (f: File) => {
    resetResults();
    setFile(f);
    setPhase("idle");
    setStatusText("");
  };

  const pollJob = useCallback((id: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const res = await fetch(`${API}/job/${id}`);
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const data = (await res.json()) as { status: string; log: string };

            setJobLog(data.log);
            setStatusText(data.status === "running" ? "Kedjan kör…" : data.status);

            if (data.status === "running") return;

            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }

            if (data.status === "error") {
              setPhase("error");
              setServerError(data.log || "Kedjan misslyckades.");
              return;
            }

            setPhase("analyzing");
            setStatusText("Hämtar och analyserar ljud…");

            const [beforeRes, afterRes] = await Promise.all([
              fetch(`${API}/audio/${id}/before`),
              fetch(`${API}/audio/${id}/after`),
            ]);
            if (!beforeRes.ok || !afterRes.ok) {
              throw new Error("Kunde inte hämta before/after från servern.");
            }

            const [beforeBlob, afterBlob] = await Promise.all([
              beforeRes.blob(),
              afterRes.blob(),
            ]);
            const beforeFile = new File([beforeBlob], "before", {
              type: beforeBlob.type || "audio/*",
            });
            const afterFile = new File([afterBlob], "after.wav", {
              type: "audio/wav",
            });

            const [beforeAnalysis, afterAnalysis] = await Promise.all([
              analyzeWithNoiseFloor(beforeFile, () => {}),
              analyzeWithNoiseFloor(afterFile, (s) => setStatusText(s)),
            ]);

            setBeforeResult(beforeAnalysis.result);
            setAfterResult(afterAnalysis.result);
            setNoiseFloorDb(afterAnalysis.noiseFloorDb);
            setPhase("done");
            setStatusText("");
          } catch (e) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setPhase("error");
            setAnalysisError(
              e instanceof Error ? e.message : decodeAnalysisError(e),
            );
          }
        })();
      }, 2000);
  }, []);

  const runChain = async () => {
    if (!file || !specKey) return;
    resetResults();
    setPhase("uploading");
    setStatusText("Laddar upp…");

    const params = new URLSearchParams({
      spec: specKey,
      mic,
      mode,
      filename: file.name,
    });

    try {
      const res = await fetch(`${API}/run?${params}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      const { id } = (await res.json()) as { id: string };
      setJobId(id);
      setPhase("running");
      setStatusText("Kedjan kör…");
      pollJob(id);
    } catch (e) {
      setPhase("error");
      setServerError(
        e instanceof Error ? e.message : "Uppladdning misslyckades.",
      );
    }
  };

  const busy = phase === "uploading" || phase === "running" || phase === "analyzing";
  const selectedSpec = specKey ? specs[specKey] : null;

  return (
    <div className="aba lr">
      <style>{ABA_CSS + LOCAL_RUN_CSS}</style>

      <header className="aba-head">
        <p className="aba-eyebrow">Saltwaves · lokal driftpanel</p>
        <h1 className="aba-title">Local Run</h1>
        <p className="aba-sub">
          Internt verktyg — körs enbart på localhost. Dra in en råfil, kör
          PodMaster-kedjan på Mac Mini via SSH-forward, analysera before/after
          i browsern med samma motor som A/B Analyzer.
        </p>
      </header>

      {specsError && (
        <div className="aba-remote-error" role="alert">
          <p className="aba-remote-error-msg">{specsError}</p>
        </div>
      )}

      <div
        className={`aba-drop lr-drop${file ? " is-done" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.flac,.aac,.ogg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <span className="aba-drop-tag">Råfil</span>
        <span className="aba-drop-name">
          {file ? file.name : "Dra in råfilen"}
        </span>
      </div>

      <div className="lr-controls">
        <label className="lr-field">
          <span className="lr-label">Målspec</span>
          <select
            className="lr-select"
            value={specKey}
            onChange={(e) => setSpecKey(e.target.value)}
            disabled={busy || !Object.keys(specs).length}
          >
            {Object.entries(specs).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="lr-field">
          <span className="lr-label">Lågsnitt</span>
          <select
            className="lr-select"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            disabled={busy}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="lr-field">
          <span className="lr-label">Mikrofontyp</span>
          <select
            className="lr-select"
            value={mic}
            onChange={(e) => setMic(e.target.value as MicType)}
            disabled={busy}
          >
            {MICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="lr-run"
          disabled={!file || busy || !specKey}
          onClick={() => void runChain()}
        >
          Kör kedjan
        </button>
      </div>

      {(statusText || jobLog) && phase !== "done" && (
        <div className="lr-status" role="status" aria-live="polite">
          {statusText && <p className="lr-status-line">{statusText}</p>}
          {jobLog && (
            <pre className="lr-log">{jobLog}</pre>
          )}
        </div>
      )}

      {phase === "error" && (serverError || analysisError) && (
        <div className="aba-remote-error" role="alert">
          <p className="aba-remote-error-title">Fel</p>
          <pre className="lr-log">{serverError || analysisError}</pre>
        </div>
      )}

      {(beforeResult || afterResult) && (
        <AbAnalysisResults
          a={beforeResult}
          b={afterResult}
          label={file?.name ?? null}
        />
      )}

      {phase === "done" && selectedSpec && afterResult && noiseFloorDb != null && (
        <SpecCompliance
          spec={selectedSpec}
          after={afterResult}
          noiseFloorDb={noiseFloorDb}
        />
      )}

      {phase === "done" && jobId && (
        <div className="lr-download">
          <a
            className="lr-run lr-download-btn"
            href={`${API}/download/${jobId}`}
            download
          >
            Ladda ner master
          </a>
        </div>
      )}
    </div>
  );
}

const LOCAL_RUN_CSS = `
.lr .lr-drop{max-width:920px;margin:0 auto 24px}
.lr-controls{
  max-width:920px;margin:0 auto 28px;display:grid;gap:14px;
  grid-template-columns:repeat(auto-fit,minmax(180px,1fr));align-items:end;
}
.lr-field{display:flex;flex-direction:column;gap:6px}
.lr-label{font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700}
.lr-select{
  border:1px solid var(--line);border-radius:10px;padding:10px 12px;
  background:rgba(255,255,255,.55);font-size:14px;font-family:inherit;
}
.lr-run{
  border:none;border-radius:10px;padding:12px 18px;
  background:var(--ink);color:var(--paper);font-size:14px;font-weight:700;
  cursor:pointer;font-family:inherit;
}
.lr-run:disabled{opacity:.45;cursor:not-allowed}
.lr-status,.lr-spec,.lr-download{max-width:920px;margin:0 auto 28px}
.lr-status-line{margin:0 0 8px;font-size:14px;color:var(--ink-60)}
.lr-log{
  margin:0;padding:12px 14px;border-radius:10px;border:1px solid var(--line);
  background:rgba(255,255,255,.45);font-size:12px;line-height:1.5;
  white-space:pre-wrap;word-break:break-word;max-height:280px;overflow:auto;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.lr-spec-grid{display:grid;gap:10px}
.lr-spec-row{
  display:grid;grid-template-columns:80px 1fr 1fr auto;gap:12px;align-items:center;
  border:1px solid var(--line);border-radius:10px;padding:12px 14px;
  background:rgba(255,255,255,.5);font-size:14px;font-variant-numeric:tabular-nums;
}
.lr-spec-label{font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
.lr-spec-target{color:var(--ink-60)}
.lr-spec-badge{
  font-size:11px;font-weight:700;letter-spacing:.08em;padding:4px 10px;border-radius:99px;
}
.lr-spec-badge.is-ok{background:#e6f4ea;color:#1e6b3a}
.lr-spec-badge.is-fail{background:#fdecea;color:#b3261e}
.lr-download-btn{display:inline-block;text-decoration:none;text-align:center}
@media (max-width:640px){
  .lr-spec-row{grid-template-columns:1fr 1fr;grid-template-rows:auto auto auto}
  .lr-spec-label{grid-column:1/-1}
}
`;
