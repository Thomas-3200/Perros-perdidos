/**
 * Generación de embeddings visuales para matching de perros.
 *
 * Estrategia:
 * 1. Descargar la imagen de Cloudinary
 * 2. Enviar a OpenAI Vision para extracción de embedding (o CLIP via Replicate)
 * 3. Guardar el vector en pgvector (columna photoEmbedding de Sighting)
 *
 * Nota: CLIP via Replicate es la opción ideal en producción para
 * embeddings visuales puros. GPT-4o Vision se usa para extracción
 * de atributos del perro (raza, color, señas).
 */
import OpenAI from 'openai';
import Replicate from 'replicate';
// Inicialización lazy — no falla al importar sin API keys configuradas
let _openai = null;
let _replicate = null;
function getOpenAI() {
    if (!_openai)
        _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'placeholder' });
    return _openai;
}
function getReplicate() {
    if (!_replicate)
        _replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN ?? '' });
    return _replicate;
}
export async function extractDogAttributesFromImage(imageUrl) {
    const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: { url: imageUrl, detail: 'high' },
                    },
                    {
                        type: 'text',
                        text: `Analiza esta imagen y extrae información sobre el perro.

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "hasDogDetected": boolean,
  "breed": "string o null",
  "colors": ["array de colores en español"],
  "size": "small|medium|large|extra_large o null",
  "sex": "male|female o null",
  "distinguishingFeatures": ["array de señas particulares visibles"],
  "confidence": número entre 0 y 1 indicando confianza de la extracción
}

Si no hay perro en la imagen, pon hasDogDetected: false y confidence: 0.`,
                    },
                ],
            },
        ],
        max_tokens: 400,
        temperature: 0,
    });
    const raw = response.choices[0]?.message?.content ?? '{}';
    // Limpiar posibles bloques de markdown
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    }
    catch {
        return {
            hasDogDetected: false,
            colors: [],
            distinguishingFeatures: [],
            confidence: 0,
        };
    }
}
// ─── Embedding visual via CLIP (Replicate) ────────────────────────────────────
export async function generateImageEmbedding(imageUrl) {
    // Modelo CLIP en Replicate: openai/clip-vit-large-patch14
    // Retorna un vector de 768 dimensiones
    const output = await getReplicate().run('openai/clip-vit-large-patch14:b8afe62952083f9dc7c6d30bfe9b1e48cb3c4be9', { input: { image: imageUrl } });
    return output;
}
// ─── Similitud coseno entre dos vectores ─────────────────────────────────────
export function cosineSimilarity(a, b) {
    if (a.length !== b.length)
        return 0;
    const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    if (magA === 0 || magB === 0)
        return 0;
    return dot / (magA * magB);
}
//# sourceMappingURL=embedding.js.map