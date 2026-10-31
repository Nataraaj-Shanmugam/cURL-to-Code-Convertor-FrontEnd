export const EXAMPLE_CURLS = [
  {
    label: "GET Request",
    method: "GET",
    curl: `curl -X GET "https://jsonplaceholder.typicode.com/posts/1" -H "Accept: application/json"`,
  },
  {
    label: "POST with JSON Body",
    method: "POST",
    curl: `curl -X POST "https://jsonplaceholder.typicode.com/posts" -H "Content-Type: application/json" -d '{"title": "foo", "body": "bar", "userId": 1}'`,
  },
  {
    label: "With Auth Header",
    method: "GET",
    curl: `curl -X GET "https://api.example.com/users" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.token" -H "Accept: application/json"`,
  },
  {
    label: "PUT Update Resource",
    method: "PUT",
    curl: `curl -X PUT "https://jsonplaceholder.typicode.com/posts/1" -H "Content-Type: application/json" -d '{"id": 1, "title": "updated", "body": "new content", "userId": 1}'`,
  },
  {
    label: "DELETE Request",
    method: "DELETE",
    curl: `curl -X DELETE "https://jsonplaceholder.typicode.com/posts/1" -H "Accept: application/json"`,
  },
  {
    label: "PATCH Partial Update",
    method: "PATCH",
    curl: `curl -X PATCH "https://jsonplaceholder.typicode.com/posts/1" -H "Content-Type: application/json" -d '{"title": "patched title"}'`,
  },
] as const;

/**
 * The one colour map for HTTP methods (see ui/method-badge). Text is the -800 / -300 step on a
 * -100 / -950 tint so every badge clears 4.5:1 in both themes; do not add per-page copies.
 */
export const METHOD_COLORS: Record<string, string> = {
  GET:     "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  POST:    "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  PUT:     "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  PATCH:   "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  DELETE:  "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  HEAD:    "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-300",
  OPTIONS: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

export const METHOD_COLOR_FALLBACK = "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
