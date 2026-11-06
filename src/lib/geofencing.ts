/**
 * Utilidades para cálculo de geocercas y validación de sedes asignadas.
 */

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

/**
 * Calcula la distancia en metros entre dos coordenadas geográficas utilizando la fórmula de Haversine.
 */
export function calcularDistanciaMetros(coord1: Coordenadas, coord2: Coordenadas): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const lat1Rad = (coord1.latitud * Math.PI) / 180;
  const lat2Rad = (coord2.latitud * Math.PI) / 180;
  const deltaLat = ((coord2.latitud - coord1.latitud) * Math.PI) / 180;
  const deltaLon = ((coord2.longitud - coord1.longitud) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Valida si una posición se encuentra dentro del radio permitido de la sede.
 */
export function validarGeocercaSede(
  posicionUsuario: Coordenadas,
  sede: { latitud: number; longitud: number; radio_metros: number }
): { dentroDeRango: boolean; distanciaMetros: number; toleranciaMetros: number } {
  const distancia = calcularDistanciaMetros(posicionUsuario, {
    latitud: sede.latitud,
    longitud: sede.longitud,
  });

  return {
    dentroDeRango: distancia <= sede.radio_metros,
    distanciaMetros: distancia,
    toleranciaMetros: sede.radio_metros,
  };
}

