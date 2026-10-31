/**
 * Guards for window-level keyboard shortcuts. A page shortcut must not fire behind an open modal,
 * and a shortcut that has a native text-editing meaning (Ctrl+Z / Ctrl+Y) must leave text fields
 * alone.
 */

const MODAL_SELECTOR = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [aria-modal="true"]';

/** True while a modal dialog is open anywhere on the page. */
export const isModalOpen = (doc: Document = document): boolean => doc.querySelector(MODAL_SELECTOR) !== null;

/** True when the event target is inside a dialog (open or closing). */
export const isInsideDialog = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]') !== null;

const NON_TEXT_INPUT_TYPES = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "image", "range", "color"]);

/** True when the event target is a field where the user types text. */
export const isTextEntryTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return target.closest('[contenteditable=""], [contenteditable="true"]') !== null;
};

/** A page-level shortcut should be ignored: a modal is open or the key came from inside one. */
export const isBlockedByModal = (e: KeyboardEvent): boolean => isModalOpen() || isInsideDialog(e.target);
