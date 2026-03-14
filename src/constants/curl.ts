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

export const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  POST:   "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PUT:    "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
  PATCH:  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};
