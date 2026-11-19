import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// QU-1: the app's dialogs are controlled <Dialog open> opened from a plain button (no DialogTrigger),
// so Radix had nothing to give focus back to and it fell to <body>.
function Host({ nested = false }: { nested?: boolean }) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Body</DialogDescription>
          </DialogHeader>
          {nested && <Button onClick={() => setInner(true)}>Open inner</Button>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
          <Dialog open={inner} onOpenChange={setInner}>
            <DialogContent>
              <DialogTitle>Inner</DialogTitle>
              <DialogDescription>Inner body</DialogDescription>
              <Button onClick={() => setInner(false)}>Close inner</Button>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe('Dialog focus return', () => {
  it('returns focus to the opening button on Escape', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });
    await user.tab();
    expect(opener).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(opener).not.toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('returns focus to the opening button when a footer button closes it', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(opener);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('a nested dialog returns focus to the button inside the outer dialog', async () => {
    const user = userEvent.setup();
    render(<Host nested />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const innerOpener = await screen.findByRole('button', { name: 'Open inner' });
    await user.click(innerOpener);
    await user.click(await screen.findByRole('button', { name: 'Close inner' }));
    await waitFor(() => expect(innerOpener).toHaveFocus());
  });
});
