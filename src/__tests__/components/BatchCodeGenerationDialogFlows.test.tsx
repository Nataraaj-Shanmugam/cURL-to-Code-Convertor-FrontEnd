import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderWithProviders } from '../test-utils';
import BatchCodeGenerationDialog from '@/components/features/curl/BatchCodeGenerationDialog';
import type { BatchItem } from '@/types/batch';
import type { ParsedCurl } from '@/types/curl';

const makeItem = (id: string, method: string, endpoint: string, extra: Partial<ParsedCurl> = {}): BatchItem => ({
  id,
  originalCurl: `curl -X ${method} https://api.example.com${endpoint}`,
  parsed: { method, base_url: 'https://api.example.com', endpoint, ...extra },
  config: {
    option: 'full',
    className: 'BatchApiTest',
    methodName: 'stale',
    assertionRequired: true,
    statusCode: '200',
    loggingRequired: true,
    needPojo: false,
  },
  name: `${method} ${endpoint}`,
});

interface GenerateBody {
  parsed_data: ParsedCurl;
  config: { className: string; methodName: string; statusCode: string };
}

const codeFor = (b: GenerateBody) => `import io.restassured.RestAssured;
import org.testng.annotations.*;

public class Whatever {
    @Test
    public void ${b.config.methodName}() {
        given().header("Authorization", "Bearer abc123tokenvalue").when().get("/x").then().statusCode(${b.config.statusCode});
    }
}`;

/** Records every generate request and answers with `reply(body)`. */
function mockGenerate(reply: (b: GenerateBody) => Response | Promise<Response> = (b) =>
  HttpResponse.json({ success: true, generated_code: codeFor(b) })) {
  const bodies: GenerateBody[] = [];
  server.use(
    http.post('*/api/generate-from-parsed', async ({ request }) => {
      const body = (await request.json()) as GenerateBody;
      bodies.push(body);
      return reply(body);
    }),
  );
  return bodies;
}

const open = (items: BatchItem[]) =>
  renderWithProviders(<BatchCodeGenerationDialog open onOpenChange={vi.fn()} items={items} />);

const generateBtn = () => screen.getByRole('button', { name: 'Generate All' });
const methodInput = (name: string) => screen.getByRole('textbox', { name: `Method name for ${name}` });

const ITEMS = () => [makeItem('1', 'GET', '/users'), makeItem('2', 'POST', '/users')];

describe('BatchCodeGenerationDialog validation (QF-7, QS-8)', () => {
  it('rejects an empty method name, a name with spaces and duplicates, and a bad class name', async () => {
    const user = userEvent.setup();
    const bodies = mockGenerate();
    open(ITEMS());
    expect(generateBtn()).toBeEnabled();

    await user.clear(methodInput('GET /users'));
    expect(generateBtn()).toBeDisabled();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(methodInput('GET /users')).toHaveAttribute('aria-invalid', 'true');

    await user.type(methodInput('GET /users'), 'same name');
    expect(screen.getByText(/valid Java identifier/)).toBeInTheDocument();
    expect(generateBtn()).toBeDisabled();

    await user.clear(methodInput('GET /users'));
    await user.type(methodInput('GET /users'), 'dup');
    await user.clear(methodInput('POST /users'));
    await user.type(methodInput('POST /users'), 'dup');
    expect(screen.getByText('Already used by another request')).toBeInTheDocument();
    expect(generateBtn()).toBeDisabled();

    await user.clear(methodInput('POST /users'));
    await user.type(methodInput('POST /users'), 'other');
    expect(generateBtn()).toBeEnabled();

    const className = screen.getByLabelText('Test Class Name');
    await user.clear(className);
    await user.type(className, 'My Test Class');
    expect(generateBtn()).toBeDisabled();
    await user.click(generateBtn());
    expect(bodies).toHaveLength(0);

    await user.clear(className);
    await user.type(className, 'MyTestClass');
    await user.click(generateBtn());
    expect(await screen.findByText(/public class MyTestClass/)).toBeInTheDocument();
    expect(bodies.map((b) => b.config.methodName)).toEqual(['dup', 'other']);
  });
});

describe('BatchCodeGenerationDialog suggested names (QF-21)', () => {
  it('derives method names from the current method and endpoint, uniquely', () => {
    const edited = makeItem('1', 'PUT', '/v2/people');
    edited.config.methodName = 'testGet_users'; // what the item was seeded with before it was edited
    open([edited, makeItem('2', 'PUT', '/v2/people')]);

    const inputs = screen.getAllByRole('textbox', { name: /Method name for/ });
    expect(inputs.map((i) => (i as HTMLInputElement).value)).toEqual(['testPut_v2_people', 'testPut_v2_people_2']);
  });
});

describe('BatchCodeGenerationDialog failures (QF-8)', () => {
  it('shows an error and stays on the config step when every request fails', async () => {
    const user = userEvent.setup();
    mockGenerate(() => HttpResponse.json({ success: false, error: { message: 'boom' } }));
    open(ITEMS());

    await user.click(generateBtn());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Code generation failed for all 2 requests');
    expect(alert).toHaveTextContent('GET /users: boom');
    expect(alert).toHaveTextContent('POST /users: boom');
    expect(screen.queryByText('Generated Batch Code')).not.toBeInTheDocument();
    expect(generateBtn()).toBeEnabled(); // can be retried
  });

  it('also treats network/server errors as failures', async () => {
    const user = userEvent.setup();
    mockGenerate(() => new HttpResponse(null, { status: 500 }));
    open(ITEMS());

    await user.click(generateBtn());

    expect(await screen.findByRole('alert')).toHaveTextContent('Code generation failed for all 2 requests');
  });

  it('warns on the result step, naming the requests that failed, when only some fail', async () => {
    const user = userEvent.setup();
    mockGenerate((b) =>
      b.parsed_data.method === 'POST'
        ? HttpResponse.json({ success: false, error: 'bad body' })
        : HttpResponse.json({ success: true, generated_code: codeFor(b) }),
    );
    open(ITEMS());

    await user.click(generateBtn());

    expect(await screen.findByText('Generated Batch Code')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('1 of 2 requests');
    expect(alert).toHaveTextContent('POST /users: bad body');
  });

  it('shows no warning when everything succeeds', async () => {
    const user = userEvent.setup();
    mockGenerate();
    open(ITEMS());

    await user.click(generateBtn());

    await screen.findByText('Generated Batch Code');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
