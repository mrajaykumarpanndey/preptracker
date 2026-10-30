"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Tracker" },
  { href: "/quiz", label: "Quizzes" },
  { href: "/insights", label: "Progress" },
  { href: "/focus", label: "Focus" },
  { href: "/settings", label: "Settings" },
];

// Guides belong to a topic on the tracker; a topic's quiz sits under Quizzes.
function section(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/guide")) return "/";
  return LINKS.find((l) => l.href !== "/" && pathname.startsWith(l.href))?.href ?? "";
}

/** The one header shown on every page. */
export default function SiteHeader() {
  const active = section(usePathname() ?? "/");
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>
            P
          </span>
          Prep Tracker
        </Link>
        <div className="site-header-right">
          <nav className="nav" aria-label="Main">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={link.href === active ? "active" : undefined} aria-current={link.href === active ? "page" : undefined}>
                {link.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
