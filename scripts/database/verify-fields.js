#!/usr/bin/env node

/**
 * Script para verificar que los campos de Prisma usados en el código existen
 * Útil para ejecutar antes de hacer commit
 */

const fs = require('fs');
const path = require('path');

// Leer schema de Prisma
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Extraer modelos y sus campos
const models = {};
const modelRegex = /model (\w+) \{([^}]+)\}/g;
let match;

while ((match = modelRegex.exec(schema)) !== null) {
  const modelName = match[1];
  const fields = match[2]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('@@') && !line.startsWith('//'))
    .map(line => {
      const fieldMatch = line.match(/^(\w+)\s+/);
      return fieldMatch ? fieldMatch[1] : null;
    })
    .filter(Boolean);

  models[modelName] = fields;
}

console.log('✓ Schema loaded:', Object.keys(models).length, 'models found\n');

// Verificar el endpoint de limpieza de datos
const endpointPath = path.join(__dirname, '../app/api/user/data/route.ts');
const endpointCode = fs.readFileSync(endpointPath, 'utf8');

// Extraer operaciones deleteMany y update
const operations = [];
const deleteManyRegex = /tx\.(\w+)\.deleteMany\(\{[^}]*where:\s*\{([^}]+)\}/g;

while ((match = deleteManyRegex.exec(endpointCode)) !== null) {
  const model = match[1];
  const whereClause = match[2].trim();

  // Extraer solo los campos (lado izquierdo de ':' o el campo completo si no hay ':')
  // Ejemplos:
  //   "userId" -> ["userId"]
  //   "authorId: userId" -> ["authorId"]
  //   "recipientId: userId" -> ["recipientId"]
  const fieldMatches = whereClause.match(/(\w+)\s*(?::|,|})/g);
  if (fieldMatches) {
    fieldMatches.forEach(fieldMatch => {
      // Extraer solo el nombre del campo (antes de ':' si existe)
      const field = fieldMatch.split(':')[0].replace(/[,\s}]/g, '').trim();
      if (field) {
        operations.push({ model, field, operation: 'deleteMany' });
      }
    });
  }
}

// Verificar todas las operaciones
let errors = 0;
console.log('=== Verificando operaciones de Prisma ===\n');

operations.forEach(({ model, field, operation }) => {
  // Convertir de camelCase a PascalCase para el modelo
  const modelName = model.charAt(0).toUpperCase() + model.slice(1);

  if (!models[modelName]) {
    console.error(`✗ Modelo "${modelName}" no existe en el schema`);
    errors++;
    return;
  }

  if (!models[modelName].includes(field)) {
    console.error(`✗ Campo "${field}" no existe en modelo "${modelName}"`);
    console.error(`  Campos disponibles: ${models[modelName].join(', ')}`);
    errors++;
  } else {
    console.log(`✓ ${modelName}.${field}`);
  }
});

console.log('');

if (errors > 0) {
  console.error(`\n❌ ${errors} error(es) encontrado(s)`);
  process.exit(1);
} else {
  console.log('✅ Todas las verificaciones pasaron correctamente');
  process.exit(0);
}
