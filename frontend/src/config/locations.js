// Edite aqui os dados dos dois locais. Pegue a latitude/longitude
// abrindo o local no Google Maps, clicando com o botão direito no
// pino exato e copiando os números que aparecem no topo do menu.

export const LOCATIONS = {
  paroquia: {
    label: "Paróquia São João Paulo II",
    subtitle: "Park Sul — Cerimônia às 10h30",
    address: "Paróquia São João Paulo II, Park Sul",
    lat: null, // ex: -15.8697
    lng: null, // ex: -48.0511
  },
  restaurante: {
    label: "Restaurante Versá",
    subtitle: "Almoço após a cerimônia",
    address: "Restaurante Versá",
    lat: null,
    lng: null,
  },
};

// Monta os links de abrir no app. Usa coordenadas quando disponíveis
// (mais preciso) e cai para o endereço em texto quando não.
export function mapsLink({ address, lat, lng }) {
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function wazeLink({ address, lat, lng }) {
  if (lat && lng) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

export function embedUrl({ address }) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}
