import type { SwaggerDefinition } from "swagger-jsdoc";

export const swaggerDefinition: SwaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Blaniel API",
    version: "1.0.0",
    description: `
# Blaniel API

API REST completa para crear y gestionar agentes de IA emocionales y administrativos.

## Features

- 🤖 **AI Agents**: Crear compañeros emocionales y asistentes administrativos
- 🌍 **Virtual Worlds**: Entornos grupales para múltiples agentes
- 💬 **Conversations**: Chat con análisis emocional en tiempo real
- 📊 **Analytics**: Métricas detalladas de uso y engagement
- 🔐 **Authentication**: Sistema seguro con API keys
- 🚦 **Rate Limiting**: Control de uso por plan
- 📈 **Usage Tracking**: Monitoreo de recursos consumidos

## Authentication

Todas las requests requieren autenticación mediante API key en el header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

Obtén tu API key en el dashboard de usuario.

## Rate Limits

Los límites dependen de tu plan:

- **Free**: 10 requests/minuto
- **Plus**: 100 requests/minuto
- **Ultra**: 1000 requests/minuto

Headers de respuesta:
- \`X-RateLimit-Limit\`: Límite total
- \`X-RateLimit-Remaining\`: Requests restantes
- \`X-RateLimit-Reset\`: Timestamp de reset

## Errors

La API usa códigos HTTP estándar:

- \`200\`: Success
- \`201\`: Created
- \`400\`: Bad Request
- \`401\`: Unauthorized
- \`403\`: Forbidden (quota exceeded)
- \`404\`: Not Found
- \`429\`: Too Many Requests
- \`500\`: Internal Server Error

Formato de error:
\`\`\`json
{
  "error": "Error message",
  "details": "Additional context"
}
\`\`\`
    `,
    contact: {
      name: "API Support",
      email: "api@creador-ia.com",
      url: "https://creador-ia.com/support",
    },
    license: {
      name: "Proprietary",
      url: "https://creador-ia.com/terms",
    },
  },
  servers: [
    {
      url: "http://localhost:3000/api/v1",
      description: "Development server",
    },
    {
      url: "https://api.creador-ia.com/v1",
      description: "Production server",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description: "Enter your API key",
      },
    },
    schemas: {
      Agent: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier",
            example: "cuid_123abc",
          },
          userId: {
            type: "string",
            description: "Owner user ID",
          },
          kind: {
            type: "string",
            enum: ["companion", "assistant"],
            description: "Type of agent",
          },
          name: {
            type: "string",
            description: "Agent name",
            example: "Luna",
          },
          description: {
            type: "string",
            description: "Agent description",
          },
          personality: {
            type: "string",
            description: "Personality traits",
          },
          purpose: {
            type: "string",
            description: "Agent's purpose",
          },
          tone: {
            type: "string",
            description: "Communication tone",
          },
          profile: {
            type: "object",
            description: "Extended profile data",
          },
          systemPrompt: {
            type: "string",
            description: "System prompt for LLM",
          },
          visibility: {
            type: "string",
            enum: ["private", "world", "public"],
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          agentId: {
            type: "string",
            nullable: true,
          },
          worldId: {
            type: "string",
            nullable: true,
          },
          userId: {
            type: "string",
            nullable: true,
          },
          role: {
            type: "string",
            enum: ["user", "assistant", "system"],
          },
          content: {
            type: "string",
          },
          metadata: {
            type: "object",
            properties: {
              emotions: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              relationLevel: {
                type: "string",
              },
              tokensUsed: {
                type: "number",
              },
            },
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      World: {
        type: "object",
        properties: {
          id: {
            type: "string",
          },
          userId: {
            type: "string",
          },
          name: {
            type: "string",
          },
          description: {
            type: "string",
            nullable: true,
          },
          agents: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Agent",
            },
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      UsageStats: {
        type: "object",
        properties: {
          plan: {
            type: "string",
            enum: ["free", "plus", "ultra"],
          },
          messages: {
            type: "object",
            properties: {
              used: { type: "number" },
              limit: { type: "number" },
              percentage: { type: "number" },
            },
          },
          agents: {
            type: "object",
            properties: {
              used: { type: "number" },
              limit: { type: "number" },
              percentage: { type: "number" },
            },
          },
          worlds: {
            type: "object",
            properties: {
              used: { type: "number" },
              limit: { type: "number" },
              percentage: { type: "number" },
            },
          },
          tokens: {
            type: "object",
            properties: {
              used: { type: "number" },
              perMessage: { type: "number" },
            },
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
          },
          details: {
            type: "string",
          },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
};

export const swaggerOptions = {
  definition: swaggerDefinition,
  apis: ["./app/api/v1/**/*.ts"],
};
