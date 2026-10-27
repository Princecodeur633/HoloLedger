import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(selectClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(selectClass, "h-auto py-2", className)} {...props} />;
}

/** Amount input with the currency shown inside; accepts "15 000" or "12,5". */
export function MoneyInput({
  currency,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { currency: string }) {
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        placeholder="0"
        className={cn("h-10 pr-16", className)}
        {...props}
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
        {currencySymbol(currency)}
      </span>
    </div>
  );
}

export function currencySymbol(currency: string) {
  return currency === "XAF" || currency === "XOF" ? "FCFA" : currency;
}
