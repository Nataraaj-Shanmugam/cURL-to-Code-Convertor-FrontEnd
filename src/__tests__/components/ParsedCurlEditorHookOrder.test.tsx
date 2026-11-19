import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import ParsedCurlEditor from '@/components/features/curl/ParsedCurlEditor';
import { render } from '../test-utils';
import { mockParsedCurl } from '../mocks/handlers';
import type { ParsedCurl } from '@/types/curl';

// The real hook only changes `parsed` through internal state, so let a test swap
// the value between renders to exercise the empty <-> filled transition.
// `undefined` means "use the real value".
const forced = vi.hoisted(() => ({ parsed: undefined as unknown }));

vi.mock('@/lib/hooks/useParsedCurlEditor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/useParsedCurlEditor')>();
  return {
    ...actual,
    useParsedCurlEditor: (...args: Parameters<typeof actual.useParsedCurlEditor>) => {
      const state = actual.useParsedCurlEditor(...args);
      return forced.parsed === undefined ? state : { ...state, parsed: forced.parsed as ParsedCurl };
    },
  };
});

// ParsedCurlEditor is wrapped in React.memo, so each rerender passes a different
// `originalCurl` to force a real re-render.
describe('ParsedCurlEditor hook order (rules-of-hooks)', () => {
  const initialData = mockParsedCurl as unknown as ParsedCurl;

  it.each([
    ['an empty object', {}],
    ['a missing value', null],
  ])('survives parsed going filled -> %s -> filled', (_label, emptyValue) => {
    forced.parsed = undefined;
    const { rerender } = render(<ParsedCurlEditor initialData={initialData} originalCurl="curl 1" />);
    expect(screen.getByText('Edit Parsed Request')).toBeInTheDocument();

    forced.parsed = emptyValue;
    rerender(<ParsedCurlEditor initialData={initialData} originalCurl="curl 2" />);
    expect(screen.getByText(/No parsed data available/i)).toBeInTheDocument();

    forced.parsed = undefined;
    rerender(<ParsedCurlEditor initialData={initialData} originalCurl="curl 3" />);
    expect(screen.getByText('Edit Parsed Request')).toBeInTheDocument();
  });

  it('survives parsed going empty -> filled', () => {
    forced.parsed = {};
    const { rerender } = render(<ParsedCurlEditor initialData={initialData} originalCurl="curl 1" />);
    expect(screen.getByText(/No parsed data available/i)).toBeInTheDocument();

    forced.parsed = undefined;
    rerender(<ParsedCurlEditor initialData={initialData} originalCurl="curl 2" />);
    expect(screen.getByText('Edit Parsed Request')).toBeInTheDocument();
  });
});
