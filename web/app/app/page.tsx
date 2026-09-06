"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Candle = { t: string; o: number; h: number; l: number; c: number };
type Quote = { ltp?: number | null; open?: number | null; bid?: number | null; ask?: number | null };
type Market = {
  underlying?: number; expiry?: string; expiries?: string[]; strikes?: number[];
  atm_strike?: number; quotes?: Record<string, Quote>; iv_atm?: number | null;
};
type Charges = Record<string, number>;
type Ticket = {
  instrument: string; side: string; lots: number; gross_pnl: number; net_pnl: number;
  theta_per_hour: number; theta_so_far: number | null; expected_move_pts: number;
  points_to_target: Record<string, number | null>;
  oi: { bias: string; reason: string; ce_oi_change?: number; pe_oi_change?: number };
  state: string; state_reason: string;
  exit_charges?: Charges;
  entry_charges?: Charges;
  mark_price?: number;
  points?: number;
};
type Leg = {
  expiry: string; strike: string; option_type: "CE" | "PE"; side: "LONG" | "SHORT";
  lots: string; lot_size: string; entry_price: string; target_net: string; stop_loss: string; hours_open: string;
};

function rupee(n: number) {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return sign + "\u20b9" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function px(n?: number | null) {
  return n == null || Number.isNaN(Number(n)) ? "\u2014" : Number(n).toFixed(2);
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
function ivLabel(k: string) {
  if (k.includes("minus")) return "IV -2%";
  if (k.includes("plus")) return "IV +2%";
  return "IV unchanged";
}

function Drop({ label, value, onChange, children, width } : {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; width?: string;
}) {
  return (
    <label className="inline-flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.14em] uppercase text-white/35 font-[family-name:var(--font-mono)]">{label}</span>
      <select className={`appearance-none bg-[#0c0a18] border border-white/12 rounded-full pl-3 pr-7 py-1.5 text-[13px] text-white ${width || "min-w-[7.5rem]"}`} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

function Field({ label, value, onChange, w, hint } : {
  label: string; value: string; onChange: (v: string) => void; w?: string; hint?: string;
}) {
  return (
    <label className="inline-flex flex-col gap-1" title={hint}>
      <span className="text-[10px] tracking-[0.14em] uppercase text-white/35 font-[family-name:var(--font-mono)]">{label}</span>
      <input className={`bg-[#0c0a18] border border-white/12 rounded-full px-3 py-1.5 text-[13px] text-white ${w || "w-24"}`} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function AngelChart({ data, empty }: { data: Candle[]; empty: string }) {
  const [span, setSpan] = useState(48);
  const view = useMemo(() => data.slice(-Math.max(12, span)), [data, span]);
  const W = 420, H = 240, left = 52, right = 8, top = 10, bottom = 28;
  if (!data.length) return <div className="h-[240px] flex items-center justify-center text-[12px] text-white/40">{empty}</div>;
  const max = Math.max(...view.map((d) => d.h));
  const min = Math.min(...view.map((d) => d.l));
  const rng = max - min || 1;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const y = (v: number) => top + ((max - v) / rng) * plotH;
  const ticks = 4;
  const xLabels = [0, Math.floor(view.length / 2), view.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]">
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = max - (rng * i) / ticks;
        const yy = y(v);
        return (
          <g key={i}>
            <line x1={left} x2={W - right} y1={yy} y2={yy} stroke="rgba(255,255,255,0.08)" />
            <text x={left - 6} y={yy + 3} textAnchor="end" fill="#8b9098" fontSize="9" fontFamily="ui-monospace, monospace">{v >= 1000 ? v.toFixed(0) : v.toFixed(2)}</text>
          </g>
        );
      })}
      <line x1={left} x2={left} y1={top} y2={H - bottom} stroke="rgba(255,255,255,0.2)" />
      <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} stroke="rgba(255,255,255,0.2)" />
      {view.map((d, i) => {
        const x = left + (i + 0.5) * (plotW / view.length);
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
        const x = left + (i + 0.5) * (plotW / view.length);
        return <text key={i} x={x} y={H - 8} textAnchor="middle" fill="#8b9098" fontSize="9" fontFamily="ui-monospace, monospace">{hhmm(d.t)}</text>;
      })}
    </svg>
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
  const [popup, setPopup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tickAt, setTickAt] = useState<string | null>(null);
  const legsRef = useRef(legs);
  legsRef.current = legs;
  const setL = (patch: Partial<Leg>) => setLegs([{ ...legs[0], ...patch }]);

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
      hours_open: p.hours_open ? Number(p.hours_open) : 2,
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

  const L = legs[0];
  const q = market.quotes?.[`${L.strike}${L.option_type}`];
  const ltp = q?.ltp ?? tickets[0]?.mark_price;
  const open = q?.open;
  const entry = Number(L.entry_price);
  const qty = Number(L.lots || 1) * Number(L.lot_size || 65);
  const sign = L.side === "SHORT" ? -1 : 1;
  const hasEntry = Boolean(L.entry_price) && Number.isFinite(entry) && ltp != null;
  const points = hasEntry ? (Number(ltp) - entry) * sign : null;
  const grossLocal = points != null ? points * qty : null;
  const t0 = tickets[0];
  const feeTotal = (t0?.exit_charges?.total || 0) + (t0?.entry_charges?.total || 0);
  const netLocal = grossLocal != null ? grossLocal - feeTotal : (t0 ? t0.net_pnl : null);
  const has = grossLocal != null;
  const call = L.option_type === "CE";
  const chargeRows = Object.entries({
    entry_brokerage: t0?.entry_charges?.brokerage,
    exit_brokerage: t0?.exit_charges?.brokerage,
    stt: t0?.exit_charges?.stt,
    exchange: t0?.exit_charges?.exchange_txn,
    gst: (t0?.entry_charges?.gst || 0) + (t0?.exit_charges?.gst || 0),
    stamp: t0?.entry_charges?.stamp,
    total: feeTotal,
  }).filter(([, v]) => v != null);

  function onAnalyze() {
    if (!L.target_net || !L.stop_loss) {
      setPopup("Enter Target and Stop in rupees — book P&L, not premium.");
      return;
    }
    setAnalysis(true);
    loadAll().catch((e) => setError(String(e.message || e)));
  }

  return (
    <main className="flex-1 px-4 pt-16 pb-12 max-w-[1080px] mx-auto w-full">
      {popup && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center px-4" onClick={() => setPopup(null)}>
          <div className="bg-[#12101c] border border-white/15 rounded-2xl p-5 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] leading-relaxed">{popup}</p>
            <button type="button" className="mt-4 text-[13px] rounded-full border border-white/20 px-4 py-1.5" onClick={() => setPopup(null)}>OK</button>
          </div>
        </div>
      )}
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-[18px] font-medium tracking-tight">Live book</h1>
        <span className="text-[11px] font-[family-name:var(--font-mono)] text-white/35">{tickAt || "..."}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`border border-white/10 rounded-2xl p-4 bg-white/[0.03] ${has ? glow(grossLocal || 0) : ""}`}>
          <div className="text-[10px] tracking-[0.16em] font-[family-name:var(--font-mono)] text-white/35">GROSS</div>
          <div className="font-[family-name:var(--font-mono)] text-[26px] tabular-nums mt-1" style={{ color: pnlColor(grossLocal || 0) }}>{has ? rupee(grossLocal || 0) : "\u2014"}</div>
        </div>
        <div className={`relative group border border-white/10 rounded-2xl p-4 bg-white/[0.03] ${netLocal != null ? glow(netLocal) : ""}`}>
          <div className="text-[10px] tracking-[0.16em] font-[family-name:var(--font-mono)] text-white/35">NET TICK</div>
          <div className="font-[family-name:var(--font-mono)] text-[26px] tabular-nums mt-1" style={{ color: pnlColor(netLocal || 0) }}>{netLocal != null ? rupee(netLocal) : "\u2014"}</div>
          <div className="hidden group-hover:block absolute right-3 top-full mt-2 z-20 w-56 rounded-xl border border-white/15 bg-[#12101c] p-3 text-[12px]">
            {chargeRows.map(([k, v]) => (
              <div key={k} className="flex justify-between font-[family-name:var(--font-mono)]">
                <span className="text-white/45">{k.replace(/_/g, " ")}</span>
                <span>{rupee(Number(v))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mb-5">
        <section className="border border-white/10 rounded-2xl p-3 bg-white/[0.03]">
          <div className="text-[10px] tracking-[0.14em] font-[family-name:var(--font-mono)] text-white/35">NIFTY SPOT</div>
          <div className="font-[family-name:var(--font-mono)] text-[20px] mb-1">{market.underlying ? market.underlying.toFixed(2) : "\u2014"}</div>
          <AngelChart data={spotBars} empty="Angel candles after open" />
        </section>
        <section className={`border rounded-2xl p-3 ${call ? "panel-call" : "panel-put"}`}>
          <div className="text-[10px] tracking-[0.14em] font-[family-name:var(--font-mono)] text-white/45">{call ? "CALL" : "PUT"} {L.strike}</div>
          <div className="font-[family-name:var(--font-mono)] text-[20px]">LTP {px(ltp)}</div>
          <div className="text-[11px] text-white/45 font-[family-name:var(--font-mono)] mb-1">open {px(open)} · bid {px(q?.bid)} · ask {px(q?.ask)}</div>
          <AngelChart data={optBars} empty="Select strike" />
        </section>
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3 mb-4">
        <Drop label="Expiry" value={L.expiry} onChange={(v) => setL({ expiry: v })} width="min-w-[8.5rem]">{(market.expiries || []).map((ex) => <option key={ex} value={ex}>{ex}</option>)}</Drop>
        <Drop label="Strike" value={L.strike} onChange={(v) => setL({ strike: v })}>{(market.strikes || []).filter((k) => k > 1000 && k < 100000).map((k) => <option key={k} value={String(k)}>{k}</option>)}</Drop>
        <Drop label="Type" value={L.option_type} onChange={(v) => setL({ option_type: v as "CE" | "PE" })} width="min-w-[4.5rem]"><option>CE</option><option>PE</option></Drop>
        <Drop label="Side" value={L.side} onChange={(v) => setL({ side: v as "LONG" | "SHORT" })} width="min-w-[5.5rem]"><option>LONG</option><option>SHORT</option></Drop>
        <Field label="Lots" value={L.lots} onChange={(v) => setL({ lots: v })} w="w-16" />
        <Field label="Entry" value={L.entry_price} onChange={(v) => setL({ entry_price: v })} hint="Premium" />
        <Field label="Target" value={L.target_net} onChange={(v) => setL({ target_net: v })} hint="Target in rupees" />
        <Field label="Stop" value={L.stop_loss} onChange={(v) => setL({ stop_loss: v })} hint="Stop in rupees you can lose" />
        <button type="button" className="cta-gradient rounded-full px-5 py-2 text-[13px] font-medium" onClick={onAnalyze}>Analyze</button>
      </div>
      {error && <p className="text-[12px] text-[#C77A6E] mb-3 font-[family-name:var(--font-mono)]">{error}</p>}
      {analysis && t0 && (
        <section className="border border-white/10 rounded-2xl p-5 bg-white/[0.03] space-y-5 max-w-[560px]">
          <div className="font-[family-name:var(--font-mono)] text-[32px] tracking-wide" style={{ color: t0.state === "dead" ? "#C77A6E" : t0.state === "safe" || t0.state === "on_plan" ? "#7FC49A" : "#D6A25C" }}>
            {(t0.state || "").replace("_", " ").toUpperCase()}
          </div>
          <p className="text-[14px] text-white/65 leading-relaxed">{t0.state_reason}</p>
          <div>
            <div className="text-[10px] tracking-[0.14em] font-[family-name:var(--font-mono)] text-white/35 mb-1">THETA</div>
            <div className="font-[family-name:var(--font-mono)] text-[18px]">{t0.theta_so_far == null ? "\u2014" : rupee(t0.theta_so_far)}</div>
            <div className="text-[12px] text-white/45">{rupee(t0.theta_per_hour || 0)} / hour</div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.14em] font-[family-name:var(--font-mono)] text-white/35 mb-1">IV \u00b7 NIFTY MOVE TO TARGET</div>
            <div className="text-[12px] text-white/40 mb-2">ATM IV {market.iv_atm != null ? (Number(market.iv_atm) * 100).toFixed(1) + "%" : "model 15%"} · expected {t0.expected_move_pts?.toFixed?.(0)} pts</div>
            {Object.entries(t0.points_to_target || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between font-[family-name:var(--font-mono)] text-[13px]">
                <span className="text-white/45">{ivLabel(k)}</span>
                <span>{v == null ? "\u2014" : `${v > 0 ? "+" : ""}${Number(v).toFixed(0)} pts`}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[10px] tracking-[0.14em] font-[family-name:var(--font-mono)] text-white/35 mb-1">OI WINDOW ±5</div>
            <div className="text-[18px]">{(t0.oi?.bias || "neutral").toUpperCase()}</div>
            <p className="text-[13px] text-white/55">{t0.oi?.reason}</p>
          </div>
        </section>
      )}
    </main>
  );
}
