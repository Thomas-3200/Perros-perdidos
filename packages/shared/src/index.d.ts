export * from './types/user.js';
export * from './types/dog.js';
export * from './types/case.js';
export * from './types/match.js';
export * from './types/notification.js';
export * from './types/reunion.js';
export * from './types/api.js';
/**
 * Calcula la distancia en km entre dos puntos geográficos (Haversine).
 */
export declare function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
/**
 * Normaliza una distancia en km a un score 0-1.
 * 0 km → 1.0 | maxKm → 0.0
 */
export declare function geoScoreFromKm(distanceKm: number, maxKm?: number): number;
/**
 * Normaliza una diferencia temporal a un score 0-1.
 * 0 días → 1.0 | maxDays → 0.0
 */
export declare function timeScoreFromDays(daysDiff: number, maxDays?: number): number;
/**
 * Calcula score de atributos entre dos perros (0-1).
 *
 * Regla especial: si el color es conocido y NO coincide, el score se capa en 0.25.
 * El color es el atributo más discriminativo visualmente: un perro negro y uno blanco
 * no pueden ser el mismo. Sin esta regla, un match de tamaño solo (ej: ambos "chico")
 * elevaba el score a MEDIUM aunque color y raza fueran opuestos → falso positivo.
 */
export declare function attributeScore(params: {
    breedMatch: boolean | null;
    sizeMatch: boolean | null;
    colorMatch: boolean | null;
}): number;
export { MATCH_WEIGHTS, CONFIDENCE_THRESHOLDS, MAX_DAILY_NOTIFICATIONS } from './types/match.js';
//# sourceMappingURL=index.d.ts.map