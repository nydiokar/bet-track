import { randomUUID } from "node:crypto";

export const newId = () => randomUUID();

export const autoStatus = (matchTime: Date, currentStatus?: string): string => {
  if (currentStatus === "settled") return "settled";
  const now = Date.now();
  const diff = matchTime.getTime() - now;
  if (diff > 0) return "upcoming";
  if (diff > -(3 * 60 * 60 * 1000)) return "live";
  return "finished";
};