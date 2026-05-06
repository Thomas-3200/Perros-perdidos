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
}

export function PhotoPicker({ onFile, multiple, onFiles }: Props) {
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
