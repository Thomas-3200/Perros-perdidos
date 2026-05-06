/**
 * Módulo de apoyo emocional — chat IA empático con Claude.
 *
 * Principios:
 * - Validar emociones del dueño antes de dar consejos
 * - Ofrecer guía práctica de búsqueda
 * - Mencionar historias de reunificación exitosa como esperanza
 * - NUNCA diagnosticar ni reemplazar ayuda profesional
 * - Siempre incluir disclaimer al inicio de la sesión
 */
import Anthropic from '@anthropic-ai/sdk';

// claude-sonnet-4-6 para apoyo emocional: mejor calidad de respuesta empática
// Configurable via ANTHROPIC_SUPPORT_MODEL en Render → Environment
const SUPPORT_MODEL = process.env.ANTHROPIC_SUPPORT_MODEL ?? 'claude-sonnet-4-6';

let _anthropic: Anthropic | null = null;
const getAnthropic = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no configurada');
  }
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
};

const SYSTEM_PROMPT = `Eres un asistente empático y cálido que ayuda a dueños de perros perdidos en momentos de angustia.

Tu rol es:
1. PRIMERO escuchar y validar las emociones del dueño con empatía genuina
2. Luego ofrecer consejos PRÁCTICOS y ACCIONABLES de búsqueda
3. Compartir esperanza con estadísticas reales (muchos perros son encontrados semanas después)
4. Guiar al dueño paso a paso si está paralizado por el estrés

Consejos prácticos que puedes dar:
- Colocar ropa con el olor del dueño en el último lugar visto
- Notificar veterinarias y refugios locales con fotos
- Hacer publicaciones en grupos locales de Facebook con foto + descripción + contacto
- Revisar horarios: algunos perros regresan de noche a zonas familiares
- Buscar en abrigos y debajo de vehículos en el radio inmediato
- Contactar al microchip si el perro fue castrado/registrado
- Imprimir volantes en el barrio

IMPORTANTE:
- NO eres terapeuta. Si el dueño expresa angustia severa, siempre sugiere buscar apoyo profesional
- Sé breve y cálido. Máximo 3-4 párrafos por respuesta
- Habla en español de manera natural y cercana
- Usa el nombre del perro en tus respuestas para hacer la conversación más personal`;

export interface SupportInput {
  userMessage: string;
  dogName: string;
  daysMissing: number;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function emotionalSupport(input: SupportInput): Promise<string> {
  const { userMessage, dogName, daysMissing, conversationHistory } = input;

  const contextMessage = conversationHistory.length === 0
    ? `[Contexto: El perro se llama ${dogName} y lleva ${daysMissing} día(s) desaparecido. Esta es la primera vez que el dueño usa el módulo de apoyo.]\n\n${userMessage}`
    : userMessage;

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map(m => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: contextMessage },
  ];

  const response = await getAnthropic().messages.create({
    model:      SUPPORT_MODEL,
    max_tokens: 500,
    system:     SYSTEM_PROMPT,
    messages,
  });

  const content = response.content[0];
  if (content?.type === 'text') return content.text;

  return 'Lo siento, no pude generar una respuesta en este momento. Por favor intenta de nuevo.';
}
