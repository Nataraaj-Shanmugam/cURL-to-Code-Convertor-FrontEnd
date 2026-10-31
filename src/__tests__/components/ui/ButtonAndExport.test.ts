import { describe, it, expect } from 'vitest';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportFileName } from '@/components/features/curl/ExportJsonDialog';

describe('primary button (QR-18)', () => {
  it('keeps its emphasis: semibold with a subtle shadow', () => {
    const cls = cn(buttonVariants({ variant: 'default' })); // as <Button> merges it
    expect(cls).toContain('font-semibold');
    expect(cls).toContain('shadow-sm');
    expect(cls).not.toMatch(/\bfont-medium\b/);
  });

  it('leaves the outline variant at medium weight', () => {
    expect(cn(buttonVariants({ variant: 'outline' }))).toContain('font-medium');
  });
});

describe('export file name (QR-14)', () => {
  it('is timestamped so repeated exports do not collide', () => {
    expect(exportFileName(new Date('2026-01-31T10:15:00.123Z'))).toBe('parsed-curl-2026-01-31T10-15-00.json');
    expect(exportFileName(new Date('2026-01-31T10:15:01Z'))).not.toBe(exportFileName(new Date('2026-01-31T10:15:00Z')));
  });
});
