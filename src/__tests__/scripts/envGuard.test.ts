import { describe, it, expect } from 'vitest';
import type { ResolvedConfig } from 'vite';
import {
  API_URL_VAR,
  envGuard,
  isLoopbackHost,
  validateApiUrl,
} from '../../../scripts/envGuard';

describe('isLoopbackHost', () => {
  it.each([
    'localhost',
    'LOCALHOST',
    'localhost.',
    'app.localhost',
    '127.0.0.1',
    '127.1.2.3',
    '127.255.255.255',
    '0.0.0.0',
    '[::1]',
    '[::]',
    '[::ffff:7f00:1]',
    '[::ffff:0:0]',
  ])('treats %s as loopback', (host) => {
    expect(isLoopbackHost(host)).toBe(true);
  });

  it.each([
    'api.example.com',
    'localhost.example.com',
    'notlocalhost',
    '126.0.0.1',
    '128.0.0.1',
    '10.0.0.5',
    '192.168.1.10',
    '8.8.8.8',
    '1270.0.0.1',
    '[2001:db8::1]',
    '[::ffff:808:808]',
  ])('does not treat %s as loopback', (host) => {
    expect(isLoopbackHost(host)).toBe(false);
  });
});

describe('validateApiUrl', () => {
  it.each([undefined, '', '   '])('rejects a missing value (%j)', (value) => {
    expect(validateApiUrl(value)).toMatch(/not set/);
  });

  it.each([
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'https://127.0.0.2',
    'http://[::1]:8000/api',
    'http://0.0.0.0:8000',
    // URL() canonicalises these to 127.0.0.1
    'http://2130706433',
    'http://0x7f.1',
    'http://[0:0:0:0:0:0:0:1]',
    'http://[::ffff:127.0.0.1]',
  ])('rejects loopback URL %s', (value) => {
    expect(validateApiUrl(value)).toMatch(/loopback/);
  });

  it.each(['api.example.com', 'localhost:8000', '//api.example.com', 'ftp://api.example.com'])(
    'rejects a value that is not an absolute http(s) URL (%s)',
    (value) => {
      expect(validateApiUrl(value)).toMatch(/absolute/);
    },
  );

  it.each([
    'https://api.example.com',
    'https://api.example.test:8443/v1',
    'http://10.0.0.5:8000',
    ' https://api.example.com ',
  ])('accepts %s', (value) => {
    expect(validateApiUrl(value)).toBeNull();
  });
});

describe('envGuard plugin', () => {
  function resolve(command: 'build' | 'serve', mode: string, url?: string) {
    const plugin = envGuard();
    const hook = plugin.configResolved as (config: ResolvedConfig) => void;
    const config = {
      command,
      mode,
      env: url === undefined ? {} : { [API_URL_VAR]: url },
    } as unknown as ResolvedConfig;
    return () => hook(config);
  }

  it.each(['production', 'preprod'])('fails a %s build when the URL is missing', (mode) => {
    expect(resolve('build', mode)).toThrow(new RegExp(`"${mode}" mode.*${API_URL_VAR}`, 's'));
  });

  it.each(['production', 'preprod'])('fails a %s build that points at localhost', (mode) => {
    expect(resolve('build', mode, 'http://localhost:8000')).toThrow(/loopback/);
  });

  it.each(['production', 'preprod'])('allows a %s build with a real URL', (mode) => {
    expect(resolve('build', mode, 'https://api.example.test')).not.toThrow();
  });

  it('names where to set the variable in the error', () => {
    expect(resolve('build', 'production')).toThrow(/Vercel/);
  });

  it('keeps the dev-mode fallback: no checks for serve or unguarded modes', () => {
    expect(resolve('serve', 'development')).not.toThrow();
    expect(resolve('serve', 'production')).not.toThrow();
    expect(resolve('build', 'development')).not.toThrow();
    expect(resolve('build', 'test')).not.toThrow();
  });
});
