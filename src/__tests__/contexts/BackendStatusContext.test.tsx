import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { useEffect } from 'react';
import { server } from '../mocks/server';
import { renderWithProviders } from '../test-utils';
import {
  BackendStatusProvider,
  backendStatusReducer,
  initialBackendStatus,
  useBackendStatus,
  type BackendStatus,
  type BackendStatusContextValue,
  type BackendStatusTiming,
} from '@/contexts/BackendStatusContext';
import BackendStatusChip from '@/components/features/backend/BackendStatusChip';
import CurlPlayground from '@/components/features/curl/CurlPlayground';
import { apiClient } from '@/lib/api/apiClient';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const FAST: Partial<BackendStatusTiming> = {
  slowProbeMs: 1_000,
  wakeBudgetMs: 1_000,
  probeTimeoutMs: 1_000,
  pollBaseDelayMs: 5,
  pollMaxDelayMs: 20,
};

/** Health answers with `respond(callNumber)`; returns the call counter. */
function mockHealth(respond: (call: number) => Response | Promise<Response>) {
  const calls = { count: 0 };
  server.use(
    http.get('*/health', () => {
      calls.count += 1;
      return respond(calls.count);
    }),
  );
  return calls;
}

const unhealthy = () => HttpResponse.text('', { status: 503 });
const healthy = () => HttpResponse.json({ status: 'ok' });

/** Renders the provider with a chip, recording every distinct status it passes through. */
function renderStatus(timing: Partial<BackendStatusTiming> = FAST) {
  const seen: BackendStatus[] = [];
  const ctx: { current?: BackendStatusContextValue } = {};
  function Recorder() {
    const value = useBackendStatus();
    ctx.current = value;
    useEffect(() => {
      if (seen[seen.length - 1] !== value.status) seen.push(value.status);
    }, [value.status]);
    return null;
  }
  const utils = render(
    <BackendStatusProvider timing={timing}>
      <Recorder />
      <BackendStatusChip data-testid="chip" />
    </BackendStatusProvider>,
  );
  const status = () => screen.getByTestId('chip').getAttribute('data-status');
  return { ...utils, seen, ctx, status };
}

describe('backendStatusReducer', () => {
  const at = 1_000;

  it('starts in checking', () => {
    expect(initialBackendStatus).toEqual({ status: 'checking', wakingSince: null });
  });

  it('checking → ready when the first probe answers', () => {
    expect(backendStatusReducer(initialBackendStatus, { type: 'probe-ok' })).toEqual({
      status: 'ready',
      wakingSince: null,
    });
  });

  it('checking → waking on a failed or slow probe, keeping the original start time', () => {
    const waking = backendStatusReducer(initialBackendStatus, { type: 'probe-failed', at });
    expect(waking).toEqual({ status: 'waking', wakingSince: at });
    expect(backendStatusReducer(waking, { type: 'probe-failed', at: at + 5_000 })).toEqual(waking);
    expect(backendStatusReducer(initialBackendStatus, { type: 'slow', at })).toEqual(waking);
  });

  it('waking → ready, waking → unavailable, unavailable → checking on recheck', () => {
    const waking = { status: 'waking' as const, wakingSince: at };
    expect(backendStatusReducer(waking, { type: 'probe-ok' }).status).toBe('ready');
    const down = backendStatusReducer(waking, { type: 'gave-up' });
    expect(down).toEqual({ status: 'unavailable', wakingSince: null });
    expect(backendStatusReducer(down, { type: 'recheck' })).toEqual(initialBackendStatus);
  });

  it('a request that reached the backend marks it ready from any state', () => {
    for (const status of ['checking', 'waking', 'unavailable'] as const) {
      expect(backendStatusReducer({ status, wakingSince: null }, { type: 'signal-up' }).status).toBe('ready');
    }
  });

  it('ignores stale probe results once ready or unavailable', () => {
    const ready = { status: 'ready' as const, wakingSince: null };
    expect(backendStatusReducer(ready, { type: 'probe-failed', at })).toBe(ready);
    expect(backendStatusReducer(ready, { type: 'slow', at })).toBe(ready);
    expect(backendStatusReducer(ready, { type: 'gave-up' })).toBe(ready);
    const unavailable = { status: 'unavailable' as const, wakingSince: null };
    expect(backendStatusReducer(unavailable, { type: 'probe-failed', at })).toBe(unavailable);
  });
});

describe('BackendStatusProvider', () => {
  it('goes straight from checking to ready when the backend is awake', async () => {
    const calls = mockHealth(healthy);
    const { seen, status } = renderStatus();

    await waitFor(() => expect(status()).toBe('ready'));
    expect(seen).toEqual(['checking', 'ready']);
    expect(calls.count).toBe(1);
  });

  it('asleep → waking → ready while the health check keeps failing, then answers', async () => {
    const calls = mockHealth((call) => (call <= 2 ? unhealthy() : healthy()));
    const { seen, status } = renderStatus();

    await waitFor(() => expect(status()).toBe('ready'));
    expect(seen).toEqual(['checking', 'waking', 'ready']);
    expect(calls.count).toBe(3);
  });

  it('shows waking when the first probe is slow (a sleeping backend holding the connection)', async () => {
    mockHealth(async () => {
      await delay(300);
      return healthy();
    });
    const { seen, status } = renderStatus({ ...FAST, slowProbeMs: 20 });

    await waitFor(() => expect(status()).toBe('waking'));
    await waitFor(() => expect(status()).toBe('ready'));
    expect(seen).toEqual(['checking', 'waking', 'ready']);
  });

  it('becomes unavailable when the wake budget runs out, and Retry starts over', async () => {
    let up = false;
    mockHealth(() => (up ? healthy() : HttpResponse.error()));
    const { seen, status } = renderStatus({ ...FAST, wakeBudgetMs: 60 });

    await waitFor(() => expect(status()).toBe('unavailable'));
    expect(screen.getByRole('button', { name: /Generator unavailable. Retry/ })).toBeInTheDocument();

    up = true;
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(status()).toBe('ready'));
    // 'waking' may be batched away when the first failed probe already used up the tiny budget.
    expect(seen.filter((step) => step !== 'waking')).toEqual(['checking', 'unavailable', 'checking', 'ready']);
  });

  it('treats a 4xx from the health path as awake', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockHealth(() => HttpResponse.text('Not Found', { status: 404 }));
    const { status } = renderStatus();

    await waitFor(() => expect(status()).toBe('ready'));
    warn.mockRestore();
  });

  it('a successful request elsewhere marks a waking backend ready', async () => {
    mockHealth(unhealthy);
    const { status } = renderStatus({ ...FAST, wakeBudgetMs: 60_000, pollBaseDelayMs: 5_000 });
    await waitFor(() => expect(status()).toBe('waking'));

    await act(() => apiClient.post('/api/parse', { curl: 'curl https://a.example' }));
    await waitFor(() => expect(status()).toBe('ready'));
  });

  it('re-checks when a request runs out of retries while ready', async () => {
    let up = true;
    mockHealth(() => (up ? healthy() : unhealthy()));
    server.use(http.post('*/api/parse', () => HttpResponse.error()));
    const { status } = renderStatus({ ...FAST, wakeBudgetMs: 60_000 });
    await waitFor(() => expect(status()).toBe('ready'));

    up = false;
    await act(() => apiClient.post('/api/parse', { curl: 'x' }).catch(() => {}));
    await waitFor(() => expect(status()).toBe('waking'));
  });

  describe('waitUntilReady', () => {
    it('resolves once ready, immediately when already ready', async () => {
      mockHealth((call) => (call === 1 ? unhealthy() : healthy()));
      const { ctx, status } = renderStatus();

      const waiting = ctx.current!.waitUntilReady();
      await expect(waiting).resolves.toBeUndefined();
      expect(status()).toBe('ready');
      await expect(ctx.current!.waitUntilReady()).resolves.toBeUndefined();
    });

    it('rejects with a plain message when the backend stays down, and can be aborted', async () => {
      mockHealth(unhealthy);
      const { ctx } = renderStatus({ ...FAST, wakeBudgetMs: 60 });

      await expect(ctx.current!.waitUntilReady()).rejects.toMatchObject({
        message: expect.stringMatching(/didn't wake up/),
        retryable: true,
      });

      const controller = new AbortController();
      const waiting = ctx.current!.waitUntilReady(controller.signal);
      controller.abort();
      await expect(waiting).rejects.toMatchObject({ kind: 'aborted' });
    });
  });
});

describe('CurlPlayground with a sleeping backend', () => {
  beforeEach(() => mockNavigate.mockClear());

  function renderPlayground(timing: Partial<BackendStatusTiming>) {
    return renderWithProviders(
      <BackendStatusProvider timing={timing}>
        <CurlPlayground />
      </BackendStatusProvider>,
    );
  }

  it('holds the parse while the generator wakes up, then sends it', async () => {
    let up = false;
    mockHealth(() => (up ? healthy() : unhealthy()));
    let parseCalls = 0;
    server.use(
      http.post('*/api/parse', () => {
        parseCalls += 1;
        return HttpResponse.json({ success: true, data: { method: 'GET', url: 'https://a.example' } });
      }),
    );
    const user = userEvent.setup();
    renderPlayground({ ...FAST, wakeBudgetMs: 60_000 });

    await user.type(screen.getByRole('textbox'), 'curl https://a.example');
    await user.click(screen.getByRole('button', { name: /Parse cURL/ }));

    const notice = await screen.findByTestId('backend-wait-notice');
    expect(notice).toHaveTextContent('The generator is waking up — usually under a minute');
    expect(screen.getByRole('progressbar', { name: 'Waiting for the generator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Waiting for generator/ })).toBeDisabled();
    expect(parseCalls).toBe(0);

    up = true;
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/editor', expect.anything()));
    expect(parseCalls).toBe(1);
    expect(screen.queryByTestId('backend-wait-notice')).not.toBeInTheDocument();
  });

  it('Cancel stops waiting without sending or showing an error', async () => {
    mockHealth(unhealthy);
    const user = userEvent.setup();
    renderPlayground({ ...FAST, wakeBudgetMs: 60_000 });

    await user.type(screen.getByRole('textbox'), 'curl https://a.example');
    await user.click(screen.getByRole('button', { name: /Parse cURL/ }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByTestId('backend-wait-notice')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Parse cURL/ })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a plain-language error with Retry when the generator stays unavailable', async () => {
    let up = false;
    mockHealth(() => (up ? healthy() : HttpResponse.error()));
    const user = userEvent.setup();
    renderPlayground({ ...FAST, wakeBudgetMs: 60 });

    await user.type(screen.getByRole('textbox'), 'curl https://a.example');
    await user.click(screen.getByRole('button', { name: /Parse cURL/ }));

    expect(await screen.findByText(/The generator didn't wake up/, { selector: 'span' })).toBeInTheDocument();
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/editor', expect.anything()));
  });

  it('offers Retry for a failed request but not for an invalid cURL', async () => {
    mockHealth(healthy);
    const user = userEvent.setup();
    renderPlayground(FAST);

    await user.type(screen.getByRole('textbox'), 'invalid-curl-garbage');
    await user.click(screen.getByRole('button', { name: /Parse cURL/ }));
    expect(await screen.findByText('Invalid cURL command format')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    let calls = 0;
    server.use(
      http.post('*/api/parse', () => {
        calls += 1;
        return calls <= 3
          ? HttpResponse.html('<h1>502 Bad Gateway</h1>', { status: 502 })
          : HttpResponse.json({ success: true, data: { method: 'GET' } });
      }),
    );
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'curl https://a.example');
    await user.click(screen.getByRole('button', { name: /Parse cURL/ }));
    expect(await screen.findByText(/HTTP 502/, { selector: 'span' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/editor', expect.anything()));
  });
});
