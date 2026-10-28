"use client";

import { Input } from "@/components/ui/input";
import { COUNTRIES, type PhoneValue } from "@/lib/phone";
import { cn } from "@/lib/utils";

/** Country picker + number. A number typed with "+<code>" wins over the picked country. */
export function PhoneInput({
  id,
  value,
  onChange,
  invalid,
  required,
}: {
  id: string;
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  invalid?: boolean;
  required?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <select
        aria-label="Pays"
        value={value.country}
        onChange={(e) => onChange({ ...value, country: e.target.value })}
        className={cn(
          "border-input dark:bg-input/30 h-10 shrink-0 rounded-lg border bg-transparent px-2 text-sm",
        )}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dial} · {c.name}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="06 123 4567"
        required={required}
        value={value.number}
        onChange={(e) => onChange({ ...value, number: e.target.value })}
        aria-invalid={invalid}
        className="h-10 min-w-0 flex-1"
      />
    </div>
  );
}
