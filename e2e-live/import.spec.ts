import type { Page } from '@playwright/test';
import { test, expect, curlInput, openSection, SECRETS } from './support/live';

/**
 * Import from Postman / OpenAPI. The import itself runs in the browser; every imported request is
 * then parsed by the real backend, so these tests check that what the importers emit is a cURL the
 * backend understands, and that the right values arrive in the editor.
 */

const POSTMAN_COLLECTION = {
  info: {
    _postman_id: '6b1e2c55-live-e2e',
    name: 'Shop API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'https://api.shop.example.com/v2' },
    { key: 'token', value: SECRETS.bearer },
  ],
  item: [
    {
      name: 'Users',
      item: [
        {
          name: 'List users',
          request: {
            method: 'GET',
            header: [{ key: 'Accept', value: 'application/json' }],
            url: {
              raw: '{{baseUrl}}/users?page=1&size=20',
              host: ['{{baseUrl}}'],
              path: ['users'],
              query: [
                { key: 'page', value: '1' },
                { key: 'size', value: '20' },
              ],
            },
          },
        },
        {
          name: 'Create user',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: {
              mode: 'raw',
              raw: '{\n  "name": "Asha",\n  "roles": ["admin", "qa"],\n  "address": {"city": "Pune"}\n}',
              options: { raw: { language: 'json' } },
            },
            url: '{{baseUrl}}/users',
          },
        },
      ],
    },
    {
      name: 'Orders',
      item: [
        {
          name: 'Get order',
          request: {
            method: 'GET',
            header: [{ key: 'X-Tenant', value: '{{tenantId}}' }],
            url: '{{baseUrl}}/orders/{{orderId}}',
          },
        },
      ],
    },
  ],
};

const POSTMAN_ENV = {
  id: 'env-live-e2e',
  name: 'Staging',
  values: [
    { key: 'tenantId', value: 'tenant-blue', enabled: true },
    { key: 'orderId', value: 'ORD-9001', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

const OPENAPI_YAML = `openapi: 3.0.3
info:
  title: Pet Store (live e2e)
  version: 1.4.0
servers:
  - url: https://{region}.petstore.example.com/api/{version}
    variables:
      region:
        default: eu
        enum: [eu, us]
      version:
        default: v3
paths:
  /pets/{petId}:
    parameters:
      - $ref: '#/components/parameters/PetId'
    get:
      summary: Get pet
      parameters:
        - $ref: '#/components/parameters/Verbose'
      responses:
        '200':
          description: ok
  /pets:
    post:
      summary: Add pet
      security:
        - ApiKeyAuth: []
      requestBody:
        $ref: '#/components/requestBodies/PetBody'
      responses:
        '201':
          description: created
components:
  parameters:
    PetId:
      name: petId
      in: path
      required: true
      schema: { type: integer, example: 42 }
    Verbose:
      name: verbose
      in: query
      schema: { type: boolean, default: true }
  requestBodies:
    PetBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Pet'
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
  schemas:
    Pet:
      type: object
      required: [name]
      properties:
        name: { type: string, example: Bruno }
        age: { type: integer, example: 3 }
        tags:
          type: array
          items: { $ref: '#/components/schemas/Tag' }
        owner:
          $ref: '#/components/schemas/Owner'
    Tag:
      type: object
      properties:
        label: { type: string, example: friendly }
    Owner:
      allOf:
        - type: object
          properties:
            email: { type: string, format: email, example: owner@example.com }
        - type: object
          properties:
            phone: { type: string, example: '+91-80-5555-0100' }
`;

const OPENAPI_SWAGGER2_JSON = JSON.stringify({
  swagger: '2.0',
  info: { title: 'Legacy', version: '1' },
  host: 'legacy.example.com',
  basePath: '/v1',
  schemes: ['https'],
  paths: { '/health': { get: { operationId: 'health', responses: { 200: { description: 'ok' } } } } },
});

async function openImport(page: Page) {
  await page.goto('/playground');
  await expect(page.getByTestId('backend-status-playground')).toHaveAttribute('data-status', 'ready');
  await page.getByRole('button', { name: 'Import' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import from Postman / OpenAPI' });
  await expect(dialog).toBeVisible();
  return dialog;
}

const source = (page: Page) => page.getByPlaceholder('Paste your Postman Collection JSON or OpenAPI YAML/JSON here...');

test.describe('Import: Postman collection v2.1', () => {
  test('[IM-01][IM-05] detection, folders, variables and the environment', async ({ page }) => {
    const dialog = await openImport(page);
    await source(page).fill(JSON.stringify(POSTMAN_COLLECTION, null, 2));

    await expect(dialog.getByText('Postman Collection', { exact: true })).toBeVisible();
    await expect(dialog.getByText('3 requests found')).toBeVisible();
    await expect(dialog.getByText('Users', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Orders', { exact: true })).toBeVisible();
    // Collection variables are resolved in the URLs shown.
    await expect(dialog.getByText('https://api.shop.example.com/v2/users?page=1&size=20')).toBeVisible();
    // Variables nothing defines are flagged.
    await expect(dialog.getByTestId('unresolved-variables')).toContainText('1 of 3 requests still contain unresolved variables');
    await expect(dialog.getByText('2 unresolved')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Import Selected (3)' })).toBeEnabled();

    // An environment resolves them; a broken one is reported.
    const env = dialog.locator('#postman-env');
    await env.fill('{"values": [');
    await expect(dialog.getByText(/environment/i).filter({ hasText: /valid|parse|JSON/i }).first()).toBeVisible();
    await env.fill(JSON.stringify(POSTMAN_ENV));
    await expect(dialog.getByTestId('unresolved-variables')).toHaveCount(0);
    await expect(dialog.getByText('https://api.shop.example.com/v2/orders/ORD-9001')).toBeVisible();
  });

  test('[IM-04][IM-10] select / deselect, and Cancel discards everything', async ({ page }) => {
    const dialog = await openImport(page);
    await source(page).fill(JSON.stringify(POSTMAN_COLLECTION));
    await expect(dialog.getByText('3 selected')).toBeVisible();
    await dialog.getByRole('button', { name: 'Deselect All' }).click();
    await expect(dialog.getByText('No requests selected')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Import Selected (0)' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Select All' }).click();
    await expect(dialog.getByRole('button', { name: 'Import Selected (3)' })).toBeEnabled();
    await dialog.getByRole('checkbox').first().click();
    await expect(dialog.getByRole('button', { name: 'Import Selected (2)' })).toBeEnabled();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(source(page)).toHaveValue('');
    await expect(page.getByRole('dialog').getByText(/requests found/)).toHaveCount(0);
  });

  test('[IM-02][IM-11] importing several requests parses each with the real backend into the batch editor', async ({ page, api }) => {
    const dialog = await openImport(page);
    await source(page).fill(JSON.stringify(POSTMAN_COLLECTION));
    await dialog.locator('#postman-env').fill(JSON.stringify(POSTMAN_ENV));
    await dialog.getByRole('button', { name: 'Import Selected (3)' }).click();

    await expect(page).toHaveURL(/\/batch-editor$/, { timeout: 20_000 });
    const list = page.getByRole('list', { name: 'Requests' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list.getByRole('button', { name: 'GET /v2/users', exact: true })).toBeVisible();
    await expect(list.getByRole('button', { name: 'POST /v2/users', exact: true })).toBeVisible();
    await expect(list.getByRole('button', { name: 'GET /v2/orders/ORD-9001', exact: true })).toBeVisible();

    await api.settle();
    const parsed = api.of('/api/parse').map((c) => c.response as { success: boolean; data: Record<string, unknown> });
    expect(parsed).toHaveLength(3);
    expect(parsed.every((p) => p.success)).toBe(true);
    const create = parsed.find((p) => p.data.method === 'POST')!.data;
    // Collection-level bearer auth was inherited, and the raw JSON body survived the round trip.
    expect((create.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRETS.bearer}`);
    expect(JSON.parse(create.data as string)).toEqual({ name: 'Asha', roles: ['admin', 'qa'], address: { city: 'Pune' } });
    const order = parsed.find((p) => String(p.data.endpoint).includes('ORD-9001'))!.data;
    expect((order.headers as Record<string, string>)['X-Tenant']).toBe('tenant-blue');

    // In the editor the inherited token is masked.
    await list.getByRole('button', { name: 'POST /v2/users', exact: true }).click();
    await expect(page.getByTestId('batch-editor-panel').getByText('Bearer ••••••••').filter({ visible: true }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(SECRETS.bearer);
  });

  test('[IM-03] importing one request fills the Playground; it then parses', async ({ page }) => {
    const dialog = await openImport(page);
    await source(page).fill(JSON.stringify(POSTMAN_COLLECTION));
    await dialog.getByRole('button', { name: 'Deselect All' }).click();
    await dialog.locator('label').filter({ hasText: '/users?page=1' }).getByRole('checkbox').click();
    await dialog.getByRole('button', { name: 'Import Selected (1)' }).click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/playground$/);
    await expect(curlInput(page)).toHaveValue(/^curl \\\s+'https:\/\/api\.shop\.example\.com\/v2\/users\?page=1&size=20' \\\s+-H 'Accept: application\/json'/);
    await page.getByRole('button', { name: 'Parse cURL' }).click();
    await expect(page).toHaveURL(/\/editor$/);
    await openSection(page, /^Query Parameters/);
    await expect(page.getByText('size', { exact: true })).toBeVisible();
  });

  test('[IM-09] a collection can be uploaded as a .json file', async ({ page }) => {
    const dialog = await openImport(page);
    await dialog.getByRole('tab', { name: 'Upload File' }).click();
    await dialog.locator('input[type="file"][accept=".json,.yaml,.yml"]').setInputFiles({
      name: 'shop.postman_collection.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(POSTMAN_COLLECTION)),
    });
    await expect(dialog.getByText('3 requests found')).toBeVisible();
    await expect(dialog.getByText('Postman Collection', { exact: true })).toBeVisible();
  });
});

test.describe('Import: OpenAPI', () => {
  test('[IM-06] OpenAPI 3 YAML: $ref parameters, request bodies, allOf, server variables and apiKey security', async ({ page, api }) => {
    const dialog = await openImport(page);
    await source(page).fill(OPENAPI_YAML);
    await expect(dialog.getByText('OpenAPI Spec', { exact: true })).toBeVisible();
    await expect(dialog.getByText('2 requests found')).toBeVisible();
    await expect(dialog.getByText('https://eu.petstore.example.com/api/v3/pets/{petId}')).toBeVisible();
    await dialog.getByRole('button', { name: 'Import Selected (2)' }).click();

    await expect(page).toHaveURL(/\/batch-editor$/, { timeout: 20_000 });
    const list = page.getByRole('list', { name: 'Requests' });
    await expect(list.getByRole('button', { name: 'GET /api/v3/pets/42', exact: true })).toBeVisible();
    await expect(list.getByRole('button', { name: 'POST /api/v3/pets', exact: true })).toBeVisible();

    await api.settle();
    const parsed = api.of('/api/parse').map((c) => (c.response as { data: Record<string, unknown> }).data);
    const get = parsed.find((p) => p.method === 'GET')!;
    expect(get.query_params).toEqual({ verbose: 'true' });
    const post = parsed.find((p) => p.method === 'POST')!;
    expect((post.headers as Record<string, string>)['X-API-Key']).toBe('YOUR_API_KEY');
    // The example body is built from the $ref'd schema, with allOf merged.
    expect(JSON.parse(post.data as string)).toEqual({
      name: 'Bruno',
      age: 3,
      tags: [{ label: 'friendly' }],
      owner: { email: 'owner@example.com', phone: '+91-80-5555-0100' },
    });
  });

  test('[IM-07] Swagger 2.0 JSON is detected and its host/basePath used', async ({ page }) => {
    const dialog = await openImport(page);
    await source(page).fill(OPENAPI_SWAGGER2_JSON);
    await expect(dialog.getByText('OpenAPI Spec', { exact: true })).toBeVisible();
    await expect(dialog.getByText('https://legacy.example.com/v1/health')).toBeVisible();
    await dialog.getByRole('button', { name: 'Import Selected (1)' }).click();
    await expect(curlInput(page)).toHaveValue(/legacy\.example\.com\/v1\/health/);
  });

  test('[IM-08] input that is neither is reported and cannot be imported', async ({ page }) => {
    const dialog = await openImport(page);
    await source(page).fill('{"hello": "world"}');
    await expect(dialog.getByText('Unknown Format', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Import Selected/ })).toBeDisabled();
    await source(page).fill('not: [valid');
    await expect(dialog.getByRole('button', { name: /Import Selected/ })).toBeDisabled();
    await expect(dialog.getByText(/requests found/)).toHaveCount(0);
  });

  test('[SH-07] Ctrl+Enter inside the Import dialog does not parse the Playground command', async ({ page, api }) => {
    await page.goto('/playground');
    await curlInput(page).fill('curl https://api.example.com/ping');
    await page.getByRole('button', { name: 'Import' }).click();
    await source(page).fill(OPENAPI_SWAGGER2_JSON);
    await source(page).press('Control+Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await api.settle();
    expect(api.of('/api/parse')).toHaveLength(0);
    await expect(page).toHaveURL(/\/playground$/);
  });
});
