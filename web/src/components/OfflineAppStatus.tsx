import { Download, WifiOff } from "lucide-react";
import type { useOfflineApp } from "../hooks/useOfflineApp";
import "./offline-app.css";

export function OfflineAppStatus({ online, status, install }: ReturnType<typeof useOfflineApp>) {
  if (!import.meta.env.PROD && online) return null;
  const label = !online ? "Offline" : status === "ready" ? "Ready to use offline"
    : status === "unavailable" ? "Offline setup unavailable" : "Preparing offline access…";

  return <div className="offline-app-status">
    <span role="status">{!online && <WifiOff size={13} aria-hidden="true"/>}{label}</span>
    {install && <button type="button" onClick={() => void install()}><Download size={13} aria-hidden="true"/> Install QR Mystic</button>}
  </div>;
}
