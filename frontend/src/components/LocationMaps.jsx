import { LOCATIONS, mapsLink, wazeLink, embedUrl } from "../config/locations.js";

function LocationCard({ location }) {
  return (
    <div className="location-card">
      <p className="map-label">{location.label}</p>
      <p className="map-sublabel">{location.subtitle}</p>

      <div className="map-wrap">
        <iframe
          title={`Mapa — ${location.label}`}
          src={embedUrl(location)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="map-actions">
        <a
          className="map-btn map-btn-maps"
          href={mapsLink(location)}
          target="_blank"
          rel="noreferrer"
        >
          Abrir no Google Maps
        </a>
        <a
          className="map-btn map-btn-waze"
          href={wazeLink(location)}
          target="_blank"
          rel="noreferrer"
        >
          Abrir no Waze
        </a>
      </div>
    </div>
  );
}

export default function LocationMaps() {
  return (
    <section className="section">
      <h2 className="section-title">Como chegar</h2>
      <p className="section-subtitle">Cerimônia e almoço — toque para abrir a rota no seu app.</p>

      <LocationCard location={LOCATIONS.paroquia} />
      <LocationCard location={LOCATIONS.restaurante} />
    </section>
  );
}
