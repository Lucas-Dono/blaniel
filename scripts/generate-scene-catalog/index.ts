/**
 * Scene Catalog Generator
 *
 * Script para generar e insertar el catálogo de escenas en la base de datos.
 */

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { SCENE_EXAMPLES_BY_CATEGORY } from "./templates/scene-examples";
import { validateScenes } from "./validation/scene-validator";

async function generateCatalog() {
  console.log("=".repeat(60));
  console.log("GENERADOR DE CATÁLOGO DE ESCENAS");
  console.log("=".repeat(60));
  console.log();

  // 1. Contar escenas a generar
  const allScenes = Object.values(SCENE_EXAMPLES_BY_CATEGORY).flat();
  console.log(`📊 Total de escenas a insertar: ${allScenes.length}`);

  // Mostrar distribución por categoría
  console.log("\n📈 Distribución por categoría:");
  for (const [category, scenes] of Object.entries(SCENE_EXAMPLES_BY_CATEGORY)) {
    console.log(`  ${category}: ${scenes.length} escenas`);
  }
  console.log();

  // 2. Validar todas las escenas
  console.log("Validando escenas...");
  const validation = validateScenes(allScenes);
  console.log(`  ✓ Válidas: ${validation.valid}`);
  console.log(`  ✗ Inválidas: ${validation.invalid}`);
  console.log();

  if (validation.invalid > 0) {
    console.error("Errores de validación:");
    for (const result of validation.results) {
      if (!result.validation.valid) {
        console.error(`  ${result.scene.code}: ${result.validation.errors.join(", ")}`);
      }
    }
    console.log();
    console.log("Corrige los errores antes de continuar.");
    process.exit(1);
  }

  // 3. Mostrar advertencias
  const withWarnings = validation.results.filter(
    (r) => r.validation.warnings.length > 0
  );
  if (withWarnings.length > 0) {
    console.warn("Advertencias:");
    for (const result of withWarnings) {
      console.warn(`  ${result.scene.code}: ${result.validation.warnings.join(", ")}`);
    }
    console.log();
  }

  // 4. Insertar escenas en la base de datos
  console.log("Insertando escenas en la base de datos...");

  // Limpiar escenas existentes (opcional, comentado por seguridad)
  // await prisma.scene.deleteMany({});

  let inserted = 0;
  let skipped = 0;

  for (const scene of allScenes) {
    try {
      // Verificar si ya existe
      const existing = await prisma.scene.findUnique({
        where: { code: scene.code },
      });

      if (existing) {
        console.log(`  ⊘ ${scene.code} ya existe, saltando...`);
        skipped++;
        continue;
      }

      // Insertar escena
      await prisma.scene.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          code: scene.code,
          name: scene.name,
          category: scene.category,
          subcategory: scene.subcategory,
          triggerType: scene.triggerType,
          triggerPattern: null,
          triggerMinEnergy: null,
          triggerMaxEnergy: null,
          triggerMinTension: null,
          triggerMaxTension: null,
          description: scene.description,
          objectives: scene.objectives,
          participantRoles: scene.participantRoles,
          interventionSequence: scene.interventionSequence,
          consequences: scene.consequences,
          variations: undefined,
          usageCount: 0,
          successRate: 0.5,
          avgEngagement: 0.5,
          isActive: true,
          minAIs: scene.minAIs,
          maxAIs: scene.maxAIs,
          duration: scene.duration,
        },
      });

      console.log(`  ✓ ${scene.code} - ${scene.name}`);
      inserted++;
    } catch (error) {
      console.error(`  ✗ Error insertando ${scene.code}:`, error);
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log("RESUMEN");
  console.log("=".repeat(60));
  console.log(`Total de escenas: ${allScenes.length}`);
  console.log(`Insertadas: ${inserted}`);
  console.log(`Saltadas (ya existían): ${skipped}`);
  console.log();

  // 5. Estadísticas del catálogo
  const stats = await prisma.scene.groupBy({
    by: ["category"],
    _count: true,
  });

  console.log("ESCENAS POR CATEGORÍA:");
  for (const stat of stats) {
    console.log(`  ${stat.category}: ${stat._count} escenas`);
  }

  console.log();
  console.log("✅ Catálogo generado exitosamente");
}

// Ejecutar
generateCatalog()
  .then(() => {
    console.log();
    console.log("Cerrando conexión a la base de datos...");
    return prisma.$disconnect();
  })
  .then(() => {
    console.log("¡Listo!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error fatal:", error);
    prisma.$disconnect();
    process.exit(1);
  });
