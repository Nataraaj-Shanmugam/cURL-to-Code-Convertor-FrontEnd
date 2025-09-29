import type { ParsedData, HeaderItem, QueryParamItem, AuthItem } from '../types';

/**
 * Parses a raw cURL command string into structured ParsedData.
 * ⚠️ This is a simplified parser — extend as needed for edge cases.
 */
export function parseCurlCommand(curl: string): ParsedData {
  const headers: HeaderItem[] = [];
  const params: QueryParamItem[] = [];
  const auth: AuthItem[] = [];
  let method = 'GET';
  let url = '';
  let body: string | undefined;

  // Split by spaces while respecting quotes
  const parts = curl.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    switch (part) {
      case 'curl':
        continue;

      case '-X':
      case '--request':
        method = (parts[i + 1] || 'GET').replace(/"/g, '');
        i++;
        break;

      case '-H':
      case '--header': {
        const headerStr = (parts[i + 1] || '').replace(/^"|"$/g, '');
        const [key, ...rest] = headerStr.split(':');
        headers.push({
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          key: key.trim(),
          value: rest.join(':').trim(),
          enabled: true
        });
        i++;
        break;
      }

      case '-d':
      case '--data':
      case '--data-raw': {
        body = (parts[i + 1] || '').replace(/^"|"$/g, '');
        i++;
        break;
      }

      case '-u':
      case '--user': {
        const authStr = (parts[i + 1] || '').replace(/^"|"$/g, '');
        const [user, pass] = authStr.split(':');
        auth.push({
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          key: user,
          value: pass,
          enabled: true,
          type: 'Basic'
        });
        i++;
        break;
      }

      default:
        if (part.startsWith('http')) {
          url = part.replace(/"/g, '');
        }
    }
  }

  // Extract query params from URL
  if (url.includes('?')) {
    const [base, query] = url.split('?');
    url = base;
    query.split('&').forEach((q) => {
      const [k, v] = q.split('=');
      params.push({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        key: decodeURIComponent(k),
        value: decodeURIComponent(v || ''),
        enabled: true
      });
    });
  }

  return { method, url, headers, params, auth, body };
}
