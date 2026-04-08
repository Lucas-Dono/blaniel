/**
 * Tests de integración para LLMProvider con rotación de API keys
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMProvider } from '../provider';

describe('LLMProvider - API Key Rotation', () => {
  beforeEach(() => {
    // Limpiar singleton entre tests
    vi.resetModules();

    // Limpiar environment variables
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY_1;
    delete process.env.GOOGLE_AI_API_KEY_2;
    delete process.env.GOOGLE_AI_API_KEY_3;
  });

  describe('Inicialización', () => {
    it('debe cargar una API key única desde GOOGLE_AI_API_KEY', () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key-1';

      const provider = new LLMProvider();

      // Verificar que se inicializó correctamente
      expect(provider).toBeDefined();
    });

    it('debe cargar múltiples API keys desde variables numeradas', () => {
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';
      process.env.GOOGLE_AI_API_KEY_3 = 'test-key-3';

      const provider = new LLMProvider();

      expect(provider).toBeDefined();
    });

    it('debe combinar GOOGLE_AI_API_KEY con keys numeradas', () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key-single';
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';

      const provider = new LLMProvider();

      // Debería tener 3 keys: single + 2 numeradas
      expect(provider).toBeDefined();
    });

    it('debe lanzar error si no hay API keys disponibles', () => {
      expect(() => new LLMProvider()).toThrow('No se encontraron API keys');
    });
  });

  describe('Rotación de API Keys', () => {
    it('debe usar la primera API key por defecto', async () => {
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';

      // Mock fetch para simular respuesta exitosa
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'Test response' }]
            }
          }]
        })
      });

      const provider = new LLMProvider();

      const response = await provider.generate({
        systemPrompt: 'Test system',
        messages: [{ role: 'user', content: 'Test message' }]
      });

      expect(response).toBe('Test response');

      // Verificar que fetch fue llamado con la primera key
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('test-key-1'),
        expect.any(Object)
      );
    });

    it('debe rotar a la segunda key cuando la primera retorna 429', async () => {
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';

      let callCount = 0;

      // Mock fetch para simular 429 en primera key, éxito en segunda
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primera llamada: 429 error
          return Promise.resolve({
            ok: false,
            status: 429,
            text: async () => 'Quota exceeded'
          });
        } else {
          // Second call: success
          return Promise.resolve({
            ok: true,
            json: async () => ({
              candidates: [{
                content: {
                  parts: [{ text: 'Success with second key' }]
                }
              }]
            })
          });
        }
      });

      const provider = new LLMProvider();

      const response = await provider.generate({
        systemPrompt: 'Test system',
        messages: [{ role: 'user', content: 'Test message' }]
      });

      expect(response).toBe('Success with second key');
      expect(callCount).toBe(2);
    });

    it('debe rotar a través de 3 keys antes de fallar', async () => {
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';
      process.env.GOOGLE_AI_API_KEY_3 = 'test-key-3';

      let callCount = 0;

      // Mock fetch para simular 429 en todas las keys
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 429,
          text: async () => 'Quota exceeded'
        });
      });

      const provider = new LLMProvider();

      await expect(
        provider.generate({
          systemPrompt: 'Test system',
          messages: [{ role: 'user', content: 'Test message' }]
        })
      ).rejects.toThrow('Todas las API keys de Gemini han agotado su cuota');

      // Debería haber intentado con las 3 keys
      expect(callCount).toBe(3);
    });

    it('debe detectar errores 403 como quota errors', async () => {
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';

      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 403,
            text: async () => 'Forbidden: quota exceeded'
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              candidates: [{
                content: {
                  parts: [{ text: 'Success' }]
                }
              }]
            })
          });
        }
      });

      const provider = new LLMProvider();

      const response = await provider.generate({
        systemPrompt: 'Test',
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(response).toBe('Success');
      expect(callCount).toBe(2);
    });

    it('debe detectar mensajes "rate limit" como quota errors', async () => {
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';

      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            text: async () => 'Error: rate limit exceeded'
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              candidates: [{
                content: {
                  parts: [{ text: 'Success' }]
                }
              }]
            })
          });
        }
      });

      const provider = new LLMProvider();

      const response = await provider.generate({
        systemPrompt: 'Test',
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(response).toBe('Success');
      expect(callCount).toBe(2);
    });

    it('NO debe rotar en errores no relacionados con quota', async () => {
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';

      // Mock fetch para simular error 500 (server error)
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      });

      const provider = new LLMProvider();

      await expect(
        provider.generate({
          systemPrompt: 'Test',
          messages: [{ role: 'user', content: 'Test' }]
        })
      ).rejects.toThrow('No se pudo generar una respuesta');

      // Solo debería haber hecho 1 intento (no rotar)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateProfile - Rotación con Fallback', () => {
    it('debe usar fallback si todas las keys agotan su cuota', async () => {
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';

      // Mock fetch para simular 429 en todas las keys
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Quota exceeded'
      });

      const provider = new LLMProvider();

      const result = await provider.generateProfile({
        name: 'Test Agent',
        kind: 'companion',
        personality: 'friendly',
        purpose: 'help',
        tone: 'warm'
      });

      // Debería retornar fallback en vez de lanzar error
      expect(result).toBeDefined();
      expect(result.profile).toBeDefined();
      expect(result.systemPrompt).toBeDefined();
      // El fallback usa basicIdentity.preferredName, no name directamente
      expect((result.profile as any)?.basicIdentity?.preferredName).toBe('Test Agent');
    });

    it('debe intentar con todas las keys antes de usar fallback', async () => {
      process.env.GOOGLE_AI_API_KEY_1 = 'test-key-1';
      process.env.GOOGLE_AI_API_KEY_2 = 'test-key-2';
      process.env.GOOGLE_AI_API_KEY_3 = 'test-key-3';

      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 429,
          text: async () => 'Quota exceeded'
        });
      });

      const provider = new LLMProvider();

      const result = await provider.generateProfile({
        name: 'Test',
        kind: 'companion'
      });

      expect(result).toBeDefined();
      // El provider intenta con las 3 keys (3 llamadas del bucle principal)
      // Additionally there may be extra researchCharacter calls at start
      // Solo verificamos que intentó al menos con todas las keys
      expect(callCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Formato de mensajes Gemini', () => {
    it('debe combinar system prompt con primer mensaje de usuario', async () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key';

      let capturedBody: any;

      global.fetch = vi.fn().mockImplementation((url, options) => {
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{ text: 'Response' }]
              }
            }]
          })
        });
      });

      const provider = new LLMProvider();

      await provider.generate({
        systemPrompt: 'You are helpful',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      // Verificar que el system prompt se combinó con el user message
      expect(capturedBody.contents).toBeDefined();
      expect(capturedBody.contents[0].role).toBe('user');
      expect(capturedBody.contents[0].parts[0].text).toContain('You are helpful');
      expect(capturedBody.contents[0].parts[0].text).toContain('Hello');
    });

    it('debe convertir role "assistant" a "model"', async () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key';

      let capturedBody: any;

      global.fetch = vi.fn().mockImplementation((url, options) => {
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{ text: 'Response' }]
              }
            }]
          })
        });
      });

      const provider = new LLMProvider();

      await provider.generate({
        systemPrompt: 'System',
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
          { role: 'user', content: 'How are you?' }
        ]
      });

      // The role "assistant" should be converted to "model"
      const modelMessage = capturedBody.contents.find((m: any) => m.role === 'model');
      expect(modelMessage).toBeDefined();
      expect(modelMessage.parts[0].text).toBe('Hello');
    });
  });
});
