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
    <div className="grid min-h-[100svh] place-items-center bg-[#f5f5f7] px-5 text-[#1d1d1f]">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px] rounded-[28px] bg-white p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.04)]"
      >
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-[18px] bg-[#1d1d1f] text-white">
          <Lock className="size-6" />
        </div>
        <h1 className="text-center text-[26px] font-semibold tracking-[-0.03em]">Studio Admin</h1>
        <p className="mt-1 text-center text-[14px] text-black/50">Sign in to manage your gym.</p>
        <div className="mt-7 space-y-3">
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" />
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" autoFocus />
        </div>
        {error && <p className="mt-3 text-center text-[13px] text-[#ff3b30]">{error}</p>}
        <button disabled={loading} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0a84ff] text-[15px] font-medium text-white transition active:scale-[0.98] disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"} <ArrowRight className="size-4" />
        </button>
        <p className="mt-5 text-center text-[12px] text-black/35">Demo password: monolith123</p>
      </motion.form>
    </div>
  );
}
