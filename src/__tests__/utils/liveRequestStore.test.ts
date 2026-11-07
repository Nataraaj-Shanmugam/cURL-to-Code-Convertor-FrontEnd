import { describe, it, expect, beforeEach } from 'vitest';
import {
  LIVE_REQUEST_TTL_MS,
  forgetAllLiveRequests,
  forgetLiveRequest,
  recallLiveRequest,
  rememberLiveRequest,
  touchLiveRequest,
} from '@/lib/utils/liveRequestStore';

beforeEach(() => forgetAllLiveRequests());

describe('liveRequestStore', () => {
  it('remembers and recalls by slot, keeping slots independent and returning the same reference', () => {
    const a = { n: 1 };
    rememberLiveRequest('a', a, 0);
    rememberLiveRequest('b', 'two', 0);
    expect(recallLiveRequest('a', 1)).toBe(a);
    expect(recallLiveRequest('b', 1)).toBe('two');
    expect(recallLiveRequest('missing', 1)).toBeNull();
  });
  it('overwrites a slot and restarts its clock', () => {
    rememberLiveRequest('a', 1, 0);
    rememberLiveRequest('a', 2, LIVE_REQUEST_TTL_MS);
    expect(recallLiveRequest('a', LIVE_REQUEST_TTL_MS + 1)).toBe(2);
  });
  it.each([
    ['just inside the TTL', LIVE_REQUEST_TTL_MS, true],
    ['exactly one ms past', LIVE_REQUEST_TTL_MS + 1, false],
    ['far past', LIVE_REQUEST_TTL_MS * 100, false],
    ['same instant', 0, true],
  ])('expiry boundary: %s', (_n, at, alive) => {
    rememberLiveRequest('a', 'v', 0);
    expect(recallLiveRequest('a', at)).toBe(alive ? 'v' : null);
  });
  it('an expired entry is dropped for good', () => {
    rememberLiveRequest('a', 'v', 0);
    expect(recallLiveRequest('a', LIVE_REQUEST_TTL_MS + 1)).toBeNull();
    expect(recallLiveRequest('a', 0)).toBeNull();
  });
  it('touch restarts the expiry, and is a no-op for an unknown slot', () => {
    rememberLiveRequest('a', 'v', 0);
    touchLiveRequest('a', LIVE_REQUEST_TTL_MS);
    expect(recallLiveRequest('a', LIVE_REQUEST_TTL_MS * 2)).toBe('v');
    expect(() => touchLiveRequest('nope', 5)).not.toThrow();
    expect(recallLiveRequest('nope', 5)).toBeNull();
  });
  it('forget removes one slot, forgetAll removes everything (as a reload would)', () => {
    rememberLiveRequest('a', 1, 0);
    rememberLiveRequest('b', 2, 0);
    forgetLiveRequest('a');
    expect(recallLiveRequest('a', 0)).toBeNull();
    expect(recallLiveRequest('b', 0)).toBe(2);
    forgetAllLiveRequests();
    expect(recallLiveRequest('b', 0)).toBeNull();
    expect(() => forgetLiveRequest('never')).not.toThrow();
  });
  it('stores falsy values as real values', () => {
    rememberLiveRequest('z', 0, 0);
    rememberLiveRequest('e', '', 0);
    expect(recallLiveRequest('z', 0)).toBe(0);
    expect(recallLiveRequest('e', 0)).toBe('');
  });
});
