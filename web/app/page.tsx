import Link from "next/link";

function IconHold() {
  return (
    <svg viewBox="0 0 64 64" className="w-14 h-14" fill="none" aria-hidden>
      <rect x="8" y="18" width="48" height="32" rx="6" stroke="#7FF0C8" strokeWidth="1.6" />
      <path d="M20 34h24" stroke="#7FF0C8" strokeWidth="1.6" />
      <circle cx="32" cy="34" r="4" fill="#9b6dff" />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg viewBox="0 0 64 64" className="w-14 h-14" fill="none" aria-hidden>
      <path d="M10 34h12l6-14 8 28 6-14h12" stroke="#5ce6ff" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg viewBox="0 0 64 64" className="w-14 h-14" fill="none" aria-hidden>
      <path d="M20 12v40" stroke="#C77A6E" strokeWidth="1.6" />
      <path d="M20 14h24l-6 8 6 8H20V14Z" fill="#9b6dff" fillOpacity="0.85" />
    </svg>
  );
}

const FLOW = [
  { n: "01", title: "Park the lot", body: "Strike, expiry, side, target & stop in rupees." },
  { n: "02", title: "Market talks", body: "IV, theta, delta, OI update on the live book." },
  { n: "03", title: "State speaks", body: "Safe · At risk · Dead. You still exit." },
];

const STATES = [
  {
    name: "SAFE",
    color: "#7FC49A",
    bg: "#12211A",
    bar: 82,
    meaning: "Plan still holds",
    bits: ["Delta useful", "IV stable", "OI not against"],
  },
  {
    name: "AT RISK",
    color: "#D6A25C",
    bg: "#241E12",
    bar: 48,
    meaning: "Pressure on the hold",
    bits: ["Theta rising", "IV slipping", "OI mixed"],
  },
  {
    name: "DEAD",
    color: "#C77A6E",
    bg: "#241614",
    bar: 12,
    meaning: "Target path is gone",
    bits: ["Near expiry", "IV crush", "Low delta"],
  },
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
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/35 mb-8">Why a desk</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <IconHold />, title: "Entry is easy", line: "The trade starts after fill." },
              { icon: <IconPulse />, title: "Hope hides in ticks", line: "IV and theta move first." },
              { icon: <IconFlag />, title: "Crush is quiet", line: "Dead should be visible." },
            ].map((c) => (
              <div key={c.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 min-h-[220px] flex flex-col">
                {c.icon}
                <h3 className="text-[22px] mt-6 font-medium">{c.title}</h3>
                <p className="text-[16px] text-white/55 mt-2">{c.line}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="w-full px-8 sm:px-12 lg:px-20 pt-28">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/35 mb-4">The loop</p>
          <h2 className="text-[32px] sm:text-[44px] leading-tight font-medium mb-12">How you manage the trade</h2>
          <div className="grid lg:grid-cols-[1fr_40px_1fr_40px_1fr] items-stretch gap-y-8">
            {FLOW.map((s, i) => (
              <div key={s.n} className="contents">
                <div className="rounded-3xl border border-white/10 p-8 bg-[#0c0a18]">
                  <div className="w-12 h-12 rounded-full border border-[#7FF0C8]/40 text-[#7FF0C8] font-[family-name:var(--font-mono)] text-[14px] flex items-center justify-center">
                    {s.n}
                  </div>
                  <h3 className="text-[22px] font-medium mt-5">{s.title}</h3>
                  <p className="text-[15px] text-white/55 mt-3 leading-relaxed">{s.body}</p>
                </div>
                {i < FLOW.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center text-[#7FF0C8]/50 text-2xl">→</div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="w-full px-8 sm:px-12 lg:px-20 pt-28">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/35 mb-4">The read</p>
          <h2 className="text-[32px] sm:text-[44px] leading-tight font-medium mb-12">Three states. One glance.</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {STATES.map((s) => (
              <div key={s.name} className="rounded-3xl border border-white/10 p-8" style={{ background: s.bg }}>
                <div className="font-[family-name:var(--font-mono)] text-[13px] tracking-[0.16em]" style={{ color: s.color }}>
                  {s.name}
                </div>
                <p className="text-[22px] mt-3 font-medium">{s.meaning}</p>
                <div className="mt-6 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.bar}%`, background: s.color }} />
                </div>
                <p className="text-[11px] text-white/35 mt-2 font-[family-name:var(--font-mono)]">plan strength</p>
                <ul className="mt-6 space-y-2">
                  {s.bits.map((b) => (
                    <li key={b} className="text-[14px] text-white/70 flex gap-2">
                      <span style={{ color: s.color }}—</span> {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="w-full px-8 sm:px-12 lg:px-20 pt-28">
          <h2 className="text-[32px] sm:text-[44px] leading-tight font-medium mb-3">Two desks</h2>
          <p className="text-[16px] text-white/55 mb-10">Book watches. Hold decides the state.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-white/12 p-8 min-h-[220px]">
              <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-white/40">Free</p>
              <p className="text-[28px] mt-2">Book</p>
              <p className="font-[family-name:var(--font-mono)] text-[36px] mt-2">₹0</p>
              <p className="text-[15px] text-white/55 mt-4">Live lot on screen. No state engine.</p>
            </div>
            <div className="rounded-3xl border border-[#7b8cff]/35 p-8 min-h-[220px] bg-[#16128a]/20">
              <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-[#9b6dff]">Paid</p>
              <p className="text-[28px] mt-2">Hold</p>
              <p className="font-[family-name:var(--font-mono)] text-[36px] mt-2">₹249<span className="text-[16px] text-white/40"> / mo</span></p>
              <p className="text-[15px] text-white/55 mt-4">Full state, IV, theta, OI, required move.</p>
            </div>
          </div>
          <Link href="/pricing" className="cta-gradient inline-flex mt-10 items-center justify-center px-7 py-3 rounded-full text-white text-[14px] font-medium">
            Full pricing
          </Link>
        </section>

        <footer className="w-full px-8 sm:px-12 lg:px-20 pb-14 border-t border-white/10 pt-10 mt-24">
          <p className="text-[13px] text-white/40 leading-relaxed">
            HoldCheck manages the open trade. It does not place orders. Estimates only. Not advice.
          </p>
        </footer>
      </div>
    </main>
  );
}
