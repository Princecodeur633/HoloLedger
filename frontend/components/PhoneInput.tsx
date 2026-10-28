"use client";

import { ChevronDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { COUNTRIES, type PhoneValue } from "@/lib/phone";

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
  const country = COUNTRIES.find((c) => c.code === value.country) ?? COUNTRIES[0];
  return (
    <div className="flex gap-2">
      {/* Compact face (flag + code); the transparent native select on top keeps the phone's own picker. */}
      <div className="border-input dark:bg-input/30 relative flex h-10 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
        <span aria-hidden>{country.flag}</span>
        <span className="tabular-nums">{country.dial}</span>
        <ChevronDown className="text-muted-foreground size-3.5" aria-hidden />
        <select
          aria-label="Pays"
          value={value.country}
          onChange={(e) => onChange({ ...value, country: e.target.value })}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name} ({c.dial})
            </option>
          ))}
        </select>
      </div>
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
