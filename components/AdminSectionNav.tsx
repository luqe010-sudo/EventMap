import Link from "next/link";

type AdminSection = "events" | "organizers";

type AdminSectionNavProps = {
  active: AdminSection;
};

const sections: Array<{ key: AdminSection; href: string; label: string }> = [
  { key: "events", href: "/admin/events", label: "Wydarzenia" },
  { key: "organizers", href: "/admin/organizers", label: "Organizatorzy" }
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

      <div className="adminSectionActions">
        <Link href="/admin/events/new" className="secondaryButton">Dodaj wydarzenie</Link>
        <Link href="/admin/organizers/new" className="secondaryButton">Dodaj organizatora</Link>
      </div>
    </nav>
  );
}
