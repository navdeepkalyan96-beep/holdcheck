import Link from "next/link";

export default function Nav() {
  return (
    <nav className="w-full border-b border-[#1C1F22]">
      <div className="max-w-[960px] mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#7FC49A]" aria-hidden="true" />
          <span className="font-[family-name:var(--font-display)] font-medium text-[15px] tracking-tight">
            HoldCheck
          </span>
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/#how-it-works"
            className="hidden sm:inline text-[13px] text-[#9AA1AB] hover:text-[#EDEEF0] transition-colors"
          >
            How it works
          </Link>
          <Link
            href="/app"
            className="text-[13px] font-[family-name:var(--font-mono)] px-3 py-1.5 border border-[#2A2E32] hover:border-[#3A3E42] hover:bg-[#15181B] transition-colors"
          >
            Open app
          </Link>
        </div>
      </div>
    </nav>
  );
}
