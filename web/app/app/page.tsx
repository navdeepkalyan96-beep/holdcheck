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
  net_if_exited_now: number;
  exit_charges: ChargeBreakdown;
  no_live_bid_flag: boolean;
  theta_per_hour: number;
  expected_move_pts: number;
  time_to_worthless_min: number | null;
  theoretical_price_model: number;
  low_confidence: boolean;
  plan: { target_net?: number; max_loss?: number; is_inferred: boolean };
  required_move_pts: Record<string, number | null>;
  state: string;
  state_reason: string;
};

type ApiResponse = {
  tickets: Ticket[];
  errors: { row: number; error: string }[];
};

const STATE_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  on_plan: { label: "ON PLAN", color: "#7FC49A", bg: "#12211A", border: "#2C4A3A" },
  hope: { label: "HOPE", color: "#D6A25C", bg: "#241E12", border: "#4A3D26" },
  fear: { label: "FEAR", color: "#D9C25C", bg: "#242012", border: "#4A4326" },
  dead: { label: "DEAD", color: "#C77A6E", bg: "#241614", border: "#4A2E2A" },
  safe: { label: "SAFE", color: "#7FC49A", bg: "#12211A", border: "#2C4A3A" },
  at_risk: { label: "AT RISK", color: "#D6A25C", bg: "#241E12", border: "#4A3D26" },
  near_danger: { label: "NEAR DANGER", color: "#C77A6E", bg: "#241614", border: "#4A2E2A" },
  expiring_safe: { label: "EXPIRING SAFE", color: "#7FC49A", bg: "#12211A", border: "#2C4A3A" },
};

function rupee(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}\u20B9${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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
  const isNegative = ticket.net_if_exited_now < 0;

  return (
    <div className="border border-[#22262A] bg-[#101315]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-4 flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-display)] font-medium text-[15px]">
              {ticket.instrument}
            </span>
            <span className="text-[11px] text-[#7A818A] font-[family-name:var(--font-mono)]">
              {ticket.side} · {ticket.lots}L
            </span>
          </div>
          <div className="text-[11px] text-[#7A818A] mt-0.5">expiry {ticket.expiry}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="font-[family-name:var(--font-mono)] text-[16px] tabular-nums"
            style={{ color: isNegative ? "#C77A6E" : "#7FC49A" }}
          >
            {rupee(ticket.net_if_exited_now)}
          </span>
          <StateChip state={ticket.state} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#1C1F22] pt-3 space-y-3">
          <p className="text-[13px] leading-relaxed text-[#C4C8CD]">{ticket.state_reason}.</p>

          {ticket.no_live_bid_flag && (
            <p className="text-[12px] text-[#D6A25C]">No live bid — using LTP. Low confidence.</p>
          )}
          {ticket.low_confidence && !ticket.no_live_bid_flag && (
            <p className="text-[12px] text-[#D6A25C]">Low confidence — verify near expiry.</p>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-[family-name:var(--font-mono)] text-[13px] tabular-nums">
            <Metric label="Theta / hour" value={rupee(ticket.theta_per_hour)} />
            <Metric label="Expected move" value={`${ticket.expected_move_pts.toFixed(0)} pts`} />
            <Metric
              label="Time to worthless"
              value={ticket.time_to_worthless_min != null ? `${ticket.time_to_worthless_min.toFixed(0)} min` : "—"}
            />
            <Metric label="Model price" value={rupee(ticket.theoretical_price_model)} />
          </div>

          <div>
            <div className="text-[11px] text-[#7A818A] mb-1.5 font-[family-name:var(--font-mono)]">
              {ticket.side === "LONG" ? "REQUIRED MOVE" : "ADVERSE MOVE"}
            </div>
            <div className="space-y-1 font-[family-name:var(--font-mono)] text-[13px]">
              {Object.entries(ticket.required_move_pts).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-[#7A818A]">{k.replace(/_/g, " ")}</span>
                  <span className="tabular-nums">{v != null ? `${v > 0 ? "+" : ""}${v.toFixed(0)} pts` : "unreachable"}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-[#7A818A] mb-1.5 font-[family-name:var(--font-mono)]">
              PLAN {ticket.plan.is_inferred ? "(no plan — inferred)" : ""}
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[13px] text-[#C4C8CD]">
              {ticket.plan.target_net != null && `Target net ${rupee(ticket.plan.target_net)}`}
              {ticket.plan.max_loss != null && `Max loss ${rupee(ticket.plan.max_loss)}`}
            </div>
          </div>

          <details className="text-[12px]">
            <summary className="cursor-pointer text-[#7A818A] font-[family-name:var(--font-mono)]">
              exit charges breakdown
            </summary>
            <div className="mt-2 space-y-1 font-[family-name:var(--font-mono)] pl-2 border-l border-[#22262A]">
              {Object.entries(ticket.exit_charges).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[#9AA1AB]">
                  <span>{k.replace(/_/g, " ")}</span>
                  <span className="tabular-nums">{rupee(v)}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[#7A818A] text-[11px]">{label}</div>
      <div>{value}</div>
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

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-[480px]">
        <header className="mb-6">
          <h1 className="font-[family-name:var(--font-display)] font-medium text-[18px] tracking-tight">
            Upload today&apos;s positions
          </h1>
          <p className="text-[13px] text-[#7A818A] mt-1 leading-relaxed">
            CSV in, computed tickets out. Nothing is stored — each upload is processed and forgotten.
          </p>
        </header>

        <div
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className="border border-dashed border-[#2A2E32] hover:border-[#3A3E42] cursor-pointer px-4 py-8 text-center transition-colors"
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
          <p className="text-[13px] text-[#C4C8CD] font-[family-name:var(--font-mono)]">
            {loading ? "computing…" : "drop tradebook CSV, or tap to choose"}
          </p>
          <a
            href={`${API_URL}/csv-template`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-[#7A818A] underline underline-offset-2 mt-2 inline-block"
          >
            view expected columns
          </a>
        </div>

        {error && (
          <p className="text-[13px] text-[#C77A6E] mt-3 font-[family-name:var(--font-mono)]">{error}</p>
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

        {tickets && tickets.length === 0 && (
          <p className="text-[13px] text-[#7A818A] mt-6">No positions in this file.</p>
        )}

        <footer className="mt-10 pt-6 border-t border-[#1C1F22]">
          <p className="text-[11px] text-[#5C6269] leading-relaxed">
            Estimates only. Charges, theta, and required-move figures are modeled — not investment
            or tax advice. Verify against your broker&apos;s contract note.
          </p>
        </footer>
      </div>
    </main>
  );
}
