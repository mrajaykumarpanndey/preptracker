import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Tracker" },
  { href: "/insights", label: "Progress" },
  { href: "/focus", label: "Focus" },
  { href: "/settings", label: "Settings" },
];

export default function Nav({ active }: { active: string }) {
  return (
    <div className="topbar">
      <h1>Prep Tracker</h1>
      <div className="topbar-right">
      <ThemeToggle />
      <nav className="nav">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={link.href === active ? "active" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
      </div>
    </div>
  );
}
