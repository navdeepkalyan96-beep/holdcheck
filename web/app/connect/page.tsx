"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ConnectPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [client, setClient] = useState("");
  const [pin, setPin] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("holdcheck_user");
      if (!raw) {
        router.replace("/login");
        return;
      }
      setUser(JSON.parse(raw).email || null);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`${API_URL}/broker/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, client_code: client, pin, totp }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Angel login failed");
      localStorage.setItem("holdcheck_broker", JSON.stringify({ broker: "angel", hint: data.client_hint, at: Date.now() }));
      router.push("/app");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 hero-gradient min-h-screen px-5 pt-28 pb-16">
      <div className="max-w-[460px] mx-auto">
        <p className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.2em] uppercase text-white/45">Step 2 of 2 · {user || "…"}</p>
        <h1 className="mt-3 text-[34px] tracking-tight font-[family-name:var(--font-display)]">Connect Angel One</h1>
        <p className="mt-3 text-[14px] text-white/60 leading-relaxed">SmartAPI key, client code, PIN, and a TOTP from the Angel app — or the TOTP secret you already put on Render. We test the login. We do not place orders.</p>
        <form onSubmit={submit} className="mt-10 space-y-4">
          <label className="block">
            <span className="text-[10px] tracking-[0.16em] uppercase text-white/40 font-[family-name:var(--font-mono)]">SmartAPI key</span>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="mt-1 w-full bg-[#0c0a18]/80 border border-white/15 rounded-full px-4 py-3 text-[15px]" autoComplete="off" />
          </label>
          <label className="block">
            <span className="text-[10px] tracking-[0.16em] uppercase text-white/40 font-[family-name:var(--font-mono)]">Client code</span>
            <input value={client} onChange={(e) => setClient(e.target.value)} className="mt-1 w-full bg-[#0c0a18]/80 border border-white/15 rounded-full px-4 py-3 text-[15px]" autoComplete="off" />
          </label>
          <label className="block">
            <span className="text-[10px] tracking-[0.16em] uppercase text-white/40 font-[family-name:var(--font-mono)]">PIN</span>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="mt-1 w-full bg-[#0c0a18]/80 border border-white/15 rounded-full px-4 py-3 text-[15px]" />
          </label>
          <label className="block">
            <span className="text-[10px] tracking-[0.16em] uppercase text-white/40 font-[family-name:var(--font-mono)]">TOTP or TOTP secret</span>
            <input value={totp} onChange={(e) => setTotp(e.target.value)} className="mt-1 w-full bg-[#0c0a18]/80 border border-white/15 rounded-full px-4 py-3 text-[15px]" autoComplete="one-time-code" placeholder="6-digit code or secret" />
          </label>
          {err && <p className="text-[13px] text-[#C77A6E]">{err}</p>}
          <button type="submit" disabled={busy} className="cta-gradient w-full rounded-full py-3 text-[15px] font-medium disabled:opacity-50">
            {busy ? "Checking Angel…" : "Connect broker"}
          </button>
        </form>
        <p className="mt-6 text-[12px] text-white/35">
          <Link href="/login" className="text-white/70">Back</Link>
          {" · "}
          Quotes only. Create the SmartAPI app at smartapi.angelone.in.
        </p>
      </div>
    </main>
  );
}
