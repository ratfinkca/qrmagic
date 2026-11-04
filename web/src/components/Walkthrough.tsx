import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { tourSteps } from "../lib/helpContent";

type Highlight = {left:number;top:number;width:number;height:number};
export function Walkthrough({ step, hasQr, onStep, onEnd }: {
  step: number; hasQr: boolean; onStep: (step:number) => void; onEnd: (complete:boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const current = tourSteps[step];
  useEffect(() => { const modal = dialog.current; modal?.showModal(); return () => modal?.close(); }, []);
  useEffect(() => { heading.current?.focus({preventScroll:true}); }, [step]);
  useLayoutEffect(() => {
    let observedTarget: HTMLElement | null = null;
    const resize = new ResizeObserver(measure);
    function measure() {
      const target = document.querySelector<HTMLElement>(`[data-guide="${current.target === "qr" && !hasQr ? "layers" : current.target}"]`);
      if (!target) { setHighlight(null); return; }
      if (target !== observedTarget) {
        resize.disconnect(); resize.observe(target); observedTarget = target;
        target.scrollIntoView({block:"nearest",inline:"nearest"});
      }
      const rect = target.getBoundingClientRect();
      // Panels can be taller than the viewport. Highlight only their visible area.
      const left=Math.max(6,rect.left-4),top=Math.max(6,rect.top-4);
      const next = {left,top,width:Math.max(0,Math.min(window.innerWidth-6,rect.right+4)-left),height:Math.max(0,Math.min(window.innerHeight-6,rect.bottom+4)-top)};
      setHighlight(previous => previous && Object.keys(next).every(key => previous[key as keyof Highlight] === next[key as keyof Highlight]) ? previous : next);
    }
    // The editor reveals panels/selects a QR after this component mounts. Watch
    // for that target to appear rather than retaining an empty first measurement.
    const mutation = new MutationObserver(measure);
    mutation.observe(document.body,{childList:true,subtree:true});
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize",measure);window.addEventListener("scroll",measure,true);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); window.removeEventListener("resize",measure);window.removeEventListener("scroll",measure,true); };
  }, [current.target, hasQr]);
  return <>
    <div className={`tour-shade ${highlight ? "has-highlight" : ""}`} aria-hidden="true" style={highlight ?? undefined}/>
    <dialog ref={dialog} className={`walkthrough-dialog ${highlight && highlight.left > window.innerWidth / 2 ? "tour-card-left" : ""}`} aria-label="Quick tour" onCancel={event => { event.preventDefault();onEnd(false); }}>
      <div className="tour-top"><span>Step {step+1} of {tourSteps.length}</span><button type="button" className="help-icon-button" aria-label="Close tour" onClick={() => onEnd(false)}><X size={20}/></button></div>
      <div className="tour-dots" aria-hidden="true">{tourSteps.map((item,index) => <span key={item.target} className={index===step ? "active" : ""}/>)}</div>
      <h2 ref={heading} tabIndex={-1} aria-describedby="tour-step-description">{current.title}</h2><p id="tour-step-description">{current.target === "qr" && !hasQr ? "This blank canvas has no QR yet. Use Add layer in Layers to add a fixed or numbered QR, then select it to enter its content in the Inspector." : current.body}</p><p className="tour-tip">{current.tip}</p>
      <footer className="tour-actions"><button type="button" className="tour-skip" onClick={() => onEnd(false)}>Skip tour</button>{step>0 ? <button type="button" onClick={() => onStep(step-1)}>Back</button> : null}<button type="button" className="primary-action" onClick={() => step===tourSteps.length-1 ? onEnd(true) : onStep(step+1)}>{step===tourSteps.length-1 ? "Finish tour" : "Next"}</button></footer>
    </dialog>
  </>;
}
