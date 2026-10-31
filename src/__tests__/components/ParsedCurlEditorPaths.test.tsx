import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParsedCurlEditor from '@/components/features/curl/ParsedCurlEditor';
import { render } from '../test-utils';
import type { ParsedCurl } from '@/types/curl';

const parsed: ParsedCurl = {
  method: 'POST',
  url: 'https://api.example.com/users?filter.name=bob',
  base_url: 'https://api.example.com',
  endpoint: '/users',
  headers: { Accept: 'application/json' },
  query_params: { 'filter.name': 'bob' },
  data: { tags: ['a', 'b', 'c'], items: [{ sku: 'X1' }] },
};

const lastChange = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)![0] as ParsedCurl;

describe('ParsedCurlEditor field paths', () => {
  it('edits an array item and a field inside an array of objects (QF-2)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ParsedCurlEditor initialData={parsed} onChange={onChange} />);

    await user.click(screen.getAllByRole('button', { name: 'Edit [0]' })[0]!);
    const input = screen.getByLabelText('Value of [0]');
    await user.clear(input);
    await user.type(input, 'ZZZ');
    await user.click(screen.getByRole('button', { name: 'Save [0]' }));

    await user.click(screen.getByRole('button', { name: 'Edit sku' }));
    await user.clear(screen.getByLabelText('Value of sku'));
    await user.type(screen.getByLabelText('Value of sku'), 'S9');
    await user.click(screen.getByRole('button', { name: 'Save sku' }));

    await user.click(screen.getByRole('button', { name: 'Delete [1]' }));

    const data = lastChange(onChange).data as Record<string, unknown>;
    expect(data).toEqual({ tags: ['ZZZ', 'c'], items: [{ sku: 'S9' }] });
  });

  it('edits a query parameter whose name contains a dot (QF-3)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ParsedCurlEditor initialData={parsed} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Edit filter.name' }));
    await user.clear(screen.getByLabelText('Value of filter.name'));
    await user.type(screen.getByLabelText('Value of filter.name'), 'alice');
    await user.click(screen.getByRole('button', { name: 'Save filter.name' }));

    expect(lastChange(onChange).query_params).toMatchObject({ 'filter.name': 'alice' });
  });

  it('offers no Add Entry on Request Details (QF-13)', () => {
    render(<ParsedCurlEditor initialData={parsed} />);
    const header = screen.getByRole('button', { name: /Request Details/ }).closest('h3')!;
    expect(within(header).queryByRole('button', { name: 'Add Entry' })).toBeNull();
  });

  it('asks before replacing a header that differs only by case (QF-23)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ParsedCurlEditor initialData={parsed} onChange={onChange} />);

    const header = screen.getByRole('button', { name: /^Headers/ }).closest('h3')!;
    await user.click(within(header).getByRole('button', { name: 'Add Entry' }));
    const dialog = screen.getByRole('dialog');
    const [keyInput, valueInput] = within(dialog).getAllByRole('textbox');
    await user.type(keyInput!, 'accept');
    await user.type(valueInput!, 'text/plain');
    await user.click(within(dialog).getByRole('button', { name: 'Add Entry' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(/"Accept" already exists/);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Replace' }));
    expect(lastChange(onChange).headers).toEqual({ accept: 'text/plain' });
  });
});
