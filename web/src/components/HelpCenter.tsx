import { useEffect, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { readTourCompleted, searchHelpArticles } from "../lib/helpContent";
import "./help.css";

export function HelpCenter({ onClose, onStartTour, fromLayout = false }: {
  onClose: () => void; onStartTour: () => void; fromLayout?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("getting-started");
  const results = searchHelpArticles(query);
  const article = results.find(item => item.id === selected) ?? results[0];
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    search.current?.focus();
    return () => { modal?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={dialog} className="help-dialog" aria-labelledby="help-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="help-header"><div><span className="help-eyebrow">A LITTLE GUIDANCE</span><h1 id="help-title">Help &amp; getting started</h1><p>From your first QR to a print-ready handoff.</p></div>
      <button type="button" className="help-icon-button" aria-label="Close help" onClick={onClose}><X size={22}/></button></header>
    <div className="help-search"><Search size={18}/><input ref={search} aria-label="Search help" placeholder="Try bleed, copies, saving or QR links…" value={query} onChange={event => setQuery(event.target.value)}/></div>
    <div className="help-body">
      <nav className="help-topics" aria-label="Help topics">{results.map(item => <button type="button" key={item.id} aria-current={article?.id === item.id ? "page" : undefined} onClick={() => setSelected(item.id)}>{item.title}</button>)}</nav>
      <article className="help-article" key={article?.id}>{article ? <><h2>{article.title}</h2><p className="help-lead">{article.summary}</p>{article.sections.map(section => <section key={section.title}><h3>{section.title}</h3>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}</> : <div role="status"><h2>No matching topics</h2><p>Try a shorter phrase, like “QR”, “bleed” or “save”.</p><button type="button" onClick={() => setQuery("")}>Show all topics</button></div>}</article>
    </div>
    <footer className="help-footer"><p>Want to find your way around?</p><button type="button" className="primary-action" onClick={onStartTour}>{fromLayout ? "Back to design & start tour" : readTourCompleted() ? "Restart quick tour" : "Take a quick tour"}<ArrowRight size={16}/></button></footer>
  </dialog>;
}
