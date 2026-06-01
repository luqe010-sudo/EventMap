import Link from "next/link";
import { listAdminOrganizers } from "@/lib/admin-organizers";

export const dynamic = "force-dynamic";

export default async function AdminOrganizersPage() {
  const organizers = await listAdminOrganizers();

  return (
    <main className="appShell managementShell">
      <div className="managementHeader">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h1>Organizatorzy</h1>
        </div>
        <Link href="/admin/organizers/new" className="primaryButton">Dodaj organizatora</Link>
      </div>

      <section className="managementPanel">
        <div className="managementTableWrap">
          <table className="managementTable">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Typ</th>
                <th>Kontakt</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((organizer) => {
                const owner = organizer.organizer_users.find((item) => item.role === "owner") ?? organizer.organizer_users[0];
                return (
                  <tr key={organizer.id}>
                    <td>{organizer.name}</td>
                    <td>{organizer.type ?? "-"}</td>
                    <td>
                      {organizer.email ?? organizer.phone ?? organizer.website ?? "-"}
                    </td>
                    <td>{owner?.user_id ?? "-"}</td>
                    <td>
                      <span className="statusPill">{organizer.is_verified ? "verified" : "new"}</span>
                    </td>
                    <td>
                      <div className="tableActions">
                        <Link href={`/admin/organizers/${organizer.id}/edit`}>Edytuj</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
