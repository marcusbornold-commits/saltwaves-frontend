'use client';
import { useEffect, useState } from 'react';
export default function InvitePage() {
  const [message, setMessage] = useState('Öppnar Audiobook…');
  useEffect(() => {
    const token = window.location.hash.slice(1);
    // The link secret stays out of server URL logs and is removed from browser history.
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) { setMessage('Öppna hela testlänken som du fått från Saltwaves.'); return; }
    fetch('/api/audiobook/invite', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:AbortSignal.timeout(15000)})
      .then(async response => {const data=await response.json(); if(!response.ok) throw new Error(data.error); window.location.replace('/tools/audiobook');})
      .catch(error => setMessage(error.name === 'TimeoutError' ? 'Anslutningen tog för lång tid. Öppna testlänken igen.' : error.message || 'Kunde inte öppna testet. Öppna testlänken igen.'));
  }, []);
  return <main style={{maxWidth:600,margin:'15vh auto',padding:32}}><h1>Saltwaves Audiobook</h1><p role="status">{message}</p></main>;
}
