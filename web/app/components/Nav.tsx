import Link from "next/link";

export default function Nav() {
  return (
    <nav className="w-full absolute top-0 left-0 z-20">
      <div className="w-full px-6 sm:px-10 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-white min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#7FF0C8] shrink-0" aria-hidden="true" />
          <span className="flex flex-col leading-none">
            <span className="font-[family-name:var(--font-display)] font-medium text-[22px] sm:text-[26px] tracking-tight">
              HoldCheck
            </span>
            <span className="mt-1 font-[family-name:var(--font-mono)] text-[10px] sm:text-[11px] tracking-[0.14em] uppercase text-white/45">
              Trade management for the open lot
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/pricing" className="text-[13px] text-white/70 hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/login" className="text-[13px] text-white/70 hover:text-white transition-colors">
            Login
          </Link>
          <Link
            href="/app"
            className="text-[13px] font-[family-name:var(--font-mono)] px-3 py-1.5 rounded-full border border-white/25 text-white/90 hover:border-white/50 hover:bg-white/5 transition-colors"
          >
            Open app
          </Link>
        </div>
      </div>
    </nav>
  );
}
