import Link from "next/link";

export type AdminFilterField = {
  name: string;
  label: string;
  type?: "text" | "date" | "select";
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

export type AdminSortOption = {
  label: string;
  value: string;
};

type AdminTableFiltersProps = {
  action: string;
  fields: AdminFilterField[];
  values: Record<string, string | undefined>;
  sortOptions: AdminSortOption[];
  resultCount: number;
};

export default function AdminTableFilters({
  action,
  fields,
  values,
  sortOptions,
  resultCount
}: AdminTableFiltersProps) {
  return (
    <section className="managementPanel adminFilterPanel" aria-label="Filtry tabeli">
      <form action={action} className="adminFiltersForm">
        <div className="adminFiltersGrid">
          {fields.map((field) => (
            <label key={field.name}>
              {field.label}
              {field.type === "select" ? (
                <select name={field.name} defaultValue={values[field.name] ?? ""}>
                  <option value="">Wszystkie</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type ?? "text"}
                  defaultValue={values[field.name] ?? ""}
                  placeholder={field.placeholder}
                />
              )}
            </label>
          ))}

          <label>
            Sortuj po
            <select name="sort" defaultValue={values.sort ?? sortOptions[0]?.value ?? ""}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Kierunek
            <select name="dir" defaultValue={values.dir ?? "desc"}>
              <option value="desc">Malejaco</option>
              <option value="asc">Rosnaco</option>
            </select>
          </label>
        </div>

        <div className="adminFiltersActions">
          <span>{resultCount} wynikow</span>
          <button type="submit" className="primaryButton">Filtruj</button>
          <Link href={action} className="secondaryButton">Wyczysc</Link>
        </div>
      </form>
    </section>
  );
}
