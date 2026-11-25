import Link from "next/link";
import { SearchX } from "lucide-react";

export const metadata = {
  title: "Nie znaleziono strony | MapaImprez",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotFound() {
  return (
    <main className="appShell managementShell statusPage">
      <div className="managementPanel statusPanel emptyState">
        <SearchX className="statusPageIcon" size={36} strokeWidth={1.7} aria-hidden="true" />
        <h1>Nie znaleziono strony</h1>
        <p>Ten adres nie prowadzi do aktywnej strony MapaImprez.pl.</p>
        <Link href="/" className="primaryButton">
          Wróć na stronę główną
        </Link>
      </div>
    </main>
  );
}
