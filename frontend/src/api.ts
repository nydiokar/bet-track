export type Bet = {
  id: string;
  kind?: "single" | "parlay";
  teams: string;
  bet_type: string;
  odds: number;
  stake: number;
  currency: string;
  match_time: string;
  status: "upcoming" | "live" | "finished" | "settled";
  confidence?: "high" | "medium" | "low" | null;
  created_at: string;
  uploaded_by?: string | null;
  result?: "won" | "lost" | "push" | "void" | null;
  actual_return?: number | null;
  notes?: string | null;
  settlement_state?: string;
  legs?: Array<{
    id: string;
    leg_order: number;
    teams: string;
    market_type: string;
    selection: string;
    line?: number | null;
    odds: number;
    event_time: string;
    provider?: string | null;
    provider_event_id?: string | null;
    settlement: string;
  }>;
};

type ApiResponse<T> = T & { success: boolean; error?: string };

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }
  return payload as ApiResponse<T>;
}

export const api = {
  auth: (password: string) => request<{ token: string; expires_in: number }>("/api/auth", { method: "POST", body: JSON.stringify({ password }) }),
  listBets: (token: string, query: string) => request<{ bets: Bet[]; total: number; page: number; pages: number }>(`/api/bets?${query}`, {}, token),
  upload: (token: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return request<{ bet: Bet }>("/api/upload", { method: "POST", body: form }, token);
  },
  createBet: (token: string, data: Record<string, unknown>) =>
    request<{ bet: Bet }>("/api/bets", { method: "POST", body: JSON.stringify(data) }, token),
  updateBet: (token: string, id: string, data: Record<string, unknown>) =>
    request<{ bet: Bet }>(`/api/bets/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
  deleteBet: (token: string, id: string) => request<{ message: string }>(`/api/bets/${id}`, { method: "DELETE" }, token),
};

export const fmtMoney = (value: number | null | undefined, currency = "EUR") => {
  if (value == null) return "-";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
};

export const fmtDate = (iso: string) => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(dt);
};

export const downloadCsv = (bets: Bet[]) => {
  const cols = ["id", "teams", "bet_type", "odds", "stake", "currency", "match_time", "status", "result", "actual_return", "notes", "created_at"] as const;
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[,"\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const b of bets) lines.push(cols.map((c) => esc(b[c])).join(","));

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
