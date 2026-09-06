"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Ticket = {
  instrument: string;
  expiry: string;
  lots: number;
  side: "LONG" | "SHORT";
  entry_price: number;
  gross_pnl: number;
  net_pnl: number;
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

type Market = {
  underlying?: number;
  iv_atm?: number;
  expiry?: string;
  asof?: string;
  expiries?: string[];
  strikes?: number[];
  atm_strike?: number;
};

type Leg = {
  expiry: string;
  strike: string;
  option_type: "CE" | "PE";
  side: "LONG" | "SHORT";
  lots: string;
  lot_size: string;
  entry_price: string;
  target_net: string;
  stop_loss: string;
  hours_open: string;
};

const emptyLeg = (): Leg => ({
  expiry: "",
  strike: "",
  option_type: "CE",
  side: "LONG",
  lots: "1",
  lot_size: "65",
  entry_price: "",
  target_net: "",
  stop_loss: "",
  hours_open: "2",
});

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
  iv_plus_2pct: "IV +2%",
};

function rupee(n: number) {
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
  const req = (raw.points_to_target as Ticket["points_to_target"]) ||
    (raw.required_move_pts as Ticket["points_to_target"]) || {};
  const oi = (raw.oi as Ticket["oi"]) || {
    bias: "neutral", ce_oi_change: 0, pe_oi_change: 0, window: "±5", reason: "",
  };
  const greeks = (raw.greeks as Ticket["greeks"]) || {
    delta: 0, gamma: 0, theta_per_hour: Number(raw.theta_per_hour ?? 0), vega_per_vol_point: 0,
  };
  return {
    instrument: String(raw.instrument ?? ""),
    expiry: String(raw.expiry ?? ""),
    lots: Number(raw.lots ?? 0),
    side: raw.side === "SHORT" ? "SHORT" : "LONG",
    entry_price: Number(raw.entry_price ?? 0),
    gross_pnl: Number(raw.gross_pnl ?? net),
    net_pnl: net,
    greeks,
    theta_per_hour: Number(raw.theta_per_hour ?? 0),
    hours_open: raw.hours_open == null ? null : Number(raw.hours_open),
    theta_so_far: raw.theta_so_far == null ? null : Number(raw.theta_so_far),
    expected_move_pts: Number(raw.expected_move_pts ?? 0),
    plan: (raw.plan as Ticket["plan"]) || {},
    points_to_target: req,
    oi,
    state: String(raw.state ?? ""),
    state_reason: String(raw.state_reason ?? ""),
  };
}

function StateChip({ state }: { state: string }) {
  const s = STATE_STYLE[state] ?? { label: state.toUpperCase(), color: "#9AA1AB", bg: "#1A1D20", border: "#2A2E32" };
  return (
    <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide px-2 py-1 border" style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}>
      {s.label}
    </span>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const [open, setOpen] = useState(false);
  const oiColor = ticket.oi.bias === "bullish" ? "#7FC49A" : ticket.oi.bias === "bearish" ? "#C77A6E" : "#D6A25C";
  return (
    <div className="border border-white/10 bg-white/[0.03] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-[15px]">{ticket.instrument} <span className="text-[11px] text-white/45 font-[family-name:var(--font-mono)]">{ticket.side} · {ticket.lots}L</span></div>
          <div className="text-[11px] text-white/40">gross {rupee(ticket.gross_pnl)} · net {rupee(ticket.net_pnl)}</div>
        </div>
        <StateChip state={ticket.state} />
      </button>
      {open && (
        <div className="px-4 pb-5 border-t border-white/10 pt-4 space-y-4 text-[13px]">
          <p className="text-white/70">{ticket.state_reason}.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">GROSS</div>
              <div className="font-[family-name:var(--font-mono)]" style={{ color: pnlColor(ticket.gross_pnl) }}>{rupee(ticket.gross_pnl)}</div>
            </div>
            <div>
              <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">NET TICK</div>
              <div className="font-[family-name:var(--font-mono)]" style={{ color: pnlColor(ticket.net_pnl) }}>{rupee(ticket.net_pnl)}</div>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">THETA SO FAR</div>
            <div className="font-[family-name:var(--font-mono)]" style={{ color: pnlColor(ticket.theta_so_far ?? 0) }}>
              {ticket.theta_so_far == null ? "—" : rupee(ticket.theta_so_far)} · {rupee(ticket.theta_per_hour)}/h
            </div>
          </div>
          <div>
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">POINTS TO TARGET</div>
            {Object.entries(ticket.points_to_target || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between font-[family-name:var(--font-mono)] text-[12px]">
                <span className="text-white/45">{IV_LABEL[k] ?? k}</span>
                <span>{v == null ? "unreachable" : `${v > 0 ? "+" : ""}${v.toFixed(0)} pts`}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">OI WINDOW</div>
            <div style={{ color: oiColor }}>{(ticket.oi.bias || "neutral").toUpperCase()}</div>
            <p className="text-[12px] text-white/45">{ticket.oi.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [legs, setLegs] = useState<Leg[]>([emptyLeg()]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [market, setMarket] = useState<Market | null>(null);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickAt, setTickAt] = useState<string | null>(null);
  const legsRef = useRef(legs);
  legsRef.current = legs;

  const applyMarket = useCallback((m: Market, seedLeg: boolean) => {
    setMarket(m);
    if (!seedLeg) return;
    const expiry = m.expiry || "";
    const strike = m.atm_strike != null ? String(m.atm_strike) : "";
    setLegs((prev) => prev.map((l, i) => {
      if (i !== 0) return l;
      return {
        ...l,
        expiry: l.expiry || expiry,
        strike: l.strike || strike,
      };
    }));
  }, []);

  const loadMarket = useCallback(async (expiry?: string, seed = false) => {
    const url = expiry ? `${API_URL}/market/nifty?expiry=${encodeURIComponent(expiry)}` : `${API_URL}/market/nifty`;
    const r = await fetch(url);
    const m = await r.json();
    if (!r.ok) throw new Error(typeof m.detail === "string" ? m.detail : "market failed");
    applyMarket(m, seed);
    return m as Market;
  }, [applyMarket]);

  useEffect(() => {
    loadMarket(undefined, true).catch((e) => setError(String(e.message || e)));
  }, [loadMarket]);

  const refresh = useCallback(async () => {
    const current = legsRef.current;
    const positions = current
      .filter((l) => l.strike && l.entry_price && l.expiry)
      .map((l) => ({
        expiry: l.expiry,
        strike: Number(l.strike),
        option_type: l.option_type,
        side: l.side,
        lots: Number(l.lots),
        lot_size: Number(l.lot_size || 65),
        entry_price: Number(l.entry_price),
        target_net: l.target_net ? Number(l.target_net) : null,
        stop_loss: l.stop_loss ? Number(l.stop_loss) : null,
        hours_open: l.hours_open ? Number(l.hours_open) : null,
      }));
    if (!positions.length) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/tickets/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "NIFTY", expiry: positions[0].expiry, positions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
      setTickets((data.tickets || []).map(normalizeTicket));
      if (data.market) applyMarket(data.market, false);
      setTickAt(new Date().toLocaleTimeString("en-IN", { hour12: false }));
      setError(null);
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Live book failed") +
          (API_URL.includes("localhost") ? ` — API is ${API_URL}` : ""),
      );
    } finally {
      setLoading(false);
    }
  }, [applyMarket]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => refresh(), 15000);
    return () => clearInterval(id);
  }, [live, refresh]);

  useEffect(() => {
    const ready = legs.some((l) => l.strike && l.entry_price && l.expiry);
    if (ready) refresh();
  }, [legs, refresh]);

  async function onExpiry(i: number, expiry: string) {
    setLegs((prev) => prev.map((x, j) => (j === i ? { ...x, expiry, strike: "" } : x)));
    try {
      const m = await loadMarket(expiry, false);
      const atm = m.atm_strike != null ? String(m.atm_strike) : "";
      setLegs((prev) => prev.map((x, j) => (j === i ? { ...x, expiry, strike: atm || x.strike } : x)));
    } catch (e) {
      setError(String((e as Error).message || e));
    }
  }

  const gross = tickets.reduce((s, t) => s + (Number(t.gross_pnl) || 0), 0);
  const net = tickets.reduce((s, t) => s + (Number(t.net_pnl) || 0), 0);
  const hasBook = tickets.length > 0;
  const strikeList = market?.strikes || [];

  return (
    <main className="flex-1 flex flex-col items-center px-4 pt-20 pb-12">
      <div className="w-full max-w-[640px]">
        <header className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-medium text-[22px]">Live book</h1>
            <span className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">
              {live ? "LIVE" : "PAUSED"}{tickAt ? ` · ${tickAt}` : ""}{loading ? " · …" : ""}
            </span>
          </div>
          <p className="text-[12px] font-[family-name:var(--font-mono)] text-white/45 mt-2">
            {market?.underlying != null ? `NIFTY ${market.underlying.toFixed(1)}` : "waiting for chain"}
            {market?.iv_atm != null ? ` · IV ${(market.iv_atm * 100).toFixed(1)}%` : ""}
            {market?.expiry ? ` · ${market.expiry}` : ""}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">GROSS PNL</div>
            <div className="font-[family-name:var(--font-mono)] text-[26px] tabular-nums mt-1" style={{ color: pnlColor(hasBook ? gross : 0) }}>
              {hasBook ? rupee(gross) : "—"}
            </div>
            <div className="text-[11px] text-white/35 mt-1">LTP mark</div>
          </div>
          <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">NET PNL · TICK</div>
            <div className="font-[family-name:var(--font-mono)] text-[26px] tabular-nums mt-1" style={{ color: pnlColor(hasBook ? net : 0) }}>
              {hasBook ? rupee(net) : "—"}
            </div>
            <div className="text-[11px] text-white/35 mt-1">bid/ask after charges</div>
          </div>
        </div>

        <p className="text-[12px] text-white/45 mb-3">Pick expiry and strike from the chain. Type only entry, target and stop.</p>

        <div className="space-y-3 mb-4">
          {legs.map((l, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-white/10 rounded-xl p-3">
              <label className="text-[11px] text-white/40">Expiry
                <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]"
                  value={l.expiry} onChange={(e) => onExpiry(i, e.target.value)}>
                  <option value="">pick expiry</option>
                  {(market?.expiries || []).map((ex) => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-white/40">Strike
                <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]"
                  value={l.strike} onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, strike: e.target.value } : x))}>
                  <option value="">pick strike</option>
                  {strikeList.map((k) => (
                    <option key={k} value={String(k)}>
                      {k}{market?.atm_strike === k ? " · ATM" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-white/40">Type
                <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.option_type} onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, option_type: e.target.value as "CE" | "PE" } : x))}>
                  <option>CE</option><option>PE</option>
                </select>
              </label>
              <label className="text-[11px] text-white/40">Side
                <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.side} onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, side: e.target.value as "LONG" | "SHORT" } : x))}>
                  <option>LONG</option><option>SHORT</option>
                </select>
              </label>
              <label className="text-[11px] text-white/40">Lots
                <input className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.lots} onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, lots: e.target.value } : x))} />
              </label>
              <label className="text-[11px] text-white/40">Entry
                <input className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.entry_price} onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, entry_price: e.target.value } : x))} />
              </label>
              <label className="text-[11px] text-white/40">Target ₹
                <input className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.target_net} onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, target_net: e.target.value } : x))} />
              </label>
              <label className="text-[11px] text-white/40">Stop ₹
                <input className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.stop_loss} onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, stop_loss: e.target.value } : x))} />
              </label>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" className="text-[13px] border border-white/20 rounded-full px-3 py-1.5" onClick={() => setLegs([...legs, { ...emptyLeg(), expiry: market?.expiry || legs[0]?.expiry || "", strike: market?.atm_strike != null ? String(market.atm_strike) : "" }])}>+ leg</button>
          <button type="button" className="text-[13px] border border-white/20 rounded-full px-3 py-1.5" onClick={() => refresh()} disabled={loading}>{loading ? "updating…" : "Refresh"}</button>
          <button type="button" className={`text-[13px] rounded-full px-3 py-1.5 ${live ? "cta-gradient text-white" : "border border-white/20"}`} onClick={() => setLive((v) => !v)}>
            {live ? "Live on · 15s" : "Paused"}
          </button>
        </div>

        {error && <p className="text-[13px] text-[#C77A6E] mb-3 font-[family-name:var(--font-mono)]">{error}</p>}

        {tickets.length > 0 && (
          <div className="space-y-2">{tickets.map((t, i) => <TicketCard key={i} ticket={t} />)}</div>
        )}

        <footer className="mt-10 pt-6 border-t border-white/10 text-[11px] text-white/35">
          API {API_URL}. Expiry and strikes from the live NIFTY chain. ATM is pre-selected.
        </footer>
      </div>
    </main>
  );
}
