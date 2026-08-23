import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminPage from "./components/AdminPage.jsx";
import "./theme.css";

// Roteamento simples sem biblioteca: /admin mostra a área da família,
// qualquer outro caminho mostra o site normal dos convidados.
const isAdmin = window.location.pathname.startsWith("/admin");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdmin ? <AdminPage /> : <App />}
  </React.StrictMode>
);
