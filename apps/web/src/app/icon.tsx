import { ImageResponse } from 'next/og';

export const size        = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f97316',
          borderRadius: '8px',
        }}
      >
        {/* Pata de perro en SVG puro */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 100 100"
          fill="white"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Almohadilla central */}
          <ellipse cx="50" cy="62" rx="22" ry="18" />
          {/* Dedos */}
          <ellipse cx="22" cy="44" rx="11" ry="14" />
          <ellipse cx="41" cy="34" rx="11" ry="14" />
          <ellipse cx="60" cy="34" rx="11" ry="14" />
          <ellipse cx="78" cy="44" rx="11" ry="14" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
