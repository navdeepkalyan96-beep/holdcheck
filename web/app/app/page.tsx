"use client";

import { useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SAMPLE_CSV = `underlying,expiry,strike,option_type,lot_size,side,lots,entry_price,ltp,bid,ask,iv_atm,atm_ce_premium,atm_pe_premium,forward,target_net,stop_loss,hours_open,ce_oi_change,pe_oi_change
NIFTY,2026-09-24,24800,CE,25,LONG,2,142.0,108.5,107.0,110.0,0.135,118.0,96.0,24812.0,5000.0,-2500.0,4.5,120000,210000
NIFTY,2026-09-24,24700,PE,25,SHORT,1,88.0,61.0,59.0,62.5,0.135,118.0,96.0,24812.0,3000.0,-6000.0,4.5,120000,210000
`;

type Ticket = {
  instrument: string;
  expiry: string;
  lots: number;
  side: "LONG" | "SHORT";
  entry_price: number;
  gross_pnl: number;
  net_pnl: number;
  no_live_bid_flag?: boolean;
  greeks: { delta: number; gamma: number; theta_per_hour: number; vega_per_vol_point: number };
  theta_per_hour: number;
  hours_open: number | null;
  theta_so_far: number | null;
  expected_move_pts: number;
  plan: { target_net?: number; stop_loss?: number | null; is_inferred?: boolean };
  points_to_target: Record<string, number | null>;
  oi: { bias: string; ce_oi_change: number; pe_oi_change: number; window: string; reason: string };
  state: string;
  state_reason: string;
};

const STATE_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  safe: { label: "SAFE · ON PLAN", color: "#7FC49A", bg: "#12211A", border: "#2C4A3A" },
  on_plan: { label: "SAFE · ON PLAN", color: "#7FC49A", bg: "#12211A", border: "#2C4A3A" },
  at_risk: { label: "AT RISK", color: "#D6A25C", bg: "#241E12", border: "#4A3D26" },
  hope: { label: "AT RISK", color: "#D6A25C", bg: "#241E12", border: "#4A3D26" },
  fear: { label: "AT RISK", color: "#D6A25C", bg: "#241E12", border: "#4A3D26" },
  dead: { label: "DEAD", color: "#C77A6E", bg: "#241614", border: "#4A2E2A" },
};

const IV_LABEL: Record<string, string> = {
  iv_minus_2pct: "IV −2%",
  iv_unchanged: "IV unchanged",
  iv_crush_minus_2: "IV −2 vols",
  iv_plus_2pct: "IV +2%",
};

function rupee(n: number): string {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function pnlColor(n: number) {
  if (n > 0) return "#7FC49A";
  if (n < 0) return "#C77A6E";
  return "#C4C8CD";
}

function normalizeTicket(raw: Record<string, unknown>): Ticket {
  const net = Number(raw.net_pnl ?? raw.net_if_exited_now ?? 0);
  const req = (raw.points_to_target as Record<string, number | null>) ||
    (raw.required_move_pts as Record<string, number | null>) ||
    {};
  const oiRaw = (raw.oi as Ticket["oi"]) || {
    bias: "neutral",
    ce_oi_change: 0,
    pe_oi_change: 0,
    window: "entry strike ±5",
    reason: "OI change not in this file — add ce_oi_change and pe_oi_change.",
  };
  const greeks = (raw.greeks as Ticket["greeks"]) || {
    delta: 0,
    gamma: 0,
    theta_per_hour: Number(raw.theta_per_hour ?? 0),
    vega_per_vol_point: 0,
  };
  const plan = (raw.plan as Ticket["plan"]) || {};
  return {
    instrument: String(raw.instrument ?? ""),
    expiry: String(raw.expiry ?? ""),
    lots: Number(raw.lots ?? 0),
    side: (raw.side === "SHORT" ? "SHORT" : "LONG"),
    entry_price: Number(raw.entry_price ?? 0),
    gross_pnl: Number(raw.gross_pnl ?? net),
    net_pnl: net,
    no_live_bid_flag: Boolean(raw.no_live_bid_flag),
    greeks,
    theta_per_hour: Number(raw.theta_per_hour ?? greeks.theta_per_hour ?? 0),
    hours_open: raw.hours_open == null ? null : Number(raw.hours_open),
    theta_so_far: raw.theta_so_far == null ? null : Number(raw.theta_so_far),
    expected_move_pts: Number(raw.expected_move_pts ?? 0),
    plan,
    points_to_target: req,
    oi: oiRaw,
    state: String(raw.state ?? ""),
    state_reason: String(raw.state_reason ?? ""),
  };
}

function StateChip({ state }: { state: string }) {
  const s = STATE_STYLE[state] ?? { label: state.toUpperCase(), color: "#9AA1AB", bg: "#1A1D20", border: "#2A2E32" };
  return (
    <span
      className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide px-2 py-1 border shrink-0"
      style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}
    >
      {s.label}
    </span>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const [open, setOpen] = useState(false);
  const oiColor =
    ticket.oi.bias === "bullish" ? "#7FC49A" : ticket.oi.bias === "bearish" ? "#C77A6E" : "#D6A25C";
  const points = Object.entries(ticket.points_to_target || {});

  return (
    <div className="border border-white/10 bg-white/[0.03] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[15px]">{ticket.instrument}</span>
            <span className="text-[11px] text-white/45 font-[family-name:var(--font-mono)]">
              {ticket.side} · {ticket.lots}L
            </span>
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">expiry {ticket.expiry}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-[family-name:var(--font-mono)] text-[16px] tabular-nums" style={{ color: pnlColor(ticket.net_pnl) }}>
            {rupee(ticket.net_pnl)}
          </span>
          <StateChip state={ticket.state} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-5 border-t border-white/10 pt-4 space-y-5">
          <p className="text-[13px] text-white/70 leading-relaxed">{ticket.state_reason}.</p>

          <section>
            <h3 className="text-[11px] tracking-wide font-[family-name:var(--font-mono)] text-white/40 mb-1">1 · MONEY TO THETA SO FAR</h3>
            <p className="font-[family-name:var(--font-mono)] text-[16px] tabular-nums" style={{ color: pnlColor(ticket.theta_so_far ?? 0) }}>
              {ticket.theta_so_far == null ? "add hours_open (hours since entry)" : rupee(ticket.theta_so_far)}
            </p>
            <p className="text-[12px] text-white/45 mt-1 leading-relaxed">
              Instantaneous theta {rupee(ticket.theta_per_hour)}/hour
              {ticket.hours_open != null ? ` × ${ticket.hours_open}h open` : ""}.
            </p>
          </section>

          <section>
            <h3 className="text-[11px] tracking-wide font-[family-name:var(--font-mono)] text-white/40 mb-1">2 · NIFTY POINTS TO TARGET</h3>
            <p className="text-[12px] text-white/45 mb-2">
              Target {ticket.plan.target_net != null ? rupee(ticket.plan.target_net) : "—"}
              {ticket.plan.stop_loss != null ? ` · stop ${rupee(ticket.plan.stop_loss)}` : ""}.
              Expected move {ticket.expected_move_pts.toFixed(0)} pts.
            </p>
            {points.length === 0 ? (
              <p className="text-[12px] text-white/45">No solver output — pricing API may be on an older deploy, or expiry has passed.</p>
            ) : (
              <div className="space-y-1 font-[family-name:var(--font-mono)] text-[13px]">
                {points.map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-white/45">{IV_LABEL[k] ?? k.replace(/_/g, " ")}</span>
                    <span className="tabular-nums">
                      {v == null ? "unreachable" : `${v > 0 ? "+" : ""}${Number(v).toFixed(0)} pts`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[11px] tracking-wide font-[family-name:var(--font-mono)] text-white/40 mb-1">
              3 · OI SINCE ENTRY · {(ticket.oi.window || "±5 strikes").toUpperCase()}
            </h3>
            <p className="text-[14px] font-medium" style={{ color: oiColor }}>
              {(ticket.oi.bias || "neutral").toUpperCase()}
            </p>
            <p className="text-[12px] text-white/45 mt-1 leading-relaxed">{ticket.oi.reason}</p>
          </section>

          <section>
            <h3 className="text-[11px] tracking-wide font-[family-name:var(--font-mono)] text-white/40 mb-1">4 · STATE</h3>
            <StateChip state={ticket.state} />
          </section>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [errors, setErrors] = useState<{ row: number; error: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function sendCsv(file: File) {
    setLoading(true);
    setError(null);
    setErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/tickets/csv`, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail || body);
        throw new Error(detail || `Server error (${res.status})`);
      }
      const data = await res.json();
      setTickets((data.tickets || []).map(normalizeTicket));
      setErrors(data.errors || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not process the file.";
      const hint =
        API_URL.includes("localhost")
          ? ` API is ${API_URL}. On Vercel set NEXT_PUBLIC_API_URL to the Railway/Fly pricing URL and redeploy.`
          : "";
      setError(msg + hint);
    } finally {
      setLoading(false);
    }
  }

  const gross = tickets?.reduce((s, t) => s + (t.gross_pnl || 0), 0) ?? 0;
  const net = tickets?.reduce((s, t) => s + (t.net_pnl || 0), 0) ?? 0;

  return (
    <main className="flex-1 flex flex-col items-center px-4 pt-20 pb-12">
      <div className="w-full max-w-[560px]">
        <header className="mb-6">
          <h1 className="font-medium text-[22px] tracking-tight">Open book</h1>
          <p className="text-[13px] text-white/55 mt-2 leading-relaxed">
            Gross is LTP mark. Net is tickwise exit (bid/ask after charges). Use expiry in the future —
            2026-09-04 is already expired, so the engine marks those legs Dead.
          </p>
        </header>

        {tickets && tickets.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
              <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">GROSS PNL</div>
              <div className="font-[family-name:var(--font-mono)] text-[22px] tabular-nums mt-1" style={{ color: pnlColor(gross) }}>
                {rupee(gross)}
              </div>
            </div>
            <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
              <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">NET PNL · TICK</div>
              <div className="font-[family-name:var(--font-mono)] text-[22px] tabular-nums mt-1" style={{ color: pnlColor(net) }}>
                {rupee(net)}
              </div>
            </div>
          </div>
        )}

        <div
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) sendCsv(file);
          }}
          className="border border-dashed border-white/20 hover:border-white/40 rounded-xl cursor-pointer px-4 py-8 text-center transition-colors bg-white/[0.02]"
        >
          <input
            ref={fileInput}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) sendCsv(file);
            }}
          />
          <p className="text-[13px] text-white/80 font-[family-name:var(--font-mono)]">
            {loading ? "computing…" : "drop positions CSV, or tap to choose"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => sendCsv(new File([SAMPLE_CSV], "sample_positions.csv", { type: "text/csv" }))}
          className="mt-3 text-[13px] text-white/70 underline underline-offset-2"
        >
          Run built-in sample (expiry 24 Sep 2026)
        </button>

        {error && (
          <p className="text-[13px] text-[#C77A6E] mt-3 font-[family-name:var(--font-mono)] whitespace-pre-wrap">{error}</p>
        )}
        {errors.length > 0 && (
          <div className="mt-3 text-[12px] text-[#D6A25C] font-[family-name:var(--font-mono)]">
            {errors.map((e) => (
              <div key={e.row}>row {e.row}: {e.error}</div>
            ))}
          </div>
        )}

        {tickets && tickets.length > 0 && (
          <div className="mt-6 space-y-2">
            {tickets.map((t, i) => (
              <TicketCard key={i} ticket={t} />
            ))}
          </div>
        )}

        <footer className="mt-10 pt-6 border-t border-white/10">
          <p className="text-[11px] text-white/35 leading-relaxed">
            Pricing API: {API_URL}. Estimates only — not advice.
          </p>
        </footer>
      </div>
    </main>
  );
}
