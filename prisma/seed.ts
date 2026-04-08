import { PrismaClient } from "@prisma/client";
import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de la base de datos...");

  // Limpiar datos existentes (opcional)
  await prisma.message.deleteMany();
  await prisma.relation.deleteMany();
  await prisma.log.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.user.deleteMany();

  // =================================================================
  // PERSONAJES PREMIUM DEL SISTEMA (Públicos)
  // =================================================================
  console.log("\n🌟 Cargando personajes premium del sistema...");

  // Cargar personajes premium desde archivos JSON
  const processedDir = path.join(__dirname, '..', 'Personajes', 'processed');
  let premiumCount = 0;

  if (fs.existsSync(processedDir)) {
    const files = fs.readdirSync(processedDir).filter(f => f.endsWith('.json'));

    console.log(`\n📁 Encontrados ${files.length} archivos de personajes premium`);

    for (const file of files) {
      const filePath = path.join(processedDir, file);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const character = JSON.parse(content);

        // Verificar si existen las imágenes necesarias
        const slug = file.replace('.json', '');
        const publicDir = path.join(__dirname, '..', 'public', 'personajes', slug);
        const avatarPath = path.join(publicDir, 'avatar.webp');
        const referencePath = path.join(publicDir, 'reference.webp');

        // Solo cargar personajes que tengan AMBAS imágenes (avatar + reference)
        // Esto excluye los placeholders SVG que solo tienen avatar
        if (!fs.existsSync(avatarPath)) {
          console.log(`   ⏭️  ${character.name} (sin imagen de avatar, saltando)`);
          continue;
        }

        if (!fs.existsSync(referencePath)) {
          console.log(`   ⏭️  ${character.name} (solo placeholder, esperando imagen real)`);
          continue;
        }

        // Verificar si ya existe
        const existing = await prisma.agent.findUnique({
          where: { id: character.id }
        });

        if (!existing) {
          await prisma.agent.create({
            data: {
              id: character.id,
              userId: null,
              teamId: null,
              kind: character.kind,
              generationTier: 'ultra',
              name: character.name,
              description: character.profile?.basicInfo?.occupation
                ? `${character.name} - ${character.profile.basicInfo.occupation}`
                : `${character.name} - Personaje Premium`,
              gender: character.gender,
              systemPrompt: character.systemPrompt,
              visibility: character.visibility,
              nsfwMode: character.nsfwMode,
              nsfwLevel: character.nsfwLevel,
              personalityVariant: character.personalityVariant || 'balanced',
              avatar: character.avatar,
              referenceImageUrl: `/personajes/${slug}/reference.webp`,
              tags: character.tags || [],
              featured: character.isPremium || true,
              profile: character.profile,
              stagePrompts: character.stagePrompts || null,
              locationCity: character.locationCity || null,
              locationCountry: character.locationCountry || null,
              updatedAt: new Date(),
            }
          });

          console.log(`   ✅ ${character.name}`);
          premiumCount++;
        } else {
          console.log(`   ⏭️  ${character.name} (ya existe)`);
        }
      } catch (error) {
        console.error(`   ❌ Error procesando ${file}:`, error);
      }
    }

    console.log(`\n✅ ${premiumCount} personajes premium cargados desde archivos JSON`);
  } else {
    console.log(`⚠️  Carpeta de personajes procesados no encontrada: ${processedDir}`);
    console.log(`   Los personajes premium no se cargarán en este seed.`);
  }

  console.log("\n🎉 ¡Seed completado exitosamente!");
  console.log("\n📊 Resumen:");
  console.log(`  - ${premiumCount} personajes premium cargados desde Personajes/processed`);
  console.log("\n✨ Base de datos lista con personajes premium únicamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
