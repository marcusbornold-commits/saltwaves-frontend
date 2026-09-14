/** The output is always WAV, regardless of the uploaded format. */
export function defaultMasterStem(original:string,preview=false):string {
  return original.replace(/\.[^.]+$/, "")+(preview?"_provmaster":"");
}
export function masterFilename(stem:string):string|null {
  const name=stem.trim().replace(/\.wav$/i, "");
  if(!name || /^\.+$/.test(name) || name.length>236 || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(name)) return null;
  return name+".wav";
}
