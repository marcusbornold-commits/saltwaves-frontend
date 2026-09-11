import { exceedsDuration, exceedsFileSize, type AccessLevel } from './access-limits';

export const PAID_INPUT_BUCKET = 'podmaster-input-paid';
export const isJobId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export type UploadDraft = { id: string; filename: string; size: number; email: string; mic: string; duration: number | null };

export function validateUploadDraft(value: unknown, access: AccessLevel): UploadDraft {
  if (!value || typeof value !== 'object') throw new Error('invalid_request');
  const v = value as Record<string, unknown>;
  if (!isJobId(v.id) || typeof v.filename !== 'string' || v.filename.length > 240 ||
      !/\.(wav|mp3|m4a)$/i.test(v.filename) || /[/\\\x00-\x1f\x7f]/.test(v.filename) ||
      typeof v.email !== 'string' || v.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) ||
      typeof v.mic !== 'string' || !['unknown','dynamic','condenser','headset'].includes(v.mic) ||
      typeof v.size !== 'number' || !Number.isSafeInteger(v.size) || v.size <= 0) throw new Error('invalid_request');
  if (exceedsFileSize(access, v.size)) throw new Error('file_too_large');
  if (v.duration !== null && (typeof v.duration !== 'number' || !Number.isFinite(v.duration) || v.duration <= 0)) throw new Error('invalid_request');
  if (typeof v.duration === 'number' && exceedsDuration(access,v.duration)) throw new Error('episode_too_long');
  return v as UploadDraft;
}
