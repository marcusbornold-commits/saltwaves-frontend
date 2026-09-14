/** Bounded sampling for a whole-book overview; no multi-hour browser decode. */
export type Overview = { peaks:number[]; duration:number; rms:number };
export async function wavOverview(file:Blob):Promise<Overview|null> {
  const head=new DataView(await file.slice(0,1024*1024).arrayBuffer());
  const tag=(offset:number)=>String.fromCharCode(...Array.from({length:4},(_,i)=>head.getUint8(offset+i)));
  if(head.byteLength<44 || !['RIFF','RF64'].includes(tag(0)) || tag(8)!=='WAVE') return null;
  let offset=12, channels=0, rate=0, bits=0, align=0, code=0, dataOffset=0, dataSize=0, rfSize=0;
  while(offset+8<=head.byteLength) {
    const kind=tag(offset), size=head.getUint32(offset+4,true), pos=offset+8;
    if(kind==='ds64' && pos+24<=head.byteLength) rfSize=Number(head.getBigUint64(pos+8,true));
    if(kind==='fmt ' && pos+16<=head.byteLength){code=head.getUint16(pos,true);channels=head.getUint16(pos+2,true);rate=head.getUint32(pos+4,true);align=head.getUint16(pos+12,true);bits=head.getUint16(pos+14,true);if(code===65534 && size>=40 && pos+40<=head.byteLength)code=head.getUint16(pos+24,true);}
    if(kind==='data'){dataOffset=pos;dataSize=size===0xffffffff?rfSize:size;break;}
    offset=pos+size+(size%2);
  }
  if(!dataOffset || !dataSize || ![1,2].includes(channels) || !rate || ![16,24,32].includes(bits) || ![1,3].includes(code) || align!==channels*bits/8 || (code===3 && bits!==32) || dataOffset+dataSize>file.size) return null;
  const frames=Math.floor(dataSize/align),duration=frames/rate;
  if(duration>54000) throw new Error('Filen får vara högst 15 timmar.');
  const bins=Math.min(2000,frames),peaks=new Array<number>(bins).fill(0);let energy=0,count=0;
  // Evenly distributed sample windows. This overview is not used for quality measurements.
  for(let base=0;base<bins;base+=32) {
    await Promise.all(Array.from({length:Math.min(32,bins-base)},async(_,j)=>{
      const bin=base+j,start=Math.floor(bin*frames/bins),end=Math.min(frames,start+256);
      const view=new DataView(await file.slice(dataOffset+start*align,dataOffset+end*align).arrayBuffer());
      let peak=0;
      for(let i=0;i<view.byteLength;i+=bits/8){let sample:number;
        if(code===3) sample=view.getFloat32(i,true);
        else if(bits===16)sample=view.getInt16(i,true)/32768;
        else if(bits===32)sample=view.getInt32(i,true)/2147483648;
        else {const raw=view.getUint8(i)|(view.getUint8(i+1)<<8)|(view.getUint8(i+2)<<16);sample=((raw<<8)>>8)/8388608;}
        if(Number.isFinite(sample)){peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;count++;}
      }
      peaks[bin]=peak;
    }));
  }
  return {duration,peaks,rms:Math.sqrt(energy/Math.max(1,count))};
}
