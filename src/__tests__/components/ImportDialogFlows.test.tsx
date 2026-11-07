import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportDialog from '@/components/features/import/ImportDialog';
import { render } from '../test-utils';
import postmanCollection from '../fixtures/postman-collection.json';
import postmanEnvironment from '../fixtures/postman-environment.json';
import postmanNoId from '../fixtures/postman-collection-no-id.json';

function setup() {
  const fns = { onOpenChange: vi.fn(), onImportSingle: vi.fn(), onImportMultiple: vi.fn() };
  render(<ImportDialog open {...fns} />);
  return fns;
}
const paste = (value: string) => fireEvent.change(screen.getByPlaceholderText(/Paste your Postman Collection/), { target: { value } });
const fileOf = (text: string, name = 'f.json', size?: number) => {
  const f = new File([text], name, { type: 'application/json' });
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('ImportDialog: selection and closing', () => {
  it('select all / deselect all and per-request toggling drive the count and the import button', async () => {
    const { onImportMultiple } = setup();
    paste(JSON.stringify(postmanCollection));
    await screen.findByTestId('unresolved-variables');
    const checkboxes = screen.getAllByRole('checkbox');
    const total = checkboxes.length;
    expect(total).toBeGreaterThan(1);
    expect(screen.getByText(`${total} selected`)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Deselect All/ }));
    expect(screen.getByText('No requests selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import Selected \(0\)/ })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /Select All/ }));
    expect(screen.getByText(`${total} selected`)).toBeInTheDocument();

    await userEvent.click(checkboxes[0]!);
    expect(screen.getByText(`${total - 1} selected`)).toBeInTheDocument();
    await userEvent.click(checkboxes[0]!);
    expect(screen.getByText(`${total} selected`)).toBeInTheDocument();

    await userEvent.click(checkboxes[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Import Selected/ }));
    expect(onImportMultiple.mock.calls[0]![0]).toHaveLength(total - 1);
  });

  it('a single selected request goes to onImportSingle as a string and closes the dialog', async () => {
    const { onImportSingle, onImportMultiple, onOpenChange } = setup();
    paste(JSON.stringify(postmanNoId));
    await screen.findByText('Postman Collection');
    fireEvent.click(screen.getByRole('button', { name: /Import Selected \(1\)/ }));
    expect(onImportMultiple).not.toHaveBeenCalled();
    expect(onImportSingle).toHaveBeenCalledTimes(1);
    expect(typeof onImportSingle.mock.calls[0]![0]).toBe('string');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Cancel closes without importing and a closed dialog starts empty next time', async () => {
    const { onImportSingle, onImportMultiple, onOpenChange } = setup();
    paste(JSON.stringify(postmanNoId));
    await screen.findByText('Postman Collection');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onImportSingle).not.toHaveBeenCalled();
    expect(onImportMultiple).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/Paste your Postman Collection/)).toHaveValue('');
  });

  it('Escape (onOpenChange) also resets the dialog', async () => {
    const { onOpenChange } = setup();
    paste('not a spec at all: [');
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalled();
  });
});

describe('ImportDialog: input errors and files', () => {
  it('shows the parser error for undetectable input and imports nothing', async () => {
    setup();
    paste('{"hello":"world"}');
    expect(await screen.findByText(/Could not detect format/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Select All|Deselect All/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Import Selected \(0\)/ })).toBeDisabled();
  });

  it('shows a JSON syntax error for broken JSON', async () => {
    setup();
    paste('{"a":');
    expect(await screen.findByText(/Invalid JSON/)).toBeInTheDocument();
  });

  it('an environment file resolves variables; an oversized one is rejected', async () => {
    setup();
    paste(JSON.stringify(postmanCollection));
    await screen.findByTestId('unresolved-variables');
    const input = screen.getByLabelText('Choose environment file') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [fileOf(JSON.stringify(postmanEnvironment), 'env.json')] } });
    await waitFor(() => expect(screen.getByTestId('unresolved-variables')).not.toHaveTextContent('accessToken'));

    fireEvent.change(input, { target: { files: [fileOf('{}', 'big.json', 6 * 1024 * 1024)] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('File is too large (max 5 MB).');

    fireEvent.change(input, { target: { files: [] } });
    expect(screen.getByRole('alert')).toHaveTextContent('File is too large');
  });

  it('an environment problem keeps the request list; fixing it clears the alert', async () => {
    setup();
    paste(JSON.stringify(postmanCollection));
    await screen.findByTestId('unresolved-variables');
    const env = screen.getByRole('textbox', { name: /Postman environment/ });
    fireEvent.change(env, { target: { value: '{"name":"x"}' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Not a Postman environment/);
    fireEvent.change(env, { target: { value: JSON.stringify(postmanEnvironment) } });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
