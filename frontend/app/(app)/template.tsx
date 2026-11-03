/** Re-mounted on every navigation: each screen fades in instead of popping. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-in fade-in duration-200">{children}</div>;
}
