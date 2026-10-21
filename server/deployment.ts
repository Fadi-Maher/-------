import type { Express } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

const DATABASE_HEALTH_TIMEOUT_MS = 3000;

export function assertProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  const required = ["DATABASE_URL", "JWT_SECRET", "VITE_APP_ID", "OAUTH_SERVER_URL", "OWNER_OPEN_ID"];
  const missing = required.filter(name => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production configuration: ${missing.join(", ")}`);
  }
}

async function checkDatabase() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.execute(sql`SELECT 1`);
}

/** The optional probe makes both ready and failure paths testable without real data. */
export function registerDeploymentRoutes(app: Express, probe: () => Promise<void> = checkDatabase) {
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production" &&
      (req.secure || req.headers["x-forwarded-proto"] === "https")) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    }
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
    } else if (req.path === "/" || req.path.endsWith(".html") ||
      req.path.startsWith("/sw") || req.path === "/manifest.webmanifest") {
      res.setHeader("Cache-Control", "no-cache");
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "maalamati-care" });
  });

  app.get("/api/ready", async (_req, res) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        probe(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Database health timeout")), DATABASE_HEALTH_TIMEOUT_MS);
        }),
      ]);
      res.json({ status: "ready", database: "connected" });
    } catch {
      // Never expose database hosts, credentials or internal error text publicly.
      res.status(503).json({ status: "unavailable", database: "unavailable" });
    } finally {
      if (timer) clearTimeout(timer);
    }
  });
}
