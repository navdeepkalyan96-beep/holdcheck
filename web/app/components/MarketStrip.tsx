"use client";

import { useEffect, useState } from "react";
import { API_URL, pricingPath } from "../lib/api";

type Row = { code: string; label: string; last: number | null; chg: number | null; pct: number | null };

function Arrow({ up }: { up: boolean }) {
  return <span className="inline-block text-[11px] leading-none">{up ? "▲" : "▼"}</span>;
}

export default function MarketStrip() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let live = true;
    const load = () => {
      fetch(pricingPath("/market/strip"))
        .then((r) => r.json())
        .then((d) => {
          if (live && Array.isArray(d.rows)) setRows(d.rows);
        })
        .catch(() => {
          fetch(`${API_URL}/market/strip`)
            .then((r) => r.json())
            .then((d) => {
              if (live && Array.isArray(d.rows)) setRows(d.rows);
            })
            .catch(() => {});
        });
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  const items = rows.length
    ? rows
    : ["Nifty", "Sensex", "Bank Nifty", "Fin Nifty", "S&P 500", "Nasdaq", "DAX", "Euro Stoxx", "Nikkei", "Hang Seng", "Brent", "US Dollar", "US 10Y"].map(
        (label) => ({ code: label, label, last: null, chg: null, pct: null })
      );

  return (
    <div className="fixed top-0 left-0 right-0 z-30 border-b border-white/10 bg-[#05030f]/90 backdrop-blur-md">
      <div className="flex overflow-hidden">
        <div className="tape-track flex gap-8 px-6 py-1.5 whitespace-nowrap">
          {[...items, ...items].map((r, i) => {
            const pct = r.pct;
            const up = (pct ?? 0) > 0;
            const down = (pct ?? 0) < 0;
            const color = up ? "#7FC49A" : down ? "#C77A6E" : "#C4C8CD";
            return (
              <span key={`${r.code}-${i}`} className="inline-flex items-baseline gap-2 text-[12px] font-[family-name:var(--font-mono)]">
                <span className="text-white/45 tracking-wide uppercase text-[10px]">{r.label}</span>
                <span className="text-white/90">{r.last == null ? "—" : r.last.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                {pct != null && (
                  <span style={{ color }} className="inline-flex items-center gap-1">
                    <Arrow up={up} />
                    {Math.abs(pct).toFixed(2)}%
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
