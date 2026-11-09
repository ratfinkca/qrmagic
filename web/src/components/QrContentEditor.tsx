import type { DataGroup, ProjectLayer, QrLayer, QrMagicProject, RenderRecord } from "../types";
import { renderLayerValue } from "../lib/serial";
import { HelpTip } from "./HelpTip";

export function QrContentEditor({ layer, project, record, onOpenCsv, onUpdateLayer, onChangeMode, onChangeFixed, onMakeIndependent }: {
  layer: QrLayer;
  project: QrMagicProject;
  record: RenderRecord;
  onOpenCsv: () => void;
  onUpdateLayer: (id: string, patch: Partial<ProjectLayer>) => void;
  onChangeMode: (layerId: string, mode: DataGroup["mode"]) => void;
  onChangeFixed: (id: string, patch: { value?: string }) => void;
  onMakeIndependent: (layerId: string) => void;
}) {
  const group = project.data.groups.find(source => source.id === layer.dataGroupId);
  const custom = layer.payloadTemplate !== "{{serial}}";
  const users = project.layers.filter(item => (item.type === "qr" || item.type === "text") && item.dataGroupId === group?.id);
  const value = renderLayerValue(layer, record);
  const url = /^https?:\/\//i.test(value) ? value : undefined;
  const preview = <div className="qr-content-preview">
    <small>{project.data.csv ? `Row ${record.index + 1}${layer.csvColumn ? ` · ${layer.csvColumn}` : ""}` : "First item contains"}</small>
    <output>{value || "Empty content"}</output>
    {url ? <a href={url} target="_blank" rel="noopener noreferrer">Test destination</a> : null}
  </div>;

  if (layer.csvColumn) return <section className="qr-content-editor" aria-label="QR content" data-guide="qr">
    <h3>QR content from CSV</h3>
    {preview}
    <button type="button" className="secondary-action" onClick={onOpenCsv}>Edit CSV mapping</button>
  </section>;

  return <section className="qr-content-editor" aria-label="QR content" data-guide="qr">
    <div className="help-context-row"><h3>What should this QR contain?</h3><HelpTip topic="qr"/></div>
    <label>Content type
      <select aria-label="Content type" value={custom ? "custom" : group?.mode ?? "fixed"}
        onChange={event => onChangeMode(layer.id, event.target.value as DataGroup["mode"])}>
        <option value="fixed">Same on every item</option>
        <option value="serial">A different serial on each item</option>
        {custom ? <option value="custom" disabled>Custom template</option> : null}
      </select>
    </label>
    {!custom && group?.mode === "fixed" ? <>
      <label>Website or text<input value={group.fixed.value}
        onChange={event => onChangeFixed(group.id, { value: event.target.value })} /></label>
      <p className="chooser-hint">Use https:// at the beginning of a website address.</p>
    </> : null}
    {!custom && group?.mode === "serial" ? <p className="chooser-hint">Set the count and numbering in Job. Copies of each item keep the same serial.</p> : null}
    {preview}
    {users.length > 1 && !custom ? <div className="source-sharing">
      <p className="chooser-hint">Shared with {users.length - 1} other {users.length === 2 ? "layer" : "layers"}. Editing this value updates them too.</p>
      <button className="secondary-action" onClick={() => onMakeIndependent(layer.id)}>Make independent</button>
    </div> : null}
    <details className="editor-disclosure" open={custom || undefined}>
      <summary>Advanced QR content</summary>
      <div className="help-field-note">Keep shared content in sync <HelpTip topic="sources"/></div>
      <label>Shared content source<select aria-label="Shared content source" value={layer.dataGroupId}
        onChange={event => onUpdateLayer(layer.id, { dataGroupId: event.target.value })}>
        {project.data.groups.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
      </select></label>
      <label>Content template<input value={layer.payloadTemplate}
        onChange={event => onUpdateLayer(layer.id, { payloadTemplate: event.target.value })} /></label>
      <p className="chooser-hint">{"{{serial}} uses the selected source. {{index}} is the item’s variation number. Literal text is also supported."}</p>
    </details>
  </section>;
}
