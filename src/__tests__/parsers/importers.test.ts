import { describe, it, expect } from 'vitest';
import { detectFormat, parseInput, parseEnvironmentText } from '@/lib/parsers/importUtils';
import { parsePostmanCollection } from '@/lib/parsers/postmanParser';
import { parseOpenApiSpec } from '@/lib/parsers/openApiParser';
import type { OpenApiSpec, PostmanCollection } from '@/types/import';
import postmanCollection from '../fixtures/postman-collection.json';
import postmanNoId from '../fixtures/postman-collection-no-id.json';
import postmanEnvironment from '../fixtures/postman-environment.json';
import openapiYaml from '../fixtures/openapi3-orders.yaml?raw';
import openapiRelative from '../fixtures/openapi3-relative-server.json';
import swagger2 from '../fixtures/swagger2-store.json';

const collection = postmanCollection as unknown as PostmanCollection;
/** One command on one line, so assertions do not depend on the line-continuation layout. */
const flat = (curl: string) => curl.replace(/ \\\n\s*/g, ' ');
const byName = <T extends { name: string }>(list: T[], name: string): T => {
  const found = list.find((r) => r.name === name);
  if (!found) throw new Error(`no request named ${name}`);
  return found;
};

describe('detectFormat', () => {
  it('detects a collection without info._postman_id', () => {
    expect(detectFormat(postmanNoId)).toBe('postman');
    expect(parsePostmanCollection(postmanNoId as unknown as PostmanCollection)).toHaveLength(1);
  });
  it('still detects collections with an id, OpenAPI and Swagger, and rejects other JSON', () => {
    expect(detectFormat(postmanCollection)).toBe('postman');
    expect(detectFormat(swagger2)).toBe('openapi');
    expect(detectFormat({ info: { title: 'x' } })).toBe('unknown');
    expect(detectFormat({ item: [] })).toBe('unknown');
  });
  it('parseInput accepts the no-id collection text', async () => {
    const result = await parseInput(JSON.stringify(postmanNoId));
    expect(result.format).toBe('postman');
  });
});

describe('Postman import', () => {
  const withoutEnv = parsePostmanCollection(collection);
  const withEnv = parsePostmanCollection(collection, parseEnvironmentText(JSON.stringify(postmanEnvironment)).env);

  it('resolves collection variables and encodes query keys and values', () => {
    const curl = flat(byName(withoutEnv, 'List orders').curlCommand);
    expect(curl).toContain("'https://orders.acme.test/v2/orders?status=on%20hold&q=a%26b%3Dc&region=eu-west&page=2'");
    expect(curl).not.toContain('verbose');
    expect(curl).not.toContain('X-Debug');
  });

  it('environment variables beat collection variables and fill the auth token', () => {
    const curl = flat(byName(withEnv, 'List orders').curlCommand);
    expect(curl).toContain("'https://staging.acme.test/v2/orders?");
    expect(curl).toContain("-H 'Authorization: Bearer tok_staging_123'");
  });

  it('ignores disabled environment values and keeps the variable visible', () => {
    const create = byName(withEnv, 'Create order');
    expect(create.curlCommand).toContain('{{idempotencyKey}}');
    expect(create.unresolvedVariables).toEqual(['idempotencyKey']);
    expect(create.curlCommand).toContain('"sku": "SKU-9"');
  });

  it('flags every still-unresolved {{variable}} per request', () => {
    expect(byName(withoutEnv, 'List orders').unresolvedVariables).toEqual(['accessToken']);
    expect([...(byName(withoutEnv, 'Create order').unresolvedVariables ?? [])].sort()).toEqual(['accessToken', 'idempotencyKey', 'sku']);
    expect(byName(withEnv, 'List orders').unresolvedVariables).toBeUndefined();
    expect(byName(withEnv, 'Public status').unresolvedVariables).toBeUndefined();
  });

  it('substitutes :pathVariables (encoded) and flags one with no value', () => {
    const get = byName(withEnv, 'Get order');
    expect(flat(get.curlCommand)).toContain('/orders/A%20100%2F7/items/:itemId');
    expect(get.unresolvedVariables).toEqual([':itemId']);
  });

  it('inherits collection auth, lets noauth opt out, and a folder auth replaces the collection auth', () => {
    expect(flat(byName(withEnv, 'List orders').curlCommand)).toContain('Authorization: Bearer');
    expect(byName(withEnv, 'Public status').curlCommand).not.toContain('Authorization');
    const login = flat(byName(withEnv, 'Login').curlCommand);
    // request-level basic auth beats the folder's api key and the collection's bearer token
    expect(login).toContain("-u 'admin:s3cret pass'");
    expect(login).not.toContain('Bearer');
    expect(login).not.toContain('X-Admin-Key');
    const upload = flat(byName(withEnv, 'Upload avatar').curlCommand);
    expect(upload).toContain("-H 'X-Admin-Key: adm-456'");
    expect(upload).not.toContain('Bearer');
  });

  it('encodes urlencoded bodies and skips disabled fields', () => {
    const login = flat(byName(withEnv, 'Login').curlCommand);
    expect(login).toContain(
      "-d 'grant_type=password&scope=read%20write&redirect=https%3A%2F%2Fx.test%2Fcb%3Fa%3D1%26b%3D2'",
    );
  });

  it('handles file form fields, text parts with a content type and literal @ values', () => {
    const result = byName(withEnv, 'Upload avatar');
    const upload = flat(result.curlCommand);
    expect(upload).toContain("-F 'avatar=@/Users/me/avatar.png'");
    expect(upload).toContain("-F 'docs=@path/to/file'");
    expect(upload).toContain("-F 'caption=Me at work;type=text/plain'");
    expect(upload).toContain("--form-string 'mention=@alice'");
    expect(result.warnings?.[0]).toMatch(/docs/);
  });

  it('turns a GraphQL body into a JSON payload with its content type', () => {
    const curl = byName(withEnv, 'Search (GraphQL)').curlCommand;
    expect(curl).toContain("-H 'Content-Type: application/json'");
    const payload = /-d '([\s\S]*)'$/.exec(curl)?.[1];
    expect(JSON.parse(payload ?? '')).toEqual({
      query: 'query Orders($first: Int!) {\n  orders(first: $first) { id total }\n}',
      variables: { first: 10 },
    });
  });

  it('adds Content-Type for raw JSON bodies and keeps folder paths and unique ids', () => {
    const create = byName(withEnv, 'Create order');
    expect(create.curlCommand).toContain("-H 'Content-Type: application/json'");
    expect(byName(withEnv, 'Login').folder).toBe('Admin / Users');
    expect(new Set(withEnv.map((r) => r.id)).size).toBe(withEnv.length);
  });

  it('adds https:// when a variable resolves to a bare host', () => {
    const list = parsePostmanCollection(collection, { values: [{ key: 'baseUrl', value: 'api.bare.test', enabled: true }] });
    expect(byName(list, 'Create order').url).toBe('https://api.bare.test/orders');
  });
});

describe('Postman environment parsing', () => {
  it('rejects text that is not an environment', () => {
    expect(parseEnvironmentText('{"foo":1}').error).toMatch(/values/);
    expect(parseEnvironmentText('nope').error).toMatch(/Invalid/);
    expect(parseEnvironmentText('  ').env).toBeNull();
  });
});

describe('OpenAPI 3 import', () => {
  it('parses YAML through parseInput', async () => {
    const result = await parseInput(openapiYaml);
    expect(result.format).toBe('openapi');
    expect(parseOpenApiSpec(result.data as OpenApiSpec).length).toBeGreaterThan(5);
  });

  const requests = (async () => {
    const result = await parseInput(openapiYaml);
    return parseOpenApiSpec(result.data as OpenApiSpec);
  })();

  it('fills server variables with defaults', async () => {
    const get = byName(await requests, 'Get a pet');
    expect(get.url).toBe('https://eu.pets.acme.test:8443/api/v3/pets/{petId}');
    expect(flat(get.curlCommand)).toContain("'https://eu.pets.acme.test:8443/api/v3/pets/0?");
  });

  it('merges path-level and $ref parameters into the operation and lets the operation override', async () => {
    const list = await requests;
    const get = flat(byName(list, 'Get a pet').curlCommand);
    expect(get).toContain('expand=owner'); // exploded array
    expect(get).toContain('verbose=false'); // $ref parameter, default
    expect(get).toContain("-H 'X-Request-Id: req-1'"); // path-level header
    const put = flat(byName(list, 'replacePet').curlCommand);
    expect(put).toContain("-H 'X-Request-Id: overridden'");
    expect(put).not.toContain('req-1');
  });

  it('resolves a $ref requestBody and merges allOf, dropping readOnly properties', async () => {
    const put = flat(byName(await requests, 'replacePet').curlCommand);
    expect(put).toContain("-H 'Content-Type: application/json'");
    const body = JSON.parse(/-d '([\s\S]*)'$/.exec(put)?.[1] ?? '');
    expect(body).toMatchObject({
      name: 'Rex',
      category: { id: 7, name: 'Dogs' },
      tags: [{ label: 'string' }],
      status: 'available',
      born: '2024-01-01',
    });
    expect(body).not.toHaveProperty('id');
    expect(body.parent).toBeDefined(); // recursive $ref stops instead of looping
  });

  it('prefix-matches JSON media types such as application/json; charset=utf-8', async () => {
    const post = flat(byName(await requests, 'Add a pet').curlCommand);
    expect(post).toContain("-H 'Content-Type: application/json; charset=utf-8'");
    expect(post).toMatch(/-d '\{/);
  });

  it('uses a $ref example under a +json media type', async () => {
    const patch = flat(byName(await requests, 'Hand over').curlCommand);
    expect(patch).toContain("-H 'Content-Type: application/vnd.api+json'");
    expect(JSON.parse(/-d '([\s\S]*)'$/.exec(patch)?.[1] ?? '')).toEqual({ data: { type: 'owner', id: '42' } });
  });

  it('turns multipart bodies into -F parts, binary properties into @file', async () => {
    const post = flat(byName(await requests, 'Upload a photo').curlCommand);
    expect(post).toContain("-F 'caption=Cute'");
    expect(post).toContain("-F 'tags=a'");
    expect(post).toContain("-F 'tags=b'");
    expect(post).toContain("-F 'file=@path/to/file'");
    expect(post).not.toContain('Content-Type'); // cURL adds the multipart boundary itself
  });

  it('encodes urlencoded bodies', async () => {
    const login = flat(byName(await requests, 'Log in').curlCommand);
    expect(login).toContain("-d 'username=ann%20lee&password=p%26ss&remember=true'");
  });

  it('maps security schemes to placeholder credentials', async () => {
    const list = await requests;
    expect(flat(byName(list, 'Get a pet').curlCommand)).toContain("-H 'Authorization: Bearer YOUR_BEARER_TOKEN'"); // global
    expect(flat(byName(list, 'Add a pet').curlCommand)).toContain("-H 'X-API-Key: YOUR_API_KEY'"); // first alternative
    expect(flat(byName(list, 'Search pets').curlCommand)).not.toContain('Authorization'); // security: []
    const photo = flat(byName(list, 'Upload a photo').curlCommand);
    expect(photo).toContain("-u 'YOUR_USERNAME:YOUR_PASSWORD'");
    expect(flat(byName(list, 'Log in').curlCommand)).toContain("-b 'sid=YOUR_API_KEY'");
  });

  it('joins non-exploded arrays and uses format examples for query params', async () => {
    const search = flat(byName(await requests, 'Search pets').curlCommand);
    expect(search).toContain('tags=dog%2Csmall');
    expect(search).toContain('since=2024-01-01T00%3A00%3A00Z');
  });

  it('resolves a relative server URL against the default host and keeps a path parameter of 0', () => {
    const list = parseOpenApiSpec(openapiRelative as unknown as OpenApiSpec);
    expect(byName(list, 'Health').url).toBe('https://api.example.com/api/v3/health');
    expect(flat(byName(list, 'Delete item').curlCommand)).toContain("-X DELETE 'https://api.example.com/api/v3/items/0'");
  });
});

describe('Swagger 2 import', () => {
  const list = parseOpenApiSpec(swagger2 as unknown as OpenApiSpec);

  it('builds the base URL from schemes, host and basePath', () => {
    expect(byName(list, 'Search').url).toBe('https://store.acme.test/v1/items/search');
  });

  it('turns a body parameter into a JSON body with the $ref schema expanded', () => {
    const create = flat(byName(list, 'Create item').curlCommand);
    expect(create).toContain("-H 'Content-Type: application/json'");
    expect(JSON.parse(/-d '([\s\S]*)'$/.exec(create)?.[1] ?? '')).toEqual({ name: 'Lamp', price: 19.5, dims: { w: 0, h: 0 } });
    expect(create).toContain("-H 'Authorization: Bearer YOUR_ACCESS_TOKEN'");
  });

  it('turns formData parameters into multipart parts and an apiKey into a query param', () => {
    const upload = flat(byName(list, 'Upload image').curlCommand);
    expect(upload).toContain("-F 'note=front'");
    expect(upload).toContain("-F 'file=@path/to/file'");
    expect(upload).toContain("'https://store.acme.test/v1/items/0/image?api_key=YOUR_API_KEY'");
  });

  it('resolves #/parameters $refs and Swagger 2 defaults', () => {
    expect(flat(byName(list, 'Search').curlCommand)).toContain('?limit=25');
  });
});
