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
// Bumpa denna när runner.py:s version bumpas.
const EXPECTED_RUNNER_VERSION = "4-lufs";
const HEALTH_POLL_MS = 5000;

type HealthInfo = {
  ok: boolean;
  pid: number;
  version: string;
  started: string;
};

type RunnerStatus = "checking" | "up" | "down";

function isNetworkFetchError(e: unknown): boolean {
  return e instanceof TypeError && e.message === "Failed to fetch";
}

function formatStarted(iso: string): string {
  try {
    return new Date(iso).toLocaleString("sv-SE");
  } catch {
    return iso;
  }
}

type Mode = "mild" | "standard" | "strong";
type MicType = "dynamic" | "condenser" | "headset" | "unknown";

type SpecEntry = {
  label: string;
  lufs: number;
  dbtp: number;
  brusgolv: number;
  /** Half-width LUFS tolerance; defaults to 0.5 when omitted. */
  lufsTol?: number;
};

type SpecsMap = Record<string, SpecEntry>;

type JobPhase =
  | "idle"
  | "uploading"
  | "running"
  | "analyzing"
  | "done"
  | "error";

/** Accept ceiling specs (dBTP, noise floor) if measured ≤ limit + this. */
const CEILING_EPS = 0.05;
const DEFAULT_LUFS_TOL = 0.5;

const METHODOLOGY =
  "Methodology: ITU-R BS.1770-4 (K-weighted, gated) · true peak 4× oversampled · LTAS Hann 4096 / 50 % overlap, RMS-gated median −15 dB, level-normalised to the 250 Hz – 4 kHz speech core. Read 9k+ with care on lossy sources.";

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

function lufsTolerance(spec: SpecEntry): number {
  return spec.lufsTol ?? DEFAULT_LUFS_TOL;
}

/** Ceiling check: measured must be ≤ limit (boundary OK) + float epsilon. */
function passesCeiling(measured: number, limit: number): boolean {
  return isFinite(measured) && measured <= limit + CEILING_EPS;
}

/** Symmetric LUFS window around target (not a strict inequality). */
function passesLufs(measured: number, target: number, tol: number): boolean {
  return isFinite(measured) && Math.abs(measured - target) <= tol;
}

type SpecRowStatus = "pass" | "fail" | "n/a";

type SpecEvalRow = {
  parameter: string;
  before: string;
  after: string;
  requirement: string;
  status: SpecRowStatus;
};

function evaluateSpecRows(
  spec: SpecEntry,
  before: AnalysisResult,
  after: AnalysisResult,
  beforeNoiseDb: number | null,
  afterNoiseDb: number,
): SpecEvalRow[] {
  const tol = lufsTolerance(spec);
  const lufsOk = passesLufs(after.integratedLufs, spec.lufs, tol);
  const dbtpOk = passesCeiling(after.truePeakDb, spec.dbtp);
  const brusOk = passesCeiling(afterNoiseDb, spec.brusgolv);

  return [
    {
      parameter: "LUFS",
      before: fmt(before.integratedLufs, " LUFS"),
      after: fmt(after.integratedLufs, " LUFS"),
      requirement: `${spec.lufs.toFixed(1)} ± ${tol.toFixed(1)} LUFS`,
      status: lufsOk ? "pass" : "fail",
    },
    {
      parameter: "dBTP",
      before: fmt(before.truePeakDb, " dBTP"),
      after: fmt(after.truePeakDb, " dBTP"),
      requirement: `≤ ${spec.dbtp.toFixed(1)} dBTP`,
      status: dbtpOk ? "pass" : "fail",
    },
    {
      parameter: "LRA",
      before: fmt(before.lra, " LU"),
      after: fmt(after.lra, " LU"),
      requirement: "—",
      status: "n/a",
    },
    {
      parameter: "PLR",
      before: fmt(before.plr, " dB"),
      after: fmt(after.plr, " dB"),
      requirement: "—",
      status: "n/a",
    },
    {
      parameter: "Noise floor",
      before: fmt(beforeNoiseDb, " dBFS", 0),
      after: fmt(afterNoiseDb, " dBFS", 0),
      requirement: `≤ ${spec.brusgolv.toFixed(0)} dBFS`,
      status: brusOk ? "pass" : "fail",
    },
  ];
}

function statusLabelSv(status: SpecRowStatus): string {
  if (status === "pass") return "OK";
  if (status === "fail") return "UTANFÖR";
  return "—";
}

function statusLabelEn(status: SpecRowStatus): string {
  if (status === "pass") return "PASS";
  if (status === "fail") return "OUT OF SPEC";
  return "—";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deliveryReportBasename(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "master";
  return `${base}_delivery-report.html`;
}

function buildDeliveryReportHtml(opts: {
  filename: string;
  dateLabel: string;
  specLabel: string;
  rows: SpecEvalRow[];
}): string {
  const rowHtml = opts.rows
    .map((row) => {
      const cls =
        row.status === "pass"
          ? "pass"
          : row.status === "fail"
            ? "fail"
            : "na";
      return `<tr>
  <td>${escapeHtml(row.parameter)}</td>
  <td>${escapeHtml(row.before)}</td>
  <td>${escapeHtml(row.after)}</td>
  <td>${escapeHtml(row.requirement)}</td>
  <td class="status ${cls}">${escapeHtml(statusLabelEn(row.status))}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Delivery report — ${escapeHtml(opts.filename)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 48px 56px;
    font-family: "IBM Plex Sans", "Segoe UI", Helvetica, Arial, sans-serif;
    color: #1a1a1a; background: #fff; line-height: 1.45;
  }
  h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.02em; }
  .meta { color: #555; font-size: 14px; margin: 0 0 28px; }
  .meta strong { color: #1a1a1a; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #ddd; }
  th { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; font-weight: 700; }
  .status { font-weight: 700; letter-spacing: 0.04em; font-size: 12px; }
  .status.pass { color: #1e6b3a; }
  .status.fail { color: #b3261e; }
  .status.na { color: #888; }
  .method {
    margin: 28px 0 0; padding-top: 16px; border-top: 1px solid #ddd;
    font-size: 12px; color: #555; max-width: 72ch;
  }
  footer {
    margin-top: 36px; padding-top: 16px; border-top: 1px solid #ddd;
    font-size: 12px; color: #666; line-height: 1.6;
  }
  @media print {
    body { padding: 12mm 14mm; }
    a { color: inherit; text-decoration: none; }
    .status.pass, .status.fail { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <h1>Delivery report</h1>
  <p class="meta">
    <strong>File:</strong> ${escapeHtml(opts.filename)}<br />
    <strong>Date:</strong> ${escapeHtml(opts.dateLabel)}<br />
    <strong>Target spec:</strong> ${escapeHtml(opts.specLabel)}
  </p>
  <table>
    <thead>
      <tr>
        <th>Parameter</th>
        <th>Before</th>
        <th>After</th>
        <th>Requirement</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>
${rowHtml}
    </tbody>
  </table>
  <p class="method">${escapeHtml(METHODOLOGY)}</p>
  <footer>
    Saltwaves Studio · Marcus Bornold · Örebro, Sweden ·
    <a href="mailto:hello@saltwaves.studio">hello@saltwaves.studio</a><br />
    Processed on own hardware inside the EU
  </footer>
</body>
</html>`;
}

function downloadBlob(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  before,
  after,
  beforeNoiseFloorDb,
  noiseFloorDb,
}: {
  spec: SpecEntry;
  before: AnalysisResult;
  after: AnalysisResult;
  beforeNoiseFloorDb: number | null;
  noiseFloorDb: number;
}) {
  const rows = evaluateSpecRows(
    spec,
    before,
    after,
    beforeNoiseFloorDb,
    noiseFloorDb,
  ).filter((r) => r.status !== "n/a");

  return (
    <section className="lr-spec" aria-label="Spec compliance">
      <h2 className="aba-h2">Spec — {spec.label}</h2>
      <div className="lr-spec-grid">
        {rows.map((row) => (
          <div key={row.parameter} className="lr-spec-row">
            <span className="lr-spec-label">
              {row.parameter === "Noise floor" ? "Brusgolv" : row.parameter}
            </span>
            <span className="lr-spec-target">{row.requirement}</span>
            <span className="lr-spec-measured">{row.after}</span>
            <span
              className={`lr-spec-badge${
                row.status === "pass" ? " is-ok" : " is-fail"
              }`}
            >
              {statusLabelSv(row.status)}
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
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus>("checking");
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [runnerForceDown, setRunnerForceDown] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const [beforeResult, setBeforeResult] = useState<AnalysisResult | null>(null);
  const [afterResult, setAfterResult] = useState<AnalysisResult | null>(null);
  const [beforeNoiseFloorDb, setBeforeNoiseFloorDb] = useState<number | null>(
    null,
  );
  const [noiseFloorDb, setNoiseFloorDb] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState("");

  const markRunnerDown = useCallback(() => {
    setRunnerForceDown(true);
    setRunnerStatus("down");
    setHealth(null);
  }, []);

  const pollHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API}/health`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = (await res.json()) as HealthInfo;
      setHealth(data);
      setRunnerStatus("up");
      setRunnerForceDown(false);
    } catch {
      setHealth(null);
      setRunnerStatus("down");
    }
  }, []);

  useEffect(() => {
    void pollHealth();
    healthPollRef.current = setInterval(() => void pollHealth(), HEALTH_POLL_MS);
    return () => {
      if (healthPollRef.current) clearInterval(healthPollRef.current);
    };
  }, [pollHealth]);

  const restartRunner = async () => {
    setRestarting(true);
    try {
      await fetch(`${API}/restart`, { method: "POST" });
      await new Promise((r) => setTimeout(r, 3000));
      await pollHealth();
    } catch {
      markRunnerDown();
    } finally {
      setRestarting(false);
    }
  };

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
    setBeforeNoiseFloorDb(null);
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
            setBeforeNoiseFloorDb(beforeAnalysis.noiseFloorDb);
            setNoiseFloorDb(afterAnalysis.noiseFloorDb);
            setPhase("done");
            setStatusText("");
          } catch (e) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            if (isNetworkFetchError(e)) {
              markRunnerDown();
            }
            setPhase("error");
            setServerError(
              isNetworkFetchError(e)
                ? "Jobbpolling misslyckades — runner nås inte eller tunnel bruten (Failed to fetch)."
                : e instanceof Error
                  ? e.message
                  : decodeAnalysisError(e),
            );
          }
        })();
      }, 2000);
  }, [markRunnerDown]);

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
      if (isNetworkFetchError(e)) {
        markRunnerDown();
      }
      setPhase("error");
      setServerError(
        isNetworkFetchError(e)
          ? "Uppladdning misslyckades — runner nås inte (Failed to fetch)."
          : e instanceof Error
            ? e.message
            : "Uppladdning misslyckades.",
      );
    }
  };

  const busy = phase === "uploading" || phase === "running" || phase === "analyzing";
  const selectedSpec = specKey ? specs[specKey] : null;
  const runnerDown = runnerForceDown || runnerStatus === "down";
  const versionStale =
    runnerStatus === "up" &&
    health != null &&
    health.version !== EXPECTED_RUNNER_VERSION;
  const statusBarAlert = runnerDown || versionStale;

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

      <div
        className={`lr-statusbar${statusBarAlert ? " is-alert" : ""}`}
        role="status"
        aria-live="polite"
      >
        <div className="lr-status-item">
          <span
            className={`lr-dot${
              runnerDown
                ? " is-down"
                : runnerStatus === "up"
                  ? " is-up"
                  : " is-checking"
            }`}
            title={
              health
                ? `v${health.version} · pid ${health.pid} · startad ${formatStarted(health.started)}`
                : undefined
            }
          />
          <span className="lr-status-name">Runner</span>
          <span className="lr-status-meta">
            {runnerDown ? (
              <span className="lr-status-warn">
                Runner nere eller tunnel bruten
              </span>
            ) : runnerStatus === "up" && health ? (
              <>
                OK · v{health.version} · startad{" "}
                {formatStarted(health.started)}
              </>
            ) : (
              "Kontrollerar…"
            )}
            <button
              type="button"
              className={`lr-status-btn${statusBarAlert ? "" : " is-ghost"}`}
              disabled={restarting}
              onClick={() => void restartRunner()}
            >
              {restarting ? "Startar om…" : "Starta om runner"}
            </button>
            {runnerDown && (
              <span className="lr-status-hint">
                Om omstart inte hjälper: kontrollera SSH-tunneln (ssh -L
                8766:127.0.0.1:8766 mac-mini)
              </span>
            )}
          </span>
        </div>

        <div className="lr-status-item">
          <span
            className={`lr-dot${
              versionStale ? " is-stale" : runnerStatus === "up" ? " is-up" : " is-checking"
            }`}
          />
          <span className="lr-status-name">Version</span>
          <span className="lr-status-meta">
            {versionStale ? (
              <span className="lr-status-warn">
                Runnern kör gammal kod — starta om
                {health
                  ? ` (körs: ${health.version}, förväntas: ${EXPECTED_RUNNER_VERSION})`
                  : ""}
              </span>
            ) : runnerStatus === "up" && health ? (
              `${health.version} ✓`
            ) : (
              "–"
            )}
          </span>
        </div>

        <div className="lr-status-item">
          <span
            className={`lr-dot${
              specsError ? " is-down" : Object.keys(specs).length ? " is-up" : " is-checking"
            }`}
          />
          <span className="lr-status-name">Specs</span>
          <span className="lr-status-meta">
            {specsError
              ? specsError
              : Object.keys(specs).length
                ? `${Object.keys(specs).length} målspecar laddade`
                : "Hämtar specs…"}
          </span>
        </div>
      </div>

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

      {phase === "done" &&
        selectedSpec &&
        beforeResult &&
        afterResult &&
        noiseFloorDb != null && (
        <SpecCompliance
          spec={selectedSpec}
          before={beforeResult}
          after={afterResult}
          beforeNoiseFloorDb={beforeNoiseFloorDb}
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
          <button
            type="button"
            className="lr-run lr-download-btn lr-download-secondary"
            disabled={
              !selectedSpec ||
              !beforeResult ||
              !afterResult ||
              noiseFloorDb == null ||
              !file
            }
            onClick={() => {
              if (
                !selectedSpec ||
                !beforeResult ||
                !afterResult ||
                noiseFloorDb == null ||
                !file
              ) {
                return;
              }
              const rows = evaluateSpecRows(
                selectedSpec,
                beforeResult,
                afterResult,
                beforeNoiseFloorDb,
                noiseFloorDb,
              );
              const html = buildDeliveryReportHtml({
                filename: file.name,
                dateLabel: new Date().toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
                specLabel: selectedSpec.label,
                rows,
              });
              downloadBlob(deliveryReportBasename(file.name), html);
            }}
          >
            Ladda ner rapport
          </button>
        </div>
      )}
    </div>
  );
}

const LOCAL_RUN_CSS = `
.lr-statusbar{
  max-width:920px;margin:0 auto 20px;display:grid;gap:10px;
  border:1px solid var(--line);border-radius:12px;padding:12px 14px;
  background:rgba(255,255,255,.5);
}
.lr-statusbar.is-alert{border-color:#f5c2c0;background:#fff5f5}
.lr-status-item{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;font-size:13px}
.lr-dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto;margin-top:4px}
.lr-dot.is-up{background:#34c759}
.lr-dot.is-down{background:#ff3b30}
.lr-dot.is-stale{background:#ffb020}
.lr-dot.is-checking{background:#8a8a8a}
.lr-status-name{
  font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  min-width:56px;
}
.lr-status-meta{flex:1;color:var(--ink-60);display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.lr-status-warn{color:#b3261e;font-weight:600}
.lr-status-hint{font-size:12px;color:var(--ink-60);flex-basis:100%}
.lr-status-btn{
  border:1px solid var(--line);border-radius:8px;padding:4px 10px;
  background:var(--ink);color:var(--paper);font-size:12px;font-weight:600;
  cursor:pointer;font-family:inherit;
}
.lr-status-btn.is-ghost{
  background:transparent;color:var(--ink-60);border-color:var(--line);
  font-weight:500;
}
.lr-status-btn.is-ghost:hover:not(:disabled){
  color:var(--ink);border-color:var(--ink);
}
.lr-status-btn:disabled{opacity:.5;cursor:not-allowed}
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
.lr-download{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.lr-download-btn{display:inline-block;text-decoration:none;text-align:center}
.lr-download-secondary{
  background:transparent;color:var(--ink);border:1px solid var(--line);
}
.lr-download-secondary:hover:not(:disabled){border-color:var(--ink)}
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
@media (max-width:640px){
  .lr-spec-row{grid-template-columns:1fr 1fr;grid-template-rows:auto auto auto}
  .lr-spec-label{grid-column:1/-1}
}
`;
