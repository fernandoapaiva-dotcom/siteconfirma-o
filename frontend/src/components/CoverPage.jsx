export default function CoverPage({ onContinue }) {
  return (
    <div className="cover-page">
      <img
        src="/assets/convite-capa.jpg"
        alt="Convite de batizado da Analu"
        className="cover-image"
      />
      <button className="cover-btn" onClick={onContinue}>
        Confirmar presença e ver detalhes
      </button>
    </div>
  );
}
