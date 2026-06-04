import Link from "next/link";

type AdminSection = "dashboard" | "events" | "review" | "organizers" | "locations" | "categories" | "cities";

type AdminSectionNavProps = {
  active: AdminSection;
};

const sections: Array<{ key: AdminSection; href: string; label: string }> = [
  { key: "dashboard", href: "/admin", label: "Dashboard" },
  { key: "events", href: "/admin/events", label: "Wydarzenia" },
  { key: "review", href: "/admin/review", label: "Do zatwierdzenia" },
  { key: "organizers", href: "/admin/organizers", label: "Organizatorzy" },
  { key: "locations", href: "/admin/locations", label: "Lokalizacje" },
  { key: "categories", href: "/admin/categories", label: "Kategorie" },
  { key: "cities", href: "/admin/cities", label: "Miasta SEO" }
];

export default function AdminSectionNav({ active }: AdminSectionNavProps) {
  return (
    <nav className="adminSectionNav" aria-label="Nawigacja panelu admina">
      <div className="adminSectionTabs" role="tablist" aria-label="Sekcje administracyjne">
        {sections.map((section) => (
          <Link
            key={section.key}
            href={section.href}
            className={`adminSectionTab ${active === section.key ? "adminSectionTabActive" : ""}`}
            aria-current={active === section.key ? "page" : undefined}
          >
            {section.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
