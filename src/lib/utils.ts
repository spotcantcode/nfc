import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function date(value: string | null, time = false) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
}
