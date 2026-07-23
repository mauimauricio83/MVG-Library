const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8420;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, "index.html");
  fs.readFile(filePath, (err, data) => {
    if (err && err.code === "EISDIR") {
      filePath = path.join(filePath, "index.html");
      fs.readFile(filePath, (err2, data2) => serveResult(err2, data2));
      return;
    }
    serveResult(err, data);
  });

  function serveResult(err, data) {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  }
}).listen(PORT, () => console.log(`Serving on http://localhost:${PORT}`));
