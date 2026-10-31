import Link from "next/link";
import { Activity, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageAdmin } from "@/lib/auth";
import { scanHistory } from "@/lib/tags";
import { DateTime } from "@/components/date-time";
import { buttonVariants } from "@/components/ui/button";
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageAdmin();
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Math.floor(Number(params.page) || 1)));
  const { scans, count } = await scanHistory(undefined, page);
  return (
    <>
      <p className="eyebrow mb-3">A LITTLE TAP GOES A LONG WAY</p>
      <h1 className="text-[34px] font-semibold tracking-tight">Moments of connection.</h1>
      <p className="mt-3 mb-8 text-sm text-muted-foreground">
        Scan activity across your workspace. Just the essentials, with privacy in mind.
      </p>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="font-medium">
            Recent scans{" "}
            <span className="ml-2 text-xs text-muted-foreground">{count.toLocaleString()}</span>
          </h2>
          <span className="text-xs text-muted-foreground">Last 90 days</span>
        </div>
        {scans.length ? (
          <ol className="divide-y">
            {scans.map((scan) => (
              <li key={scan.id} className="flex items-center gap-4 px-6 py-5">
                <div className="rounded-lg bg-secondary p-2.5">
                  <Activity size={18} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{scan.tags?.name ?? "Tag"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    NFC link opened <ArrowUpRight className="inline" size={12} />
                  </p>
                </div>
                <span className="text-right text-xs text-muted-foreground">
                  <DateTime value={scan.scanned_at} time />
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-6 py-20 text-center">
            <Activity className="mx-auto mb-4 text-primary" size={30} strokeWidth={1.5} />
            <h3 className="font-medium">Waiting for that first tap.</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              When someone opens an NFC link, it will appear here.
            </p>
            <Link
              className="mt-5 inline-block text-sm text-primary underline underline-offset-4"
              href="/dashboard"
            >
              Go to your tags
            </Link>
          </div>
        )}
        <div className="flex items-center justify-between border-t px-6 py-4 text-xs text-muted-foreground">
          <span>Page {page} · Times shown in your local timezone</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                aria-label="Previous scans"
                className={buttonVariants({ variant: "outline", size: "icon" })}
                href={`?page=${page - 1}`}
              >
                <ChevronLeft size={15} />
              </Link>
            )}
            {page * 30 < count && (
              <Link
                aria-label="Next scans"
                className={buttonVariants({ variant: "outline", size: "icon" })}
                href={`?page=${page + 1}`}
              >
                <ChevronRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </section>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        We record only the tag and timestamp. No IP addresses, location data, or device
        fingerprints. Link previews and bots can count as scans. Lifetime totals remain when
        detailed history expires.
      </p>
    </>
  );
}
