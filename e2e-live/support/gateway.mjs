/* global process, console */
/**
 * A pass-through gateway in front of the real backend, playing the part of the hosting platform's
 * router (Render puts one in front of the app). Every request is forwarded to the backend untouched.
 *
 * The only addition is the platform's "asleep" behaviour, which a local uvicorn never shows: while
 * asleep, the router answers every request with an HTML 503, exactly as a sleeping Render service
 * does. Tests switch it with POST /__gateway/mode {"mode": "awake" | "asleep"}; only the
 * backend-status project does, and it runs after every other test (see playwright.live.config.ts).
 *
 * Usage: node gateway.mjs <listenPort> <backendPort>
 */
import http from "node:http";

const [listenPort, backendPort] = process.argv.slice(2).map(Number);
let mode = "awake";

const server = http.createServer((req, res) => {
  if (req.url === "/__gateway/mode") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.method === "POST") mode = JSON.parse(body || "{}").mode === "asleep" ? "asleep" : "awake";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ mode }));
    });
    return;
  }

  if (mode === "asleep") {
    // CORS headers are what Render's router sends too, so the browser can read the 503.
    res.writeHead(503, {
      "Content-Type": "text/html",
      "Access-Control-Allow-Origin": req.headers.origin ?? "*",
    });
    res.end("<html><body><h1>503 Service Unavailable</h1></body></html>");
    return;
  }

  const upstream = http.request(
    { host: "127.0.0.1", port: backendPort, method: req.method, path: req.url, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`gateway: backend unreachable (${err.message})`);
  });
  req.pipe(upstream);
});

server.listen(listenPort, "127.0.0.1", () => console.log(`gateway :${listenPort} -> backend :${backendPort}`));
