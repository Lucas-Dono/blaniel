/**
 * Scene Validator
 *
 * Valida que las escenas tengan la estructura correcta antes de insertarlas
 * en la base de datos.
 */

import type { SceneTemplate } from "../templates/scene-examples";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateScene(scene: SceneTemplate): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validación 1: Código válido
  if (!scene.code || !/^[A-Z]{3,}_\d{3}$/.test(scene.code)) {
    errors.push("Código inválido (debe ser XXX_000)");
  }

  // Validación 2: Nombre presente
  if (!scene.name || scene.name.length < 5) {
    errors.push("Nombre muy corto o faltante");
  }

  // Validación 3: Descripción presente
  if (!scene.description || scene.description.length < 20) {
    errors.push("Descripción muy corta o faltante");
  }

  // Validación 4: Roles participantes
  if (!scene.participantRoles || scene.participantRoles.length < 1) {
    errors.push("Debe tener al menos 1 rol");
  }

  // Validación 5: Secuencia de intervenciones
  if (!scene.interventionSequence || !Array.isArray(scene.interventionSequence)) {
    errors.push("Secuencia de intervenciones faltante o inválida");
  } else {
    // Validar que cada rol tenga al menos una intervención
    const rolesWithIntervention = new Set(
      scene.interventionSequence.map((i) => i.role)
    );

    const missingRoles = scene.participantRoles.filter(
      (r) => !rolesWithIntervention.has(r)
    );

    if (missingRoles.length > 0) {
      warnings.push(`Roles sin intervención: ${missingRoles.join(", ")}`);
    }

    // Validar directivas
    for (const intervention of scene.interventionSequence) {
      if (!intervention.directive || intervention.directive.length < 10) {
        errors.push(`Directiva muy corta en rol ${intervention.role}`);
      }

      if (intervention.delay === undefined || intervention.delay < 0) {
        errors.push(`Delay inválido en rol ${intervention.role}`);
      }
    }
  }

  // Validación 6: Consecuencias (si existen)
  if (scene.consequences) {
    if (scene.consequences.seeds) {
      for (const seed of scene.consequences.seeds) {
        if (!seed.type || !seed.title || !seed.content) {
          errors.push("Semilla de tensión incompleta");
        }

        if (!seed.involvedRoles || seed.involvedRoles.length === 0) {
          errors.push("Semilla sin roles involucrados");
        }
      }
    }

    if (scene.consequences.relations) {
      for (const rel of scene.consequences.relations) {
        if (!rel.roleA || !rel.roleB) {
          errors.push("Relación sin roles especificados");
        }

        if (rel.affinityChange === undefined) {
          errors.push("Relación sin cambio de afinidad");
        }
      }
    }
  }

  // Validación 7: Rangos de IAs
  if (scene.minAIs && scene.maxAIs && scene.minAIs > scene.maxAIs) {
    errors.push("minAIs mayor que maxAIs");
  }

  // Validación 8: Duración válida
  if (!["short", "medium", "long"].includes(scene.duration)) {
    errors.push('Duración debe ser "short", "medium" o "long"');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateScenes(scenes: SceneTemplate[]): {
  valid: number;
  invalid: number;
  results: Array<{
    scene: SceneTemplate;
    validation: ValidationResult;
  }>;
} {
  const results = scenes.map((scene) => ({
    scene,
    validation: validateScene(scene),
  }));

  const valid = results.filter((r) => r.validation.valid).length;
  const invalid = results.filter((r) => !r.validation.valid).length;

  return { valid, invalid, results };
}
