"use client";
import { useState } from "react";
import { ArrowRight, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function LoginForm({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: new FormData(event.currentTarget).get("email") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (message)
    return (
      <div role="status" className="rounded-2xl border bg-secondary/50 p-6">
        <CheckCircle2 className="mb-4 text-primary" />
        <h2 className="mb-2 font-semibold">Check your inbox</h2>
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
        <Button className="mt-5" variant="outline" onClick={() => setMessage("")}>
          Use another email
        </Button>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3.5 text-muted-foreground" size={17} />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            maxLength={254}
            className="h-11 pl-10"
            disabled={!ready || busy}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="h-11 w-full justify-between" disabled={!ready || busy} type="submit">
        {busy ? "Sending your link…" : "Send sign-in link"}
        {busy ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Access is limited to approved email addresses. No password to remember, no account to
        create.
      </p>
    </form>
  );
}
