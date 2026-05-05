/** @type {import('next').NextConfig} */

// Construye el patrón de imagen para el backend (local en dev, Railway en prod)
function apiImagePattern() {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: '/uploads/**',
    };
  } catch {
    return { protocol: 'http', hostname: 'localhost', port: '3001', pathname: '/uploads/**' };
  }
}

const nextConfig = {
  // Transpila los paquetes del workspace (exponen TypeScript puro)
  transpilePackages: ['@perros/shared'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      apiImagePattern(),
    ],
  },
};

module.exports = nextConfig;
