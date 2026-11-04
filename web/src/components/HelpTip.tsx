import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { helpTips, type HelpTipTopic } from "../lib/helpContent";

export function HelpTip({ topic }: { topic: HelpTipTopic }) {
  const tip = helpTips[topic], id = useId();
  const button = useRef<HTMLButtonElement>(null), popup = useRef<HTMLSpanElement>(null);
  const pinned = useRef(false), hovered = useRef(false);
  const [open, setOpen] = useState(false);
  function close() { pinned.current = false; setOpen(false); }
  useEffect(() => {
    const element = popup.current;
    if (!element) return;
    if (!open) { if (element.matches(":popover-open")) element.hidePopover(); return; }
    function position() {
      if (!element || !button.current) return;
      const anchor = button.current.getBoundingClientRect();
      element.style.width = `${Math.min(290, window.innerWidth - 32)}px`;
      const height = element.getBoundingClientRect().height;
      element.style.left = `${Math.max(16, Math.min(anchor.left, window.innerWidth - element.offsetWidth - 16))}px`;
      element.style.top = `${Math.max(16, anchor.bottom + height + 12 < window.innerHeight ? anchor.bottom + 8 : anchor.top - height - 8)}px`;
    }
    if (!element.matches(":popover-open")) element.showPopover();
    position();
    function dismiss(event:PointerEvent) {
      if (!button.current?.contains(event.target as Node)) close();
    }
    function escape(event:KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation(); close();
    }
    window.addEventListener("resize", position); window.addEventListener("scroll", position, true);
    window.addEventListener("pointerdown",dismiss,true); window.addEventListener("keydown",escape,true);
    return () => { window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true);window.removeEventListener("pointerdown",dismiss,true);window.removeEventListener("keydown",escape,true); };
  }, [open]);
  return <span className="help-tip"><button ref={button} type="button" className="help-tip-button" aria-label={`About ${tip.label}`} aria-expanded={open} aria-describedby={open ? id : undefined}
    onFocus={() => setOpen(true)} onBlur={() => { if (!pinned.current && !hovered.current) setOpen(false); }}
    onMouseEnter={() => { hovered.current = true; setOpen(true); }} onMouseLeave={() => { hovered.current = false; if (!pinned.current && document.activeElement !== button.current) setOpen(false); }}
    onClick={() => { pinned.current = !pinned.current; setOpen(pinned.current); }}
    onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); } }}><CircleHelp size={15}/></button>
    <span ref={popup} id={id} role="tooltip" popover="manual" className="help-tip-popup">{tip.text}</span>
  </span>;
}
