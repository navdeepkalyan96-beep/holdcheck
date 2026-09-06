import Link from "next/link";

const FREE = [
  "Live Gross PNL from LTP",
  "Live Net PNL after Angel charges",
  "Nifty spot on the book",
  "Selected strike LTP / open / bid / ask",
  "One Nifty leg",
];

const PAID = [
  "Everything in Free",
  "Analyze: Safe / At risk / Dead",
  "Written hold note from the numbers",
  "Theta in ₹ / hour and ₹ so far",
  "Implied IV from live LTP",
  "IV change across ticks",
  "Delta, gamma, vega on the ticket",
  "Required Nifty move to your ₹ target",
  "IV −2% / unchanged / +2% scenarios",
  "OI window ±5 strikes — bullish / bearish / neutral",
  "Rupee target and rupee stop (not premium)",
  "Charge hover: brokerage, STT 0.15%, NSE txn, SEBI, IPFT, stamp, GST",
  "IV-crush math on this lot (₹ per vol point)",
  "Angel 5m history used for IV study",
  "Telegram / push when state flips Dead (coming)",
  "LLM caption on the ticket (coming, paid only)",
];

function Check({ dim }: { dim?: boolean }) {
  return (
    <span className={`mt-0.5 inline-flex w-4 h-4 rounded-full border items-center justify-center shrink-0 ${
      dim ? "border-white/20 text-white/25" : "border-[#7FF0C8]/50 text-[#7FF0C8]"
    }`} aria-hidden>
      <span className="text-[10px]">✓</span>
    </span>
  );
}

export default function PricingPage() {
  return (
    <main className="flex-1">
      <section className="hero-gradient relative pt-28 pb-16 px-5 overflow-hidden">
        <div className="max-w-[920px] mx-auto text-center">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.22em] uppercase text-white/55 mb-5">
            Two desks. One book.
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[36px] sm:text-[52px] leading-[1.1] tracking-tight">
            See the rupees.
            <br className="hidden sm:block" /> Pay when you need the hold.
          </h1>
          <p className="mt-6 text-white/75 text-[17px] max-w-[640px] mx-auto leading-relaxed">
            Free is Gross and Net on the live tick. Hold is the rest of the desk — state, IV, theta, OI, required move.
          </p>
        </div>
      </section>

      <section className="bg-[#07051a] px-5 pb-24 -mt-4">
        <div className="max-w-[920px] mx-auto grid md:grid-cols-2 gap-5">
          <article className="rounded-[28px] border border-white/12 bg-white/[0.03] p-7 sm:p-8 flex flex-col">
            <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/40">Free</p>
            <h2 className="mt-3 text-[28px] font-medium tracking-tight">Book</h2>
            <div className="mt-4 font-[family-name:var(--font-mono)]">
              <span className="text-[40px] tracking-tight">₹0</span>
              <span className="text-white/40 text-[14px] ml-2">forever</span>
            </div>
            <p className="mt-3 text-[14px] text-white/55 leading-relaxed">The tick. Nothing else. Enough to see whether the broker MTM is a fantasy.</p>
            <ul className="mt-8 space-y-3 flex-1">
              {FREE.map((f) => (
                <li key={f} className="flex gap-3 text-[14px] text-white/80 leading-snug">
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/app" className="mt-8 inline-flex justify-center rounded-full border border-white/20 py-3 text-[14px] hover:bg-white/5">
              Open free book
            </Link>
          </article>

          <article className="rounded-[28px] border border-[#7b8cff]/35 bg-gradient-to-b from-[#16128a]/40 to-[#07051a] p-7 sm:p-8 flex flex-col shadow-[0_0_60px_rgba(90,100,255,0.18)]">
            <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-[#9b6dff]">Paid</p>
            <h2 className="mt-3 text-[28px] font-medium tracking-tight">Hold</h2>
            <div className="mt-4 font-[family-name:var(--font-mono)]">
              <span className="text-[40px] tracking-tight">₹249</span>
              <span className="text-white/40 text-[14px] ml-2">/ month</span>
            </div>
            <p className="text-[12px] text-white/40 mt-1 font-[family-name:var(--font-mono)]">or ₹2,399 / year</p>
            <p className="mt-3 text-[14px] text-white/70 leading-relaxed">The desk after entry. Built so one avoided IV-crush hold pays the month.</p>
            <ul className="mt-8 space-y-3 flex-1">
              {PAID.map((f) => (
                <li key={f} className="flex gap-3 text-[14px] text-white/85 leading-snug">
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/app" className="cta-gradient mt-8 inline-flex justify-center rounded-full py-3 text-[14px] font-medium">
              Start Hold
            </Link>
          </article>
        </div>

        <p className="max-w-[640px] mx-auto text-center text-[12px] text-white/35 mt-12 leading-relaxed">
          Estimates, not advice. HoldCheck does not place orders. Payment checkout is not wired yet — Start Hold opens the live book.
        </p>
      </section>
    </main>
  );
}
