"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { inputCls } from "@/components/admin/ui";

export default function Login() {
  const [email, setEmail] = useState("admin@monolith.club");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/admin") ? next : "/admin";
    } else {
      setError((await res.json()).error ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <div data-theme="dark" style={{ ["--accent" as string]: "#FFD400", ["--accent-ink" as string]: "#0b0b0b" }} className="concrete grid min-h-[100svh] place-items-center px-5 text-[#ecebe4]">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[400px] border border-white/10 bg-[#111] p-8 pt-10"
      >
        <div className="tape absolute inset-x-0 top-0 h-2" /><div className="cut-sm mx-auto mb-6 grid size-14 place-items-center bg-accent text-accent-ink">
          <Lock className="size-6" />
        </div>
        <h1 className="display text-center text-[48px]">Control room</h1>
        <p className="mt-1 text-center text-[14px] text-white/50">Sign in to manage your gym.</p>
        <div className="mt-7 space-y-3">
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" />
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" autoFocus />
        </div>
        {error && <p className="mt-3 text-center text-[13px] text-[#ff3b30]">{error}</p>}
        <button disabled={loading} className="cut-sm mt-6 flex h-12 w-full items-center justify-center gap-2 bg-accent font-mono text-[15px] uppercase text-accent-ink transition active:scale-[0.98] disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"} <ArrowRight className="size-4" />
        </button>
        <p className="mt-5 text-center text-[12px] text-white/35">Demo password: monolith123</p>
      </motion.form>
    </div>
  );
}
