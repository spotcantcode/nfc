"use client";
import { useSyncExternalStore } from "react";
import { date } from "@/lib/utils";
const subscribe = () => () => {};
export function DateTime({ value, time = false }: { value: string | null; time?: boolean }) {
  const label = useSyncExternalStore(
    subscribe,
    () => date(value, time),
    () =>
      value
        ? new Intl.DateTimeFormat("en", {
            timeZone: "UTC",
            month: "short",
            day: "numeric",
            year: "numeric",
            ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
          }).format(new Date(value))
        : "Never",
  );
  return <time dateTime={value ?? undefined}>{label}</time>;
}
