import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { apiClient, DEFAULT_TIMEOUT_MS } from '@/lib/api/apiClient';

describe('apiClient', () => {
  describe('request configuration', () => {
    it('should export DEFAULT_TIMEOUT_MS of 10 seconds', () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
    });

    it('should expose get and post methods', () => {
      expect(typeof apiClient.get).toBe('function');
      expect(typeof apiClient.post).toBe('function');
    });
  });

  describe('health check', () => {
    it('should call /api/health and return ok', async () => {
      const { data } = await apiClient.get('/api/health');
      expect(data.status).toBe('ok');
    });
  });

  describe('error handling', () => {
    it('should extract error message from v2.0.0 error format (object)', async () => {
      server.use(
        http.post('*/api/test-error', () => {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'TEST_ERROR', message: 'Something went wrong' },
            },
            { status: 400 },
          );
        }),
      );

      await expect(apiClient.post('/api/test-error')).rejects.toThrow('Something went wrong');
    });

    it('should extract error message from string error format', async () => {
      server.use(
        http.post('*/api/test-error-str', () => {
          return HttpResponse.json(
            { success: false, error: 'Plain string error' },
            { status: 400 },
          );
        }),
      );

      await expect(apiClient.post('/api/test-error-str')).rejects.toThrow('Plain string error');
    });

    it('should fall back to generic message when no error details', async () => {
      server.use(
        http.post('*/api/test-error-empty', () => {
          return HttpResponse.json({}, { status: 500 });
        }),
      );

      await expect(apiClient.post('/api/test-error-empty')).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      server.use(
        http.post('*/api/test-network', () => {
          return HttpResponse.error();
        }),
      );

      await expect(apiClient.post('/api/test-network')).rejects.toThrow();
    });
  });
});
