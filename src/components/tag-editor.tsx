"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import type { Tag } from "@/lib/types";
export function TagEditor({
  tag,
  open,
  onOpenChange,
  onCreated,
}: {
  tag?: Tag;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tag: Tag) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [values, setValues] = useState({
    name: tag?.name ?? "",
    destination_url: tag?.destination_url ?? "",
    description: tag?.description ?? "",
    active: tag?.active ?? true,
  });
  async function save() {
    setConfirm(false);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(tag ? `/api/tags/${tag.id}` : "/api/tags", {
        method: tag ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(
        tag ? "Tag updated. Same sticker, new possibilities." : "Your new connection is ready.",
      );
      onOpenChange(false);
      router.refresh();
      if (!tag) onCreated(data.tag);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save your tag. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <Link2 size={23} />
            </div>
            <DialogTitle className="text-2xl tracking-tight">
              {tag ? "Edit your connection" : "Make a new connection"}
            </DialogTitle>
            <DialogDescription>
              {tag
                ? "Your NFC URL stays the same. Changes go live as soon as you save."
                : "Give your tag a destination. We’ll take care of its permanent link."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-2 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (tag?.active && !values.active) setConfirm(true);
              else void save();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="tag-name">Tag name</Label>
              <Input
                id="tag-name"
                required
                maxLength={100}
                autoFocus
                placeholder="e.g. Studio welcome card"
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination URL</Label>
              <Input
                id="destination"
                type="url"
                required
                maxLength={2048}
                placeholder="https://your-next-destination.com"
                value={values.destination_url}
                onChange={(e) => setValues({ ...values, destination_url: e.target.value })}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                A public HTTPS link. Anyone scanning the sticker can see it.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <textarea
                id="description"
                className="field min-h-24 resize-y"
                maxLength={1000}
                placeholder="Where is this sticker? What’s it for?"
                value={values.description}
                onChange={(e) => setValues({ ...values, description: e.target.value })}
                disabled={busy}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border p-4">
              <span>
                <span className="block text-sm font-medium">Enable tag</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Ready to redirect when someone taps.
                </span>
              </span>
              <input
                aria-label="Enable tag"
                type="checkbox"
                className="size-5 accent-primary"
                checked={values.active}
                onChange={(e) => setValues({ ...values, active: e.target.checked })}
                disabled={busy}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                {busy ? "Saving…" : tag ? "Save changes" : "Create tag"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable this tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone tapping the sticker will see an unavailable message until you enable it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save()}>Disable and save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
