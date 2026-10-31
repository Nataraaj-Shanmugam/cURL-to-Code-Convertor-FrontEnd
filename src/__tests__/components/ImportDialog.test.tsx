import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import ImportDialog from '@/components/features/import/ImportDialog';
import { render } from '../test-utils';
import postmanCollection from '../fixtures/postman-collection.json';
import postmanEnvironment from '../fixtures/postman-environment.json';
import postmanNoId from '../fixtures/postman-collection-no-id.json';

function setup() {
  const onImportSingle = vi.fn();
  const onImportMultiple = vi.fn();
  render(<ImportDialog open onOpenChange={vi.fn()} onImportSingle={onImportSingle} onImportMultiple={onImportMultiple} />);
  return { onImportSingle, onImportMultiple };
}

const paste = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText(/Paste your Postman Collection/), { target: { value } });

describe('ImportDialog: Postman variables', () => {
  it('flags unresolved {{variables}} in the dialog, per request and in a summary', async () => {
    setup();
    paste(JSON.stringify(postmanCollection));
    const summary = await screen.findByTestId('unresolved-variables');
    expect(summary).toHaveTextContent('accessToken');
    expect(summary).toHaveTextContent('idempotencyKey');
    expect(summary).toHaveTextContent('sku');
    expect(screen.getAllByText(/unresolved$/).length).toBeGreaterThan(0);
  });

  it('resolves variables from a pasted environment and passes the resolved cURL on import', async () => {
    const { onImportMultiple } = setup();
    paste(JSON.stringify(postmanCollection));
    await screen.findByTestId('unresolved-variables');

    fireEvent.change(screen.getByRole('textbox', { name: /Postman environment/ }), { target: { value: JSON.stringify(postmanEnvironment) } });
    // idempotencyKey is disabled in the environment, so it is still flagged; the others are resolved
    await waitFor(() => expect(screen.getByTestId('unresolved-variables')).not.toHaveTextContent('accessToken'));
    expect(screen.getByTestId('unresolved-variables')).toHaveTextContent('idempotencyKey');
    expect(screen.getByTestId('unresolved-variables')).not.toHaveTextContent('sku');

    fireEvent.click(screen.getByRole('button', { name: /Import Selected/ }));
    expect(onImportMultiple).toHaveBeenCalledTimes(1);
    const curls = onImportMultiple.mock.calls[0]![0] as string[];
    expect(curls.some((c) => c.includes('https://staging.acme.test/v2/orders?status=on%20hold'))).toBe(true);
    expect(curls.some((c) => c.includes('Bearer tok_staging_123'))).toBe(true);
  });

  it('shows an error for an environment that is not valid JSON, and keeps the import', async () => {
    setup();
    paste(JSON.stringify(postmanCollection));
    await screen.findByTestId('unresolved-variables');
    fireEvent.change(screen.getByRole('textbox', { name: /Postman environment/ }), { target: { value: '{nope' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid environment JSON/);
    expect(screen.getByRole('button', { name: /Import Selected \(/ })).toBeEnabled();
  });

  it('imports a collection that has no _postman_id', async () => {
    const { onImportSingle } = setup();
    paste(JSON.stringify(postmanNoId));
    expect(await screen.findByText('Postman Collection')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Import Selected/ }));
    expect(onImportSingle).toHaveBeenCalledWith(expect.stringContaining("'https://ping.test/ping'"));
  });
});
