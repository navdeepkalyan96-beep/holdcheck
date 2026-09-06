import Link from "next/link";

export default function Nav() {
  return (
    <nav className="w-full absolute top-0 left-0 z-20">
      <div className="max-w-[1100px] mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-white">
          <span className="w-2 h-2 rounded-full bg-[#7FF0C8]" aria-hidden="true" />
          <span className="font-[family-name:var(--font-display)] font-medium text-[15px] tracking-tight">
            HoldCheck
          </span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-5">
          <Link href="/#how-it-works" className="text-[13px] text-white/70 hover:text-white transition-colors">
            How
          </Link>
          <Link href="/pricing" className="text-[13px] text-white/70 hover:text-white transition-colors">
            Pricing
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
