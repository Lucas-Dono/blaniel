/**
 * GET /api/auth/sdk-login
 *
 * OAuth2 endpoint para login del SDK
 * Muestra página de login/registro para el SDK CLI
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const codeChallenge = searchParams.get('code_challenge');

  if (clientId !== 'sdk-cli') {
    return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
  }

  // Página HTML de login
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blaniel SDK - Iniciar Sesión</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 450px;
      width: 100%;
    }

    .logo {
      text-align: center;
      margin-bottom: 30px;
    }

    .logo h1 {
      color: #667eea;
      font-size: 32px;
      font-weight: 700;
    }

    .logo p {
      color: #999;
      font-size: 14px;
      margin-top: 5px;
    }

    .info-box {
      background: #f8f9ff;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin-bottom: 30px;
      border-radius: 4px;
    }

    .info-box h3 {
      color: #667eea;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .info-box ul {
      list-style: none;
      font-size: 13px;
      color: #666;
    }

    .info-box li {
      margin: 5px 0;
      padding-left: 20px;
      position: relative;
    }

    .info-box li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #4caf50;
      font-weight: bold;
    }

    .btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      margin-bottom: 12px;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: white;
      color: #667eea;
      border: 2px solid #667eea;
    }

    .btn-secondary:hover {
      background: #f8f9ff;
    }

    .divider {
      text-align: center;
      margin: 20px 0;
      color: #999;
      font-size: 14px;
    }

    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🤖 Blaniel</h1>
      <p>SDK Authentication</p>
    </div>

    <div class="info-box">
      <h3>El SDK solicitará acceso a:</h3>
      <ul>
        <li>Crear y gestionar NPCs</li>
        <li>Acceder a tus agentes</li>
        <li>Usar la API de chat</li>
      </ul>
    </div>

    <button class="btn btn-primary" onclick="login()">
      Iniciar Sesión
    </button>

    <div class="divider">o</div>

    <button class="btn btn-secondary" onclick="register()">
      Crear Cuenta
    </button>

    <div class="footer">
      <p>Al continuar, aceptas permitir que el SDK acceda a tu cuenta de Blaniel.</p>
    </div>
  </div>

  <script>
    const params = new URLSearchParams(window.location.search);
    const redirectUri = params.get('redirect_uri');
    const state = params.get('state');
    const codeChallenge = params.get('code_challenge');

    function login() {
      // Redirect a la página de login normal con callback al SDK
      const loginUrl = '/auth/login?callbackUrl=' + encodeURIComponent(
        '/api/auth/sdk-callback?redirect_uri=' + redirectUri +
        '&state=' + state +
        '&code_challenge=' + codeChallenge
      );
      window.location.href = loginUrl;
    }

    function register() {
      // Redirect a la página de registro con callback al SDK
      const registerUrl = '/auth/register?callbackUrl=' + encodeURIComponent(
        '/api/auth/sdk-callback?redirect_uri=' + redirectUri +
        '&state=' + state +
        '&code_challenge=' + codeChallenge
      );
      window.location.href = registerUrl;
    }
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
