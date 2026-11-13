import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
};
type OfflineStatus = "preparing" | "ready" | "unavailable";

export function useOfflineApp() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [status, setStatus] = useState<OfflineStatus>("preparing");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt>();

  useEffect(() => {
    const connectionChanged = () => setOnline(navigator.onLine);
    window.addEventListener("online", connectionChanged);
    window.addEventListener("offline", connectionChanged);
    return () => {
      window.removeEventListener("online", connectionChanged);
      window.removeEventListener("offline", connectionChanged);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const serviceWorker = navigator.serviceWorker;
    const workerUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, location.origin);
    if (!serviceWorker) {
      setStatus("unavailable");
      return;
    }
    let active = true;
    const controllerChanged = () => {
      if (serviceWorker.controller?.scriptURL === workerUrl.href) setStatus("ready");
    };
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const installed = () => setInstallPrompt(undefined);
    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("appinstalled", installed);
    serviceWorker.addEventListener("controllerchange", controllerChanged);
    controllerChanged();

    let installing: ServiceWorker | null = null;
    let registration: ServiceWorkerRegistration | undefined;
    const installStateChanged = () => {
      if (installing?.state === "redundant" && serviceWorker.controller?.scriptURL !== workerUrl.href) {
        setStatus("unavailable");
      }
    };
    const watchInstall = () => {
      installing?.removeEventListener("statechange", installStateChanged);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", installStateChanged);
    };
    void serviceWorker.register(workerUrl, { updateViaCache: "none" }).then(next => {
      if (!active) return;
      registration = next;
      next.addEventListener("updatefound", watchInstall);
      watchInstall();
      controllerChanged();
    }).catch(() => {
      if (active && serviceWorker.controller?.scriptURL !== workerUrl.href) setStatus("unavailable");
    });

    return () => {
      active = false;
      installing?.removeEventListener("statechange", installStateChanged);
      registration?.removeEventListener("updatefound", watchInstall);
      serviceWorker.removeEventListener("controllerchange", controllerChanged);
      window.removeEventListener("beforeinstallprompt", captureInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    setInstallPrompt(undefined);
    try {
      await installPrompt.prompt();
    } catch {
      // The browser menu is still available if the prompt is withdrawn.
    }
  }

  return { online, status, install: installPrompt && status === "ready" && online ? install : undefined };
}
