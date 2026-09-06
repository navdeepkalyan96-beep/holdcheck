"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Quote = { ltp?: number | null; open?: number | null; bid?: number | null; ask?: number | null };
type Market = {
  underlying?: number;
  expiry?: string;
  expiries?: string[];
  strikes?: number[];
  atm_strike?: number;
  quotes?: Record<string, Quote>;
  asof?: string;
};
type Ticket = {
  instrument: string;
  expiry: string;
  lots: number;
  side: "LONG" | "SHORT";
  entry_price: number;
  gross_pnl: number;
  net_pnl: number;
  theta_per_hour: number;
  theta_so_far: number | null;
  expected_move_pts: number;
  plan: { target_net?: number; stop_loss?: number | null };
  points_to_target: Record<string, number | null>;
  oi: { bias: string; reason: string; window: string };
  state: string;
  state_reason: string;
  live?: { spot?: number; open?: number | null; ltp?: number | null; mark?: number | null };
};
type Leg = {
  expiry: string; strike: string; option_type: "CE" | "PE"; side: "LONG" | "SHORT";
  lots: string; lot_size: string; entry_price: string; target_net: string; stop_loss: string; hours_open: string;
};

const emptyLeg = (): Leg => ({
  expiry: "", strike: "", option_type: "CE", side: "LONG",
  lots: "1", lot_size: "65", entry_price: "", target_net: "", stop_loss: "", hours_open: "2",
});

function rupee(n: number) {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function px(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(2);
}
function pnlColor(n: number) {
  if (n > 0) return "#7FC49A";
  if (n < 0) return "#C77A6E";
  return "#C4C8CD";
}

export default function Home() {
  const [legs, setLegs] = useState<Leg[]>([emptyLeg()]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [market, setMarket] = useState<Market>({});
  const [live, setLive] = useState(true);
  const [analysis, setAnalysis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickAt, setTickAt] = useState<string | null>(null);
  const legsRef = useRef(legs);
  legsRef.current = legs;

  const loadMarket = useCallback(async (expiry?: string) => {
    const url = expiry ? `${API_URL}/market/nifty?expiry=${encodeURIComponent(expiry)}` : `${API_URL}/market/nifty`;
    const r = await fetch(url);
    const m = await r.json();
    if (!r.ok) throw new Error(typeof m.detail === "string" ? m.detail : `HTTP ${r.status}`);
    setMarket(m);
    setLegs((prev) => prev.map((l, i) => {
      if (i !== 0) return l;
      return {
        ...l,
        expiry: l.expiry || m.expiry || "",
        strike: l.strike || (m.atm_strike != null ? String(m.atm_strike) : ""),
      };
    }));
    return m as Market;
  }, []);

  useEffect(() => {
    loadMarket().catch((e) => setError(String(e.message || e)));
  }, [loadMarket]);

  const refreshBook = useCallback(async () => {
    const current = legsRef.current;
    const positions = current.filter((l) => l.strike && l.entry_price && l.expiry).map((l) => ({
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
    try {
      const m = await loadMarket(positions[0]?.expiry || current[0]?.expiry || undefined);
      setTickAt(new Date().toLocaleTimeString("en-IN", { hour12: false }));
      if (!positions.length) return;
      setLoading(true);
      const res = await fetch(`${API_URL}/tickets/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "NIFTY", expiry: positions[0].expiry, positions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
      setTickets(data.tickets || []);
      if (data.market) setMarket(data.market);
      setError(null);
      void m;
    } catch (e) {
      setError(e instanceof Error ? e.message : "tick failed");
    } finally {
      setLoading(false);
    }
  }, [loadMarket]);

  useEffect(() => {
    if (!live) return;
    refreshBook();
    const id = setInterval(refreshBook, 5000);
    return () => clearInterval(id);
  }, [live, refreshBook]);

  const gross = tickets.reduce((s, t) => s + Number(t.gross_pnl || 0), 0);
  const net = tickets.reduce((s, t) => s + Number(t.net_pnl || 0), 0);
  const hasBook = tickets.length > 0;
  const expiryList = market.expiries || [];
  const strikeList = (market.strikes || []).filter((k) => k > 1000 && k < 100000);
  const first = legs[0];
  const q = market.quotes?.[`${first?.strike}${first?.option_type}`];
  const strikeMark = q?.open ?? q?.ltp ?? tickets[0]?.live?.mark;

  function analyze() {
    setAnalysis(true);
    refreshBook();
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 pt-20 pb-12">
      <div className="w-full max-w-[640px]">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-medium text-[22px]">Live book</h1>
            <p className="text-[12px] font-[family-name:var(--font-mono)] text-white/55 mt-1">
              NIFTY SPOT {market.underlying ? market.underlying.toFixed(2) : "—"}
              {tickAt ? ` · ${tickAt}` : ""}{live ? " · TICK 5s" : " · PAUSED"}
            </p>
          </div>
          <span className="text-[11px] text-white/40 font-[family-name:var(--font-mono)]">{loading ? "…" : live ? "LIVE" : "PAUSED"}</span>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">GROSS PNL</div>
            <div className="font-[family-name:var(--font-mono)] text-[26px] tabular-nums" style={{ color: pnlColor(hasBook ? gross : 0) }}>
              {hasBook ? rupee(gross) : "—"}
            </div>
          </div>
          <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">NET PNL · TICK</div>
            <div className="font-[family-name:var(--font-mono)] text-[26px] tabular-nums" style={{ color: pnlColor(hasBook ? net : 0) }}>
              {hasBook ? rupee(net) : "—"}
            </div>
          </div>
        </div>

        <div className="border border-white/10 rounded-xl p-3 mb-4 grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">NIFTY SPOT</div>
            <div className="font-[family-name:var(--font-mono)] text-[18px]">{market.underlying ? market.underlying.toFixed(2) : "—"}</div>
          </div>
          <div>
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">STRIKE MARK · OPEN / LTP</div>
            <div className="font-[family-name:var(--font-mono)] text-[18px]">{px(strikeMark)}</div>
            <div className="text-[11px] text-white/40">open {px(q?.open)} · ltp {px(q?.ltp)}</div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {legs.map((l, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-white/10 rounded-xl p-3">
              <label className="text-[11px] text-white/40">Expiry
                <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.expiry}
                  onChange={(e) => { const v = e.target.value; setLegs(legs.map((x, j) => j === i ? { ...x, expiry: v } : x)); loadMarket(v).catch(() => {}); }}>
                  {expiryList.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-white/40">Strike
                <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.strike}
                  onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, strike: e.target.value } : x))}>
                  {strikeList.map((k) => <option key={k} value={String(k)}>{k}{k === market.atm_strike ? " ATM" : ""}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-white/40">Type
                <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.option_type}
                  onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, option_type: e.target.value as "CE" | "PE" } : x))}>
                  <option>CE</option><option>PE</option>
                </select>
              </label>
              <label className="text-[11px] text-white/40">Side
                <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={l.side}
                  onChange={(e) => setLegs(legs.map((x, j) => j === i ? { ...x, side: e.target.value as "LONG" | "SHORT" } : x))}>
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
          <button type="button" className="text-[13px] border border-white/20 rounded-full px-3 py-1.5" onClick={() => setLegs([...legs, emptyLeg()])}>+ leg</button>
          <button type="button" className="cta-gradient text-white text-[13px] rounded-full px-4 py-1.5" onClick={analyze}>Analyze</button>
          <button type="button" className={`text-[13px] rounded-full px-3 py-1.5 ${live ? "border border-white/20" : "border border-white/20"}`} onClick={() => setLive((v) => !v)}>
            {live ? "Pause tick" : "Resume tick"}
          </button>
        </div>

        {error && <p className="text-[13px] text-[#C77A6E] mb-3 font-[family-name:var(--font-mono)]">{error}</p>}
        <p className="text-[12px] text-white/45 mb-4">Type entry to start Gross/Net ticking. Analyze opens state, theta, points-to-target and OI.</p>

        {tickets.map((t, i) => (
          <div key={i} className="border border-white/10 rounded-xl p-4 mb-2 bg-white/[0.03]">
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-medium">{t.instrument} <span className="text-[11px] text-white/45">{t.side} · {t.lots}L</span></div>
                <div className="text-[12px] text-white/45 font-[family-name:var(--font-mono)]">mark {px(t.live?.mark)} · gross {rupee(t.gross_pnl)} · net {rupee(t.net_pnl)}</div>
              </div>
              <span className="text-[11px] font-[family-name:var(--font-mono)] text-white/60 self-start">{(t.state || "").toUpperCase()}</span>
            </div>
            {analysis && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-[13px] text-white/70">
                <p>{t.state_reason}</p>
                <p>Theta so far {t.theta_so_far == null ? "—" : rupee(t.theta_so_far)} · {rupee(t.theta_per_hour)}/h</p>
                <p>Expected move {t.expected_move_pts?.toFixed?.(0)} pts</p>
                {Object.entries(t.points_to_target || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between font-[family-name:var(--font-mono)] text-[12px]">
                    <span className="text-white/40">{k.replace(/_/g, " ")}</span>
                    <span>{v == null ? "unreachable" : `${v > 0 ? "+" : ""}${Number(v).toFixed(0)} pts`}</span>
                  </div>
                ))}
                <p>OI {(t.oi?.bias || "neutral").toUpperCase()} — {t.oi?.reason}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
