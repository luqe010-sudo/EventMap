import Link from "next/link";

type OrganizerSectionNavProps = {
  active: "dashboard" | "events" | "profile" | "stats" | "settings";
};

const items = [
  { href: "/organizer", label: "Dashboard", key: "dashboard" },
  { href: "/organizer/events", label: "Moje wydarzenia", key: "events" },
  { href: "/organizer/profile", label: "Profil organizatora", key: "profile" },
  { href: "/organizer/stats", label: "Statystyki", key: "stats" },
  { href: "/organizer/settings", label: "Ustawienia", key: "settings" }
] as const;

export default function OrganizerSectionNav({ active }: OrganizerSectionNavProps) {
  return (
    <nav className="adminSectionNav" aria-label="Nawigacja panelu organizatora">
      <div className="adminSectionTabs">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`adminSectionTab ${active === item.key ? "adminSectionTabActive" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
