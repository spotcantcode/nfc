"use client";
import { useTheme } from "next-themes";
import { SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle light and dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunMoon size={18} />
    </Button>
  );
}
