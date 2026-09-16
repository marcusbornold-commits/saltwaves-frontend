# Audiobook test link

AUDIOBOOK_INVITE_SECRET: random 32+ byte bearer secret. Never commit or log it.
AUDIOBOOK_INVITE_EXPIRES: absolute ISO timestamp. Both are production-only.
Link format: https://app.saltwaves.studio/tools/audiobook/invite#SECRET
The fragment is exchanged by same-origin POST for an HttpOnly, Secure, SameSite=Lax signed cookie. The fragment is removed from browser history. No email is sent.
Each browser receives a distinct guest owner; reopening preserves that owner. Cookies cleared or another browser means previous jobs cannot be recovered through this link. Existing queue/file limits and retention apply; guest access does not grant PodMaster access.
Expiration is checked on every server access. To revoke, remove/rotate the secret and redeploy; this also invalidates guest cookies. Already issued audio URLs remain valid until their existing expiry. In-flight jobs are not cancelled.
Anyone holding the link can use the test. Keep it private. Authenticated access remains available after expiry.
Verification: node scripts/test-audiobook-invite.cjs and npm run build.
