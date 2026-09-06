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

const PROBLEM = [
  {
    title: "MTM is a mark, not a payout",
    body: "Your broker marks the position to last traded price. That number ignores the spread you have to cross and every rupee of exit cost. You cannot withdraw MTM.",
  },
  {
    title: "Charges are not one line",
    body: "Exit is brokerage, exchange, SEBI, STT, stamp, GST. HoldCheck itemises the stack on the live bid or ask.",
  },
  {
    title: "Theta is already happening",
    body: "Decay is named in rupees per hour, not folded into a single MTM print.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Enter the open legs",
    body: "Expiry, strike, CE or PE, side, lots, entry, target and stop. Quotes come off the live chain.",
  },
  {
    n: "02",
    title: "Start live",
    body: "The book refreshes on the Angel tick: bid/ask, implied IV, OI window. Nothing is stored.",
  },
  {
    n: "03",
    title: "Read Gross, Net, and state",
    body: "Gross is LTP. Net is exit after charges. Hold adds theta, required move, OI, and Safe / At risk / Dead.",
  },
];

const STATES = [
  { name: "SAFE", tone: "success" as const, meaning: "Greeks and OI are not fighting the plan. Stop not hit." },
  { name: "AT RISK", tone: "warning" as const, meaning: "IV, theta, or OI is pressing the hold. Stop not yet hit." },
  { name: "DEAD", tone: "danger" as const, meaning: "Stop hit, or near expiry + high theta + IV crash + low delta." },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <section className="hero-gradient relative min-h-[92vh] flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        <div className="max-w-[920px] mx-auto pt-10">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.22em] uppercase text-white/55 mb-6">
            Nifty options · live book · estimates, not advice
          </p>
          <h1 className="text-white font-[family-name:var(--font-display)] font-normal text-[34px] sm:text-[50px] lg:text-[58px] leading-[1.12] tracking-tight">
            Your broker&apos;s MTM isn&apos;t what you&apos;ll take
            <br className="hidden sm:block" /> home.
          </h1>
          <p className="mt-7 text-white/88 text-[17px] sm:text-[20px] leading-relaxed max-w-[780px] mx-auto">
            Live bid or ask, charges and theta, next to what this expiry is already pricing.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link href="/app" className="cta-gradient inline-flex items-center justify-center min-w-[200px] px-8 py-3.5 rounded-full text-white text-[16px] font-medium">
              Open live book
            </Link>
            <Link href="/pricing" className="inline-flex items-center justify-center min-w-[160px] px-8 py-3.5 rounded-full text-white text-[16px] border border-white/25">
              Pricing
            </Link>
          </div>
        </div>
      </section>

      <div className="bg-[#07051a]">
        <section className="max-w-[880px] mx-auto px-5 pt-20">
          <div className="grid md:grid-cols-3 gap-8">
            {PROBLEM.map((p) => (
              <div key={p.title} className="border-t border-white/15 pt-5">
                <h3 className="text-[16px] font-medium mb-2">{p.title}</h3>
                <p className="text-[14px] text-white/65 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="max-w-[880px] mx-auto px-5 pt-20">
          <h2 className="text-[26px] sm:text-[32px] leading-tight font-medium mb-10">Live book. No CSV.</h2>
          <div className="space-y-8">
            {STEPS.map((s) => (
              <div key={s.n} className="grid sm:grid-cols-[72px_1fr] gap-3 sm:gap-6">
                <span className="font-[family-name:var(--font-mono)] text-[13px] text-white/35 pt-1">{s.n}</span>
                <div>
                  <h3 className="text-[17px] font-medium">{s.title}</h3>
                  <p className="text-[14px] text-white/65 mt-2 leading-relaxed max-w-[640px]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="max-w-[880px] mx-auto px-5 pt-20">
          <h2 className="text-[26px] sm:text-[32px] leading-tight font-medium mb-3">Two desks</h2>
          <p className="text-[14px] text-white/55 mb-8">Free is the tick. Hold is the analysis.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/12 p-6">
              <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-white/40">Free</p>
              <p className="text-[22px] mt-2">Book</p>
              <p className="font-[family-name:var(--font-mono)] text-[28px] mt-2">₹0</p>
              <p className="text-[13px] text-white/55 mt-3">Gross + Net after charges. Spot and strike quotes.</p>
            </div>
            <div className="rounded-2xl border border-[#7b8cff]/35 p-6 bg-[#16128a]/20">
              <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-[#9b6dff]">Paid</p>
              <p className="text-[22px] mt-2">Hold</p>
              <p className="font-[family-name:var(--font-mono)] text-[28px] mt-2">₹249<span className="text-[14px] text-white/40"> / mo</span></p>
              <p className="text-[13px] text-white/55 mt-3">State, IV, theta, OI, required move, charge stack.</p>
            </div>
          </div>
          <Link href="/pricing" className="cta-gradient inline-flex mt-8 items-center justify-center px-7 py-3 rounded-full text-white text-[14px] font-medium">
            Full pricing
          </Link>
        </section>

        <section className="max-w-[880px] mx-auto px-5 pt-20 pb-8">
          <h2 className="text-[22px] font-medium mb-6">States</h2>
          <div className="space-y-3">
            {STATES.map((s) => (
              <div key={s.name} className="flex gap-4 items-start">
                <StatePill label={s.name} tone={s.tone} />
                <p className="text-[14px] text-white/65 leading-relaxed">{s.meaning}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="max-w-[880px] mx-auto px-5 pb-12 border-t border-white/10 pt-8">
          <p className="text-[12px] text-white/40 leading-relaxed max-w-[720px]">
            Live quotes via Angel One. Estimates only. Not advice. HoldCheck does not place orders.
          </p>
        </footer>
      </div>
    </main>
  );
}
