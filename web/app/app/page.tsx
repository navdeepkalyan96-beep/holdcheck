"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Candle = { t: string; o: number; h: number; l: number; c: number };
type Quote = { ltp?: number | null; open?: number | null; bid?: number | null; ask?: number | null };
type Market = {
  underlying?: number; expiry?: string; expiries?: string[]; strikes?: number[];
  atm_strike?: number; quotes?: Record<string, Quote>;
};
type Ticket = {
  instrument: string; side: string; lots: number; gross_pnl: number; net_pnl: number;
  theta_per_hour: number; theta_so_far: number | null; expected_move_pts: number;
  points_to_target: Record<string, number | null>;
  oi: { bias: string; reason: string };
  state: string; state_reason: string;
};
type Leg = {
  expiry: string; strike: string; option_type: "CE" | "PE"; side: "LONG" | "SHORT";
  lots: string; lot_size: string; entry_price: string; target_net: string; stop_loss: string; hours_open: string;
};

function rupee(n: number) {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function px(n?: number | null) {
  return n == null || Number.isNaN(Number(n)) ? "—" : Number(n).toFixed(2);
}
function pnlColor(n: number) {
  if (n > 0) return "#7FC49A";
  if (n < 0) return "#C77A6E";
  return "#C4C8CD";
}
function glow(n: number) {
  if (n > 0) return "glow-profit";
  if (n < 0) return "glow-loss";
  return "";
}
function hhmm(t: string) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return String(t).slice(11, 16);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function AngelChart({ data, empty }: { data: Candle[]; empty: string }) {
  const [span, setSpan] = useState(48);
  const view = useMemo(() => data.slice(-Math.max(12, span)), [data, span]);
  const W = 420, H = 240, L = 52, R = 8, T = 10, B = 28;
  if (!data.length) {
    return <div className="h-[240px] flex items-center justify-center text-[12px] text-white/40">{empty}</div>;
  }
  const max = Math.max(...view.map((d) => d.h));
  const min = Math.min(...view.map((d) => d.l));
  const rng = max - min || 1;
  const plotW = W - L - R, plotH = H - T - B;
  const y = (v: number) => T + ((max - v) / rng) * plotH;
  const ticks = 4;
  const xLabels = [0, Math.floor(view.length / 2), view.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]">
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = max - (rng * i) / ticks;
          const yy = y(v);
          return (
            <g key={i}>
              <line x1={L} x2={W - R} y1={yy} y2={yy} stroke="rgba(255,255,255,0.08)" />
              <text x={L - 6} y={yy + 3} textAnchor="end" fill="#8b9098" fontSize="9" fontFamily="ui-monospace, monospace">
                {v >= 1000 ? v.toFixed(0) : v.toFixed(2)}
              </text>
            </g>
          );
        })}
        <line x1={L} x2={L} y1={T} y2={H - B} stroke="rgba(255,255,255,0.2)" />
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="rgba(255,255,255,0.2)" />
        {view.map((d, i) => {
          const x = L + (i + 0.5) * (plotW / view.length);
          const bw = Math.max(2, plotW / view.length - 1.5);
          const color = d.c >= d.o ? "#3dff8a" : "#ff5c6a";
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(d.h)} y2={y(d.l)} stroke={color} strokeWidth="1" />
              <rect x={x - bw / 2} y={y(Math.max(d.o, d.c))} width={bw} height={Math.max(1, Math.abs(y(d.o) - y(d.c)))} fill={color} />
            </g>
          );
        })}
        {xLabels.map((i) => {
          const d = view[i];
          if (!d) return null;
          const x = L + (i + 0.5) * (plotW / view.length);
          return (
            <text key={i} x={x} y={H - 8} textAnchor="middle" fill="#8b9098" fontSize="9" fontFamily="ui-monospace, monospace">
              {hhmm(d.t)}
            </text>
          );
        })}
      </svg>
      <div className="flex gap-2 justify-end text-[11px]">
        <button type="button" className="border border-white/20 rounded px-2 py-0.5" onClick={() => setSpan((s) => Math.max(12, s - 12))}>zoom +</button>
        <button type="button" className="border border-white/20 rounded px-2 py-0.5" onClick={() => setSpan((s) => Math.min(Math.max(data.length, 12), s + 12))}>zoom −</button>
      </div>
    </div>
  );
}

export default function Home() {
  const [legs, setLegs] = useState<Leg[]>([{
    expiry: "", strike: "", option_type: "CE", side: "LONG", lots: "1", lot_size: "65",
    entry_price: "", target_net: "", stop_loss: "", hours_open: "2",
  }]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [market, setMarket] = useState<Market>({});
  const [spotBars, setSpotBars] = useState<Candle[]>([]);
  const [optBars, setOptBars] = useState<Candle[]>([]);
  const [analysis, setAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickAt, setTickAt] = useState<string | null>(null);
  const legsRef = useRef(legs);
  legsRef.current = legs;

  const loadAll = useCallback(async () => {
    const L = legsRef.current[0];
    const q = L?.expiry ? `?expiry=${encodeURIComponent(L.expiry)}` : "";
    const r = await fetch(`${API_URL}/market/nifty${q}`);
    const m = await r.json();
    if (!r.ok) throw new Error(typeof m.detail === "string" ? m.detail : "market fail");
    setMarket(m);
    setLegs((prev) => prev.map((x, i) => (i ? x : {
      ...x,
      expiry: x.expiry || m.expiry || "",
      strike: x.strike || (m.atm_strike != null ? String(m.atm_strike) : ""),
    })));

    const LL = legsRef.current[0];
    const [spot, opt] = await Promise.all([
      fetch(`${API_URL}/market/candles?kind=spot`).then((x) => x.json()).catch(() => ({ candles: [] })),
      LL?.expiry && LL?.strike
        ? fetch(`${API_URL}/market/candles?kind=option&expiry=${LL.expiry}&strike=${LL.strike}&option_type=${LL.option_type}`).then((x) => x.json()).catch(() => ({ candles: [] }))
        : Promise.resolve({ candles: [] }),
    ]);
    setSpotBars(spot.candles || []);
    setOptBars(opt.candles || []);

    const positions = legsRef.current.filter((p) => p.strike && p.entry_price && p.expiry).map((p) => ({
      expiry: p.expiry, strike: Number(p.strike), option_type: p.option_type, side: p.side,
      lots: Number(p.lots), lot_size: Number(p.lot_size || 65), entry_price: Number(p.entry_price),
      target_net: p.target_net ? Number(p.target_net) : null,
      stop_loss: p.stop_loss ? Number(p.stop_loss) : null,
      hours_open: p.hours_open ? Number(p.hours_open) : null,
    }));
    if (!positions.length) {
      setTickAt(new Date().toLocaleTimeString("en-IN", { hour12: false }));
      return;
    }
    const res = await fetch(`${API_URL}/tickets/live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "NIFTY", expiry: positions[0].expiry, positions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "book fail");
    setTickets(data.tickets || []);
    if (data.market) setMarket(data.market);
    setTickAt(new Date().toLocaleTimeString("en-IN", { hour12: false }));
    setError(null);
  }, []);

  useEffect(() => {
    loadAll().catch((e) => setError(String(e.message || e)));
    const id = setInterval(() => loadAll().catch(() => {}), 3000);
    return () => clearInterval(id);
  }, [loadAll]);

  const gross = tickets.reduce((s, t) => s + Number(t.gross_pnl || 0), 0);
  const net = tickets.reduce((s, t) => s + Number(t.net_pnl || 0), 0);
  const has = tickets.length > 0;
  const L = legs[0];
  const q = market.quotes?.[`${L.strike}${L.option_type}`];
  const mark = q?.open ?? q?.ltp;
  const call = L.option_type === "CE";
  const t0 = tickets[0];

  return (
    <main className="flex-1 px-3 pt-16 pb-10 max-w-[1100px] mx-auto w-full">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[20px] font-medium">Live book</h1>
        <span className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">{tickAt ? `TICK ${tickAt}` : "connecting"} · 3s</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className={`border border-white/10 rounded-xl p-4 bg-white/[0.03] ${has ? glow(gross) : ""}`}>
          <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">GROSS PNL</div>
          <div className="font-[family-name:var(--font-mono)] text-[28px] tabular-nums" style={{ color: pnlColor(has ? gross : 0) }}>{has ? rupee(gross) : "—"}</div>
        </div>
        <div className={`border border-white/10 rounded-xl p-4 bg-white/[0.03] ${has ? glow(net) : ""`}>
          <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">NET PNL · TICK</div>
          <div className="font-[family-name:var(--font-mono)] text-[28px] tabular-nums" style={{ color: pnlColor(has ? net : 0) }}>{has ? rupee(net) : "—"}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <section className="border border-white/10 rounded-xl p-3 bg-white/[0.03]">
          <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">NIFTY SPOT · Angel 5m</div>
          <div className="font-[family-name:var(--font-mono)] text-[22px] mb-1">{market.underlying ? market.underlying.toFixed(2) : "—"}</div>
          <AngelChart data={spotBars} empty="no Nifty candles (Sunday / Angel hist)" />
        </section>
        <section className={`border rounded-xl p-3 ${call ? "panel-call" : "panel-put"}`}>
          <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/50">{call ? "CALL" : "PUT"} · {L.strike || "strike"} · Angel 5m</div>
          <div className="font-[family-name:var(--font-mono)] text-[22px] mb-1">mark {px(mark)} <span className="text-[12px] text-white/50">open {px(q?.open)} · ltp {px(q?.ltp)}</span></div>
          <AngelChart data={optBars} empty="pick expiry + strike — weekend may be empty" />
        </section>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-white/10 rounded-xl p-3 mb-3">
        <label className="text-[11px] text-white/40">Expiry
          <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={L.expiry} onChange={(e) => setLegs([{ ...L, expiry: e.target.value }])}>
            {(market.expiries || []).map((ex) => <option key={ex} value={ex}>{ex}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-white/40">Strike
          <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={L.strike} onChange={(e) => setLegs([{ ...L, strike: e.target.value }])}>
            {(market.strikes || []).filter((k) => k > 1000 && k < 100000).map((k) => <option key={k} value={String(k)}>{k}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-white/40">Type
          <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={L.option_type} onChange={(e) => setLegs([{ ...L, option_type: e.target.value as "CE" | "PE" }])}>
            <option>CE</option><option>PE</option>
          </select>
        </label>
        <label className="text-[11px] text-white/40">Side
          <select className="w-full bg-[#07051a] border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={L.side} onChange={(e) => setLegs([{ ...L, side: e.target.value as "LONG" | "SHORT" }])}>
            <option>LONG</option><option>SHORT</option>
          </select>
        </label>
        <label className="text-[11px] text-white/40">Lots
          <input className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={L.lots} onChange={(e) => setLegs([{ ...L, lots: e.target.value }])} />
        </label>
        <label className="text-[11px] text-white/40">Entry
          <input className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={L.entry_price} onChange={(e) => setLegs([{ ...L, entry_price: e.target.value }])} />
        </label>
        <label className="text-[11px] text-white/40">Target ₹
          <input className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={L.target_net} onChange={(e) => setLegs([{ ...L, target_net: e.target.value }])} />
        </label>
        <label className="text-[11px] text-white/40">Stop ₹
          <input className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-white text-[13px]" value={L.stop_loss} onChange={(e) => setLegs([{ ...L, stop_loss: e.target.value }])} />
        </label>
      </div>

      <button type="button" className="cta-gradient w-full rounded-xl py-4 text-[18px] font-medium mb-4" onClick={() => { setAnalysis(true); loadAll().catch((e) => setError(String(e.message || e))); }}>
        Analyze
      </button>
      {error && <p className="text-[13px] text-[#C77A6E] mb-3 font-[family-name:var(--font-mono)]">{error}</p>}
      {analysis && t0 && (
        <section className="border border-white/10 rounded-xl p-5 bg-white/[0.03] space-y-4">
          <div className="text-center font-[family-name:var(--font-mono)] text-[42px] tracking-wide" style={{ color: t0.state === "dead" ? "#C77A6E" : t0.state === "safe" || t0.state === "on_plan" ? "#7FC49A" : "#D6A25C" }}>
            {(t0.state || "").replace("_", " ").toUpperCase()}
          </div>
          <p className="text-center text-white/70">{t0.state_reason}</p>
          <div>
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">MONEY TO THETA SO FAR</div>
            <div className="text-[20px] font-[family-name:var(--font-mono)]">{t0.theta_so_far == null ? "—" : rupee(t0.theta_so_far)}</div>
          </div>
          <div>
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">REQUIRED MOVE TO TARGET</div>
            {Object.entries(t0.points_to_target || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between font-[family-name:var(--font-mono)] text-[14px]">
                <span className="text-white/45">{k.includes("minus") ? "IV −2%" : k.includes("plus") ? "IV +2%" : "IV unchanged"}</span>
                <span>{v == null ? "unreachable" : `${v > 0 ? "+" : ""}${Number(v).toFixed(0)} pts`}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[11px] font-[family-name:var(--font-mono)] text-white/40">OI WINDOW</div>
            <div className="text-[18px]">{(t0.oi?.bias || "neutral").toUpperCase()}</div>
            <p className="text-[13px] text-white/55">{t0.oi?.reason}</p>
          </div>
        </section>
      )}
    </main>
  );
}
