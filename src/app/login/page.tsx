"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("dcasares.silva@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      window.location.href = "/today";
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "10vh auto 0" }}>
      <div className="topbar">
        <div>
          <h1>Claudio</h1>
          <div className="sub">Sign in to your time assistant</div>
        </div>
      </div>
      <form className="card" onSubmit={submit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
        />
        {error && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <span className="spacer" />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
      <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>
        Dev seed login: <b>dcasares.silva@gmail.com</b> / <b>claudio</b>
      </p>
    </div>
  );
}
