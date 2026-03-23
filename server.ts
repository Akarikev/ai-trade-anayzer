import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";

import analyzeHandler from "./api/analyze.js";

const app = express();
const PORT = 3000;

// Trust the first proxy to correctly get the client IP
app.set('trust proxy', 1);

app.use(express.json());

// Rate limiting: 5 requests per minute per IP
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many analysis requests. Please try again in a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/analyze", analyzeLimiter, analyzeHandler);

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  import("vite").then(async ({ createServer }) => {
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
