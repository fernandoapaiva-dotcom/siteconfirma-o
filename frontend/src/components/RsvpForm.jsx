import { useState } from "react";

const WatercolorDivider = () => (
  <svg className="watercolor-divider" viewBox="0 0 120 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10,10 Q60,5 110,10" stroke="var(--sage-deep)" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
    {/* Folhas esquerdas */}
    <path d="M35,9 C29,6 27,2 35,2 C43,2 41,6 35,9 Z" fill="var(--sage)" opacity="0.6" transform="rotate(-20 35 9)"/>
    <path d="M50,8 C44,5 42,1 50,1 C58,1 56,5 50,8 Z" fill="var(--sage)" opacity="0.5" transform="rotate(-10 50 8)"/>
    {/* Folhas direitas */}
    <path d="M70,8 C78,5 80,1 70,1 C62,1 64,5 70,8 Z" fill="var(--sage)" opacity="0.5" transform="rotate(10 70 8)"/>
    <path d="M85,9 C91,6 93,2 85,2 C77,2 79,6 85,9 Z" fill="var(--sage)" opacity="0.6" transform="rotate(20 85 9)"/>
    {/* Bagas de ouro aquarela */}
    <circle cx="42" cy="11" r="1.8" fill="var(--gold)" opacity="0.75"/>
    <circle cx="58" cy="7" r="1.8" fill="var(--gold)" opacity="0.75"/>
    <circle cx="78" cy="11" r="1.8" fill="var(--gold)" opacity="0.75"/>
  </svg>
);

export default function RsvpForm({ onSuccess }) {
  const [nome, setNome] = useState("");
  const [nomesAcompanhantes, setNomesAcompanhantes] = useState([]);
  const [presenca, setPresenca] = useState(null); // 'Cerimônia e Almoço' | 'Apenas à Cerimônia' | 'Apenas ao Almoço' | 'Não poderei comparecer' | null
  const [mensagem, setMensagem] = useState("");
  const [status, setStatus] = useState(null); // { ok, text }
  const [enviando, setEnviando] = useState(false);

  const podeEnviar = nome.trim().length > 0 && presenca !== null && !enviando;

  const handleAcompanhantesCountChange = (count) => {
    const newCount = Math.max(0, count);
    setNomesAcompanhantes((prev) => {
      const copy = [...prev];
      if (newCount > copy.length) {
        while (copy.length < newCount) {
          copy.push("");
        }
      } else {
        copy.splice(newCount);
      }
      return copy;
    });
  };

  const addCompanheiro = () => {
    setNomesAcompanhantes((prev) => [...prev, ""]);
  };

  const removeCompanheiro = (idx) => {
    setNomesAcompanhantes((prev) => prev.filter((_, i) => i !== idx));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!podeEnviar) return;

    setEnviando(true);
    setStatus(null);

    const acompanhantesFormatado = nomesAcompanhantes.length > 0
      ? `${nomesAcompanhantes.length} (${nomesAcompanhantes.filter(n => n.trim() !== "").join(", ")})`
      : "0";

    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, acompanhantes: acompanhantesFormatado, presenca, mensagem }),
      });

      if (!res.ok) throw new Error("Falha ao confirmar");

      setStatus({ ok: true, text: "Presença confirmada! Obrigado por fazer parte desse dia." });
      setNome("");
      setNomesAcompanhantes([]);
      setPresenca(null);
      setMensagem("");
      
      if (onSuccess) onSuccess();
    } catch (err) {
      setStatus({ ok: false, text: "Não deu pra confirmar agora. Tenta de novo em instantes." });
    } finally {
      setEnviando(false);
    }
  }

  if (status && status.ok) {
    return (
      <section className="section" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: "4rem", color: "var(--sage)", marginBottom: "16px" }}>✓</div>
        <h2 className="section-title" style={{ fontFamily: "var(--font-script)", fontSize: "2.8rem", color: "var(--sage-deep)", margin: "0 0 12px" }}>Muito Obrigado!</h2>
        <p className="status-msg status-ok" style={{ margin: "16px auto", fontSize: "1rem", maxWidth: "420px", color: "var(--sage-deep)", lineHeight: "1.4" }}>
          {status.text}
        </p>
        <p style={{ fontSize: "0.85rem", color: "var(--gold-deep)", fontStyle: "italic", marginTop: "24px" }}>
          Retornando ao convite principal...
        </p>
      </section>
    );
  }

  return (
    <section className="section">
      <h2 className="section-title">Confirme sua presença</h2>
      <WatercolorDivider />
      <p className="section-subtitle">
        Confirme até 30/08/2026 para garantirmos seu lugar no almoço no restaurante Versá.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="nome">Seu nome</label>
        <input
          id="nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome completo"
        />

        <label htmlFor="acompanhantes">Quantos acompanhantes (além de você)?</label>
        <input
          id="acompanhantes"
          type="number"
          min="0"
          value={nomesAcompanhantes.length}
          onChange={(e) => handleAcompanhantesCountChange(Number(e.target.value))}
        />

        {nomesAcompanhantes.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <label style={{ fontSize: "0.85rem", marginBottom: "6px" }}>Nomes dos acompanhantes:</label>
            {nomesAcompanhantes.map((nomeAcomp, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <input
                  type="text"
                  placeholder={`Nome do acompanhante ${idx + 1}`}
                  value={nomeAcomp}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNomesAcompanhantes((prev) => {
                      const copy = [...prev];
                      copy[idx] = val;
                      return copy;
                    });
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => removeCompanheiro(idx)}
                  className="toggle-btn"
                  style={{ width: "38px", minWidth: "38px", height: "38px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px" }}
                >
                  −
                </button>
                {idx === nomesAcompanhantes.length - 1 && (
                  <button
                    type="button"
                    onClick={addCompanheiro}
                    className="toggle-btn active-yes"
                    style={{ width: "38px", minWidth: "38px", height: "38px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px" }}
                  >
                    +
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <label>Onde você vai nos prestigiar?</label>
        <div className="toggle-row" style={{ flexWrap: "wrap" }}>
          <button
            type="button"
            className={`toggle-btn ${presenca === "Cerimônia e Almoço" ? "active-yes" : ""}`}
            onClick={() => setPresenca("Cerimônia e Almoço")}
            style={{ minWidth: "120px", margin: "2px" }}
          >
            Cerimônia e Almoço
          </button>
          <button
            type="button"
            className={`toggle-btn ${presenca === "Apenas à Cerimônia" ? "active-yes" : ""}`}
            onClick={() => setPresenca("Apenas à Cerimônia")}
            style={{ minWidth: "120px", margin: "2px" }}
          >
            Apenas Cerimônia
          </button>
          <button
            type="button"
            className={`toggle-btn ${presenca === "Apenas ao Almoço" ? "active-yes" : ""}`}
            onClick={() => setPresenca("Apenas ao Almoço")}
            style={{ minWidth: "120px", margin: "2px" }}
          >
            Apenas Almoço
          </button>
          <button
            type="button"
            className={`toggle-btn ${presenca === "Não poderei comparecer" ? "active-no" : ""}`}
            onClick={() => setPresenca("Não poderei comparecer")}
            style={{ minWidth: "120px", margin: "2px" }}
          >
            Não poderei ir
          </button>
        </div>

        <label htmlFor="mensagem">Mensagem para a Analu (opcional)</label>
        <textarea
          id="mensagem"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Deixe um recado ou uma bênção..."
        />

        <button type="submit" className="btn-primary" disabled={!podeEnviar}>
          {enviando ? "Enviando..." : "Confirmar presença"}
        </button>

        {status && (
          <p className={`status-msg ${status.ok ? "status-ok" : "status-err"}`}>
            {status.text}
          </p>
        )}
      </form>
    </section>
  );
}
