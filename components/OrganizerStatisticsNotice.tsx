import type { StatisticsReadStatus } from "@/lib/organizer-statistics";

export default function OrganizerStatisticsNotice({ analyticsStatus, savesStatus }: {
  analyticsStatus: StatisticsReadStatus;
  savesStatus: StatisticsReadStatus;
}) {
  const missing = [
    analyticsStatus !== "complete" ? `interakcji (${analyticsStatus === "incomplete" ? "niepełny odczyt" : "niedostępne"})` : null,
    savesStatus !== "complete" ? `bieżących zapisań (${savesStatus === "incomplete" ? "niepełny odczyt" : "niedostępne"})` : null
  ].filter(Boolean);
  if (!missing.length) return null;
  return <div className="formError" role="alert">Nie udało się potwierdzić pełnych danych: {missing.join("; ")}. Brakujące liczniki oznaczono „—”. Odśwież stronę, aby spróbować ponownie.</div>;
}
