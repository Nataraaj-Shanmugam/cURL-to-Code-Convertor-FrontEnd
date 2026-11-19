import { toast } from "sonner";

/**
 * One place for the confirmation toasts, so the wording is the same wherever a copy, download or
 * save happens. Sonner's toaster is a polite live region, so these are also announced (WCAG 4.1.3).
 */
export const NOTIFY_COPIED = "Copied to clipboard";
export const NOTIFY_COPY_FAILED = "Could not copy to clipboard";
export const NOTIFY_SAVED = "Changes saved";

export const notifyCopied = (what?: string) => toast.success(what ? `${what} copied to clipboard` : NOTIFY_COPIED);
export const notifyCopyFailed = () => toast.error(NOTIFY_COPY_FAILED);
export const notifyDownloaded = (fileName: string) => toast.success(`Downloaded ${fileName}`);
export const notifySaved = () => toast.success(NOTIFY_SAVED);

/** Copy text and toast the outcome. Resolves to whether the copy worked. */
export async function copyToClipboard(text: string, what?: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    notifyCopied(what);
    return true;
  } catch {
    notifyCopyFailed();
    return false;
  }
}
