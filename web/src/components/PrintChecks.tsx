import { CheckCircle2, TriangleAlert } from "lucide-react";
import { HelpTip } from "./HelpTip";
import type { PrintCheckState } from "../hooks/usePrintChecks";
import "./print-checks.css";

export function PrintChecks({state,locked=false,onSelectLayer}:{state:PrintCheckState;locked?:boolean;onSelectLayer?:(id:string)=>void}) {
  const issues=state.issues.filter(issue=>issue.category==="quality"||issue.severity==="error");
  const errors=issues.filter(issue=>issue.severity==="error").length;
  const suggestions=issues.length-errors;
  return <section className="print-checks" aria-label="Print checks">
    <div className="print-checks-heading"><strong>Print checks <HelpTip topic="printChecks"/></strong><span className={errors?"checks-error":issues.length?"checks-warning":"checks-neutral"} aria-hidden="true">{state.checking?"Checking…":issues.length?`${issues.length} to review`:state.unavailable?"Check sample":"Checked"}</span></div>
    {state.checking?<p role="status">Checking print details…</p>:state.unavailable?<p role="status">Some print checks couldn’t run. You can keep designing; check an exported sample before printing.</p>:issues.length?<details key={errors?"errors":"suggestions"} open={errors>0}>
      <summary>{errors?`${errors} ${errors===1?"issue":"issues"} to fix`:""}{errors&&suggestions?" · ":""}{suggestions?`${suggestions} ${suggestions===1?"suggestion":"suggestions"} to review`:""}</summary>
      <ul className="print-checks-list">{issues.map((issue,index)=><li key={`${issue.code}-${issue.layerId}-${index}`} data-print-code={issue.code}>
        <TriangleAlert size={14} aria-hidden="true"/><div><p>{issue.message}</p>{issue.layerId&&onSelectLayer?<button type="button" disabled={locked} aria-label={`Select ${issue.layerName??issue.message.split(":")[0]} for print check`} onClick={()=>onSelectLayer(issue.layerId!)}>Select layer</button>:null}</div>
      </li>)}</ul>
    </details>:<p className="checks-clear" role="status"><CheckCircle2 size={14}/> No issues found in these checks.</p>}
    <p className="print-checks-footnote">Guidance, not print or scan certification. QR density uses sampled records; cut checks sample QR/text box edges. Artwork may overlap codes. Scan an exported sample and check a physical print at actual size.{!onSelectLayer?" Go back to design to make changes.":""}</p>
  </section>;
}
