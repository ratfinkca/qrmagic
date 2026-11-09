import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, X } from "lucide-react";
import type { QrMagicProject } from "../types";
import { MAX_CSV_BYTES, parseCsvBatch, reviewCsvBatch, withCsvBatch } from "../lib/csvBatch";
import { productionCount } from "../lib/production";
import "./csv-batch.css";

const PAGE_SIZE = 10;
const issueLabels = {
  "missing-qr": "Missing QR",
  "missing-text": "Missing text",
  "duplicate-qr": "Repeated QR",
};

type Props = {
  project: QrMagicProject;
  review: ReturnType<typeof reviewCsvBatch>;
  currentIndex: number;
  onClose: () => void;
  onReplace: (next: QrMagicProject) => void;
  onMap: (id: string, column: string | undefined) => void;
  onAllowRepeats: (allowed: boolean) => void;
  onPreview: (index: number) => void;
};

export function CsvBatchDialog({ project, review, currentIndex, onClose, onReplace, onMap, onAllowRepeats, onPreview }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(Math.floor(currentIndex / PAGE_SIZE));
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const csv = project.data.csv;
  const layers = project.layers.filter(layer => layer.type === "qr" || layer.type === "text");
  const flagged = useMemo(() => Array.from(review.rows.keys()).sort((a, b) => a - b), [review]);
  const visibleCount = onlyFlagged ? flagged.length : csv?.rows.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(visibleCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const indices = Array.from({ length: Math.min(PAGE_SIZE, visibleCount - start) }, (_, offset) =>
    onlyFlagged ? flagged[start + offset] : start + offset);

  useEffect(() => {
    const modal = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    modal?.showModal();
    return () => { modal?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);

  async function importFile(file: File) {
    setBusy(true);
    setError("");
    try {
      if (file.size > MAX_CSV_BYTES) throw new Error("Choose a CSV file of 5 MB or less.");
      const batch = parseCsvBatch(file.name, await file.text());
      if (!dialog.current?.open) return;
      if (batch.rows.length * project.production.copiesPerRecord > 100_000) {
        throw new Error("This CSV and the current copies setting exceed 100,000 finished items. Reduce copies in Job and try again.");
      }
      onReplace(withCsvBatch(project, batch));
      setOnlyFlagged(false);
      setPage(0);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The CSV file could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    try {
      onReplace(withCsvBatch(project));
      setError("");
      setOnlyFlagged(false);
      setPage(0);
    } catch {
      setError("The existing content sources and copies setting exceed the job limit. Reduce copies in Job and try again.");
    }
  }

  return <dialog ref={dialog} className="csv-dialog" aria-labelledby="csv-title" onCancel={event => {
    event.preventDefault();
    onClose();
  }}>
    <header className="help-header">
      <div><span className="help-eyebrow">JOB DATA</span><h1 id="csv-title">CSV batch</h1>
        <p>Use one spreadsheet row per design. Choose which columns fill your QR codes and text.</p></div>
      <button type="button" className="help-icon-button" aria-label="Close CSV batch" onClick={onClose}><X size={22}/></button>
    </header>
    <div className="csv-body">
      <div className="csv-file">
        <div className="csv-file-description">
          <FileSpreadsheet size={22} aria-hidden="true"/>
          <div>{csv ? <><strong>{csv.name}</strong>
            <p>{csv.rows.length.toLocaleString()} {csv.rows.length === 1 ? "row" : "rows"} · {productionCount(project).total.toLocaleString()} finished items</p>
          </> : <><strong>Start with a CSV file</strong>
            <p>Put column names on the first row, such as Link and Name. Save the file as CSV UTF-8.</p></>}</div>
        </div>
        <div className="csv-actions">
          <input ref={fileInput} type="file" className="visually-hidden" aria-label="CSV file" accept=".csv,text/csv" tabIndex={-1}
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void importFile(file);
            }}/>
          <button type="button" className={csv ? "secondary-action" : "primary-action"} disabled={busy}
            onClick={() => fileInput.current?.click()}>{busy ? "Reading file…" : csv ? "Replace CSV" : "Import CSV"}</button>
          {csv && <button type="button" className="secondary-action" disabled={busy} onClick={remove}>Remove CSV</button>}
        </div>
      </div>
      {error && <p className="csv-error" role="alert">{error}</p>}
      {csv && <>
        <section className="csv-section" aria-labelledby="csv-map-title">
          <h2 id="csv-map-title">Map columns</h2>
          <p>Choose a column for each layer you want the CSV to fill. Other layers keep their current content.</p>
          {layers.length ? <div className="csv-mappings">
            {layers.map(layer => <label key={layer.id}>
              <span>{layer.name} <small>{layer.type === "qr" ? "QR" : "Text"}{!layer.visible ? " · Hidden" : ""}</small></span>
              <select aria-label={`${layer.name} CSV column`} value={layer.csvColumn ?? ""} disabled={busy}
                onChange={event => onMap(layer.id, event.target.value || undefined)}>
                <option value="">Use layer content</option>
                {csv.columns.map(column => <option key={column} value={column}>{column}</option>)}
              </select>
            </label>)}
          </div> : <p>Add a QR or text layer in the editor to map a column.</p>}
        </section>
        <section className="csv-section" aria-labelledby="csv-preview-title">
          <h2 id="csv-preview-title">Preview rows</h2>
          <p>Open a row on the canvas to see how it will print. Row numbers start below the column headers.</p>
          <div className="csv-review" role="status">
            {review.missingQrRows > 0 && <p className="csv-error">{review.missingQrRows} {review.missingQrRows === 1 ? "row needs" : "rows need"} QR content before batch export.</p>}
            {review.missingTextRows > 0 && <p>{review.missingTextRows} {review.missingTextRows === 1 ? "row has" : "rows have"} missing text. These values will print blank.</p>}
            {review.duplicateQrRows > 0 && <p>{review.duplicateQrRows} rows share a QR value. Check that the repeats are intentional.</p>}
            {review.rows.size === 0 && <p>{layers.some(layer => layer.csvColumn && layer.visible && layer.opacity > 0)
              ? "No issues found in the mapped values." : "Map a column to a visible layer to check its values."}</p>}
          </div>
          <div className="csv-options">
            <label><input type="checkbox" checked={onlyFlagged} onChange={event => { setOnlyFlagged(event.target.checked); setPage(0); }}/> Only flagged rows</label>
            {layers.some(layer => layer.type === "qr" && layer.csvColumn) && <label><input type="checkbox" checked={Boolean(csv.allowRepeatedQr)}
              disabled={busy} onChange={event => onAllowRepeats(event.target.checked)}/>
              Repeated QR values are intentional</label>}
          </div>
          <div className="csv-table-wrap" tabIndex={0} role="region" aria-label="CSV data preview">
            <table>
              <thead><tr><th scope="col">Row</th>{csv.columns.map(column => <th scope="col" key={column}>{column}</th>)}<th scope="col">Review</th></tr></thead>
              <tbody>{indices.map(index => <tr key={index} className={index === currentIndex ? "csv-current-row" : undefined}>
                <th scope="row"><button type="button" className="csv-row-link" disabled={busy} onClick={() => onPreview(index)}
                  aria-label={`Preview row ${index + 1} on canvas`} aria-current={index === currentIndex ? "true" : undefined}>{index + 1}</button></th>
                {csv.rows[index].map((value, column) => <td key={column}>{value.trim() ? value : <span className="csv-blank">Empty</span>}</td>)}
                <td>{review.rows.get(index)?.map((issue, issueIndex) =>
                  <span className={`csv-issue ${issue.kind}`} key={issueIndex}>{issueLabels[issue.kind]} · {issue.layerName}</span>) ?? "—"}</td>
              </tr>)}</tbody>
            </table>
            {!visibleCount && <p className="csv-empty">No flagged rows.</p>}
          </div>
          {pageCount > 1 && <div className="csv-pagination">
            <button type="button" className="secondary-action" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span aria-live="polite">Page {currentPage + 1} of {pageCount.toLocaleString()}</span>
            <button type="button" className="secondary-action" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>}
        </section>
      </>}
    </div>
    <footer className="help-footer"><p>Imported data is saved inside this project.</p>
      <button type="button" className="primary-action" onClick={onClose}>Back to editor</button></footer>
  </dialog>;
}
