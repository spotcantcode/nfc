import { Radio } from "lucide-react";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Radio size={23} strokeWidth={1.8} />
      </span>
      {!compact && (
        <span className="text-xl font-semibold tracking-tight">
          tap<span className="text-muted-foreground font-normal"> / </span>space
          <span className="ml-2 rounded border px-1 py-0.5 align-middle text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
            NFC
          </span>
        </span>
      )}
    </div>
  );
}
