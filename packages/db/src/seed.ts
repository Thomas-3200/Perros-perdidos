/**
 * Seed — datos de demo para lanzamiento
 * Ejecutar con: pnpm --filter @perros/db db:seed
 */
import prisma from './index.js';

async function main() {
  console.log('🌱 Sembrando datos de demo...');

  // ── Usuario admin ─────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@perrosperdidos.app' },
    update: {},
    create: {
      email: 'admin@perrosperdidos.app',
      name: 'Admin Sistema',
      role: 'admin',
      reputationScore: 100,
    },
  });

  // ── Usuario 1: Valentina ──────────────────────────────────────────────────
  const valentina = await prisma.user.upsert({
    where: { email: 'valentina.demo@perros.app' },
    update: {},
    create: {
      email:        'valentina.demo@perros.app',
      name:         'Valentina Gómez',
      phone:        '+5491155550001',
      locationCity: 'Palermo, Buenos Aires',
      locationLat:  -34.5885,
      locationLng:  -58.4348,
    },
  });

  // ── Usuario 2: Martín ─────────────────────────────────────────────────────
  const martin = await prisma.user.upsert({
    where: { email: 'martin.demo@perros.app' },
    update: {},
    create: {
      email:        'martin.demo@perros.app',
      name:         'Martín Herrera',
      phone:        '+5491155550002',
      locationCity: 'Villa Urquiza, Buenos Aires',
      locationLat:  -34.5697,
      locationLng:  -58.4879,
    },
  });

  // ── Perro 1: Mia (Golden Retriever) ──────────────────────────────────────
  const mia = await prisma.dog.upsert({
    where: { id: 'demo-dog-mia-001' },
    update: {},
    create: {
      id:          'demo-dog-mia-001',
      ownerId:     valentina.id,
      name:        'Mia',
      breed:       'Golden Retriever',
      color:       ['dorado', 'crema'],
      size:        'large',
      sex:         'female',
      age:         3,
      neutered:    true,
      description: 'Muy sociable y amigable. Collar rojo con placa dorada.',
      photos: [
        'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
      ],
    },
  });

  const miaCase = await prisma.lostCase.upsert({
    where: { id: 'demo-case-mia-001' },
    update: {},
    create: {
      id:              'demo-case-mia-001',
      dogId:           mia.id,
      ownerId:         valentina.id,
      status:          'found',
      lastSeenLat:     -34.5875,
      lastSeenLng:     -58.4348,
      lastSeenAddress: 'Av. Santa Fe y Scalabrini Ortiz',
      lastSeenCity:    'Palermo, Buenos Aires',
      lastSeenCountry: 'Argentina',
      lastSeenAt:      new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      contactMethod:   'whatsapp',
      contactValue:    '+5491155550001',
      closedAt:        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.reunionStory.upsert({
    where: { lostCaseId: miaCase.id },
    update: {},
    create: {
      lostCaseId: miaCase.id,
      ownerId:    valentina.id,
      photos: [
        'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
      ],
      storyText:
        'Mia se escapó cuando una tormenta asustó a toda la cuadra. Cinco días de angustia y búsqueda constante. Gracias a esta plataforma, una vecina la vio y reportó el avistamiento. Nos reencontramos en menos de una hora. ¡Gracias a toda la comunidad!',
      aiGeneratedStory:
        `Durante cinco largos días, Valentina recorrió cada rincón de Palermo buscando a Mia, su Golden Retriever de 3 años. Todo comenzó una noche de tormenta: los truenos asustaron a Mia y salió disparada por la puerta entreabierta.

Valentina publicó el caso en la plataforma y en pocas horas la comunidad se movilizó. Vecinos del barrio comenzaron a enviar avistamientos. Fue una señora de la calle Malabia quien finalmente la vio tranquila en un jardín cercano y reportó su ubicación exacta.

En menos de una hora, Mia y Valentina se reencontraron. "No puedo creer lo rápido que la encontramos con la ayuda de todos", dijo Valentina entre lágrimas.

Hoy Mia duerme tranquila en su lugar favorito del sillón, como si nada hubiera pasado. 🐾❤️`,
      published:   true,
      publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Caso 1 creado: Mia — Valentina Gómez (Palermo)');

  // ── Perro 2: Bruno (Labrador) ─────────────────────────────────────────────
  const bruno = await prisma.dog.upsert({
    where: { id: 'demo-dog-bruno-001' },
    update: {},
    create: {
      id:          'demo-dog-bruno-001',
      ownerId:     martin.id,
      name:        'Bruno',
      breed:       'Labrador Retriever',
      color:       ['negro'],
      size:        'large',
      sex:         'male',
      age:         5,
      neutered:    false,
      description: 'Tranquilo y obediente. Mancha blanca en el pecho. Responde a su nombre.',
      photos: [
        'https://images.unsplash.com/photo-1591160690555-5debfba289f0?w=800&q=80',
      ],
    },
  });

  const brunoCase = await prisma.lostCase.upsert({
    where: { id: 'demo-case-bruno-001' },
    update: {},
    create: {
      id:              'demo-case-bruno-001',
      dogId:           bruno.id,
      ownerId:         martin.id,
      status:          'found',
      lastSeenLat:     -34.5711,
      lastSeenLng:     -58.4905,
      lastSeenAddress: 'Triunvirato y Olazábal',
      lastSeenCity:    'Villa Urquiza, Buenos Aires',
      lastSeenCountry: 'Argentina',
      lastSeenAt:      new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      contactMethod:   'phone',
      contactValue:    '+5491155550002',
      reward:          15000,
      rewardCurrency:  'ARS',
      closedAt:        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.reunionStory.upsert({
    where: { lostCaseId: brunoCase.id },
    update: {},
    create: {
      lostCaseId: brunoCase.id,
      ownerId:    martin.id,
      photos: [
        'https://images.unsplash.com/photo-1591160690555-5debfba289f0?w=800&q=80',
      ],
      storyText:
        'Bruno se perdió cuando salimos a correr y se soltó la correa. Seis días buscándolo por todo el barrio. Un chico que usa esta app lo vio en una plaza y lo reportó. A la hora ya estábamos juntos de nuevo. La plataforma fue clave.',
      aiGeneratedStory:
        `Martín y Bruno salían a correr juntos cada mañana por Villa Urquiza. Pero un martes, la correa cedió y Bruno desapareció entre el tráfico de Triunvirato.

Seis días de búsqueda intensa: carteles en cada árbol, posts en redes sociales y el caso publicado en la plataforma. La comunidad respondió de inmediato: decenas de personas en el barrio estaban atentas.

Fue un estudiante universitario el que finalmente lo vio descansando en la plaza Gelly, a diez cuadras de casa. Reportó el avistamiento con foto y ubicación exacta. Martín llegó corriendo en minutos.

Bruno lo recibió con ese salto de Labrador que vuela a la altura del pecho. "Seis días que me parecieron seis años", contó Martín. "Sin la comunidad, no sé qué hubiera pasado."

Hoy Bruno sigue saliendo a correr, pero con correa doble. 🖤🐾`,
      published:   true,
      publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Caso 2 creado: Bruno — Martín Herrera (Villa Urquiza)');
  console.log(`\n🎉 Seed completado.`);
  console.log(`   Admin: ${admin.email}`);
  console.log(`   2 historias de reunificación publicadas en el feed.`);
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
