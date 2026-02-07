import "dotenv/config";
import bcrypt from "bcryptjs";
import { readSecret, normalizePassword } from "./password-utils.js";

const fromArgs = process.argv.slice(2).join(" ");
const rawPassword = fromArgs || (await readSecret("Enter password to verify"));
const password = normalizePassword(rawPassword);
const hash = process.env.PASSWORD_HASH;

if (!password) {
  console.error("Password cannot be empty");
  process.exit(1);
}

if (!hash) {
  console.error("PASSWORD_HASH not found in backend/.env");
  process.exit(1);
}

const ok = await bcrypt.compare(password, hash);
console.log(ok ? "MATCH" : "NO_MATCH");