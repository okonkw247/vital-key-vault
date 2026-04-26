import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root")!;

// Health check: if React fails to mount within 8s, show a fallback banner
// so users never see an indefinite blank screen.
const mountTimer = window.setTimeout(() => {
  if (!rootEl.hasChildNodes()) {
    rootEl.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#080808;color:#e6e6e6;font-family:Inter,system-ui,sans-serif;padding:24px;text-align:center">
        <div style="max-width:420px">
          <div style="color:#00ff88;font-size:14px;margin-bottom:8px">Adams X API Vault</div>
          <div style="font-size:18px;font-weight:600;margin-bottom:8px">The app failed to load.</div>
          <div style="color:#8a8a8a;font-size:14px;margin-bottom:16px">Check your connection or try a hard refresh.</div>
          <button onclick="location.reload()" style="background:#00ff88;color:#0a0a0a;border:0;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer">Reload</button>
        </div>
      </div>`;
  }
}, 8000);

try {
  createRoot(rootEl).render(<App />);
  // Mounted — cancel the fallback.
  window.clearTimeout(mountTimer);
} catch (err) {
  console.error("Failed to mount React app:", err);
}

// Unregister any old service workers from previous PWA attempts so they
// don't serve stale assets and cause blank screens.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
}
