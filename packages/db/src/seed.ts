/**
 * Seed de desarrollo — crea datos de prueba básicos
 * Ejecutar con: pnpm db:seed
 */
import prisma from './index.js';

async function main() {
  console.log('🌱 Iniciando seed de desarrollo...');

  // Usuario admin de prueba
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

  // Dueño de perro de prueba
  const owner = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'María García',
      phone: '+5491112345678',
      role: 'owner',
      locationLat: -34.6037,
      locationLng: -58.3816,
      locationCity: 'Buenos Aires',
      locationCountry: 'Argentina',
    },
  });

  // Perro de prueba
  const dog = await prisma.dog.upsert({
    where: { id: 'seed-dog-001' },
    update: {},
    create: {
      id: 'seed-dog-001',
      ownerId: owner.id,
      name: 'Max',
      breed: 'Labrador',
      color: ['amarillo'],
      size: 'large',
      sex: 'male',
      age: 3,
      description: 'Tiene una mancha blanca en el pecho. Muy amigable.',
      photos: [],
    },
  });

  // Caso perdido de prueba
  await prisma.lostCase.upsert({
    where: { id: 'seed-case-001' },
    update: {},
    create: {
      id: 'seed-case-001',
      dogId: dog.id,
      ownerId: owner.id,
      status: 'active',
      lastSeenLat: -34.6037,
      lastSeenLng: -58.3816,
      lastSeenAddress: 'Av. Corrientes 1234',
      lastSeenCity: 'Buenos Aires',
      lastSeenCountry: 'Argentina',
      lastSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // hace 2 días
      contactMethod: 'whatsapp',
      contactValue: '+5491112345678',
      reward: 5000,
      rewardCurrency: 'ARS',
      behaviorNotes: 'Asustadizo con extraños. Responde al nombre Max.',
    },
  });

  console.log('✅ Seed completado!');
  console.log(`   Admin: ${admin.email}`);
  console.log(`   Dueño: ${owner.email}`);
  console.log(`   Perro: ${dog.name} (${dog.breed})`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
