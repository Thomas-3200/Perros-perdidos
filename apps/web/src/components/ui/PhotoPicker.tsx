'use client';

/**
 * PhotoPicker — muestra dos botones: Cámara y Galería.
 * Usa dos inputs ocultos separados para que el sistema operativo
 * abra directamente lo que el usuario eligió.
 */
import { useRef } from 'react';
import { Camera, ImageIcon } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  /**
   * Si true, oculta el botón de Cámara y muestra solo Galería con un botón
   * más grande y un label personalizable. Útil para flujos donde una foto
   * tomada en el momento no tiene sentido (ej: subir un screenshot).
   */
  galleryOnly?: boolean;
  /** Texto del botón cuando galleryOnly = true */
  galleryLabel?: string;
}

export function PhotoPicker({ onFile, multiple, onFiles, galleryOnly, galleryLabel }: Props) {
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (multiple && onFiles) {
      onFiles(files);
    } else {
      onFile(files[0]);
    }
    // Reset para permitir elegir el mismo archivo de nuevo
    e.target.value = '';
  }

  // ── Variante: solo galería, botón único grande ─────────────────────────
  if (galleryOnly) {
    return (
      <>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="w-full flex flex-col items-center gap-3 py-10 rounded-2xl border-2 border-dashed border-gray-300
                     hover:border-brand-400 hover:bg-brand-50 transition-colors active:scale-[0.98]"
        >
          <ImageIcon className="w-10 h-10 text-brand-500" />
          <span className="text-base font-semibold text-gray-700">
            {galleryLabel ?? 'Subir desde galería'}
          </span>
          <span className="text-xs text-gray-400">JPG, PNG o HEIC</span>
        </button>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="sr-only"
          onChange={handleChange}
        />
      </>
    );
  }

  // ── Variante default: cámara + galería ──────────────────────────────────
  return (
    <div className="flex gap-3 w-full">
      {/* Cámara */}
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border-2 border-dashed border-gray-300
                   hover:border-brand-400 hover:bg-brand-50 transition-colors active:scale-95"
      >
        <Camera className="w-7 h-7 text-brand-500" />
        <span className="text-sm font-semibold text-gray-600">Cámara</span>
      </button>

      {/* Galería */}
      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border-2 border-dashed border-gray-300
                   hover:border-brand-400 hover:bg-brand-50 transition-colors active:scale-95"
      >
        <ImageIcon className="w-7 h-7 text-brand-500" />
        <span className="text-sm font-semibold text-gray-600">Galería</span>
      </button>

      {/* Inputs ocultos */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        className="sr-only"
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        onChange={handleChange}
      />
    </div>
  );
}
