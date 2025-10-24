interface Props {
  loading: boolean;
  error: string | null;
  response: string;
}

export default function ResponseViewer({ loading, error, response }: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-3 mt-4">
      <h2 className="text-sm font-semibold text-muted-foreground">Response</h2>
      <div className="min-h-[20vh] w-full rounded-xl border border-input bg-background p-3 text-sm font-mono overflow-auto">
        {loading && <p>⏳ Sending request...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && (
          <pre className="whitespace-pre-wrap break-words">{response}</pre>
        )}
      </div>
    </section>
  );
}
