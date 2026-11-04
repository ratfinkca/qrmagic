import { Check, Download, LoaderCircle, TriangleAlert } from "lucide-react";

export function LocalSaveStatus({status,savedAt,forked,onRetry,onDownload}:{
  status:string;savedAt?:number;forked:boolean;onRetry:()=>void;onDownload:()=>void;
}) {
  const failed=status==="error",working=status==="saving"||status==="pending";
  return <div className={`local-save-status ${failed?"save-failed":""}`}>
    <span role="status" title={savedAt?`Last local save: ${new Date(savedAt).toLocaleString()}`:undefined}>
      {failed?<TriangleAlert size={14}/>:working?<LoaderCircle size={14}/>:<Check size={14}/>}
      {failed?"Local save failed":status==="saving"?"Saving on this device…":status==="pending"?"Changes waiting to save…":status==="saved"?"Saved on this device":"Download a project file for backup"}
    </span>
    {failed?<><button type="button" onClick={onRetry}>Retry local save</button><button type="button" onClick={onDownload}><Download size={13}/> Download backup</button></>:null}
    {forked?<small>Saved as a separate local copy because another tab changed the original.</small>:null}
  </div>;
}
