export type ExportProgress = { stage:"artwork"|"panels"|"package"; completed:number; total:number };
export type ExportControl = { signal?:AbortSignal; onProgress?:(progress:ExportProgress)=>void };

export async function exportYield(signal?:AbortSignal) {
  signal?.throwIfAborted();
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  signal?.throwIfAborted();
}
