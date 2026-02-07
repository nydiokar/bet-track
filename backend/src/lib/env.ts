import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");
const backendEnvPath = path.join(backendRoot, ".env");
const cwdEnvPath = path.resolve(process.cwd(), ".env");
const resolvedEnvPath = fs.existsSync(backendEnvPath) ? backendEnvPath : cwdEnvPath;

dotenv.config({ path: resolvedEnvPath, quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().default("file:./data/bet-track.sqlite"),
  PASSWORD_HASH: z.string().min(20),
  JWT_SECRET: z.string().min(12).default("dev-insecure-secret-change-me"),
  JWT_EXPIRY_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  SETTLEMENT_PROVIDER: z.enum(["none", "api_football"]).default("none"),
  SETTLEMENT_POLL_MINUTES: z.coerce.number().int().min(0).default(0),
  API_FOOTBALL_KEY: z.string().optional(),
  API_FOOTBALL_BASE_URL: z.string().url().default("https://v3.football.api-sports.io"),
});

export type AppEnv = z.infer<typeof envSchema>;
export const env: AppEnv = envSchema.parse(process.env);
export const envPath = resolvedEnvPath;

if (env.NODE_ENV === "production") {
  if (env.JWT_SECRET.includes("insecure") || env.JWT_SECRET.length < 24) {
    throw new Error("JWT_SECRET must be a strong secret in production");
  }
}

if (env.SETTLEMENT_PROVIDER === "api_football" && !env.API_FOOTBALL_KEY) {
  throw new Error("API_FOOTBALL_KEY is required when SETTLEMENT_PROVIDER=api_football");
}
