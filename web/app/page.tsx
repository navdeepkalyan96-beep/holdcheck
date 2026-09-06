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
    title: "Hope is expensive",
    body: "The book stays open while theta and IV eat the edge. HoldCheck names that in rupees, on this lot, now.",
  },
  {
    title: "Charges are not one line",
    body: "Brokerage, STT, exchange, stamp, GST — itemised on the live tick so Net is what you can actually take.",
  },
  {
    title: "The plan needs a state",
    body: "Safe, At risk, or Dead from IV, delta, gamma, theta and OI — not from a feeling.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Enter the open legs",
    body: "Expiry, strike, CE or PE, side, lots, entry, rupee target and stop. Quotes come off the live chain.",
  },
  {
    n: "02",
    title: "Watch the live book",
    body: "Gross from LTP. Net after Angel charges. Glow green or red with the tick.",
  },
  {
    n: "03",
    title: "Analyze the hold",
    body: "Required Nifty move, theta so far, IV scenarios, OI tilt, and the state tag.",
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
      <section className="hero-gradient relative min-h-screen flex flex-col items-center justify-center px-6 sm:px-12 text-center overflow-hidden">
        <div className="w-full max-w-[1100px] mx-auto pt-16">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.22em] uppercase text-white/55 mb-6">
            Nifty options · after you are in · estimates, not advice
          </p>
          <h1 className="text-white font-[family-name:var(--font-display)] font-normal text-[36px] sm:text-[56px] lg:text-[68px] leading-[1.08] tracking-tight">
            Know what this lot is worth
            <br className="hidden sm:block" /> if you exit now.
          </h1>
          <p className="mt-7 text-white/88 text-[17px] sm:text-[21px] leading-relaxed max-w-[820px] mx-auto">
            Live net after charges. Theta, IV and OI on the open position — so hope does not run the book.
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

      <div className="bg-[#07051a] w-full min-h-screen">
        <section className="w-full px-8 sm:px-12 lg:px-20 pt-24">
          <div className="grid md:grid-cols-3 gap-10 lg:gap-16">
            {PROBLEM.map((p) => (
              <div key={p.title} className="border-t border-white/15 pt-6">
                <h3 className="text-[20px] font-medium mb-3">{p.title}</h3>
                <p className="text-[16px] text-white/65 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="w-full px-8 sm:px-12 lg:px-20 pt-28">
          <h2 className="text-[32px] sm:text-[44px] leading-tight font-medium mb-12">How the desk works</h2>
          <div className="grid lg:grid-cols-3 gap-10">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-[family-name:var(--font-mono)] text-[13px] text-white/35">{s.n}</span>
                <h3 className="text-[22px] font-medium mt-3">{s.title}</h3>
                <p className="text-[16px] text-white/65 mt-3 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="w-full px-8 sm:px-12 lg:px-20 pt-28">
          <h2 className="text-[32px] sm:text-[44px] leading-tight font-medium mb-3">Two desks</h2>
          <p className="text-[16px] text-white/55 mb-10">Free is the tick. Hold is the analysis.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-white/12 p-8 min-h-[220px]">
              <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-white/40">Free</p>
              <p className="text-[28px] mt-2">Book</p>
              <p className="font-[family-name:var(--font-mono)] text-[36px] mt-2">₹0</p>
              <p className="text-[15px] text-white/55 mt-4">Gross + Net after charges. Spot and strike quotes.</p>
            </div>
            <div className="rounded-3xl border border-[#7b8cff]/35 p-8 min-h-[220px] bg-[#16128a]/20">
              <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-[#9b6dff]">Paid</p>
              <p className="text-[28px] mt-2">Hold</p>
              <p className="font-[family-name:var(--font-mono)] text-[36px] mt-2">₹249<span className="text-[16px] text-white/40"> / mo</span></p>
              <p className="text-[15px] text-white/55 mt-4">State, IV, theta, OI, required move, charge stack.</p>
            </div>
          </div>
          <Link href="/pricing" className="cta-gradient inline-flex mt-10 items-center justify-center px-7 py-3 rounded-full text-white text-[14px] font-medium">
            Full pricing
          </Link>
        </section>

        <section className="w-full px-8 sm:px-12 lg:px-20 pt-28 pb-12">
          <h2 className="text-[28px] font-medium mb-8">States</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STATES.map((s) => (
              <div key={s.name} className="flex flex-col gap-3 items-start">
                <StatePill label={s.name} tone={s.tone} />
                <p className="text-[16px] text-white/65 leading-relaxed">{s.meaning}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="w-full px-8 sm:px-12 lg:px-20 pb-14 border-t border-white/10 pt-8">
          <p className="text-[13px] text-white/40 leading-relaxed">
            Live quotes via Angel One. Estimates only. Not advice. HoldCheck does not place orders.
          </p>
        </footer>
      </div>
    </main>
  );
}
