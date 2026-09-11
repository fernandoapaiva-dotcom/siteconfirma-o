import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminPage from "./components/AdminPage.jsx";
import "./theme.css";

// Registra o Service Worker para suporte a uploads em segundo plano nativo
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Service Worker registrado no escopo:", reg.scope);
      })
      .catch((err) => {
        console.warn("[SW] Falha ao registrar Service Worker:", err.message);
      });
  });
}

// Roteamento simples sem biblioteca: /admin mostra a área da família,
// qualquer outro caminho mostra o site normal dos convidados.
const isAdmin = window.location.pathname.startsWith("/admin");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdmin ? <AdminPage /> : <App />}
  </React.StrictMode>
);
