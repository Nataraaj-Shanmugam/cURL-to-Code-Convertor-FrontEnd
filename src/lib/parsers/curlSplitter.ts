/**
 * Splits a block of text containing multiple cURL commands into individual commands.
 * Commands are separated by:
 * - A blank line (two consecutive newlines)
 * - A line containing only "---"
 * Line continuations (trailing \) are joined before splitting.
 */
export function splitCurlCommands(text: string): string[] {
  // Normalize CRLF
  const normalized = text.replace(/\r\n/g, "\n");

  // Split by blank lines or --- separator
  const chunks = normalized.split(/\n\s*\n|\n---\s*\n/);

  return chunks
    .map((chunk) => {
      // Join line continuations: line ending with \ (optionally followed by spaces)
      return chunk.replace(/\\\s*\n\s*/g, " ").trim();
    })
    .filter(
      (chunk) => chunk.startsWith("curl ") || chunk.startsWith("curl\t")
    );
}
