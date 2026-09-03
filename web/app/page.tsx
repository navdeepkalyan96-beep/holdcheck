import Link from "next/link";

function StatePill({ label, tone }: { label: string; tone: "success" | "warning" | "danger" }) {
  const styles = {
    success: { color: "#7FC49A", bg: "#12211A", border: "#2C4A3A" },
    warning: { color: "#D6A25C", bg: "#241E12", border: "#4A3D26" },
    danger: { color: "#C77A6E", bg: "#241614", border: "#4A2E2A" },
  }[tone];
  return (
    <span
      className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide px-2 py-1 border"
      style={{ color: styles.color, backgroundColor: styles.bg, borderColor: styles.border }}
    >
      {label}
    </span>
  );
}

const FEATURES = [
  {
    title: "Net if exited now",
    body: "Bid for longs, ask for shorts, minus real exit charges. Not the broker's MTM field.",
  },
  {
    title: "Required move vs expected move",
    body: "What Nifty needs to do to hit your target, next to what this expiry's straddle is already pricing.",
  },
  {
    title: "Theta, named",
    body: "Rupees lost or earned per hour, shown as a number — not folded invisibly into the MTM.",
  },
  {
    title: "Charges made visible",
    body: "Brokerage, STT, exchange, SEBI, stamp, GST — each line shown, formula included, versioned so a Budget change doesn't silently go stale.",
  },
  {
    title: "One ticket, both sides",
    body: "Same math for buyers and sellers — theta earned instead of lost, adverse move instead of required move.",
  },
  {
    title: "A cold state, not a cheer",
    body: "On plan, Hope, Fear, or Dead. No \"stay strong\", no \"book profits\" — just where the position actually stands.",
  },
];

const STEPS = [
  { n: "01", title: "Export your tradebook", body: "CSV from your broker, or fill in the template with today's open positions." },
  { n: "02", title: "Upload it", body: "Nothing is stored — each file is computed and forgotten." },
  { n: "03", title: "Read the ticket", body: "Net now, theta, required move, and a state label for every open leg." },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <section className="max-w-[640px] mx-auto px-4 pt-16 pb-12">
        <p className="font-[family-name:var(--font-mono)] text-[12px] text-[#7A818A] mb-4">
          NIFTY OPTIONS · NSE · INDIA
        </p>
        <h1 className="font-[family-name:var(--font-display)] font-medium text-[32px] sm:text-[40px] leading-[1.15] tracking-tight">
          Your broker&apos;s MTM isn&apos;t what you&apos;ll take home.
        </h1>
        <p className="text-[16px] text-[#9AA1AB] mt-4 leading-relaxed max-w-[520px]">
          HoldCheck shows the net rupees you&apos;d actually bank if you exited a position right
          now — charges and theta included — next to what the market is pricing for the rest of
          the move. Cold numbers, not a feeling.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Link
            href="/app"
            className="font-[family-name:var(--font-mono)] text-[13px] px-4 py-2.5 bg-[#EDEEF0] text-[#0C0E10] hover:bg-[#D4D6D9] transition-colors"
          >
            Open HoldCheck →
          </Link>
          <Link
            href="/#how-it-works"
            className="font-[family-name:var(--font-mono)] text-[13px] px-4 py-2.5 border border-[#2A2E32] hover:border-[#3A3E42] transition-colors"
          >
            How it works
          </Link>
        </div>
      </section>

      <section className="max-w-[640px] mx-auto px-4 py-10 border-t border-[#1C1F22]">
        <div className="border border-[#22262A] bg-[#101315]">
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-display)] font-medium text-[15px]">
                    NIFTY 24800CE
                  </span>
                  <span className="text-[11px] text-[#7A818A] font-[family-name:var(--font-mono)]">
                    LONG · 2L
                  </span>
                </div>
                <div className="text-[11px] text-[#7A818A] mt-0.5">expiry 2026-09-04</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-mono)] text-[16px] tabular-nums" style={{ color: "#C77A6E" }}>
                  -₹1,759
                </span>
                <StatePill label="HOPE" tone="warning" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#1C1F22] text-[13px] text-[#C4C8CD] leading-relaxed">
              Required move (202pts) is close to the expected move (214pts) the market is
              pricing. Theta ₹278/hour. Time to worthless ≈ 17 hours.
            </div>
          </div>
        </div>
        <p className="text-[12px] text-[#5C6269] mt-2 font-[family-name:var(--font-mono)]">
          real output from the pricing engine, not a mockup
        </p>
      </section>

      <section id="how-it-works" className="max-w-[640px] mx-auto px-4 py-10 border-t border-[#1C1F22]">
        <h2 className="font-[family-name:var(--font-display)] font-medium text-[18px] mb-6">
          How it works
        </h2>
        <div className="space-y-6">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-4">
              <span className="font-[family-name:var(--font-mono)] text-[13px] text-[#5C6269] pt-0.5 shrink-0">
                {s.n}
              </span>
              <div>
                <div className="font-[family-name:var(--font-display)] font-medium text-[15px]">{s.title}</div>
                <div className="text-[13px] text-[#9AA1AB] mt-1 leading-relaxed">{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[640px] mx-auto px-4 py-10 border-t border-[#1C1F22]">
        <h2 className="font-[family-name:var(--font-display)] font-medium text-[18px] mb-6">
          What every ticket shows
        </h2>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <div className="font-[family-name:var(--font-display)] font-medium text-[14px]">{f.title}</div>
              <div className="text-[13px] text-[#9AA1AB] mt-1 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[640px] mx-auto px-4 py-10 border-t border-[#1C1F22]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-[family-name:var(--font-display)] font-medium text-[16px]">
              Nifty options, NSE, India.
            </div>
            <div className="text-[13px] text-[#9AA1AB] mt-1">No login required for the CSV tool.</div>
          </div>
          <Link
            href="/app"
            className="font-[family-name:var(--font-mono)] text-[13px] px-4 py-2.5 bg-[#EDEEF0] text-[#0C0E10] hover:bg-[#D4D6D9] transition-colors shrink-0"
          >
            Open HoldCheck →
          </Link>
        </div>
      </section>

      <footer className="max-w-[640px] mx-auto px-4 py-8 border-t border-[#1C1F22]">
        <p className="text-[11px] text-[#5C6269] leading-relaxed">
          Estimates only. Charges, theta, and required-move figures are modeled — not investment
          or tax advice. Verify against your broker&apos;s contract note.
        </p>
      </footer>
    </main>
  );
}
