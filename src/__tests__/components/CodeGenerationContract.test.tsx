import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { mockPomXml } from '../mocks/handlers';
import { renderWithProviders } from '../test-utils';
import CodeGenerationDialog from '@/components/features/curl/CodeGenerationDialog';
import type { ParsedCurl } from '@/types/curl';

const post: ParsedCurl = {
  method: 'POST',
  url: 'https://api.example.com/users',
  base_url: 'https://api.example.com',
  endpoint: '/users',
  headers: { 'Content-Type': 'application/json' },
  data: { name: 'John' },
};

/** Parent that owns `open`, the way ParsedCurlEditor does: the dialog stays mounted while closed. */
function Harness({ parsed }: { parsed: ParsedCurl }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>reopen</button>
      <CodeGenerationDialog open={open} onOpenChange={setOpen} parsedData={parsed} />
    </>
  );
}

const user = userEvent.setup();
const captured: { body?: { parsed_data: unknown; config: Record<string, unknown> } } = {};

function captureGenerate(extra: Record<string, unknown> = {}) {
  server.use(
    http.post('*/api/generate-from-parsed', async ({ request }) => {
      const body = (await request.json()) as { parsed_data: unknown; config: Record<string, unknown> };
      captured.body = body;
      const config = body.config as { generatePom?: boolean; needPojo?: boolean; pomConfig?: { pomType?: string } };
      return HttpResponse.json({
        success: true,
        generated_code: 'package p;\npublic class ApiTest {}',
        pojo_code: config.needPojo ? 'public class RequestBody {}' : '',
        pomXml: config.generatePom ? mockPomXml(config.pomConfig?.pomType) : undefined,
        ...extra,
      });
    }),
  );
}

const pickFull = () => user.click(screen.getByLabelText(/Full Test Class/));
const generate = () => user.click(screen.getByRole('button', { name: /^Generate Code$/ }));
const openAdvanced = () => user.click(screen.getByRole('button', { name: /Maven & advanced/ }));

beforeEach(() => {
  captured.body = undefined;
});

// Typing into several fields is slow on a loaded machine.
vi.setConfig({ testTimeout: 20_000 });

describe('generate request contract (QR-3)', () => {
  it("posts { parsed_data, config } with production's keys, serviceName and the POJO class name", async () => {
    captureGenerate();
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await user.click(screen.getByRole('checkbox', { name: 'Generate POJO Classes' }));
    await user.clear(screen.getByLabelText(/POJO Class Name/));
    await user.type(screen.getByLabelText(/POJO Class Name/), 'UserRequest');
    await generate();
    await screen.findByText('Generated Code', { exact: true });

    const config = captured.body!.config;
    expect(captured.body!.parsed_data).toEqual(post);
    expect(Object.keys(config).sort()).toEqual(
      [
        'assertResponseTime', 'assertionRequired', 'dataFormat', 'generatePom', 'includeRetry', 'loggingRequired',
        'maxResponseTimeMs', 'methodName', 'needPojo', 'option', 'pojoClassName', 'serviceName', 'statusCode',
        'testDescription', 'testGroups', 'testPriority', 'useFluentApi',
      ].sort(),
    );
    expect(config).toMatchObject({ serviceName: 'ApiTest', pojoClassName: 'UserRequest', needPojo: true, dataFormat: 'json' });
    expect(config).not.toHaveProperty('className');
  });

  it("shows the backend's pomXml rather than a client template", async () => {
    captureGenerate();
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await openAdvanced();
    await user.click(screen.getByRole('checkbox', { name: 'Generate pom.xml' }));
    await user.clear(screen.getByLabelText(/Group ID/));
    await user.type(screen.getByLabelText(/Group ID/), 'org.acme');
    await user.selectOptions(screen.getByLabelText('Java version'), '17');
    await generate();
    await screen.findByText('Generated Code', { exact: true });

    const pomConfig = captured.body!.config.pomConfig as { pomType: string; javaVersion: string; projectInfo: { groupId: string } };
    expect(captured.body!.config.generatePom).toBe(true);
    expect(pomConfig).toMatchObject({ pomType: 'full', javaVersion: '17', projectInfo: { groupId: 'org.acme' } });

    await user.click(screen.getByRole('tab', { name: 'pom.xml' }));
    expect(document.querySelector('pre')?.textContent).toContain('maven-surefire-plugin');
    expect(document.querySelector('pre')?.textContent).not.toContain('org.projectlombok');
  });
});

describe('restored options (QR-2, QR-4, QR-5, T20)', () => {
  it('collapses the Maven & advanced section by default', async () => {
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    expect(screen.getByRole('button', { name: /Maven & advanced/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Java version')).not.toBeInTheDocument();
    await openAdvanced();
    const java = screen.getByRole('checkbox', { name: 'Generate pom.xml' });
    await user.click(java);
    expect(within(screen.getByLabelText('Java version')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Java 8', 'Java 11', 'Java 17', 'Java 21',
    ]);
  });

  it('auto-detects the data format from the request and lets the user override it', async () => {
    captureGenerate();
    const xml: ParsedCurl = { ...post, headers: { 'Content-Type': 'application/xml' }, data: '<user><name>x</name></user>' };
    renderWithProviders(<Harness parsed={xml} />);
    await pickFull();
    await openAdvanced();
    expect(screen.getByText('Auto-detected: XML')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^XML/ })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /JSON \+ XML/ }));
    expect(screen.queryByText(/Auto-detected/)).not.toBeInTheDocument();
    await generate();
    await screen.findByText('Generated Code', { exact: true });
    expect(captured.body!.config.dataFormat).toBe('both');
  });

  it('sends the response time check and test groups', async () => {
    captureGenerate();
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await openAdvanced();
    await user.click(screen.getByRole('checkbox', { name: 'Response time check' }));
    await user.clear(screen.getByLabelText(/Max response time/));
    await user.type(screen.getByLabelText(/Max response time/), '750');
    await user.clear(screen.getByLabelText('Test groups'));
    await user.type(screen.getByLabelText('Test groups'), 'smoke, api');
    await generate();
    await screen.findByText('Generated Code', { exact: true });
    expect(captured.body!.config).toMatchObject({ assertResponseTime: true, maxResponseTimeMs: 750, testGroups: ['smoke', 'api'] });
  });

  it.each(['GET', 'DELETE', 'HEAD'])('disables POJO generation for %s and never sends it', async (method) => {
    captureGenerate();
    renderWithProviders(<Harness parsed={{ ...post, method, data: undefined }} />);
    await pickFull();
    expect(screen.getByRole('checkbox', { name: 'Generate POJO Classes' })).toBeDisabled();
    expect(screen.getByText('Not available for GET/DELETE/HEAD')).toBeInTheDocument();
    await generate();
    await screen.findByText('Generated Code', { exact: true });
    expect(captured.body!.config.needPojo).toBe(false);
  });

  it('keeps POJO generation for POST', async () => {
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    expect(screen.getByRole('checkbox', { name: 'Generate POJO Classes' })).toBeEnabled();
  });

  it('forces a dependencies-only POM for Method-only', async () => {
    captureGenerate();
    renderWithProviders(<Harness parsed={post} />);
    await user.click(screen.getByLabelText(/Test Method Only/));
    await openAdvanced();
    await user.click(screen.getByRole('checkbox', { name: 'Generate pom.xml' }));
    expect(screen.getByLabelText('POM type')).toBeDisabled();
    expect(screen.queryByLabelText(/Group ID/)).not.toBeInTheDocument();
    await generate();
    await screen.findByText('Generated Code', { exact: true });
    expect((captured.body!.config.pomConfig as { pomType: string }).pomType).toBe('dependencies_only');
    expect(screen.getByRole('tab', { name: 'Dependencies (pom.xml)' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'testng.xml' })).not.toBeInTheDocument();
  });

  describe('downloads', () => {
    const downloaded: string[] = [];
    beforeEach(() => {
      downloaded.length = 0;
      URL.createObjectURL = vi.fn(() => 'blob:x');
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloaded.push(this.download);
      });
    });
    afterEach(() => vi.restoreAllMocks());

    it('offers testng.xml with a full POM and Download All saves every file', async () => {
      captureGenerate();
      renderWithProviders(<Harness parsed={post} />);
      await pickFull();
      await user.click(screen.getByRole('checkbox', { name: 'Generate POJO Classes' }));
      await openAdvanced();
      await user.click(screen.getByRole('checkbox', { name: 'Generate pom.xml' }));
      await generate();
      await screen.findByText('Generated Code', { exact: true });

      await user.click(screen.getByRole('tab', { name: 'testng.xml' }));
      expect(document.querySelector('pre')?.textContent).toContain('<class name="p.ApiTest"/>');
      expect(screen.getByText(/runs testng\.xml/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Download All' }));
      await waitFor(() => expect(downloaded).toEqual(['ApiTest.java', 'RequestBody.java', 'pom.xml', 'testng.xml']));
    });

    it('lets a Method-only result be downloaded', async () => {
      captureGenerate({ generated_code: '@Test\npublic void testApiRequest() {}' });
      renderWithProviders(<Harness parsed={post} />);
      await user.click(screen.getByLabelText(/Test Method Only/));
      await generate();
      await screen.findByText('Generated Code', { exact: true });
      await user.click(screen.getByRole('button', { name: 'Download' }));
      expect(downloaded).toEqual(['testApiRequest.java']);
      expect(screen.queryByRole('button', { name: 'Download All' })).not.toBeInTheDocument();
    });
  });
});

describe('validation (QF-9)', () => {
  it('a hidden class name does not block Method-only generation', async () => {
    captureGenerate();
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await user.clear(screen.getByLabelText(/Test Class Name/));
    await user.type(screen.getByLabelText(/Test Class Name/), 'my class');
    expect(screen.getByText(/Must be a valid Java identifier/)).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Test Method Only/));
    expect(screen.queryByText(/Must be a valid Java identifier/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Generate Code$/ })).toBeEnabled();
    await generate();
    await screen.findByText('Generated Code', { exact: true });
  });

  it('a POJO name left invalid with POJO unticked does not block Generate', async () => {
    captureGenerate();
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    const pojo = screen.getByRole('checkbox', { name: 'Generate POJO Classes' });
    await user.click(pojo);
    await user.clear(screen.getByLabelText(/POJO Class Name/));
    await user.type(screen.getByLabelText(/POJO Class Name/), 'bad name!');
    await user.click(pojo);
    await generate();
    await screen.findByText('Generated Code', { exact: true });
  });

  it('shows the error next to the field and opens the collapsed section that holds it', async () => {
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await openAdvanced();
    await user.click(screen.getByRole('checkbox', { name: 'Generate pom.xml' }));
    await user.clear(screen.getByLabelText(/Group ID/));
    await openAdvanced(); // collapse
    expect(screen.queryByLabelText(/Group ID/)).not.toBeInTheDocument();

    await generate();
    const group = await screen.findByLabelText(/Group ID/);
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(group.getAttribute('aria-describedby')!)).toHaveTextContent('Required');
    await waitFor(() => expect(group).toHaveFocus());
    expect(screen.getByText(/Fix the 1 highlighted field/)).toBeInTheDocument();
  });
});

describe('failed generate (QU-7)', () => {
  it('shows the error in the pinned footer, outside the scrolling body, and scrolls it into view', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    server.use(
      http.post('*/api/generate-from-parsed', () =>
        HttpResponse.json({ success: false, error: { code: 'X', message: 'Backend exploded' } }),
      ),
    );
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await generate();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Backend exploded/);
    const generateButton = screen.getByRole('button', { name: /^Generate Code$/ });
    const footer = generateButton.parentElement!.parentElement!;
    expect(footer).toContainElement(alert);
    expect(footer.className).toContain('shrink-0');
    expect(footer.parentElement!.className).toContain('flex-col');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });
});

describe('closing and cancelling', () => {
  /** A generate response the test releases by hand, so timing never depends on machine load. */
  const held = () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let requested!: () => void;
    const arrived = new Promise<void>((r) => (requested = r));
    server.use(
      http.post('*/api/generate-from-parsed', async () => {
        requested();
        await gate;
        return HttpResponse.json({ success: true, generated_code: 'public class Late {}' });
      }),
    );
    return { release, arrived };
  };

  it('ignores a result that arrives after Cancel (QF-10)', async () => {
    const response = held();
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await generate();
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    await response.arrived;
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    response.release();
    await new Promise((r) => setTimeout(r, 200)); // let the late response be processed

    await user.click(screen.getByRole('button', { name: 'reopen' }));
    expect(await screen.findByText('Code Generation Configuration')).toBeInTheDocument();
    expect(screen.queryByText('Generated Code', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Generate Code$/ })).toBeEnabled();
  });

  it('can stop waiting without closing', async () => {
    const response = held();
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await generate();
    await response.arrived;
    await user.click(screen.getByRole('button', { name: 'Stop waiting' }));
    expect(screen.getByRole('button', { name: /^Generate Code$/ })).toBeEnabled();
    response.release();
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByText('Generated Code', { exact: true })).not.toBeInTheDocument();
  });

  it('keeps the result and the config when the dialog is closed with Esc and reopened (QU-24)', async () => {
    captureGenerate();
    renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await user.clear(screen.getByLabelText(/Test Class Name/));
    await user.type(screen.getByLabelText(/Test Class Name/), 'MyTest');
    await generate();
    await screen.findByText('Generated Code', { exact: true });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Generated Code', { exact: true })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'reopen' }));
    expect(await screen.findByText('Generated Code', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Test Code' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back to Config/ }));
    expect(screen.getByLabelText(/Test Class Name/)).toHaveValue('MyTest');
  });

  it('drops a result that no longer matches the request after it is edited', async () => {
    captureGenerate();
    const { rerender } = renderWithProviders(<Harness parsed={post} />);
    await pickFull();
    await generate();
    await screen.findByText('Generated Code', { exact: true });

    rerender(<Harness parsed={{ ...post, endpoint: '/other' }} />);
    expect(await screen.findByText('Code Generation Configuration')).toBeInTheDocument();
    expect(screen.queryByText('Generated Code', { exact: true })).not.toBeInTheDocument();
  });
});
