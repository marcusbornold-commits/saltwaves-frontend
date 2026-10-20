// Minimal strömmande ZIP (lagrad, ingen komprimering: WAV packas ändå dåligt). Data descriptors, UTF-8-namn.
// ZIP64: poster vars storlek är okänd eller ≥ 4 GB skrivs med ZIP64-extrafält och 64-bitars data descriptor;
// offset/storlek ≥ 4 GB i central directory och ZIP64-slutpost läggs till automatiskt, så hela zip-filen kan vara > 4 GB.
import "server-only";
const T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (c: number, b: Uint8Array) => { c = ~c >>> 0; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return ~c >>> 0; };
const MAX32 = 0xffffffff;
type Src = ReadableStream<Uint8Array> | Uint8Array | { body: ReadableStream<Uint8Array>; size?: number | null };
export type ZipEntry = { name: string; open: () => Promise<Src> };
const u64 = (v: DataView, at: number, n: number) => v.setBigUint64(at, BigInt(n), true);
export function zipStream(entries: ZipEntry[], opts: { forceZip64?: boolean } = {}): ReadableStream<Uint8Array> {
  const enc = new TextEncoder(), d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const central: Uint8Array[] = []; let offset = 0;
  return new ReadableStream<Uint8Array>({
    async start(ctl) {
      const push = (b: Uint8Array) => { ctl.enqueue(b); offset += b.length; };
      try {
        for (const e of entries) {
          const name = enc.encode(e.name), start = offset;
          const src0 = await e.open();
          const bytes = src0 instanceof Uint8Array ? src0 : null;
          const obj = !bytes && !(src0 instanceof ReadableStream) ? src0 as { body: ReadableStream<Uint8Array>; size?: number | null } : null;
          const stream = bytes ? null : obj ? obj.body : src0 as ReadableStream<Uint8Array>;
          const hint = bytes ? bytes.length : obj ? (obj.size ?? null) : null;
          const z64 = !!opts.forceZip64 || hint === null || hint >= MAX32;
          const ver = z64 ? 45 : 20;
          const h = new DataView(new ArrayBuffer(30 + (z64 ? 20 : 0)));
          h.setUint32(0, 0x04034b50, true); h.setUint16(4, ver, true); h.setUint16(6, 0x0808, true); h.setUint16(8, 0, true);
          h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint16(26, name.length, true);
          if (z64) { h.setUint32(18, MAX32, true); h.setUint32(22, MAX32, true); h.setUint16(28, 20, true); }
          push(new Uint8Array(h.buffer, 0, 30)); push(name);
          if (z64) { const x = new DataView(h.buffer, 30, 20); x.setUint16(0, 0x0001, true); x.setUint16(2, 16, true); push(new Uint8Array(h.buffer, 30, 20)); } // storlekar 0, riktiga i descriptor
          let c = 0, size = 0;
          if (bytes) { c = crc(c, bytes); size = bytes.length; push(bytes); }
          else { const r = stream!.getReader(); for (;;) { const { done, value } = await r.read(); if (done) break; c = crc(c, value); size += value.length; push(value); } }
          if (!z64 && size >= MAX32) throw new Error("zip entry size hint wrong");
          const dd = new DataView(new ArrayBuffer(z64 ? 24 : 16)); dd.setUint32(0, 0x08074b50, true); dd.setUint32(4, c, true);
          if (z64) { u64(dd, 8, size); u64(dd, 16, size); } else { dd.setUint32(8, size, true); dd.setUint32(12, size, true); }
          push(new Uint8Array(dd.buffer));
          const bigSize = z64 || size >= MAX32, bigOff = start >= MAX32;
          const xl = (bigSize ? 16 : 0) + (bigOff ? 8 : 0), extra = xl ? 4 + xl : 0;
          const ce = new DataView(new ArrayBuffer(46 + extra));
          ce.setUint32(0, 0x02014b50, true); ce.setUint16(4, ver, true); ce.setUint16(6, ver, true); ce.setUint16(8, 0x0808, true); ce.setUint16(12, time, true); ce.setUint16(14, date, true);
          ce.setUint32(16, c, true); ce.setUint32(20, bigSize ? MAX32 : size, true); ce.setUint32(24, bigSize ? MAX32 : size, true); ce.setUint16(28, name.length, true); ce.setUint16(30, extra, true);
          ce.setUint32(42, bigOff ? MAX32 : start, true);
          const ceBytes = new Uint8Array(ce.buffer);
          let ex: Uint8Array | null = null;
          if (extra) { const x = new DataView(new ArrayBuffer(extra)); x.setUint16(0, 0x0001, true); x.setUint16(2, xl, true); let at = 4; if (bigSize) { u64(x, at, size); u64(x, at + 8, size); at += 16; } if (bigOff) u64(x, at, start); ex = new Uint8Array(x.buffer); }
          central.push(ceBytes.subarray(0, 46), name); if (ex) central.push(ex);
        }
        const cdStart = offset; for (const b of central) push(b);
        const cdSize = offset - cdStart, n = entries.length;
        const need64 = !!opts.forceZip64 || cdStart >= MAX32 || cdSize >= MAX32 || n >= 0xffff;
        if (need64) {
          const z = new DataView(new ArrayBuffer(56)); const zStart = offset;
          z.setUint32(0, 0x06064b50, true); u64(z, 4, 44); z.setUint16(12, 45, true); z.setUint16(14, 45, true);
          u64(z, 24, n); u64(z, 32, n); u64(z, 40, cdSize); u64(z, 48, cdStart); push(new Uint8Array(z.buffer));
          const l = new DataView(new ArrayBuffer(20)); l.setUint32(0, 0x07064b50, true); u64(l, 8, zStart); l.setUint32(16, 1, true); push(new Uint8Array(l.buffer));
        }
        const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, Math.min(n, 0xffff), true); end.setUint16(10, Math.min(n, 0xffff), true);
        end.setUint32(12, need64 ? MAX32 : cdSize, true); end.setUint32(16, need64 ? MAX32 : cdStart, true); ctl.enqueue(new Uint8Array(end.buffer)); ctl.close();
      } catch (err) { ctl.error(err); }
    },
  });
}
