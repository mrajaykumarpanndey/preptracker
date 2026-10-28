import Link from "next/link";

const LINKS = [
  { href: "/", label: "Tracker" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
];

export default function Nav({ active }: { active: string }) {
  return (
    <div className="topbar">
      <h1>Prep Tracker</h1>
      <nav className="nav">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={link.href === active ? "active" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
