'use client';
import { useEffect, useState } from 'react';
export default function InvitePage() {
  const [message, setMessage] = useState('Öppnar…');
  useEffect(() => {
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) { setMessage('Öppna hela inbjudningslänken som du fått från Saltwaves.'); return; }
    fetch('/api/opendoors-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'same-origin',
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.location.replace('/tools/opendoors');
    }).catch(e => setMessage(e.message || 'Kunde inte öppna sidan. Öppna länken igen.'));
  }, []);
  return (
    <main className="od">
      <div className="od-wrap">
        <p className="od-eye">Saltwaves · Open Doors</p>
        <h1>Välkommen</h1>
        <p role="status">{message}</p>
      </div>
    </main>
  );
}
