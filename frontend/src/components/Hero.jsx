import React from "react";

const GoldLaurelDa = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", margin: "8px 0" }}>
    <svg width="32" height="16" viewBox="0 0 24 12" fill="none" style={{ transform: "scaleX(-1)" }}>
      <path d="M2 10C6 8 12 5 22 2" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M6 9C5 7 5 5 8 4 C11 3 10 6 7 8" fill="var(--gold)" opacity="0.8"/>
      <path d="M12 7C11 5 11 3 14 2 C17 1 16 4 13 6" fill="var(--gold)" opacity="0.8"/>
    </svg>
    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: "var(--gold-deep)", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: "600" }}>da</span>
    <svg width="32" height="16" viewBox="0 0 24 12" fill="none">
      <path d="M2 10C6 8 12 5 22 2" stroke="var(--gold)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M6 9C5 7 5 5 8 4 C11 3 10 6 7 8" fill="var(--gold)" opacity="0.8"/>
      <path d="M12 7C11 5 11 3 14 2 C17 1 16 4 13 6" fill="var(--gold)" opacity="0.8"/>
    </svg>
  </div>
);

export default function Hero() {
  return (
    <header className="hero" style={{ borderBottom: "none", marginBottom: "8px", paddingBottom: "0" }}>
      {/* Cruz de Ouro no Topo */}
      <svg width="22" height="30" viewBox="0 0 24 36" fill="none" style={{ margin: "0 auto 14px", display: "block" }}>
        <path d="M12 2v32M6 12h12" stroke="var(--gold-deep)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>

      {/* Introdução do Convite */}
      <p style={{
        fontFamily: "var(--font-body)",
        fontSize: "0.68rem",
        letterSpacing: "0.14em",
        color: "var(--ink)",
        textTransform: "uppercase",
        opacity: 0.85,
        margin: "0 auto 4px",
        padding: "0 20px",
        lineHeight: "1.5",
        maxWidth: "320px"
      }}>
        Aqui começa uma caminhada de fé,<br />guiada pelas mãos de Deus
      </p>
      
      {/* Pequeno Coração de Ouro */}
      <span style={{ color: "var(--gold)", fontSize: "0.85rem", display: "block", margin: "2px 0 16px" }}>♥</span>

      <p className="hero-eyebrow" style={{ fontSize: "0.72rem", color: "var(--ink)", opacity: 0.7, marginBottom: "8px", letterSpacing: "0.15em" }}>
        Você é nosso convidado para o
      </p>

      <h1 className="hero-title" style={{ fontSize: "2.4rem", margin: "0", fontFamily: "var(--font-display)", color: "var(--gold-deep)" }}>
        BATIZADO
      </h1>

      <GoldLaurelDa />

      <p className="hero-name" style={{ fontSize: "5.4rem", color: "var(--sage-deep)", margin: "0 auto 20px", fontFamily: "var(--font-script)", fontWeight: "400" }}>
        Analu
      </p>

      {/* Fita / Faixa Verde do Convite */}
      <div style={{
        background: "rgba(138, 152, 120, 0.16)",
        borderLeft: "3.5px solid var(--sage)",
        borderRight: "3.5px solid var(--sage)",
        padding: "10px 16px",
        margin: "12px auto 24px",
        maxWidth: "460px",
        borderRadius: "4px",
        boxShadow: "inset 0 0 6px rgba(95, 110, 82, 0.03)"
      }}>
        <p style={{
          margin: 0,
          fontFamily: "var(--font-body)",
          fontSize: "0.65rem",
          letterSpacing: "0.12em",
          lineHeight: "1.5",
          color: "var(--sage-deep)",
          textTransform: "uppercase",
          fontWeight: "600"
        }}>
          Um pequeno coração, uma grande bênção e uma vida entregue aos cuidados de Deus
        </p>
      </div>
    </header>
  );
}
