"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@") || password.length < 6) {
      setErr("Use a real email and a password of at least 6 characters.");
      return;
    }
    localStorage.setItem("holdcheck_user", JSON.stringify({ email, at: Date.now() }));
    router.push("/connect");
  }

  return (
    <main className="flex-1 hero-gradient min-h-screen px-5 pt-28 pb-16">
      <div className="max-w-[420px] mx-auto">
        <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.2em] uppercase text-white/45">Step 1 of 2</p>
        <h1 className="mt-3 text-[34px] tracking-tight font-[family-name:var(--font-display)]">Sign in</h1>
        <p className="mt-3 text-[14px] text-white/60 leading-relaxed">HoldCheck account first. Angel is the next screen. Nothing is stored on our servers yet — this session lives in your browser.</p>
        <form onSubmit={submit} className="mt-10 space-y-4">
          <label className="block">
            <span className="text-[10px] tracking-[0.16em] uppercase text-white/40 font-[family-name:var(--font-mono)]">Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full bg-[#0c0a18]/80 border border-white/15 rounded-full px-4 py-3 text-[15px]" />
          </label>
          <label className="block">
            <span className="text-[10px] tracking-[0.16em] uppercase text-white/40 font-[family-name:var(--font-mono)]">Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full bg-[#0c0a18]/80 border border-white/15 rounded-full px-4 py-3 text-[15px]" />
          </label>
          {err && <p className="text-[13px] text-[#C77A6E]">{err}</p>}
          <button type="submit" className="cta-gradient w-full rounded-full py-3 text-[15px] font-medium">Continue to broker</button>
        </form>
        <p className="mt-6 text-[12px] text-white/35">Already connected? <Link href="/app" className="text-white/70">Open the book</Link></p>
      </div>
    </main>
  );
}
