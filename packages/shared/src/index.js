// ─── @perros/shared — Tipos y utilidades compartidos ─────────────────────────
// Tipos principales
export * from './types/user.js';
export * from './types/dog.js';
export * from './types/case.js';
export * from './types/match.js';
export * from './types/notification.js';
export * from './types/reunion.js';
export * from './types/api.js';
// ─── Utilidades de geo ────────────────────────────────────────────────────────
/**
 * Calcula la distancia en km entre dos puntos geográficos (Haversine).
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function toRad(deg) {
    return (deg * Math.PI) / 180;
}
/**
 * Normaliza una distancia en km a un score 0-1.
 * 0 km → 1.0 | maxKm → 0.0
 */
export function geoScoreFromKm(distanceKm, maxKm = 50) {
    return Math.max(0, 1 - distanceKm / maxKm);
}
/**
 * Normaliza una diferencia temporal a un score 0-1.
 * 0 días → 1.0 | maxDays → 0.0
 */
export function timeScoreFromDays(daysDiff, maxDays = 30) {
    return Math.max(0, 1 - daysDiff / maxDays);
}
/**
 * Calcula score de atributos entre dos perros (0-1).
 *
 * Regla especial: si el color es conocido y NO coincide, el score se capa en 0.25.
 * El color es el atributo más discriminativo visualmente: un perro negro y uno blanco
 * no pueden ser el mismo. Sin esta regla, un match de tamaño solo (ej: ambos "chico")
 * elevaba el score a MEDIUM aunque color y raza fueran opuestos → falso positivo.
 */
export function attributeScore(params) {
    const { breedMatch, sizeMatch, colorMatch } = params;
    // Color explícitamente incorrecto: el máximo score posible se reduce a 0.25.
    // Esto impide que un match de tamaño solo llegue a umbral MEDIUM cuando el
    // color y la raza son ambos incorrectos.
    if (colorMatch === false) {
        const partials = [breedMatch, sizeMatch].filter((v) => v !== null);
        const partialScore = partials.length > 0
            ? partials.filter(Boolean).length / partials.length
            : 0.5;
        return partialScore * 0.25;
    }
    const checks = [breedMatch, sizeMatch, colorMatch].filter((v) => v !== null);
    if (checks.length === 0)
        return 0.5; // Sin datos suficientes → neutro
    return checks.filter(Boolean).length / checks.length;
}
// ─── Constantes ───────────────────────────────────────────────────────────────
export { MATCH_WEIGHTS, CONFIDENCE_THRESHOLDS, MAX_DAILY_NOTIFICATIONS } from './types/match.js';
//# sourceMappingURL=index.js.map