"use client";
import { DateTime } from "@/components/date-time";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  ArrowUpRight,
  Radio,
  CircleCheck,
  CirclePause,
  Activity,
  Copy,
  Pencil,
  QrCode,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowDownUp,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { TagEditor } from "@/components/tag-editor";
import { TagDetails, copyUrl } from "@/components/tag-details";
import { cn } from "@/lib/utils";
import type { Stats, Tag } from "@/lib/types";
type Filters = { page: number; q: string; status: string; sort: string; direction: string };
export function Dashboard({
  tags,
  count,
  stats,
  baseUrl,
  filters,
}: {
  tags: Tag[];
  count: number;
  stats: Stats;
  baseUrl: string;
  filters: Filters;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<Tag | "new" | null>(null);
  const [details, setDetails] = useState<{ tag: Tag; tab: "share" | "activity" } | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(filters.q);
  function navigate(next: Partial<Filters>) {
    const values = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => params.set(key, String(value)));
    router.push(`/dashboard?${params}`);
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tags/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeleting(null);
      toast.success("Tag deleted. Its URL will never be reassigned.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t delete this tag.");
    } finally {
      setBusy(false);
    }
  }
  const cards = [
    {
      label: "Total tags",
      value: stats.total,
      icon: Radio,
      foot: "Connections you've created",
      color: "text-primary",
    },
    {
      label: "Active tags",
      value: stats.active,
      icon: CircleCheck,
      foot: "Ready for the next tap",
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Disabled tags",
      value: stats.disabled,
      icon: CirclePause,
      foot: "Taking a little pause",
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Total scans",
      value: stats.scans,
      icon: Activity,
      foot: "Moments of connection",
      color: "text-primary",
    },
  ];
  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow mb-3">LESS FRICTION. MORE CONNECTION.</p>
          <h1 className="text-3xl font-semibold tracking-[-.035em] sm:text-[34px]">
            Your tags, at a glance<span className="text-primary">.</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Little links to your physical world. Make them go somewhere good.
          </p>
        </div>
        <Button className="mt-1 h-11 gap-2 px-5 shadow-sm" onClick={() => setEditor("new")}>
          <Plus size={17} />
          Create tag
        </Button>
      </div>
      <section
        aria-label="Workspace statistics"
        className="mb-9 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5"
      >
        {cards.map(({ label, value, icon: Icon, foot, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <Icon size={17} strokeWidth={1.6} className={color} />
            </div>
            <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">
              {value.toLocaleString()}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">{foot}</p>
          </div>
        ))}
      </section>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight">All connections</h2>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {stats.total}
            </span>
          </div>
          <Link
            href="/dashboard/guide"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            New to NFC? <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div
            className="flex gap-1 rounded-lg bg-secondary/60 p-1"
            role="group"
            aria-label="Filter tag status"
          >
            {["all", "active", "disabled"].map((status) => (
              <button
                key={status}
                onClick={() => navigate({ status })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs capitalize transition-colors",
                  filters.status === status
                    ? "bg-card font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {status === "all" ? "All tags" : status}
              </button>
            ))}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ q: query });
              }}
              className="relative min-w-40 flex-1 sm:w-52"
            >
              <Search size={15} className="absolute top-2.5 left-3 text-muted-foreground" />
              <Input
                aria-label="Search tags"
                name="q"
                placeholder="Search tags…"
                maxLength={100}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 bg-background pl-9 text-xs"
              />
            </form>
            <div className="flex items-center rounded-md border bg-background">
              <ArrowDownUp size={13} className="ml-2 text-muted-foreground" />
              <select
                aria-label="Sort tags"
                className="h-9 max-w-36 bg-transparent pr-2 pl-1 text-xs outline-none"
                value={`${filters.sort}:${filters.direction}`}
                onChange={(e) => {
                  const [sort, direction] = e.target.value.split(":");
                  navigate({ sort, direction });
                }}
              >
                <option value="created_at:desc">Newest first</option>
                <option value="created_at:asc">Oldest first</option>
                <option value="name:asc">Name: A to Z</option>
                <option value="name:desc">Name: Z to A</option>
                <option value="scan_count:desc">Most scanned</option>
                <option value="last_scanned_at:desc">Recently scanned</option>
                <option value="updated_at:desc">Recently edited</option>
              </select>
            </div>
          </div>
        </div>
        {!tags.length ? (
          <div className="flex min-h-[330px] flex-col items-center justify-center border-t px-6 py-12 text-center">
            <div className="mb-5 rounded-2xl border bg-background p-5">
              <Radio size={30} strokeWidth={1.4} className="text-primary" />
            </div>
            <h3 className="text-lg font-medium">
              {stats.total === 0 ? "Every connection starts somewhere." : "No tags found."}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {stats.total === 0
                ? "Create your first tag, write it to a sticker, and let a simple tap do the rest."
                : "Try a different name or clear your filters to find your connection."}
            </p>
            <Button
              className="mt-6"
              variant={stats.total === 0 ? "default" : "outline"}
              onClick={() =>
                stats.total === 0
                  ? setEditor("new")
                  : (setQuery(""), navigate({ q: "", status: "all", page: 1 }))
              }
            >
              {stats.total === 0 ? (
                <>
                  <Plus size={15} />
                  Create your first tag
                </>
              ) : (
                "Clear filters"
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="divide-y border-t sm:hidden">
              {tags.map((tag) => (
                <article key={tag.id} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      className="min-w-0 truncate text-left text-sm font-medium"
                      onClick={() => setDetails({ tag, tab: "share" })}
                    >
                      {tag.name}
                    </button>
                    <Badge
                      variant="outline"
                      className={
                        tag.active
                          ? "shrink-0 border-transparent bg-emerald-600/8 text-emerald-700 dark:text-emerald-400"
                          : "shrink-0 text-muted-foreground"
                      }
                    >
                      {tag.active ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    {tag.destination_url.replace(/^https:\/\//, "")}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Created <DateTime value={tag.created_at} />
                    </span>
                    <button
                      className="flex min-h-8 items-center gap-1.5"
                      aria-label={`View scans for ${tag.name}`}
                      onClick={() => setDetails({ tag, tab: "activity" })}
                    >
                      <Activity size={12} />
                      {tag.scan_count.toLocaleString()} scans
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1 border-t pt-3">
                    <Button
                      className="h-11 text-xs text-muted-foreground"
                      variant="ghost"
                      aria-label={`Copy URL for ${tag.name}`}
                      onClick={() => void copyUrl(`${baseUrl}/nfc/${tag.id}`)}
                    >
                      <Copy size={14} />
                      Copy
                    </Button>
                    <Button
                      className="h-11 text-xs text-muted-foreground"
                      variant="ghost"
                      aria-label={`Show QR code for ${tag.name}`}
                      onClick={() => setDetails({ tag, tab: "share" })}
                    >
                      <QrCode size={14} />
                      QR
                    </Button>
                    <Button
                      className="h-11 text-xs text-muted-foreground"
                      variant="ghost"
                      aria-label={`Edit ${tag.name}`}
                      onClick={() => setEditor(tag)}
                    >
                      <Pencil size={14} />
                      Edit
                    </Button>
                    <Button
                      className="h-11 text-xs text-muted-foreground hover:text-destructive"
                      variant="ghost"
                      aria-label={`Delete ${tag.name}`}
                      onClick={() => setDeleting(tag)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto border-t sm:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-background/60 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium sm:px-6">Tag / Destination</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 text-right font-medium">Scans</th>
                    <th className="hidden px-5 py-3 font-medium xl:table-cell">Last scanned</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tags.map((tag) => (
                    <tr key={tag.id} className="group transition-colors hover:bg-secondary/30">
                      <td className="max-w-[220px] py-5 pr-3 pl-5 sm:max-w-[330px] sm:pl-6">
                        <div className="flex items-center gap-3">
                          <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl border bg-background text-primary sm:flex">
                            <Link2 size={18} strokeWidth={1.6} />
                          </span>
                          <div className="min-w-0">
                            <button
                              className="block max-w-full truncate text-left font-medium hover:text-primary"
                              onClick={() => setDetails({ tag, tab: "share" })}
                            >
                              {tag.name}
                            </button>
                            <p
                              className="mt-1.5 truncate text-xs text-muted-foreground"
                              title={tag.destination_url}
                            >
                              {tag.destination_url.replace(/^https:\/\//, "")}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground/80">
                              Created <DateTime value={tag.created_at} />
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1.5 border-transparent text-[10px] font-medium",
                            tag.active
                              ? "bg-emerald-600/8 text-emerald-700 dark:text-emerald-400"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              tag.active ? "bg-emerald-600" : "bg-muted-foreground",
                            )}
                          />
                          {tag.active ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-3 text-right">
                        <button
                          aria-label={`View scans for ${tag.name}`}
                          onClick={() => setDetails({ tag, tab: "activity" })}
                          className="font-medium tabular-nums hover:text-primary"
                        >
                          {tag.scan_count.toLocaleString()}
                        </button>
                      </td>
                      <td className="hidden px-5 text-xs whitespace-nowrap text-muted-foreground xl:table-cell">
                        <DateTime value={tag.last_scanned_at} time />
                      </td>
                      <td className="px-3">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            title="Copy NFC URL"
                            aria-label={`Copy URL for ${tag.name}`}
                            onClick={() => void copyUrl(`${baseUrl}/nfc/${tag.id}`)}
                          >
                            <Copy size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            title="QR code and details"
                            aria-label={`Show QR code for ${tag.name}`}
                            onClick={() => setDetails({ tag, tab: "share" })}
                          >
                            <QrCode size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            title="Edit tag"
                            aria-label={`Edit ${tag.name}`}
                            onClick={() => setEditor(tag)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            title="Delete tag"
                            aria-label={`Delete ${tag.name}`}
                            onClick={() => setDeleting(tag)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex items-center justify-between border-t px-5 py-4 text-xs text-muted-foreground sm:px-6">
          <span>
            {count
              ? `${(filters.page - 1) * 20 + 1}–${Math.min(filters.page * 20, count)} of ${count} tags`
              : "0 tags"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="Previous page"
              disabled={filters.page <= 1}
              onClick={() => navigate({ page: filters.page - 1 })}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="px-1">{filters.page}</span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="Next page"
              disabled={filters.page * 20 >= count}
              onClick={() => navigate({ page: filters.page + 1 })}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </section>
      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-primary/10 bg-secondary/60 px-6 py-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Radio size={25} strokeWidth={1.5} className="shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">The sticker stays. The destination evolves.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Update a destination anytime. There’s no need to rewrite your NFC tag.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/guide"
          className="flex shrink-0 items-center gap-2 text-xs font-medium text-primary"
        >
          Explore the writing guide <ArrowUpRight size={15} />
        </Link>
      </div>
      {editor && (
        <TagEditor
          key={editor === "new" ? "new" : editor.id}
          tag={editor === "new" ? undefined : editor}
          open
          onOpenChange={(open) => !open && setEditor(null)}
          onCreated={(tag) => setDetails({ tag, tab: "share" })}
        />
      )}
      {details && (
        <TagDetails
          key={details.tag.id}
          tag={tags.find((t) => t.id === details.tag.id) ?? details.tag}
          initialTab={details.tab}
          baseUrl={baseUrl}
          onClose={() => setDetails(null)}
        />
      )}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && !busy && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the tag and its scan history. The physical sticker will stop
              working. Its URL stays reserved forever and cannot be assigned to another tag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep tag</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
