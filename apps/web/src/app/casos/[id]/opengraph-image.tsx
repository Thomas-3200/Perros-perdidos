/**
 * OG image dinámica por caso.
 * Cuando alguien comparte el link en WhatsApp, Facebook, Twitter, etc., se
 * genera al vuelo una imagen 1200x630 con la foto del perro, su nombre,
 * ciudad y recompensa — para maximizar el click rate.
 */
import { ImageResponse } from 'next/og';

export const alt         = 'Perro perdido en Perros Perdidos';
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface CaseDetail {
  id:              string;
  status:          'active' | 'found' | 'closed';
  lastSeenCity?:   string;
  reward?:         number | null;
  rewardCurrency?: string;
  dog: {
    name:  string;
    breed?: string;
    photos: string[];
  };
}

async function fetchCase(id: string): Promise<CaseDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/cases/${id}`, {
      next: { revalidate: 300 }, // cache 5 min
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch { return null; }
}

export default async function OGImage({ params }: { params: { id: string } }) {
  const caseData = await fetchCase(params.id);

  // Fallback genérico si el caso no existe
  if (!caseData) {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
          color: 'white', fontFamily: 'sans-serif',
        }}>
          <div style={{ fontSize: 100, marginBottom: 20 }}>🐾</div>
          <div style={{ fontSize: 56, fontWeight: 800 }}>Perros Perdidos</div>
          <div style={{ fontSize: 28, opacity: 0.9, marginTop: 12 }}>
            Comunidad + IA reuniendo perros con sus familias
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const photo  = caseData.dog.photos[0];
  const name   = caseData.dog.name;
  const breed  = caseData.dog.breed;
  const city   = caseData.lastSeenCity;
  const reward = caseData.reward;
  const cur    = caseData.rewardCurrency ?? 'ARS';

  const isFound = caseData.status === 'found';

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex',
        background: '#fff7ed',
        fontFamily: 'sans-serif',
      }}>
        {/* Columna izquierda: foto */}
        <div style={{
          width: 600, height: 630,
          display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: photo ? 'transparent' : '#fed7aa',
          position: 'relative',
        }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt={name}
              width={600}
              height={630}
              style={{ width: 600, height: 630, objectFit: 'cover' }}
            />
          ) : (
            <div style={{ fontSize: 240 }}>🐶</div>
          )}

          {/* Badge estado */}
          <div style={{
            position: 'absolute', top: 24, left: 24,
            background: isFound ? '#22c55e' : '#ef4444',
            color: 'white',
            padding: '8px 18px',
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            {isFound ? '🏠 Reunificado' : '🚨 Perdido'}
          </div>
        </div>

        {/* Columna derecha: info */}
        <div style={{
          flex: 1, height: 630,
          padding: 56,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              fontSize: 22, color: '#c2410c', fontWeight: 700,
              letterSpacing: 2, textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              🐾 Perros Perdidos
            </div>

            <div style={{
              fontSize: 76, fontWeight: 900, color: '#1f2937',
              marginTop: 24, lineHeight: 1, display: 'flex',
            }}>
              {name}
            </div>

            {breed && (
              <div style={{
                fontSize: 32, color: '#6b7280',
                marginTop: 12, display: 'flex',
              }}>
                {breed}
              </div>
            )}

            {city && (
              <div style={{
                fontSize: 26, color: '#374151',
                marginTop: 28,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                📍 {city}
              </div>
            )}

            {!isFound && reward && reward > 0 && (
              <div style={{
                marginTop: 24,
                background: '#fb923c',
                color: 'white',
                fontWeight: 800, fontSize: 28,
                padding: '12px 24px',
                borderRadius: 16,
                alignSelf: 'flex-start',
                display: 'flex',
              }}>
                💰 Recompensa: ${reward.toLocaleString('es-AR')} {cur}
              </div>
            )}
          </div>

          <div style={{
            fontSize: 22, color: '#6b7280',
            display: 'flex', flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ display: 'flex' }}>
              {isFound
                ? '🎉 Gracias a la comunidad por colaborar.'
                : '👀 ¿Lo viste? Reportalo en la app — la IA te conecta con el dueño.'}
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: '#c2410c',
              display: 'flex', marginTop: 4,
            }}>
              perros-perdidos-web.vercel.app
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
