import Link from "next/link";

export default function ValueProps() {
  return (
    <section className="valueSection">
      <div className="valueGrid">
        <div className="valueCard">
          <span className="valueIcon valueIconCamera"><ValueIcon name="camera" /></span>
          <h3>Wszystko w jednym miejscu</h3>
          <p>Przeglądaj wydarzenia i sprawdzaj szczegóły oraz linki do ich źródeł w jednym miejscu.</p>
        </div>
        <div className="valueCard">
          <span className="valueIcon valueIconPin"><ValueIcon name="pin" /></span>
          <h3>Lokalnie i aktualnie</h3>
          <p>Wybierz miejscowość i datę. Liczba dostępnych wydarzeń zależy od lokalnej oferty.</p>
        </div>
        <div className="valueCard">
          <span className="valueIcon valueIconHeart"><ValueIcon name="heart" /></span>
          <h3>Dopasowane do Ciebie</h3>
          <p>Filtruj wydarzenia według kategorii, daty i ceny, żeby znaleźć coś dla siebie.</p>
        </div>
        <div className="valueCard valueCardCta">
          <span className="valueIcon valueIconCalendar"><ValueIcon name="calendar" /></span>
          <h3>Organizujesz wydarzenie?</h3>
          <p>Załóż konto organizatora i prześlij wydarzenie do zatwierdzenia.</p>
          <Link href="/organizer/events/new" className="valueLink">
            Dodaj wydarzenie →
          </Link>
        </div>
      </div>
    </section>
  );
}

function ValueIcon({ name }: { name: "camera" | "pin" | "heart" | "calendar" }) {
  if (name === "camera") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4v-10Z" />
        <circle cx="12" cy="13.5" r="3" />
        <path d="M18 11h.01" />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    );
  }
  if (name === "heart") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.4 5.8a5.1 5.1 0 0 0-7.2 0L12 7l-1.2-1.2a5.1 5.1 0 1 0-7.2 7.2L12 21l8.4-8a5.1 5.1 0 0 0 0-7.2Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M4 10h16M8 14h2.5M13.5 14H16" />
    </svg>
  );
}
