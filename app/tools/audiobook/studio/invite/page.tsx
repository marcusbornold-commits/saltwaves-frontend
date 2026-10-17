'use client';
import { useEffect, useState } from 'react';
export default function StudioInvitePage() {
  const [message, setMessage] = useState('Öppnar Studio…');
  useEffect(() => {
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) { setMessage('Öppna hela inbjudningslänken som du fått från Saltwaves.'); return; }
    fetch('/api/studio-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), credentials: 'same-origin' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); window.location.replace('/tools/audiobook/studio'); })
      .catch(e => setMessage(e.message || 'Kunde inte öppna Studio. Öppna länken igen.'));
  }, []);
  return <main style={{ maxWidth: 600, margin: '15vh auto', padding: 32 }}><h1>Saltwaves Studio</h1><p role="status">{message}</p></main>;
}
