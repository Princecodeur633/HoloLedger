/** Countries offered next to phone fields. The server applies each country's numbering rules. */
export const COUNTRIES = [
  { code: "CG", dial: "+242", name: "Congo-Brazzaville", flag: "🇨🇬" },
  { code: "CD", dial: "+243", name: "RD Congo", flag: "🇨🇩" },
  { code: "CM", dial: "+237", name: "Cameroun", flag: "🇨🇲" },
  { code: "GA", dial: "+241", name: "Gabon", flag: "🇬🇦" },
  { code: "CF", dial: "+236", name: "Centrafrique", flag: "🇨🇫" },
  { code: "AO", dial: "+244", name: "Angola", flag: "🇦🇴" },
  { code: "TD", dial: "+235", name: "Tchad", flag: "🇹🇩" },
  { code: "CI", dial: "+225", name: "Côte d’Ivoire", flag: "🇨🇮" },
  { code: "SN", dial: "+221", name: "Sénégal", flag: "🇸🇳" },
  { code: "FR", dial: "+33", name: "France", flag: "🇫🇷" },
  { code: "BE", dial: "+32", name: "Belgique", flag: "🇧🇪" },
];

export const DEFAULT_COUNTRY = "CG";

export interface PhoneValue {
  country: string;
  number: string;
}

/** Body fields expected by the API for a phone typed with its country picker. */
export function phoneBody({ country, number }: PhoneValue) {
  return { phone: number, phone_country: country };
}

/** Pre-fill a picker from a stored E.164 number (+243991234567). */
export function phoneValue(e164: string | null | undefined): PhoneValue {
  if (!e164) return { country: DEFAULT_COUNTRY, number: "" };
  const match = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => e164.startsWith(c.dial));
  return { country: match?.code ?? DEFAULT_COUNTRY, number: e164 };
}

/** +242061234567 → "+242 061 234 567", for display only. */
export function formatPhone(e164: string) {
  const country = COUNTRIES.find((c) => e164.startsWith(c.dial));
  if (!country) return e164;
  const rest = e164.slice(country.dial.length);
  return `${country.dial} ${rest.replace(/\B(?=(\d{3})+$)/g, " ")}`;
}
