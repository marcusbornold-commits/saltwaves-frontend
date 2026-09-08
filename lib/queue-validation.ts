import { createHmac, timingSafeEqual } from 'node:crypto';
import { type AccessLevel, exceedsDuration, exceedsFileSize } from './access-limits';

export const OUTPUT_BUCKET = 'podmaster-jobs';
export const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class QueueError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function capability(id: string, secret: string) {
  return createHmac('sha256', secret).update('podmaster-job:' + id).digest('hex');
}
export function validCapability(id: string, token: string, secret: string) {
  if (!JOB_ID.test(id) || !/^[0-9a-f]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(capability(id, secret), 'hex'));
}
export function inputBucket(plan: string) { return plan === 'free' ? 'podmaster-input-free' : 'podmaster-input-paid'; }
export function validateUpload(body: Record<string, unknown>, access: AccessLevel) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new QueueError('invalid_request');
  if (typeof body.filename !== 'string' || body.filename.length > 240 ||
      /[/\\\x00-\x1f\x7f]/.test(body.filename) || !/\.(wav|mp3|m4a)$/i.test(body.filename)) {
    throw new QueueError('invalid_file_type');
  }
  if (typeof body.size !== 'number' || !Number.isSafeInteger(body.size) || body.size <= 0) throw new QueueError('invalid_file_size');
  if (exceedsFileSize(access, body.size)) throw new QueueError('file_too_large', 413);
  if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new QueueError('invalid_email');
  const mic = typeof body.mic_type === 'string' ? body.mic_type : 'unknown';
  if (!['dynamic','condenser','headset','unknown'].includes(mic)) throw new QueueError('invalid_microphone');
  const duration = body.duration_seconds;
  if (duration !== null && duration !== undefined && (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0)) throw new QueueError('invalid_duration');
  if (typeof duration === 'number' && exceedsDuration(access, duration)) throw new QueueError('episode_too_long', 413);
  return {filename: body.filename, size: body.size, email: body.email.trim(), mic, duration: typeof duration === 'number' ? duration : null};
}
