import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderWithProviders } from '../test-utils';
import BatchCodeGenerationDialog from '@/components/features/curl/BatchCodeGenerationDialog';
import type { BatchItem } from '@/types/batch';
import type { ParsedCurl } from '@/types/curl';

const makeItem = (id: string, endpoint: string, extra: Partial<ParsedCurl> = {}): BatchItem => ({
  id,
  originalCurl: `curl https://api.example.com${endpoint}`,
  parsed: { method: 'GET', base_url: 'https://api.example.com', endpoint, ...extra },
  config: {
    option: 'full',
    className: 'BatchApiTest',
    methodName: `testGet_${id}`,
    assertionRequired: true,
    statusCode: '200',
    loggingRequired: true,
    needPojo: false,
  },
  name: `GET ${endpoint}`,
});

const methodCode = (name: string, path: string) => `import io.restassured.RestAssured;
import static io.restassured.RestAssured.*;
import org.testng.annotations.*;

public class Whatever {
    @Test
    public void ${name}() {
        given()
            .header("Accept", "application/json")
        .when()
            .get("${path}")
        .then()
            .statusCode(200);
    }
}`;

async function generate(items: BatchItem[]) {
  server.use(
    http.post('*/api/generate-from-parsed', async ({ request }) => {
      const body = (await request.json()) as { parsed_data: ParsedCurl; config: { methodName: string } };
      return HttpResponse.json({
        success: true,
        generated_code: methodCode(body.config.methodName, body.parsed_data.endpoint),
      });
    }),
  );
  const user = userEvent.setup();
  renderWithProviders(<BatchCodeGenerationDialog open onOpenChange={vi.fn()} items={items} />);
  await user.click(screen.getByRole('button', { name: 'Generate All' }));
  const code = await screen.findByText(/public class BatchApiTest/);
  return code.textContent ?? '';
}

describe('BatchCodeGenerationDialog relaxed HTTPS', () => {
  it('adds relaxed validation only to the request whose cURL had -k/--insecure', async () => {
    const code = await generate([
      makeItem('1', '/secure'),
      makeItem('2', '/self-signed', { ssl_config: { insecure: true } }),
      makeItem('3', '/also-secure'),
    ]);

    const methods = code.split('@Test').slice(1);
    expect(methods).toHaveLength(3);
    expect(methods[0]).not.toContain('relaxedHTTPSValidation');
    expect(methods[1]).toContain('given().relaxedHTTPSValidation()');
    expect(methods[2]).not.toContain('relaxedHTTPSValidation');
  });

  it('no longer relaxes TLS for the whole class', async () => {
    const code = await generate([makeItem('1', '/a'), makeItem('2', '/b')]);

    expect(code).not.toContain('useRelaxedHTTPSValidation');
    expect(code).not.toContain('relaxedHTTPSValidation');
    expect(code).not.toContain('@BeforeClass');
  });

  it('also honours -k recorded under flags', async () => {
    const code = await generate([makeItem('1', '/a', { flags: { insecure: true } })]);

    expect(code).toContain('given().relaxedHTTPSValidation()');
  });

  it('emits each method once, with the unique default names it was given', async () => {
    const items = [makeItem('1', '/users'), makeItem('2', '/users')];
    items[1]!.config.methodName = 'testGet_users_2';
    items[0]!.config.methodName = 'testGet_users';

    const code = await generate(items);

    expect(code.match(/public void testGet_users\(\)/g)).toHaveLength(1);
    expect(code.match(/public void testGet_users_2\(\)/g)).toHaveLength(1);
  });
});
