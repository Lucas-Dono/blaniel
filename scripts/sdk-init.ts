#!/usr/bin/env tsx
/**
 * SDK Initialization Script
 *
 * Configura el SDK para usar:
 * - Cloud (blaniel.com) - Todo configurado, solo login
 * - Local (self-hosted) - Requiere configuración local
 */

import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const CLOUD_URL = 'https://blaniel.com';
const CLOUD_AUTH_URL = 'https://blaniel.com/auth/sdk-login';

interface SDKConfig {
  mode: 'cloud' | 'local';
  apiUrl: string;
  token?: string;
  userId?: string;
}

async function openBrowser(url: string): Promise<void> {
  const start = process.platform === 'darwin' ? 'open' :
                process.platform === 'win32' ? 'start' : 'xdg-open';

  try {
    await execAsync(`${start} "${url}"`);
  } catch (error) {
    console.error('No se pudo abrir el navegador automáticamente.');
    console.log(`\nPor favor abre manualmente: ${url}`);
  }
}

async function cloudLogin(): Promise<SDKConfig> {
  console.log('\n🌐 Iniciando sesión en Blaniel Cloud...\n');

  // Generate PKCE challenge
  const crypto = await import('crypto');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  // Estado único para la sesión
  const state = crypto.randomBytes(16).toString('hex');

  // Construir URL de OAuth
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: 'sdk-cli',
    redirect_uri: 'http://localhost:3333/callback',
    scope: 'npc:read npc:write agents:read agents:write',
    state: state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${CLOUD_AUTH_URL}?${authParams.toString()}`;

  console.log('🔐 Abriendo navegador para autenticación...');
  console.log(`   Si no se abre, visita: ${authUrl}\n`);

  await openBrowser(authUrl);

  // Iniciar servidor local para recibir el callback
  const http = await import('http');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:3333`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        if (!code || returnedState !== state) {
          res.writeHead(400);
          res.end('Error: Código inválido');
          server.close();
          reject(new Error('Autenticación fallida'));
          return;
        }

        // Intercambiar código por token
        try {
          const tokenResponse = await fetch(`${CLOUD_URL}/api/auth/sdk-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              verifier,
              client_id: 'sdk-cli',
              redirect_uri: 'http://localhost:3333/callback',
            }),
          });

          if (!tokenResponse.ok) {
            throw new Error('Error obteniendo token');
          }

          const tokenData = await tokenResponse.json();

          // Success page
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Blaniel SDK - Autenticado</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                  background: white;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                  text-align: center;
                }
                h1 { color: #667eea; margin-bottom: 20px; }
                p { color: #666; margin: 10px 0; }
                .check { font-size: 64px; color: #4caf50; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="check">✓</div>
                <h1>¡Autenticación exitosa!</h1>
                <p>Ya puedes cerrar esta ventana y volver a la terminal.</p>
                <p style="margin-top: 30px; color: #999; font-size: 14px;">
                  Bienvenido a Blaniel Cloud
                </p>
              </div>
            </body>
            </html>
          `);

          server.close();

          resolve({
            mode: 'cloud',
            apiUrl: CLOUD_URL,
            token: tokenData.access_token,
            userId: tokenData.user_id,
          });
        } catch (error) {
          res.writeHead(500);
          res.end('Error en la autenticación');
          server.close();
          reject(error);
        }
      }
    });

    server.listen(3333, () => {
      console.log('⏳ Esperando autenticación...');
    });

    // Timeout después de 5 minutos
    setTimeout(() => {
      server.close();
      reject(new Error('Timeout: No se completó la autenticación'));
    }, 5 * 60 * 1000);
  });
}

async function localSetup(): Promise<SDKConfig> {
  console.log('\n🏠 Configuración Local\n');

  const rl = readline.createInterface({ input, output });

  console.log('Para usar el modo local necesitarás:');
  console.log('  ✓ PostgreSQL corriendo');
  console.log('  ✓ Redis (opcional)');
  console.log('  ✓ Al menos una API key de LLM');
  console.log('  ✓ Backend Next.js ejecutándose\n');

  const proceed = await rl.question('¿Continuar con setup local? (s/n): ');

  if (proceed.toLowerCase() !== 's') {
    console.log('\nPuedes usar el modo cloud con: npm run sdk-init cloud');
    process.exit(0);
  }

  const apiUrl = await rl.question('URL del backend local [http://localhost:3000]: ') || 'http://localhost:3000';

  rl.close();

  // Verificar que el backend esté corriendo
  try {
    console.log('\n🔍 Verificando conexión al backend...');
    const response = await fetch(`${apiUrl}/api/health`);

    if (response.ok) {
      console.log('✅ Backend conectado');
    } else {
      throw new Error('Backend no responde correctamente');
    }
  } catch (error) {
    console.error('\n❌ No se pudo conectar al backend');
    console.log('\nAsegúrate de que el servidor esté corriendo:');
    console.log('   npm run dev\n');
    process.exit(1);
  }

  return {
    mode: 'local',
    apiUrl,
  };
}

async function saveConfig(config: SDKConfig): Promise<void> {
  const configDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.blaniel');
  const configFile = path.join(configDir, 'config.json');

  // Crear directorio si no existe
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

  console.log(`\n✅ Configuración guardada en: ${configFile}`);
}

async function showInstructions(config: SDKConfig): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║               ✅ SDK CONFIGURADO                               ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (config.mode === 'cloud') {
    console.log('🌐 Modo: Blaniel Cloud');
    console.log(`👤 Usuario: ${config.userId || 'autenticado'}`);
    console.log(`🔗 API: ${config.apiUrl}\n`);

    console.log('📋 Próximos pasos:\n');
    console.log('  1. Crear un NPC:');
    console.log('     npm run quick-npc merchant "Nombre"\n');
    console.log('  2. Listar NPCs:');
    console.log('     npm run quick-npc list\n');
    console.log('  3. Usar en tu juego:');
    console.log('     Ver SDK_SETUP.md para integración\n');

    console.log('💡 Ventajas del modo Cloud:');
    console.log('   ✅ Sin configuración local');
    console.log('   ✅ LLMs ya configurados');
    console.log('   ✅ Backups automáticos');
    console.log('   ✅ Actualizaciones automáticas\n');
  } else {
    console.log('🏠 Modo: Local (Self-hosted)');
    console.log(`🔗 API: ${config.apiUrl}\n`);

    console.log('📋 Próximos pasos:\n');
    console.log('  1. Asegúrate de que el servidor esté corriendo:');
    console.log('     npm run dev\n');
    console.log('  2. Configura tus API keys en .env:');
    console.log('     VENICE_API_KEY=...');
    console.log('     OPENAI_API_KEY=...\n');
    console.log('  3. Crear un NPC:');
    console.log('     npm run quick-npc merchant "Nombre"\n');

    console.log('💡 Ventajas del modo Local:');
    console.log('   ✅ Control total');
    console.log('   ✅ Privacidad completa');
    console.log('   ✅ Sin límites de uso');
    console.log('   ✅ Personalizable\n');
  }

  console.log('🔗 Cambiar modo en cualquier momento:');
  console.log('   npm run sdk-init cloud   (usar Blaniel Cloud)');
  console.log('   npm run sdk-init local   (usar servidor local)\n');
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] as 'cloud' | 'local' | undefined;

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║           BLANIEL SDK - INICIALIZACIÓN                         ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (mode && mode !== 'cloud' && mode !== 'local') {
    console.error('❌ Modo inválido. Usa: cloud o local');
    console.log('\nEjemplos:');
    console.log('  npm run sdk-init cloud   (usar Blaniel Cloud)');
    console.log('  npm run sdk-init local   (configurar localmente)\n');
    process.exit(1);
  }

  let selectedMode: 'cloud' | 'local' | undefined = mode;

  if (!selectedMode) {
    // Modo interactivo
    const rl = readline.createInterface({ input, output });

    console.log('🚀 ¿Cómo quieres usar Blaniel?\n');
    console.log('  1) 🌐 Cloud (blaniel.com) - Fácil, todo configurado');
    console.log('  2) 🏠 Local (self-hosted) - Control total, requiere setup\n');

    const choice = await rl.question('Selecciona una opción (1/2): ');
    rl.close();

    selectedMode = choice === '1' ? 'cloud' : 'local';
  }

  let config: SDKConfig;

  try {
    if (selectedMode === 'cloud') {
      config = await cloudLogin();
    } else {
      config = await localSetup();
    }

    await saveConfig(config);
    await showInstructions(config);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
