import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import ParsedCurlEditor from '@/components/features/curl/ParsedCurlEditor';
import { useParsedCurlEditor } from '@/lib/hooks/useParsedCurlEditor';
import { render } from '../test-utils';
import { mockParsedCurl } from '../mocks/handlers';
import type { ParsedCurl } from '@/types/curl';

const parsed = mockParsedCurl as unknown as ParsedCurl;

describe('a typed but unsaved edit counts as unsaved (QF-22)', () => {
  it('isDirty follows the open editor: unchanged -> clean, typed -> dirty, typed back -> clean', async () => {
    const { result } = renderHook(() => useParsedCurlEditor(parsed));
    await act(async () => { await result.current.toggleEdit(['data', 'name'], 'John Doe'); });
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.handleEditChange(['data', 'name'], 'Typed'));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.handleEditChange(['data', 'name'], 'John Doe'));
    expect(result.current.isDirty).toBe(false);
  });

  it('reports dirty to the owner while a value is typed and not saved', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    render(<ParsedCurlEditor initialData={parsed} onDirtyChange={onDirtyChange} />);
    await user.click(screen.getByRole('button', { name: 'Edit page' }));
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
    await user.type(screen.getByLabelText('Value of page'), '9');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });
});
