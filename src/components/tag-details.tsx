"use client";
import { DateTime } from "@/components/date-time";
import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  ArrowUpRight,
  Radio,
  Activity,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import type { Tag, Scan } from "@/lib/types";
export async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("NFC URL copied.");
    return true;
  } catch {
    toast.error("Copy failed. Select the link and copy it manually.");
    return false;
  }
}
export function TagDetails({
  tag,
  baseUrl,
  onClose,
  initialTab = "share",
}: {
  tag: Tag;
  baseUrl: string;
  onClose: () => void;
  initialTab?: "share" | "activity";
}) {
  const [tab, setTab] = useState(initialTab);
  const [copied, setCopied] = useState(false);
  const url = `${baseUrl}/nfc/${tag.id}`;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <p className="eyebrow mb-2">YOUR CONNECTION</p>
          <DialogTitle className="pr-5 text-2xl tracking-tight">{tag.name}</DialogTitle>
          <DialogDescription>
            {tag.active
              ? "Active and ready for its next tap."
              : "Disabled. Enable this tag to start redirecting."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex gap-1 border-b">
          <Button
            variant="ghost"
            className={
              tab === "share" ? "rounded-b-none border-b-2 border-primary" : "text-muted-foreground"
            }
            onClick={() => setTab("share")}
          >
            <Radio size={15} />
            NFC link & details
          </Button>
          <Button
            variant="ghost"
            className={
              tab === "activity"
                ? "rounded-b-none border-b-2 border-primary"
                : "text-muted-foreground"
            }
            onClick={() => setTab("activity")}
          >
            <Activity size={15} />
            Scan history
          </Button>
        </div>
        {tab === "share" ? (
          <div className="space-y-5">
            <div className="flex justify-center rounded-xl bg-secondary/60 py-6">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={url} size={156} level="M" title={`NFC URL for ${tag.name}`} />
              </div>
            </div>
            <div>
              <LabelText>Your permanent NFC URL</LabelText>
              <div className="mt-2 flex items-center gap-2 rounded-lg border bg-background p-3">
                <input
                  aria-label="Public NFC URL"
                  readOnly
                  value={url}
                  className="min-w-0 flex-1 bg-transparent text-xs font-mono outline-none"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Copy NFC URL"
                  onClick={async () => {
                    if (await copyUrl(url)) setCopied(true);
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <LabelText>Current destination</LabelText>
              <a
                className="mt-2 flex items-start gap-2 break-all text-sm text-primary hover:underline"
                href={tag.destination_url}
                target="_blank"
                rel="noreferrer"
              >
                {tag.destination_url}
                <ArrowUpRight size={15} className="shrink-0" />
              </a>
            </div>
            {tag.description && (
              <div>
                <LabelText>Private notes</LabelText>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {tag.description}
                </p>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-4 border-t pt-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="mt-1">
                  <DateTime value={tag.created_at} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last modified</dt>
                <dd className="mt-1">
                  <DateTime value={tag.updated_at} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total scans</dt>
                <dd className="mt-1">{tag.scan_count.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last scanned</dt>
                <dd className="mt-1">
                  <DateTime value={tag.last_scanned_at} time />
                </dd>
              </div>
            </dl>
            <div className="rounded-lg bg-secondary/70 p-4 text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">Ready for the real world?</span> Copy
              this URL into a URL record in your iPhone NFC writer, then write it to the sticker.{" "}
              <Link href="/dashboard/guide" className="text-primary underline" onClick={onClose}>
                Read the writing guide
              </Link>
              .
            </div>
          </div>
        ) : (
          <History tagId={tag.id} />
        )}
      </DialogContent>
    </Dialog>
  );
}
function LabelText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}
function History({ tagId }: { tagId: string }) {
  const [data, setData] = useState<{ scans: Scan[]; count: number } | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tags/${tagId}/scans?page=${page}`, { signal: controller.signal })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setData(result);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [tagId, page, retry]);
  if (error)
    return (
      <div role="alert" className="py-8 text-center text-sm">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => setRetry(retry + 1)}>
          Try again
        </Button>
      </div>
    );
  if (!data)
    return (
      <div role="status" className="flex justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading scan history" />
      </div>
    );
  return (
    <div className="py-2">
      <p className="mb-4 text-xs text-muted-foreground">
        Last 90 days. Timestamps are shown in your local time.
      </p>
      {!data.scans.length ? (
        <div className="py-10 text-center">
          <Activity className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">The first tap is still to come.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Scan your sticker or QR code to see activity here.
          </p>
        </div>
      ) : (
        <ol className="divide-y">
          {data.scans.map((scan) => (
            <li key={scan.id} className="flex items-center gap-3 py-3 text-sm">
              <span className="size-2 rounded-full bg-primary" />
              <span>Tag opened</span>
              <span className="ml-auto text-xs text-muted-foreground">
                <DateTime value={scan.scanned_at} time />
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{data.count.toLocaleString()} recorded scans</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous scans"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={14} />
          </Button>
          <span>Page {page}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next scans"
            disabled={page * 30 >= data.count}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
