import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { apiClient } from '@/lib/api/apiClient';
import type { CodeGenConfig } from '@/types/curl';

describe('Backend Integration — Parse cURL', () => {
  it('should successfully parse a valid cURL command', async () => {
    const curlCommand = 'curl -X POST "https://api.example.com/users" -H "Content-Type: application/json" -d \'{"name": "John"}\'';

    const { data } = await apiClient.post('/api/parse', { curl: curlCommand });

    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.method).toBe('POST');
    expect(data.data.base_url).toBe('https://api.example.com');
    expect(data.data.endpoint).toBe('/users');
    expect(data.data.headers).toHaveProperty('Content-Type', 'application/json');
  });

  it('should return error for empty cURL command', async () => {
    await expect(
      apiClient.post('/api/parse', { curl: '' }),
    ).rejects.toThrow('cURL command is required');
  });

  it('should return error for invalid cURL command', async () => {
    await expect(
      apiClient.post('/api/parse', { curl: 'invalid-curl-garbage' }),
    ).rejects.toThrow('Invalid cURL command format');
  });

  it('should handle array response (multiple parsed results)', async () => {
    server.use(
      http.post('*/api/parse', () => {
        return HttpResponse.json({
          success: true,
          data: [
            { method: 'GET', base_url: 'https://a.com', endpoint: '/a' },
            { method: 'POST', base_url: 'https://b.com', endpoint: '/b' },
          ],
        });
      }),
    );

    const { data } = await apiClient.post('/api/parse', { curl: 'curl https://a.com/a' });

    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data).toHaveLength(2);
  });

  it('should include query params in parsed response', async () => {
    const { data } = await apiClient.post('/api/parse', {
      curl: 'curl "https://api.example.com/users?page=1&limit=10"',
    });

    expect(data.data.query_params).toBeDefined();
    expect(data.data.query_params.page).toBe('1');
    expect(data.data.query_params.limit).toBe('10');
  });

  it('should include cookies in parsed response', async () => {
    const { data } = await apiClient.post('/api/parse', {
      curl: 'curl -b "session_id=abc123" https://api.example.com',
    });

    expect(data.data.cookies).toBeDefined();
    expect(data.data.cookies.session_id).toBe('abc123');
  });
});

describe('Backend Integration — Code Generation', () => {
  const baseConfig: CodeGenConfig = {
    option: 'full',
    className: 'ApiTest',
    methodName: 'testApiRequest',
    assertionRequired: true,
    statusCode: '200',
    loggingRequired: true,
    needPojo: false,
  };

  const parsedData = {
    method: 'POST',
    base_url: 'https://api.example.com',
    endpoint: '/users',
    headers: { 'Content-Type': 'application/json' },
    data: { name: 'John' },
  };

  it('should generate full test class code', async () => {
    const { data } = await apiClient.post('/api/generate-from-parsed', {
      parsed_data: parsedData,
      config: baseConfig,
    });

    expect(data.success).toBe(true);
    expect(data.generated_code).toContain('public class ApiTest');
    expect(data.generated_code).toContain('@Test');
    expect(data.language).toBe('java');
  });

  it('should generate method-only code', async () => {
    const { data } = await apiClient.post('/api/generate-from-parsed', {
      parsed_data: parsedData,
      config: { ...baseConfig, option: 'method' },
    });

    expect(data.success).toBe(true);
    expect(data.generated_code).toBeDefined();
  });

  it('should include POJO code when needPojo is true', async () => {
    const { data } = await apiClient.post('/api/generate-from-parsed', {
      parsed_data: parsedData,
      config: { ...baseConfig, needPojo: true },
    });

    expect(data.success).toBe(true);
    expect(data.pojo_code).toContain('@Data');
    expect(data.pojo_code).toContain('@Builder');
  });

  it('should not include POJO code when needPojo is false', async () => {
    const { data } = await apiClient.post('/api/generate-from-parsed', {
      parsed_data: parsedData,
      config: baseConfig,
    });

    expect(data.pojo_code).toBe('');
  });

  it('should return error when generation option is missing', async () => {
    await expect(
      apiClient.post('/api/generate-from-parsed', {
        parsed_data: parsedData,
        config: { ...baseConfig, option: '' },
      }),
    ).rejects.toThrow('Generation option is required');
  });

  it('should handle server errors during generation', async () => {
    server.use(
      http.post('*/api/generate-from-parsed', () => {
        return HttpResponse.json(
          { success: false, error: { code: 'INTERNAL', message: 'Generation failed' } },
          { status: 500 },
        );
      }),
    );

    await expect(
      apiClient.post('/api/generate-from-parsed', {
        parsed_data: parsedData,
        config: baseConfig,
      }),
    ).rejects.toThrow('Generation failed');
  });
});

describe('Backend Integration — Body Editing', () => {
  it('should edit a body node successfully', async () => {
    const { data } = await apiClient.post('/api/body/edit', {
      body: { name: 'John', address: { city: 'NYC' } },
      path: 'address.city',
      value: 'Los Angeles',
    });

    expect(data.success).toBe(true);
  });

  it('should delete a body node successfully', async () => {
    const { data } = await apiClient.post('/api/body/delete', {
      body: { name: 'John', address: { city: 'NYC' } },
      path: 'address.city',
    });

    expect(data.success).toBe(true);
  });

  it('should return error when path is missing for edit', async () => {
    await expect(
      apiClient.post('/api/body/edit', { body: {}, path: '', value: 'test' }),
    ).rejects.toThrow('Path is required');
  });

  it('should return error when path is missing for delete', async () => {
    await expect(
      apiClient.post('/api/body/delete', { body: {}, path: '' }),
    ).rejects.toThrow('Path is required');
  });
});
