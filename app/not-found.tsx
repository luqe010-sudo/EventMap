import Link from "next/link";

export const metadata = {
  title: "Nie znaleziono strony | MapaImprez",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotFound() {
  return (
    <main className="appShell">
      <div className="emptyState">
        <h1>Nie znaleziono strony</h1>
        <p>Ten adres nie prowadzi do aktywnej strony MapaImprez.pl.</p>
        <Link href="/" className="primaryButton">
          Wroc na strone glowna
        </Link>
      </div>
    </main>
  );
}
