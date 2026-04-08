/**
 * Templates HTML para emails de posts seguidos
 */

export interface NewCommentEmailData {
  userName: string;
  postTitle: string;
  postUrl: string;
  commentAuthor: string;
  commentContent: string;
  unsubscribeUrl: string;
}

export interface DigestEmailData {
  userName: string;
  periodLabel: string;
  posts: Array<{
    id: string;
    title: string;
    url: string;
    newCommentsCount: number;
    community?: {
      name: string;
      slug: string;
    };
  }>;
  totalNewComments: number;
  unsubscribeUrl: string;
  managePreferencesUrl: string;
}

/**
 * Template para email de nuevo comentario en post seguido
 */
export function newCommentEmailTemplate(data: NewCommentEmailData): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuevo comentario en post que sigues</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                Blaniel Community
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e0ff; font-size: 14px;">
                Nuevo comentario en post que sigues
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px 0; color: #1d1d1f; font-size: 16px; line-height: 1.5;">
                Hola <strong>${data.userName}</strong>,
              </p>

              <p style="margin: 0 0 24px 0; color: #1d1d1f; font-size: 16px; line-height: 1.5;">
                <strong>${data.commentAuthor}</strong> ha comentado en el post que sigues:
              </p>

              <!-- Post Info -->
              <div style="background-color: #f5f5f7; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 24px; border-radius: 8px;">
                <h2 style="margin: 0 0 12px 0; color: #1d1d1f; font-size: 18px; font-weight: 600;">
                  ${data.postTitle}
                </h2>
                <div style="background-color: #ffffff; padding: 16px; border-radius: 6px; margin-top: 12px;">
                  <p style="margin: 0; color: #6e6e73; font-size: 15px; line-height: 1.6; font-style: italic;">
                    "${data.commentContent.substring(0, 200)}${data.commentContent.length > 200 ? '...' : ''}"
                  </p>
                </div>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="${data.postUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                      Ver Comentario
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #86868b; font-size: 13px; line-height: 1.5;">
                Recibes este email porque estás siguiendo este post. Puedes dejar de seguirlo en cualquier momento desde la página del post.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f7; padding: 30px 40px; border-top: 1px solid #e5e5e7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; color: #86868b; font-size: 13px;">
                      © 2025 Blaniel. Todos los derechos reservados.
                    </p>
                    <p style="margin: 0; font-size: 12px;">
                      <a href="${data.unsubscribeUrl}" style="color: #667eea; text-decoration: none;">
                        Cancelar suscripción
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Template para email de digest diario/semanal
 */
export function digestEmailTemplate(data: DigestEmailData): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen de actividad - ${data.periodLabel}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                Blaniel Community
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e0ff; font-size: 14px;">
                Resumen de actividad - ${data.periodLabel}
              </p>
            </td>
          </tr>

          <!-- Summary Stats -->
          <tr>
            <td style="padding: 32px 40px 24px 40px;">
              <p style="margin: 0 0 24px 0; color: #1d1d1f; font-size: 16px; line-height: 1.5;">
                Hola <strong>${data.userName}</strong>,
              </p>

              <p style="margin: 0 0 24px 0; color: #1d1d1f; font-size: 16px; line-height: 1.5;">
                Aquí está tu resumen de actividad ${data.periodLabel.toLowerCase()} en los posts que sigues:
              </p>

              <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="50%" align="center" style="padding: 12px;">
                      <div style="font-size: 36px; font-weight: 700; color: #667eea; margin-bottom: 4px;">
                        ${data.totalNewComments}
                      </div>
                      <div style="font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px;">
                        Nuevos Comentarios
                      </div>
                    </td>
                    <td width="50%" align="center" style="padding: 12px; border-left: 1px solid #e5e5e7;">
                      <div style="font-size: 36px; font-weight: 700; color: #764ba2; margin-bottom: 4px;">
                        ${data.posts.length}
                      </div>
                      <div style="font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px;">
                        Posts Activos
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              ${data.posts.length > 0 ? `
                <h3 style="margin: 0 0 20px 0; color: #1d1d1f; font-size: 20px; font-weight: 600;">
                  Posts con actividad reciente
                </h3>

                ${data.posts.map(post => `
                  <div style="background-color: #f5f5f7; border-radius: 10px; padding: 20px; margin-bottom: 16px; transition: all 0.2s;">
                    <div style="display: flex; align-items: start; margin-bottom: 12px;">
                      <div style="flex: 1;">
                        <h4 style="margin: 0 0 8px 0; color: #1d1d1f; font-size: 17px; font-weight: 600; line-height: 1.3;">
                          ${post.title}
                        </h4>
                        ${post.community ? `
                          <p style="margin: 0 0 8px 0; color: #86868b; font-size: 13px;">
                            en <strong>${post.community.name}</strong>
                          </p>
                        ` : ''}
                      </div>
                    </div>

                    <div style="background-color: #ffffff; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                      <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        ${post.newCommentsCount} nuevo${post.newCommentsCount !== 1 ? 's' : ''} comentario${post.newCommentsCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <a href="${post.url}" style="display: inline-block; color: #667eea; text-decoration: none; font-size: 14px; font-weight: 600;">
                      Ver Post →
                    </a>
                  </div>
                `).join('')}
              ` : `
                <p style="margin: 0; color: #86868b; font-size: 15px; text-align: center; padding: 40px 20px;">
                  No hubo actividad nueva en tus posts seguidos durante este período.
                </p>
              `}
            </td>
          </tr>

          <!-- CTA -->
          ${data.posts.length > 0 ? `
            <tr>
              <td style="padding: 0 40px 40px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <a href="${data.managePreferencesUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                        Ver Todos los Posts
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f5f7; padding: 30px 40px; border-top: 1px solid #e5e5e7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; color: #86868b; font-size: 13px;">
                      © 2025 Blaniel. Todos los derechos reservados.
                    </p>
                    <p style="margin: 0; font-size: 12px;">
                      <a href="${data.managePreferencesUrl}" style="color: #667eea; text-decoration: none; margin-right: 16px;">
                        Gestionar Preferencias
                      </a>
                      <a href="${data.unsubscribeUrl}" style="color: #667eea; text-decoration: none;">
                        Cancelar suscripción
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
