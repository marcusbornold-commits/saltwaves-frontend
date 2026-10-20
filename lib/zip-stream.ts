// Minimal strömmande ZIP (lagrad, ingen komprimering: WAV packas ändå dåligt). Data descriptors, UTF-8-namn.
// Gräns: inget ZIP64, så hela zip-filen måste vara under 4 GB.
import "server-only";
const T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (c: number, b: Uint8Array) => { c = ~c >>> 0; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return ~c >>> 0; };
export type ZipEntry = { name: string; open: () => Promise<ReadableStream<Uint8Array> | Uint8Array> };
export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder(), d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const central: Uint8Array[] = []; let offset = 0;
  return new ReadableStream<Uint8Array>({
    async start(ctl) {
      const push = (b: Uint8Array) => { ctl.enqueue(b); offset += b.length; };
      try {
        for (const e of entries) {
          const name = enc.encode(e.name), start = offset;
          const h = new DataView(new ArrayBuffer(30));
          h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0808, true); h.setUint16(8, 0, true);
          h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint16(26, name.length, true);
          push(new Uint8Array(h.buffer)); push(name);
          let c = 0, size = 0; const src = await e.open();
          if (src instanceof Uint8Array) { c = crc(c, src); size = src.length; push(src); }
          else { const r = src.getReader(); for (;;) { const { done, value } = await r.read(); if (done) break; c = crc(c, value); size += value.length; push(value); } }
          if (offset > 0xffffffff) throw new Error("zip > 4 GB");
          const dd = new DataView(new ArrayBuffer(16)); dd.setUint32(0, 0x08074b50, true); dd.setUint32(4, c, true); dd.setUint32(8, size, true); dd.setUint32(12, size, true); push(new Uint8Array(dd.buffer));
          const ce = new DataView(new ArrayBuffer(46));
          ce.setUint32(0, 0x02014b50, true); ce.setUint16(4, 20, true); ce.setUint16(6, 20, true); ce.setUint16(8, 0x0808, true); ce.setUint16(12, time, true); ce.setUint16(14, date, true);
          ce.setUint32(16, c, true); ce.setUint32(20, size, true); ce.setUint32(24, size, true); ce.setUint16(28, name.length, true); ce.setUint32(42, start, true);
          central.push(new Uint8Array(ce.buffer), name);
        }
        const cdStart = offset; for (const b of central) push(b);
        const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
        end.setUint32(12, offset - cdStart, true); end.setUint32(16, cdStart, true); ctl.enqueue(new Uint8Array(end.buffer)); ctl.close();
      } catch (err) { ctl.error(err); }
    },
  });
}
