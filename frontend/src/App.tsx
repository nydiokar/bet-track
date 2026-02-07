import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Bet, downloadCsv, fmtDate, fmtMoney } from "./api";

const tokenKey = "bet_track_token";

const editSchema = z.object({
  teams: z.string().min(3),
  bet_type: z.string().min(2),
  odds: z.coerce.number().min(1.01),
  stake: z.coerce.number().positive(),
  currency: z.string().length(3),
  match_time: z.string().min(1),
  notes: z.string().optional(),
  status: z.enum(["upcoming", "live", "finished", "settled"]),
  result: z.enum(["", "won", "lost", "push", "void"]),
  actual_return: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

const toLocalInput = (iso: string) => {
  const dt = new Date(iso);
  const offset = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - offset).toISOString().slice(0, 16);
};

export default function App() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) ?? "");
  const [password, setPassword] = useState("");
  const [filters, setFilters] = useState({ status: "all", search: "", from: "", to: "", sort: "match_time", order: "desc" });
  const [files, setFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<Bet | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.status !== "all") p.set("status", filters.status);
    if (filters.search) p.set("search", filters.search);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    p.set("sort", filters.sort);
    p.set("order", filters.order);
    p.set("limit", "200");
    return p.toString();
  }, [filters]);

  const authMutation = useMutation({
    mutationFn: (pwd: string) => api.auth(pwd),
    onSuccess: (res) => {
      setToken(res.token);
      localStorage.setItem(tokenKey, res.token);
      setPassword("");
      setMessage("");
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const betsQuery = useQuery({
    queryKey: ["bets", query, token],
    queryFn: () => api.listBets(token, query),
    enabled: Boolean(token),
  });

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bets"] });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < files.length; i += 1) {
        setMessage(`Processing ${i + 1}/${files.length}...`);
        await api.upload(token, files[i]);
      }
    },
    onSuccess: async () => {
      setMessage(`Processed ${files.length} screenshot(s)`);
      setFiles([]);
      setShowAddModal(false);
      await invalidate();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditForm) => {
      if (!editing) throw new Error("No bet selected");
      return api.updateBet(token, editing.id, {
        teams: data.teams,
        bet_type: data.bet_type,
        odds: data.odds,
        stake: data.stake,
        currency: data.currency.toUpperCase(),
        match_time: new Date(data.match_time).toISOString(),
        status: data.status,
        result: data.result || null,
        actual_return: data.actual_return ? Number(data.actual_return) : null,
        notes: data.notes || null,
      });
    },
    onSuccess: async () => {
      setMessage("Bet updated");
      setEditing(null);
      await invalidate();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBet(token, id),
    onSuccess: async () => {
      setMessage("Bet deleted");
      setEditing(null);
      await invalidate();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const logout = () => {
    localStorage.removeItem(tokenKey);
    setToken("");
  };

  const bets = betsQuery.data?.bets ?? [];

  const upcoming = useMemo(
    () => bets.filter((b) => b.status === "upcoming" || b.status === "live").slice(0, 6),
    [bets]
  );

  const stats = useMemo(() => {
    let staked = 0;
    let pnl = 0;
    for (const b of bets) {
      staked += b.stake;
      if (b.result === "won") pnl += (b.actual_return ?? b.stake * b.odds) - b.stake;
      if (b.result === "lost") pnl -= b.stake;
    }
    return { staked, pnl };
  }, [bets]);

  const startEdit = (bet: Bet) => {
    setEditing(bet);
    editForm.reset({
      teams: bet.teams,
      bet_type: bet.bet_type,
      odds: bet.odds,
      stake: bet.stake,
      currency: bet.currency,
      match_time: toLocalInput(bet.match_time),
      status: bet.status,
      result: (bet.result as "" | "won" | "lost" | "push" | "void") ?? "",
      actual_return: bet.actual_return?.toString() ?? "",
      notes: bet.notes ?? "",
    });
  };

  if (!token) {
    return (
      <div className="login-shell">
        <form
          className="login-card"
          onSubmit={(e) => {
            e.preventDefault();
            authMutation.mutate(password);
          }}
        >
          <h1>Shared Bet Tracker</h1>
          <p>Fast screenshot capture. Clean event history.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Shared password" required />
          <button type="submit" disabled={authMutation.isPending}>Unlock Dashboard</button>
          {message ? <div className="error">{message}</div> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Shared Bet Tracker</h1>
          <p>{bets.length} bets | Staked {fmtMoney(stats.staked)} | P&L {fmtMoney(stats.pnl)}</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => betsQuery.refetch()}>Refresh</button>
          <button className="ghost" onClick={() => downloadCsv(bets)}>Export</button>
          <button onClick={() => setShowAddModal(true)}>Add Screenshot</button>
          <button className="ghost" onClick={logout}>Logout</button>
        </div>
      </header>

      <section className="compact-filters">
        <input
          className="search"
          placeholder="Search team..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="all">All Status</option>
          <option value="upcoming">Upcoming</option>
          <option value="live">Live</option>
          <option value="finished">Finished</option>
          <option value="settled">Settled</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
          <option value="match_time">Match Time</option>
          <option value="created_at">Created</option>
          <option value="stake">Stake</option>
          <option value="odds">Odds</option>
        </select>
        <select value={filters.order} onChange={(e) => setFilters((f) => ({ ...f, order: e.target.value }))}>
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </section>

      {message ? <div className="toast">{message}</div> : null}

      {upcoming.length > 0 ? (
        <section className="upcoming-strip">
          {upcoming.map((bet) => (
            <article key={bet.id} className={`mini-card status-${bet.status}`}>
              <div className="mini-title">{bet.teams}</div>
              <div className="mini-meta">{bet.bet_type} @ {bet.odds}</div>
              <div className="mini-meta">{fmtDate(bet.match_time)}</div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="table-panel">
        <div className="table-head">
          <h2>Bet History</h2>
          <span>{bets.length} rows</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Match Time</th>
                <th>Event</th>
                <th>Bet</th>
                <th>Type</th>
                <th>Odds</th>
                <th>Stake</th>
                <th>Status</th>
                <th>Result</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {betsQuery.isLoading ? (
                <tr><td colSpan={10} className="empty">Loading...</td></tr>
              ) : null}
              {!betsQuery.isLoading && bets.length === 0 ? (
                <tr><td colSpan={10} className="empty">No bets found</td></tr>
              ) : null}
              {bets.map((bet) => (
                <tr key={bet.id}>
                  <td>{fmtDate(bet.match_time)}</td>
                  <td>{bet.teams}</td>
                  <td>{bet.bet_type}</td>
                  <td>{bet.kind === "parlay" ? `Parlay (${bet.legs?.length ?? 0})` : "Single"}</td>
                  <td>{bet.odds}</td>
                  <td>{fmtMoney(bet.stake, bet.currency)}</td>
                  <td><span className={`pill ${bet.status}`}>{bet.status}</span></td>
                  <td>{bet.result ?? "pending"}</td>
                  <td className="notes-cell">{bet.notes ?? "-"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="ghost tiny" onClick={() => startEdit(bet)}>Edit</button>
                      <button
                        className="danger tiny"
                        onClick={() => {
                          if (window.confirm("Delete this bet?")) deleteMutation.mutate(bet.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAddModal ? (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Add Bets</h2>
              <button className="ghost" onClick={() => setShowAddModal(false)}>Close</button>
            </div>
            <div className="upload-box">
              <input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              <button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending || files.length === 0}>
                {uploadMutation.isPending ? "Processing..." : `Upload ${files.length || ""}`}
              </button>
              <div className="muted">Upload screenshots only. Singles and parlays are extracted automatically.</div>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit Bet</h2>
              <button className="ghost" onClick={() => setEditing(null)}>Close</button>
            </div>
            <form className="manual-form" onSubmit={editForm.handleSubmit((v) => updateMutation.mutate(v))}>
              <input {...editForm.register("teams")} />
              <input {...editForm.register("bet_type")} />
              <input type="number" step="0.01" {...editForm.register("odds")} />
              <input type="number" step="0.01" {...editForm.register("stake")} />
              <input maxLength={3} {...editForm.register("currency")} />
              <input type="datetime-local" {...editForm.register("match_time")} />
              <select {...editForm.register("status")}>
                <option value="upcoming">upcoming</option>
                <option value="live">live</option>
                <option value="finished">finished</option>
                <option value="settled">settled</option>
              </select>
              <select {...editForm.register("result")}>
                <option value="">pending</option>
                <option value="won">won</option>
                <option value="lost">lost</option>
                <option value="push">push</option>
                <option value="void">void</option>
              </select>
              <input placeholder="Actual return" {...editForm.register("actual_return")} />
              <input placeholder="Notes" {...editForm.register("notes")} />
              <button type="submit" disabled={updateMutation.isPending}>Save Changes</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
