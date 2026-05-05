/**
 * Upload de imágenes.
 * - Si hay keys de Cloudinary → usa Cloudinary (CDN, optimizado)
 * - Si no hay keys → guarda en disco local (./uploads/) para desarrollo
 */
import { v2 as cloudinary } from 'cloudinary';
import type { MultipartFile } from '@fastify/multipart';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url:       string;
  publicId:  string;
  format:    string;
  width?:    number;
  height?:   number;
  storage:   'cloudinary' | 'local';
}

const hasCloudinary = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );

// Directorio local de uploads (relativo al proceso, que arranca desde packages/api)
const LOCAL_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

function ensureLocalDir(folder: string): string {
  const dir = path.join(LOCAL_UPLOADS_DIR, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function uploadToCloudinary(
  file: MultipartFile,
  folder: 'dogs' | 'sightings' | 'reunions',
): Promise<UploadResult> {
  const buffer = await file.toBuffer();

  const uploadPromise = new Promise<UploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        `perros-perdidos/${folder}`,
        resource_type: 'auto',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload falló'));
        resolve({
          url:      result.secure_url,
          publicId: result.public_id,
          format:   result.format,
          width:    result.width,
          height:   result.height,
          storage:  'cloudinary',
        });
      },
    );
    stream.end(buffer);
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Cloudinary tardó demasiado. Intentá de nuevo.')), 30_000),
  );

  return Promise.race([uploadPromise, timeoutPromise]);
}

async function uploadToLocal(
  file: MultipartFile,
  folder: 'dogs' | 'sightings' | 'reunions',
): Promise<UploadResult> {
  const buffer   = await file.toBuffer();
  const ext      = path.extname(file.filename || 'file.jpg') || '.jpg';
  const name     = `${crypto.randomUUID()}${ext}`;
  const dir      = ensureLocalDir(folder);
  const filePath = path.join(dir, name);

  fs.writeFileSync(filePath, buffer);

  const apiBase = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
  const url     = `${apiBase}/uploads/${folder}/${name}`;

  return {
    url,
    publicId: `local/${folder}/${name}`,
    format:   ext.replace('.', ''),
    storage:  'local',
  };
}

export async function uploadFile(
  file: MultipartFile,
  folder: 'dogs' | 'sightings' | 'reunions',
): Promise<UploadResult> {
  if (hasCloudinary()) {
    return uploadToCloudinary(file, folder);
  }
  console.info(`[upload] Cloudinary no configurado → guardando localmente (${folder})`);
  return uploadToLocal(file, folder);
}
