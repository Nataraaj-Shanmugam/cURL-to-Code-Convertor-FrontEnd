/**
 * File Operations Utility
 * Handles file downloads, clipboard operations, and file exports
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DownloadOptions {
  filename: string;
  content: string;
  mimeType?: string;
}

export interface CopyOptions {
  content: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export enum FileType {
  JAVA = 'java',
  XML = 'xml',
  JSON = 'json',
  TEXT = 'text',
}

// ============================================================================
// MIME TYPE MAPPING
// ============================================================================

const MIME_TYPES: Record<FileType, string> = {
  [FileType.JAVA]: 'text/x-java-source',
  [FileType.XML]: 'application/xml',
  [FileType.JSON]: 'application/json',
  [FileType.TEXT]: 'text/plain',
};

// ============================================================================
// FILE DOWNLOAD FUNCTIONS
// ============================================================================

/**
 * Downloads content as a file
 * @param options Download configuration
 * @throws Error if download fails
 */
export function downloadFile(options: DownloadOptions): void {
  const { filename, content, mimeType = MIME_TYPES[FileType.TEXT] } = options;

  try {
    // Create blob from content
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Create temporary anchor element
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    // Trigger download
    document.body.appendChild(anchor);
    anchor.click();

    // Cleanup
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(
      `Failed to download file "${filename}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Downloads a Java file
 */
export function downloadJavaFile(className: string, content: string): void {
  downloadFile({
    filename: `${className}.java`,
    content,
    mimeType: MIME_TYPES[FileType.JAVA],
  });
}

/**
 * Downloads an XML file
 */
export function downloadXmlFile(filename: string, content: string): void {
  downloadFile({
    filename: filename.endsWith('.xml') ? filename : `${filename}.xml`,
    content,
    mimeType: MIME_TYPES[FileType.XML],
  });
}

/**
 * Downloads a JSON file
 */
export function downloadJsonFile(filename: string, data: any): void {
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  downloadFile({
    filename: filename.endsWith('.json') ? filename : `${filename}.json`,
    content,
    mimeType: MIME_TYPES[FileType.JSON],
  });
}

// ============================================================================
// CLIPBOARD OPERATIONS
// ============================================================================

/**
 * Copies text to clipboard using modern Clipboard API
 * @param options Copy configuration
 * @returns Promise that resolves when copy is successful
 */
export async function copyToClipboard(options: CopyOptions): Promise<void> {
  const { content, onSuccess, onError } = options;

  try {
    // Check if Clipboard API is available
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not available');
    }

    await navigator.clipboard.writeText(content);
    onSuccess?.();
  } catch (error) {
    const copyError = error instanceof Error 
      ? error 
      : new Error('Failed to copy to clipboard');
    
    onError?.(copyError);
    throw copyError;
  }
}

/**
 * Fallback copy method for older browsers
 * @deprecated Use copyToClipboard instead
 */
export function copyToClipboardLegacy(content: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    
    document.body.appendChild(textarea);
    textarea.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    return success;
  } catch (error) {
    console.error('Legacy copy failed:', error);
    return false;
  }
}

// ============================================================================
// FILE VALIDATION
// ============================================================================

/**
 * Validates filename (removes invalid characters)
 */
export function sanitizeFilename(filename: string): string {
  // Remove invalid characters for cross-platform compatibility
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/^\.+/, '_') // No leading dots
    .replace(/\.+$/, '_') // No trailing dots
    .trim();
}

/**
 * Ensures filename has correct extension
 */
export function ensureExtension(filename: string, extension: string): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return filename.endsWith(ext) ? filename : `${filename}${ext}`;
}

/**
 * Validates file content is not empty
 */
export function validateContent(content: string): boolean {
  return content.trim().length > 0;
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

export interface BatchDownload {
  filename: string;
  content: string;
  type?: FileType;
}

/**
 * Downloads multiple files sequentially
 * @param files Array of files to download
 * @param delayMs Delay between downloads (default: 100ms)
 */
export async function downloadMultipleFiles(
  files: BatchDownload[],
  delayMs: number = 100
): Promise<void> {
  for (const file of files) {
    const mimeType = file.type ? MIME_TYPES[file.type] : MIME_TYPES[FileType.TEXT];
    
    downloadFile({
      filename: file.filename,
      content: file.content,
      mimeType,
    });

    // Small delay to prevent browser blocking multiple downloads
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot + 1) : '';
}

/**
 * Gets filename without extension
 */
export function getFilenameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Estimates content size
 */
export function getContentSize(content: string): number {
  return new Blob([content]).size;
}

// ============================================================================
// BROWSER COMPATIBILITY
// ============================================================================

/**
 * Checks if Clipboard API is supported
 */
export function isClipboardSupported(): boolean {
  return !!(navigator.clipboard && navigator.clipboard.writeText);
}

/**
 * Checks if download is supported
 */
export function isDownloadSupported(): boolean {
  const a = document.createElement('a');
  return 'download' in a;
}