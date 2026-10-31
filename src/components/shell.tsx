"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutGrid,
  Activity,
  BookOpen,
  ArrowUpRight,
  LogOut,
  Radio,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
const links = [
  { href: "/dashboard", label: "All tags", icon: LayoutGrid },
  { href: "/dashboard/activity", label: "Scan activity", icon: Activity },
  { href: "/dashboard/guide", label: "Writing guide", icon: BookOpen },
];
export function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Couldn’t sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b bg-background/95 px-5 backdrop-blur lg:hidden">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </header>
      {open && (
        <button
          className="fixed inset-0 top-[72px] z-20 bg-black/30 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[252px] flex-col border-r bg-sidebar px-5 py-8 transition-transform lg:translate-x-0",
          open ? "top-[72px]" : "-translate-x-full",
        )}
      >
        <Link href="/dashboard" className="px-2">
          <Brand />
        </Link>
        <p className="eyebrow mt-14 mb-4 px-3">WORKSPACE</p>
        <nav className="space-y-1.5">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-sidebar-accent text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon size={18} strokeWidth={1.7} />
              {label}
              {pathname === href && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="mb-6 rounded-xl border bg-background/50 p-4">
            <Radio className="mb-3 text-primary" size={23} />
            <p className="text-sm font-medium">Write once. Redirect forever.</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Your next destination is only an edit away.
            </p>
            <Link
              href="/dashboard/guide"
              onClick={() => setOpen(false)}
              className="mt-4 flex items-center gap-1 text-xs font-medium text-primary"
            >
              How it works <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="flex items-center gap-2 border-t pt-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium uppercase">
              {email.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">Personal workspace</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground" title={email}>
                {email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="Sign out"
              disabled={busy}
              onClick={logout}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            </Button>
          </div>
        </div>
      </aside>
      <div className="lg:ml-[252px]">
        <header className="hidden h-[76px] items-center justify-between border-b px-10 lg:flex">
          <p className="text-sm text-muted-foreground">
            Workspace <span className="mx-3 text-border">/</span>{" "}
            <span className="text-foreground">
              {links.find((l) => l.href === pathname)?.label ?? "All tags"}
            </span>
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-600" /> Private workspace
            </span>
            <span className="h-4 border-l" />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-5 sm:p-8 lg:p-10">{children}</main>
        <footer className="mx-5 mt-4 flex justify-between border-t py-6 text-[11px] text-muted-foreground sm:mx-8 lg:mx-10">
          <span>
            Tapspace <span className="mx-1">/</span> Your connections, in one place.
          </span>
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
          <span className="hidden sm:block">Built for a world beyond the screen.</span>
        </footer>
      </div>
    </div>
  );
}
