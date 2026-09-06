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
    body: "Your broker marks the position to last traded price. That number ignores the spread you actually have to cross, and it ignores every rupee of exit cost. You cannot withdraw MTM. You can only withdraw what is left after you sell or buy back at a real quote, after charges.",
  },
  {
    title: "Charges are not one line",
    body: "On NSE F&O the exit bill is brokerage, exchange transaction charges, SEBI turnover fee, STT, stamp duty, and GST on the service components. A profitable-looking MTM can flip after that stack. HoldCheck itemises each line instead of burying it in a blended percentage.",
  },
  {
    title: "Theta is already happening",
    body: "An option decays whether you look at it or not. Broker MTM folds that decay into a single number. HoldCheck names it: rupees per hour, and — for longs — an estimate of hours until the premium is economically worthless if the underlying does not move.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Export today's open legs",
    body: "Download a tradebook or positions CSV from your broker, or fill HoldCheck's template. Each row is one option: underlying, expiry, strike, CE/PE, lot size, side, lots, entry, live quotes, and the chain inputs used for the model (ATM IV, ATM premiums, forward).",
  },
  {
    n: "02",
    title: "Compute, do not store",
    body: "Upload the file. The pricing service reads it in memory, prices each row, and returns tickets. The file is not written to a database. Refresh the page and the session is gone.",
  },
  {
    n: "03",
    title: "Read the ticket, not a slogan",
    body: "Every ticket shows net-if-exited-now, the charge stack, theta per hour, required (or adverse) move versus the expiry's expected move, and a state label derived from those numbers — On plan, Hope, Fear, Dead for longs; Safe, At risk, Near danger for shorts.",
  },
];

const TICKET_FIELDS = [
  {
    title: "Net if exited now",
    body: "Longs are marked to bid; shorts to ask. Exit charges are subtracted. The result is the rupee P&L you would book if you closed at this instant. It is deliberately not LTP × lots.",
  },
  {
    title: "Exit charges",
    body: "Brokerage, exchange txn, SEBI fee, STT, stamp, GST, and a total. Rates in this version are documented placeholders — verify against a current NSE/SEBI circular and a real contract note before you treat a figure as final.",
  },
  {
    title: "Theta / hour",
    body: "Black-76 decay of the theoretical price, scaled to your lots and lot size, expressed in rupees per hour. Negative for longs (you pay time). Positive for shorts (you earn time), all else equal.",
  },
  {
    title: "Expected move",
    body: "Inferred from this expiry's ATM straddle (CE + PE premium). It is what the options market is already charging for the remaining session to expiry — not a forecast HoldCheck invented.",
  },
  {
    title: "Required / adverse move",
    body: "For a long: how many Nifty points the underlying still needs so that an exit would hit your target net after charges. For a short: how far an adverse move can go before your max-loss is breached. Compared side-by-side with expected move.",
  },
  {
    title: "State",
    body: "A classifier, not advice. If required move is well inside expected move and you are not burning through the plan on theta, the ticket is On plan. If the target needs more than the market is pricing, it is Hope. If time-to-worthless is short, Fear or Dead. Shorts use Safe / At risk / Near danger against max loss.",
  },
];

const STATES = [
  { name: "ON PLAN", tone: "success" as const, who: "Long", meaning: "Target is inside what this expiry is already pricing, and time decay has not yet invalidated the plan." },
  { name: "HOPE", tone: "warning" as const, who: "Long", meaning: "You still need a move close to, or larger than, the expected move. The market is not giving you that for free." },
  { name: "FEAR", tone: "warning" as const, who: "Long", meaning: "Time-to-worthless is short relative to the remaining session. Premium is decaying faster than the plan assumed." },
  { name: "DEAD", tone: "danger" as const, who: "Long", meaning: "The remaining premium cannot reasonably recover the plan before expiry under the model." },
  { name: "SAFE", tone: "success" as const, who: "Short", meaning: "Adverse move to max-loss is outside the expected move." },
  { name: "AT RISK", tone: "warning" as const, who: "Short", meaning: "An expected-sized move would press the max-loss." },
  { name: "NEAR DANGER", tone: "danger" as const, who: "Short", meaning: "A smaller-than-expected move already threatens the plan." },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <section className="hero-gradient relative min-h-[92vh] flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        <div className="max-w-[920px] mx-auto pt-10">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.22em] uppercase text-white/55 mb-6">
            Nifty options · NSE India · Estimates, not advice
          </p>
          <h1 className="text-white font-[family-name:var(--font-display)] font-normal text-[34px] sm:text-[50px] lg:text-[58px] leading-[1.12] tracking-tight">
            Your broker&apos;s MTM isn&apos;t what you&apos;ll take
            <br className="hidden sm:block" /> home.
          </h1>
          <p className="mt-7 text-white/88 text-[17px] sm:text-[20px] leading-relaxed max-w-[780px] mx-auto">
            HoldCheck shows the net rupees you would actually bank if you exited a
            position right now — bid or ask, charges and theta included — next to
            what this expiry is already pricing for the rest of the move.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#how-it-works"
              className="cta-gradient inline-flex items-center justify-center min-w-[220px] px-8 py-3.5 rounded-full text-white text-[16px] font-medium shadow-[0_12px_40px_rgba(80,90,255,0.35)]"
            >
              How it works
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center justify-center min-w-[180px] px-8 py-3.5 rounded-full text-white text-[16px] border border-white/25 hover:bg-white/5 transition-colors"
            >
              Open the tool
            </Link>
          </div>
        </div>
      </section>

      <div className="bg-[#07051a]">
        <section className="max-w-[880px] mx-auto px-5 pt-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/40 mb-3">
            Why this exists
          </p>
          <h2 className="text-[26px] sm:text-[32px] leading-tight font-medium mb-10 max-w-[640px]">
            Retail options P&amp;L is usually read off a screen that was never designed to be cashed.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {PROBLEM.map((p) => (
              <div key={p.title} className="border-t border-white/15 pt-5">
                <h3 className="text-[16px] font-medium mb-2">{p.title}</h3>
                <p className="text-[14px] text-white/65 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-[880px] mx-auto px-5 pt-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/40 mb-3">
            Sample ticket
          </p>
          <h2 className="text-[24px] font-medium mb-6">What the engine actually returns</h2>
          <div className="border border-white/10 bg-white/[0.03] rounded-xl overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[17px]">NIFTY 24800 CE</span>
                    <span className="text-[11px] text-white/50 font-[family-name:var(--font-mono)]">
                      LONG · 2 lots
                    </span>
                  </div>
                  <div className="text-[12px] text-white/45 mt-1">Expiry 4 Sep 2026 · marked to bid, after charges</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-mono)] text-[20px] tabular-nums" style={{ color: "#C77A6E" }}>
                    -₹1,759
                  </span>
                  <StatePill label="HOPE" tone="warning" />
                </div>
              </div>
              <p className="mt-4 pt-4 border-t border-white/10 text-[14px] text-white/75 leading-relaxed">
                Required move of 202 points is close to the 214-point expected move this expiry is
                pricing. Theta is ₹278 per hour. Time to worthless is about 17 hours if the index
                does not help. That is why the state is Hope, not On plan: the target is possible,
                but it is asking the market for nearly everything it is already charging.
              </p>
            </div>
          </div>
          <p className="text-[12px] text-white/40 mt-3 font-[family-name:var(--font-mono)]">
            Illustrative ticket from the pricing engine. Not a recommendation to hold or exit.
          </p>
        </section>

        <section id="how-it-works" className="max-w-[880px] mx-auto px-5 pt-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/40 mb-3">
            Workflow
          </p>
          <h2 className="text-[26px] sm:text-[32px] leading-tight font-medium mb-10">
            Three steps. No account. No stored book.
          </h2>
          <div className="space-y-8">
            {STEPS.map((s) => (
              <div key={s.n} className="grid sm:grid-cols-[72px_1fr] gap-3 sm:gap-6">
                <span className="font-[family-name:var(--font-mono)] text-[13px] text-white/35 pt-1">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-[17px] font-medium">{s.title}</h3>
                  <p className="text-[14px] text-white/65 mt-2 leading-relaxed max-w-[640px]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              href="/app"
              className="cta-gradient inline-flex items-center justify-center px-7 py-3 rounded-full text-white text-[14px] font-medium"
            >
              Upload a CSV
            </Link>
          </div>
        </section>

        <section className="max-w-[880px] mx-auto px-5 pt-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/40 mb-3">
            Ticket anatomy
          </p>
          <h2 className="text-[26px] sm:text-[32px] leading-tight font-medium mb-10">
            What every field means
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {TICKET_FIELDS.map((f) => (
              <div key={f.title} className="border-t border-white/12 pt-4">
                <h3 className="text-[15px] font-medium">{f.title}</h3>
                <p className="text-[14px] text-white/65 mt-2 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-[880px] mx-auto px-5 pt-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/40 mb-3">
            State labels
          </p>
          <h2 className="text-[26px] font-medium mb-3">A classifier, not a coach</h2>
          <p className="text-[14px] text-white/65 leading-relaxed max-w-[640px] mb-8">
            Labels describe the relationship between your plan, remaining time, and what the
            straddle is pricing. They do not tell you to book, hold, average, or “stay strong.”
          </p>
          <div className="overflow-x-auto border border-white/10 rounded-xl">
            <table className="w-full text-left text-[13px]">
              <thead className="text-white/45 font-[family-name:var(--font-mono)] text-[11px] tracking-wide">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-normal">State</th>
                  <th className="px-4 py-3 font-normal">Side</th>
                  <th className="px-4 py-3 font-normal">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                {STATES.map((s) => (
                  <tr key={s.name} className="border-b border-white/8 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatePill label={s.name} tone={s.tone} />
                    </td>
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">{s.who}</td>
                    <td className="px-4 py-3 text-white/70 leading-relaxed">{s.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="max-w-[880px] mx-auto px-5 pt-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-white/40 mb-3">
            Method, briefly
          </p>
          <h2 className="text-[26px] font-medium mb-6">Black-76, a fee stack, a state machine</h2>
          <div className="space-y-4 text-[14px] text-white/65 leading-relaxed max-w-[680px]">
            <p>
              Theoretical prices use Black-76 on the listed forward, with ATM implied vol taken
              from the chain you supply. That is the standard futures-style model for index options
              on NSE; it is not a proprietary signal.
            </p>
            <p>
              Net-if-exited-now uses the live bid for longs and the live ask for shorts. If bid/ask
              are missing, the engine falls back to LTP and flags the ticket as low confidence.
            </p>
            <p>
              Required move is solved from the model price so that, after the same fee stack, the
              position would print your target net (longs) or breach max loss (shorts). Expected
              move is the ATM straddle. The state machine only compares those quantities and the
              remaining life of the option.
            </p>
            <p>
              This version does not connect to a broker. You paste chain fields (IV, ATM premiums,
              forward) yourself. Live quote wiring is a later milestone.
            </p>
          </div>
        </section>

        <section className="max-w-[880px] mx-auto px-5 py-20">
          <div className="border border-white/10 rounded-2xl p-8 sm:p-10 bg-white/[0.03] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h2 className="text-[22px] font-medium">Run it on today&apos;s book</h2>
              <p className="text-[14px] text-white/60 mt-2 max-w-[420px] leading-relaxed">
                CSV in, tickets out. Nothing is stored. Keep the disclaimer on every number you show someone else.
              </p>
            </div>
            <Link
              href="/app"
              className="cta-gradient inline-flex items-center justify-center px-7 py-3 rounded-full text-white text-[14px] font-medium shrink-0"
            >
              Open HoldCheck
            </Link>
          </div>
        </section>

        <footer className="max-w-[880px] mx-auto px-5 pb-12 border-t border-white/10 pt-8">
          <p className="text-[12px] text-white/40 leading-relaxed max-w-[720px]">
            Estimates only. Charges, theta, required-move, and state labels are modeled. They are
            not investment, tax, or trading advice, and they are not a substitute for your broker&apos;s
            contract note or a current NSE/SEBI circular. Default fee rates in this build are
            placeholders until verified. HoldCheck does not place orders.
          </p>
        </footer>
      </div>
    </main>
  );
}
