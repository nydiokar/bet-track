import bcrypt from "bcryptjs";
import { readSecret, normalizePassword } from "./password-utils.js";

const fromArgs = process.argv.slice(2).join(" ");
const rawPassword = fromArgs || (await readSecret("Enter password to hash"));
const password = normalizePassword(rawPassword);

if (!password) {
  console.error("Password cannot be empty");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);