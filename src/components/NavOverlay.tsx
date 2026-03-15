import { Link } from "@/components/ui/link";

export function NavOverlay() {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 pointer-events-none">
      <div className="pointer-events-auto">
        <Link
          href="/"
          className="text-sm font-black tracking-tight bg-gradient-to-r from-primary to-[oklch(0.78_0.20_100)] bg-clip-text text-transparent hover:opacity-80 transition-opacity"
        >
          Brainrot Meter
        </Link>
      </div>
      <nav className="pointer-events-auto flex items-center gap-4">
        <Link
          href="/about"
          className="text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        >
          About
        </Link>
        <Link
          href="/blog"
          className="text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        >
          Blog
        </Link>
      </nav>
    </div>
  );
}
