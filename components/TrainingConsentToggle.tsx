"use client";

import { useState } from "react";

type TrainingConsentToggleProps = {
  initialConsent: boolean;
};

export default function TrainingConsentToggle({
  initialConsent,
}: TrainingConsentToggleProps) {
  const [enabled, setEnabled] = useState(initialConsent);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/account/training-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: next }),
      });

      if (!res.ok) {
        setEnabled(previous);
        setError("Could not save. Please try again.");
        return;
      }

      const data = (await res.json()) as { training_data_consent?: boolean };
      setEnabled(data.training_data_consent === true);
    } catch {
      setEnabled(previous);
      setError("Could not save. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="pref-card">
      <div className="pref-row">
        <div className="pref-copy">
          <p className="pref-label">Improve the pipeline</p>
          <p className="pref-desc">
            Allow Saltwaves to use audio you upload to improve how we process
            voice.
          </p>
        </div>
        <label className="pref-switch">
          <span className="sr-only">
            Allow uploaded audio to improve the processing pipeline
          </span>
          <input
            type="checkbox"
            checked={enabled}
            disabled={pending}
            onChange={(e) => void handleChange(e.target.checked)}
          />
          <span className="pref-switch-track" aria-hidden="true" />
        </label>
      </div>
      {error && <p className="pref-error">{error}</p>}
    </div>
  );
}
