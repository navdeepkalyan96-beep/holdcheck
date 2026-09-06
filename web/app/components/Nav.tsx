import Link from "next/link";
import Logo from "./Logo";

export default function Nav() {
  return (
    <nav className="w-full absolute top-0 left-0 z-20">
      <div className="w-full px-4 sm:px-8 h-[4.25rem] sm:h-20 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 text-white min-w-0">
          <Logo className="w-8 h-8 sm:w-11 sm:h-11 shrink-0" />
          <span className="flex flex-col leading-none min-w-0">
            <span className="font-[family-name:var(--font-display)] font-medium text-[18px] sm:text-[26px] tracking-tight truncate">
              HoldCheck
            </span>
            <span className="hidden sm:block mt-1 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.14em] uppercase text-white/45">
              Trade management for the open lot
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <Link href="/pricing" className="text-[12px] sm:text-[13px] text-white/70 hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="text-[12px] sm:text-[13px] text-white/70 hover:text-white">
            Login
          </Link>
          <Link
            href="/app"
            className="text-[12px] sm:text-[13px] font-[family-name:var(--font-mono)] px-2.5 sm:px-3 py-1.5 rounded-full border border-white/25 text-white/90"
          >
            App
          </Link>
        </div>
      </div>
    </nav>
  );
}
