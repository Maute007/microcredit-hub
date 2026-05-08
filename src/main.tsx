import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Em desenvolvimento, o Service Worker interfere com o Vite/HMR e pode causar
// loops de navegação e "Failed to fetch" em rotas SPA.
if ("serviceWorker" in navigator) {
  if (!import.meta.env.PROD) {
    // Se o utilizador já teve SW registado (ex.: abriu build/preview antes),
    // ele continua activo e pode quebrar o Vite/HMR e rotas SPA.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => {
      // Ignorar falha: não deve quebrar a app.
    });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sem impacto funcional crítico se o registo falhar.
      });
    });
  }
}
