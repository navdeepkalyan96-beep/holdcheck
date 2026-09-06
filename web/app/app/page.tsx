"use client";

import { useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ChargeBreakdown = {
  brokerage: number;
  exchange_txn: number;
  sebi_fee: number;
  stt: number;
  stamp: number;
  gst: number;
  total: number;
};

type Ticket = {
  instrument: string;
  expiry: string;
  lots: number;
  side: "LONG" | "SHORT";
  entry_price: number;
  gross_pnl: number;
  net_pnl: number;
  exit_charges: ChargeBreakdown;
  no_live_bid_flag: boolean;
  greeks: { delta: number; gamma: number; theta_per_hour: number; vega_per_vol_point: number };
  theta_per_hour: number;
  hours_open: number | null;
  theta_so_far: number | null;
  expected_move_pts: number;
  time_to_worthless_min: number | null;
  low_confidence: boolean;
  plan: { target_net?: number; stop_loss?: number | null; is_inferred: boolean };
  points_to_target: Record<string, number | null>;
  oi: { bias: string; ce_oi_change: number; pe_oi_change: number; window: string; reason: string };
  state: string;
  state_reason: string;
};

type ApiResponse = { tickets: Ticket[]; errors: { row: number; error: string }[] };

const STATE_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  safe: { label: "SAFE · ON PLAN", color: "#7FC49A", bg: "#12211A", border: "#2C4A3A" },
  at_risk: { label: "AT RISK", color: "#D6A25C", bg: "#241E12", border: "#4A3D26" },
  dead: { label: "DEAD", color: "#C77A6E", bg: "#241614", border: "#4A2E2A" },
};

const IV_LABEL: Record<string, string> = {
  iv_minus_2pct: "IV −2%",
  iv_unchanged: "IV unchanged",
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
            <h3 className="text-[11px] tracking-wide font-[family-name:var(--font-mono)] text-white/40 mb-1">
              1 · MONEY TO THETA SO FAR
            </h3>
            <p className="font-[family-name:var(--font-mono)] text-[16px] tabular-nums" style={{ color: pnlColor(ticket.theta_so_far ?? 0) }}>
              {ticket.theta_so_far == null ? "need hours_open or entry_time" : rupee(ticket.theta_so_far)}
            </p>
            <p className="text-[12px] text-white/45 mt-1 leading-relaxed">
              Instantaneous theta {rupee(ticket.theta_per_hour)}/hour
              {ticket.hours_open != null ? ` × ${ticket.hours_open}h open` : ""}.
              Longs pay time; shorts receive it. Flat-path model, not a realised tape.
            </p>
          </section>

          <section>
            <h3 className="text-[11px] tracking-wide font-[family-name:var(--font-mono)] text-white/40 mb-1">
              2 · NIFTY POINTS TO TARGET
            </h3>
            <p className="text-[12px] text-white/45 mb-2">
              Target {ticket.plan.target_net != null ? rupee(ticket.plan.target_net) : "—"}
              {ticket.plan.stop_loss != null ? ` · stop ${rupee(ticket.plan.stop_loss)}` : ""}
              {ticket.plan.is_inferred ? " · plan inferred" : ""}. Solved from Black-76 + fees at three IVs
              (Δ {ticket.greeks.delta}, Γ {ticket.greeks.gamma}, θ {ticket.greeks.theta_per_hour}/h).
              Expected move this expiry: {ticket.expected_move_pts.toFixed(0)} pts.
            </p>
            <div className="space-y-1 font-[family-name:var(--font-mono)] text-[13px]">
              {Object.entries(ticket.points_to_target).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-white/45">{IV_LABEL[k] ?? k}</span>
                  <span className="tabular-nums">
                    {v == null ? "unreachable" : `${v > 0 ? "+" : ""}${v.toFixed(0)} pts`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] tracking-wide font-[family-name:var(--font-mono)] text-white/40 mb-1">
              3 · OI SINCE ENTRY · {ticket.oi.window.toUpperCase()}
            </h3>
            <p className="text-[14px] font-medium" style={{ color: oiColor }}>
              {ticket.oi.bias.toUpperCase()}
            </p>
            <p className="text-[12px] text-white/45 mt-1 leading-relaxed">{ticket.oi.reason}</p>
          </section>

          <section>
            <h3 className="text-[11px] tracking-wide font-[family-name:var(--font-mono)] text-white/40 mb-1">
              4 · STATE
            </h3>
            <StateChip state={ticket.state} />
            <ul className="mt-2 text-[12px] text-white/45 space-y-1 leading-relaxed">
              <li>Safe / on plan: required (or adverse) move ≤ expected move, stop not hit, model life ≥ 30 min.</li>
              <li>At risk: required/adverse move &gt; expected move, stop not yet hit.</li>
              <li>Dead: stop hit, or required &gt; 2× expected, or &lt; 30 min of model life.</li>
            </ul>
          </section>

          {ticket.no_live_bid_flag && (
            <p className="text-[12px] text-[#D6A25C]">No live bid/ask — net uses LTP. Low confidence.</p>
          )}
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

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/tickets/csv`, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error (${res.status})`);
      }
      const data: ApiResponse = await res.json();
      setTickets(data.tickets);
      setErrors(data.errors);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process the file.");
    } finally {
      setLoading(false);
    }
  }

  const gross = tickets?.reduce((s, t) => s + t.gross_pnl, 0) ?? 0;
  const net = tickets?.reduce((s, t) => s + t.net_pnl, 0) ?? 0;

  return (
    <main className="flex-1 flex flex-col items-center px-4 pt-20 pb-12">
      <div className="w-full max-w-[560px]">
        <header className="mb-6">
          <h1 className="font-medium text-[22px] tracking-tight">Open book</h1>
          <p className="text-[13px] text-white/55 mt-2 leading-relaxed">
            Gross is LTP mark. Net is tickwise exit — bid if long, ask if short, minus charges.
            Set target and stop in the CSV (<code>target_net</code>, <code>stop_loss</code>).
          </p>
        </header>

        {tickets && tickets.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
              <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">GROSS PNL</div>
              <div className="font-[family-name:var(--font-mono)] text-[22px] tabular-nums mt-1" style={{ color: pnlColor(gross) }}>
                {rupee(gross)}
              </div>
              <div className="text-[11px] text-white/35 mt-1">LTP × qty</div>
            </div>
            <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
              <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">NET PNL · TICK</div>
              <div className="font-[family-name:var(--font-mono)] text-[22px] tabular-nums mt-1" style={{ color: pnlColor(net) }}>
                {rupee(net)}
              </div>
              <div className="text-[11px] text-white/35 mt-1">bid/ask after charges</div>
            </div>
          </div>
        )}

        <div
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
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
              if (file) handleFile(file);
            }}
          />
          <p className="text-[13px] text-white/80 font-[family-name:var(--font-mono)]">
            {loading ? "computing…" : "drop positions CSV, or tap to choose"}
          </p>
          <a
            href={`${API_URL}/csv-template`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-white/45 underline underline-offset-2 mt-2 inline-block"
          >
            column template
          </a>
        </div>

        {error && <p className="text-[13px] text-[#C77A6E] mt-3 font-[family-name:var(--font-mono)]">{error}</p>}
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

        {tickets && tickets.length === 0 && (
          <p className="text-[13px] text-white/45 mt-6">No positions in this file.</p>
        )}

        <footer className="mt-10 pt-6 border-t border-white/10">
          <p className="text-[11px] text-white/35 leading-relaxed">
            Estimates only. Gross, net, theta, OI tilt, and state are modeled — not investment advice
            and not an instruction to exit. Verify against the contract note and the live chain.
          </p>
        </footer>
      </div>
    </main>
  );
}
