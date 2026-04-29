/**
 * Generación de historias de reunificación con Claude.
 *
 * Convierte los datos del caso en una mini-historia emotiva
 * lista para el feed público y redes sociales.
 */
import Anthropic from '@anthropic-ai/sdk';

let _anthropic: Anthropic | null = null;
const getAnthropic = () => { if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? 'placeholder' }); return _anthropic; };

export interface StoryInput {
  dogName:     string;
  breed:       string;
  ownerName:   string;
  daysMissing: number;
  city:        string;
  storyText?:  string; // Texto libre del dueño (opcional)
}

export async function generateReunionStory(input: StoryInput): Promise<string> {
  const { dogName, breed, ownerName, daysMissing, city, storyText } = input;

  const userContext = storyText
    ? `El dueño escribió esto sobre la reunificación:\n"${storyText}"`
    : `El perro llevaba ${daysMissing} días perdido en ${city}.`;

  const prompt = `Escribe una historia corta y emotiva sobre la reunificación de ${dogName} (${breed}) con su dueño en ${city}.

${userContext}

La historia debe:
- Ser genuina, cálida y esperanzadora
- Tener máximo 3 párrafos
- Inspirar a otros dueños que aún buscan a su perro
- Mencionar la comunidad que ayudó en la búsqueda
- Terminar con un mensaje positivo

No inventar detalles que contradigan los datos reales.
Escribe en español, en primera o tercera persona según fluya mejor.`;

  const response = await getAnthropic().messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 400,
    messages:   [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content?.type === 'text') return content.text;

  return `¡${dogName} volvió a casa después de ${daysMissing} días! Gracias a la comunidad que no dejó de buscar. 🐾`;
}
