import { ArrowUpRight, Link2, ShieldCheck, Radio, RefreshCw } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "@/components/login-form";
import { configured, managementEnabled } from "@/lib/config";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!managementEnabled()) notFound();
  const ready = configured();
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col overflow-hidden bg-[#183e32] p-12 text-[#edf4e8] lg:flex xl:p-16">
        <Brand />
        <div className="relative z-10 my-auto max-w-xl py-16">
          <p className="mb-6 text-xs font-medium uppercase tracking-[.25em] text-[#a6bda8]">
            Your physical world, connected.
          </p>
          <h1 className="text-6xl leading-[1.08] font-medium tracking-[-.045em] xl:text-7xl">
            One small tap.
            <br />
            <span className="text-[#c6dc93]">
              Endless
              <br />
              possibilities.
            </span>
          </h1>
          <p className="mt-8 max-w-sm text-base leading-7 text-[#b8cabc]">
            Write your sticker once. Change where it goes whenever inspiration strikes.
          </p>
          <div className="mt-12 flex items-center gap-4">
            <span className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <Radio size={32} strokeWidth={1.4} />
            </span>
            <span className="h-px w-10 bg-white/20" />
            <span className="rounded-full bg-[#c6dc93] p-3 text-[#183e32]">
              <Link2 size={20} />
            </span>
            <span className="h-px w-10 bg-white/20" />
            <span className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <ArrowUpRight size={32} strokeWidth={1.4} />
            </span>
          </div>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-xs text-[#b8cabc]">
          <RefreshCw size={14} /> A permanent link. A destination that evolves.
        </p>
        <div
          aria-hidden
          className="absolute -right-60 -bottom-72 size-[650px] rounded-full border border-white/5 shadow-[0_0_0_60px_#ffffff03,0_0_0_120px_#ffffff03,0_0_0_180px_#ffffff03]"
        />
      </section>
      <main className="flex flex-col px-6 py-6 sm:px-14 lg:px-20">
        <header className="flex items-center justify-between">
          <div className="lg:invisible">
            <Brand />
          </div>
          <ThemeToggle />
        </header>
        <div className="mx-auto my-auto w-full max-w-[370px] py-16">
          <p className="eyebrow mb-4">YOUR LOCAL WORKSPACE</p>
          <h2 className="text-3xl font-semibold tracking-tight">Welcome to Tapspace.</h2>
          <p className="mt-3 mb-8 text-sm leading-6 text-muted-foreground">
            A little space for all your connections.
            <br />
            Sign in to manage your NFC tags on this computer.
          </p>
          {!ready && (
            <div
              role="status"
              className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6"
            >
              <strong className="block font-medium">Let’s connect your workspace.</strong>Set the
              environment variables and apply the Supabase migration in the README to enable
              sign-in.
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mb-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
            >
              This sign-in link is expired, already used, or was opened in a different browser.
              Request a fresh link and open it here.
            </p>
          )}
          <LoginForm ready={ready} />
        </div>
        <footer className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={14} /> Private by design. Yours to control.
        </footer>
      </main>
    </div>
  );
}
