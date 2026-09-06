"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Candle = { t: string; o: number; h: number; l: number; c: number };
type Quote = { ltp?: number | null; open?: number | null; bid?: number | null; ask?: number | null };
type Market = { underlying?: number; expiry?: string; expiries?: string[]; strikes?: number[]; atm_strike?: number; quotes?: Record<string, Quote>; iv_atm?: number | null };
type Charges = Record<string, number>;
type Ticket = {
  instrument: string; side: string; lots: number; gross_pnl: number; net_pnl: number;
  theta_per_hour: number; theta_so_far: number | null;
  points_to_target: Record<string, number | null>;
  oi: { bias: string; reason: string };
  state: string; state_reason: string; analysis?: string;
  iv?: number; iv_change?: number | null;
  greeks?: { delta?: number; gamma?: number; theta_per_hour?: number };
  exit_charges?: Charges; entry_charges?: Charges; mark_price?: number;
};
type Leg = { expiry: string; strike: string; option_type: "CE" | "PE"; side: "LONG" | "SHORT"; lots: string; lot_size: string; entry_price: string; target_net: string; stop_loss: string; hours_open: string };

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
function ivLabel(k: string) {
  if (k.includes("minus")) return "IV -2%";
  if (k.includes("plus")) return "IV +2%";
  return "IV unchanged";
}

function Drop({ label, value, onChange, children, width }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; width?: string }) {
  return (
    <label className="inline-flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.14em] uppercase text-white/35 font-[family-name:var(--font-mono)]">{label}</span>
      <select className={`appearance-none bg-[#0c0a18] border border-white/12 rounded-full pl-3 pr-7 py-1.5 text-[13px] text-white ${width || "min-w-[7.5rem]"}`} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  );
}
function Field({ label, value, onChange, w, hint }: { label: string; value: string; onChange: (v: string) => void; w?: string; hint?: string }) {
  return (
    <label className="inline-flex flex-col gap-1" title={hint}>
      <span className="text-[10px] tracking-[0.14em] uppercase text-white/35 font-[family-name:var(--font-mono)]">{label}</span>
      <input className={`bg-[#0c0a18] border border-white/12 rounded-full px-3 py-1.5 text-[13px] text-white ${w || "w-24"}`} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default function Home() {
  const [legs, setLegs] = useState<Leg[]>([{ expiry: "", strike: "", option_type: "CE", side: "LONG", lots: "1", lot_size: "65", entry_price: "", target_net: "", stop_loss: "", hours_open: "2" }]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [market, setMarket] = useState<Market>({});
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
    setLegs((prev) => prev.map((x, i) => (i ? x : { ...x, expiry: x.expiry || m.expiry || "", strike: x.strike || (m.atm_strike != null ? String(m.atm_strike) : "") })));
    const positions = legsRef.current.filter((p) => p.strike && p.entry_price && p.expiry).map((p) => ({
      expiry: p.expiry, strike: Number(p.strike), option_type: p.option_type, side: p.side,
      lots: Number(p.lots), lot_size: Number(p.lot_size || 65), entry_price: Number(p.entry_price),
      target_net: p.target_net ? Number(p.target_net) : null,
      stop_loss: p.stop_loss ? Number(p.stop_loss) : null,
      hours_open: p.hours_open ? Number(p.hours_open) : 2,
    }));
    if (!positions.length) { setTickAt(new Date().toLocaleTimeString("en-IN", { hour12: false })); return; }
    const res = await fetch(`${API_URL}/tickets/live`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: "NIFTY", expiry: positions[0].expiry, positions }) });
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
  const entry = Number(L.entry_price);
  const qty = Number(L.lots || 1) * Number(L.lot_size || 65);
  const sign = L.side === "SHORT" ? -1 : 1;
  const hasEntry = Boolean(L.entry_price) && Number.isFinite(entry) && ltp != null;
  const points = hasEntry ? (Number(ltp) - entry) * sign : null;
  const grossLocal = points != null ? points * qty : null;
  const t0 = tickets[0];
  const feeTotal = (t0?.exit_charges?.total || 0) + (t0?.entry_charges?.total || 0);
  const netLocal = grossLocal != null ? grossLocal - feeTotal : null;
  const call = L.option_type === "CE";

  function onAnalyze() {
    if (!L.target_net || !L.stop_loss) { setPopup("Enter Target and Stop in rupees."); return; }
    setAnalysis(true);
    loadAll().catch((e) => setError(String(e.message || e)));
  }

  return (
    <main className="flex-1 px-4 pt-16 pb-12 max-w-[1080px] mx-auto w-full">
      {popup && <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center px-4" onClick={() => setPopup(null)}><div className="bg-[#12101c] border border-white/15 rounded-2xl p-5 max-w-sm" onClick={(e) => e.stopPropagation()}><p>{popup}</p><button type="button" className="mt-4 text-[13px] rounded-full border border-white/20 px-4 py-1.5" onClick={() => setPopup(null)}>OK</button></div></div>}
      <div className="flex items-baseline justify-between mb-4"><h1 className="text-[18px] font-medium">Live book</h1><span className="text-[11px] text-white/35 font-[family-name:var(--font-mono)]">{tickAt || "..."}</span></div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`border border-white/10 rounded-2xl p-4 ${grossLocal != null ? glow(grossLocal) : ""}`}><div className="text-[10px] text-white/35">GROSS</div><div className="text-[26px] font-[family-name:var(--font-mono)]" style={{ color: pnlColor(grossLocal || 0) }}>{grossLocal != null ? rupee(grossLocal) : "\u2014"}</div></div>
        <div className={`border border-white/10 rounded-2xl p-4 ${netLocal != null ? glow(netLocal) : ""}`}><div className="text-[10px] text-white/35">NET TICK</div><div className="text-[26px] font-[family-name:var(--font-mono)]" style={{ color: pnlColor(netLocal || 0) }}>{netLocal != null ? rupee(netLocal) : "\u2014"}</div></div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mb-5">
        <section className="border border-white/10 rounded-2xl p-3"><div className="text-[10px] text-white/35">NIFTY SPOT</div><div className="text-[20px] font-[family-name:var(--font-mono)]">{market.underlying ? market.underlying.toFixed(2) : "\u2014"}</div></section>
        <section className={`border rounded-2xl p-3 ${call ? "panel-call" : "panel-put"}`}><div className="text-[10px] text-white/45">{call ? "CALL" : "PUT"} {L.strike}</div><div className="text-[20px] font-[family-name:var(--font-mono)]">LTP {px(ltp)}</div><div className="text-[11px] text-white/45">open {px(q?.open)} · bid {px(q?.bid)} · ask {px(q?.ask)}</div></section>
      </div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Drop label="Expiry" value={L.expiry} onChange={(v) => setL({ expiry: v })} width="min-w-[8.5rem]">{(market.expiries || []).map((ex) => <option key={ex} value={ex}>{ex}</option>)}</Drop>
        <Drop label="Strike" value={L.strike} onChange={(v) => setL({ strike: v })}>{(market.strikes || []).filter((k) => k > 1000 && k < 100000).map((k) => <option key={k} value={String(k)}>{k}</option>)}</Drop>
        <Drop label="Type" value={L.option_type} onChange={(v) => setL({ option_type: v as "CE" | "PE" })} width="min-w-[4.5rem]"><option>CE</option><option>PE</option></Drop>
        <Drop label="Side" value={L.side} onChange={(v) => setL({ side: v as "LONG" | "SHORT" })} width="min-w-[5.5rem]"><option>LONG</option><option>SHORT</option></Drop>
        <Field label="Lots" value={L.lots} onChange={(v) => setL({ lots: v })} w="w-16" />
        <Field label="Entry" value={L.entry_price} onChange={(v) => setL({ entry_price: v })} />
        <Field label="Target" value={L.target_net} onChange={(v) => setL({ target_net: v })} hint="Rupees" />
        <Field label="Stop" value={L.stop_loss} onChange={(v) => setL({ stop_loss: v })} hint="Rupees you can lose" />
        <button type="button" className="cta-gradient rounded-full px-5 py-2 text-[13px]" onClick={onAnalyze}>Analyze</button>
      </div>
      {error && <p className="text-[12px] text-[#C77A6E] mb-3">{error}</p>}
      {analysis && t0 && (
        <section className="border border-white/10 rounded-2xl p-5 space-y-5 max-w-[560px]">
          <div className="font-[family-name:var(--font-mono)] text-[32px]" style={{ color: t0.state === "dead" ? "#C77A6E" : t0.state === "safe" ? "#7FC49A" : "#D6A25C" }}>{(t0.state || "").replace("_", " ").toUpperCase()}</div>
          <p className="text-[14px] text-white/70 leading-relaxed">{t0.analysis || t0.state_reason}</p>
          <div className="grid grid-cols-2 gap-3 text-[13px] font-[family-name:var(--font-mono)]">
            <div><div className="text-[10px] text-white/35">IV</div><div>{t0.iv != null ? (t0.iv * 100).toFixed(1) + "%" : "\u2014"} {t0.iv_change != null ? `(${t0.iv_change >= 0 ? "+" : ""}${(t0.iv_change * 100).toFixed(1)})` : ""}</div></div>
            <div><div className="text-[10px] text-white/35">DELTA</div><div>{t0.greeks?.delta ?? "\u2014"}</div></div>
            <div><div className="text-[10px] text-white/35">GAMMA</div><div>{t0.greeks?.gamma ?? "\u2014"}</div></div>
            <div><div className="text-[10px] text-white/35">THETA / H</div><div>{t0.theta_per_hour != null ? rupee(t0.theta_per_hour) : "\u2014"}</div></div>
          </div>
          <div>
            <div className="text-[10px] text-white/35 mb-1">REQUIRED NIFTY MOVE TO TARGET</div>
            {Object.entries(t0.points_to_target || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[13px] font-[family-name:var(--font-mono)]"><span className="text-white/45">{ivLabel(k)}</span><span>{v == null ? "\u2014" : `${v > 0 ? "+" : ""}${Number(v).toFixed(0)} pts`}</span></div>
            ))}
          </div>
          <div>
            <div className="text-[10px] text-white/35">OI</div>
            <div>{(t0.oi?.bias || "neutral").toUpperCase()}</div>
            <p className="text-[13px] text-white/55">{t0.oi?.reason}</p>
          </div>
        </section>
      )}
    </main>
  );
}
