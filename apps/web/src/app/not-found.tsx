import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center">
      <div className="text-7xl">🐾</div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Página no encontrada</h1>
        <p className="text-gray-500 max-w-sm">
          Parece que esta página se perdió como un perrito. No te preocupes, podemos ayudarte a volver al camino.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/" className="btn-primary w-full text-center">Ir al inicio</Link>
        <Link href="/buscar" className="btn-secondary w-full text-center">Buscar casos</Link>
      </div>
    </div>
  );
}
