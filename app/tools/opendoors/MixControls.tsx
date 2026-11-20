'use client';
// Gemensamma reglage för uppladdnings- och avsnittssidan: panorering per spår och EQ.
import { EqGraph } from './EqGraph';
import { PAN_MAX, PAN_MIN, panLabel, type Eq } from '@/lib/opendoors-eq';

export function PanControl({ value, onChange, disabled, label }: { value: number; onChange: (v: number) => void; disabled?: boolean; label?: string }) {
  return (
    <div className="od-pan">
      <label>{label || 'Panorering'}: <b>{panLabel(value)}</b></label>
      <div className="od-pan-row">
        <span aria-hidden>V</span>
        <input type="range" min={PAN_MIN} max={PAN_MAX} step={5} value={value} disabled={disabled}
          aria-label={`${label || 'Panorering'}: ${panLabel(value)}`}
          onChange={e => onChange(Number(e.target.value))} onDoubleClick={() => onChange(0)} />
        <span aria-hidden>H</span>
        <button type="button" className="od-btn od-btn-ghost od-btn-sm" disabled={disabled || value === 0} onClick={() => onChange(0)}>Mitten</button>
      </div>
    </div>
  );
}

export function EqSection({ eq, onChange }: { eq: Eq; onChange: (eq: Eq) => void }) {
  return <div className="od-eqwrap"><EqGraph eq={eq} onChange={onChange} /></div>;
}
