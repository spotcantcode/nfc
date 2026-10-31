"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-4 p-8">
      <p className="eyebrow">TEMPORARILY UNAVAILABLE</p>
      <h1 className="text-3xl font-semibold">We couldn’t load your workspace.</h1>
      <p className="text-muted-foreground">
        Check your connection and try again. If this continues, check the Supabase configuration.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
