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
      <section className="hero-gradient relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        <div className="max-w-[920px] mx-auto pt-8">
          <h1 className="text-white font-[family-name:var(--font-display)] font-normal text-[36px] sm:text-[52px] lg:text-[60px] leading-[1.15] tracking-tight">
            Your broker&apos;s MTM isn&apos;t what you&apos;ll take
            <br className="hidden sm:block" /> home.
          </h1>
          <p className="mt-7 text-white/90 text-[18px] sm:text-[22px] leading-relaxed max-w-[820px] mx-auto">
            HoldCheck shows the net rupees you&apos;d actually bank if you exited a
            position right now — charges and theta included — next to what the
            market is pricing for the rest of the move. Cold numbers, not a
            feeling.
          </p>
          <div className="mt-16 flex justify-center">
            <Link
              href="/#how-it-works"
              className="cta-gradient inline-flex items-center justify-center min-w-[260px] px-10 py-4 rounded-full text-white text-[20px] underline underline-offset-4 decoration-white/80 hover:decoration-white transition-all shadow-[0_12px_40px_rgba(80,90,255,0.35)]"
            >
              How it works?
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#07051a] max-w-[640px] mx-auto px-4 py-16">
        <div className="border border-white/10 bg-white/[0.03] rounded-xl">
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-display)] font-medium text-[15px]">
                    NIFTY 24800CE
                  </span>
                  <span className="text-[11px] text-white/50 font-[family-name:var(--font-mono)]">
                    LONG · 2L
                  </span>
                </div>
                <div className="text-[11px] text-white/45 mt-0.5">expiry 2026-09-04</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-mono)] text-[16px] tabular-nums" style={{ color: "#C77A6E" }}>
                  -₹1,759
                </span>
                <StatePill label="HOPE" tone="warning" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 text-[13px] text-white/75 leading-relaxed">
              Required move (202pts) is close to the expected move (214pts) the market is
              pricing. Theta ₹278/hour. Time to worthless ≈ 17 hours.
            </div>
          </div>
        </div>
        <p className="text-[12px] text-white/40 mt-2 font-[family-name:var(--font-mono)]">
          real output from the pricing engine, not a mockup
        </p>
      </section>

      <section id="how-it-works" className="bg-[#07051a] max-w-[640px] mx-auto px-4 py-10 border-t border-white/10">
        <h2 className="font-[family-name:var(--font-display)] font-medium text-[18px] mb-6">
          How it works
        </h2>
        <div className="space-y-6">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-4">
              <span className="font-[family-name:var(--font-mono)] text-[13px] text-white/40 pt-0.5 shrink-0">
                {s.n}
              </span>
              <div>
                <div className="font-[family-name:var(--font-display)] font-medium text-[15px]">{s.title}</div>
                <div className="text-[13px] text-white/60 mt-1 leading-relaxed">{s.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/app"
            className="cta-gradient inline-flex items-center justify-center px-6 py-2.5 rounded-full text-white text-[14px]"
          >
            Open HoldCheck →
          </Link>
        </div>
      </section>

      <section className="bg-[#07051a] max-w-[640px] mx-auto px-4 py-10 border-t border-white/10">
        <h2 className="font-[family-name:var(--font-display)] font-medium text-[18px] mb-6">
          What every ticket shows
        </h2>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <div className="font-[family-name:var(--font-display)] font-medium text-[14px]">{f.title}</div>
              <div className="text-[13px] text-white/60 mt-1 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#07051a] max-w-[640px] mx-auto px-4 py-8 border-t border-white/10">
        <p className="text-[11px] text-white/40 leading-relaxed">
          Estimates only. Charges, theta, and required-move figures are modeled — not investment
          or tax advice. Verify against your broker&apos;s contract note.
        </p>
      </footer>
    </main>
  );
}
