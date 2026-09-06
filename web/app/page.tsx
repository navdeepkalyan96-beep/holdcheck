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
    title: "Entry is easy. The hold is the trade.",
    body: "Most tools help you build a strategy. Almost none sit with the live lot and tell you when the plan is still valid.",
  },
  {
    title: "Hope, fear, and greed hide in the book",
    body: "A small green print and you tighten. A decaying long and you wait. HoldCheck tags the state from IV, theta, delta and OI — not from the story you tell yourself.",
  },
  {
    title: "IV crush does not send a notification",
    body: "Near expiry, high theta, IV falling, low delta: the target is unlikely. That is Dead. You still choose the exit.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Put the live position on the desk",
    body: "Strike, expiry, side, lots, your rupee target and stop. This is management of what you already hold.",
  },
  {
    n: "02",
    title: "Watch the plan against the market",
    body: "Required Nifty move, theta, IV path, OI around the strike. The book updates while you are in the trade.",
  },
  {
    n: "03",
    title: "Read the state. Then act.",
    body: "Safe — on plan. At risk — pressure. Dead — the hold no longer earns the target. HoldCheck does not place the order.",
  },
];

const STATES = [
  { name: "SAFE", tone: "success" as const, meaning: "The open lot still matches the plan. Greeks and OI are not fighting you." },
  { name: "AT RISK", tone: "warning" as const, meaning: "IV, theta or OI is pressing the hold. The plan is under stress." },
  { name: "DEAD", tone: "danger" as const, meaning: "Stop hit, or expiry + theta + IV crush + low delta. Unlikely to reach target on this path." },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <section className="hero-gradient relative min-h-screen flex flex-col items-center justify-center px-6 sm:px-12 text-center overflow-hidden">
        <div className="w-full max-w-[1100px] mx-auto pt-16">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.22em] uppercase text-white/55 mb-6">
            After you are in · Nifty options · not a chain, a desk
          </p>
          <h1 className="text-white font-[family-name:var(--font-display)] font-normal text-[36px] sm:text-[56px] lg:text-[68px] leading-[1.08] tracking-tight">
            Manage the hold.
            <br className="hidden sm:block" /> Not the entry story.
          </h1>
          <p className="mt-7 text-white/88 text-[17px] sm:text-[21px] leading-relaxed max-w-[820px] mx-auto">
            A live state for the lot you already own — Safe, At risk, or Dead — from IV, theta, delta and OI.
            You keep the finger on the exit.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link href="/app" className="cta-gradient inline-flex items-center justify-center min-w-[200px] px-8 py-3.5 rounded-full text-white text-[16px] font-medium">
              Open the desk
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
          <h2 className="text-[32px] sm:text-[44px] leading-tight font-medium mb-12">How you manage the trade</h2>
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
          <p className="text-[16px] text-white/55 mb-10">Book watches the tick. Hold manages the plan.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-white/12 p-8 min-h-[220px]">
              <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-white/40">Free</p>
              <p className="text-[28px] mt-2">Book</p>
              <p className="font-[family-name:var(--font-mono)] text-[36px] mt-2">₹0</p>
              <p className="text-[15px] text-white/55 mt-4">See the live lot. No state, no Analyze.</p>
            </div>
            <div className="rounded-3xl border border-[#7b8cff]/35 p-8 min-h-[220px] bg-[#16128a]/20">
              <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-[#9b6dff]">Paid</p>
              <p className="text-[28px] mt-2">Hold</p>
              <p className="font-[family-name:var(--font-mono)] text-[36px] mt-2">₹249<span className="text-[16px] text-white/40"> / mo</span></p>
              <p className="text-[15px] text-white/55 mt-4">Safe / At risk / Dead, IV, theta, OI, required move.</p>
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
            HoldCheck manages the open trade. It does not place orders. Estimates only. Not advice.
          </p>
        </footer>
      </div>
    </main>
  );
}
