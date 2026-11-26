import { CalendarDays, Compass, MapPin } from "lucide-react";
import Link from "next/link";
import { listSeasons } from "@/lib/seasons";

export default function Footer() {
  return (
    <footer className="siteFooter" role="contentinfo">
      <div className="footerInner">
        <div className="footerBrand">
          <Link href="/" className="footerLogo">
            <img src="/mapaimprez_logo.svg" alt="" className="brandLogoMark" aria-hidden="true" />
            <span className="brandLogoText">Mapa<span>Imprez.pl</span></span>
          </Link>
          <p>
            Przewodnik po lokalnych wydarzeniach w Polsce.<br />
            Wybierz miejscowość i odkryj dostępną lokalną ofertę.
          </p>
        </div>

        <div className="footerColumn">
          <h3><Compass size={17} aria-hidden="true" /> Nawigacja</h3>
          <ul>
            <li><Link href="/">Odkryj wydarzenia</Link></li>
            <li><Link href="/#mapa">Mapa i lista</Link></li>
            <li><Link href="/organizer">Panel organizatora</Link></li>
            <li><Link href="/promowanie-wydarzen">Promuj wydarzenie – 39 zł</Link></li>
            <li><Link href="/regulamin">Regulamin i prywatność</Link></li>
          </ul>
        </div>

        <div className="footerColumn">
          <h3><MapPin size={17} aria-hidden="true" /> Popularne</h3>
          <ul>
            <li><Link href="/koncerty">Koncerty</Link></li>
            <li><Link href="/wroclaw">Wydarzenia we Wrocławiu</Link></li>
            <li><Link href="/warszawa">Wydarzenia w Warszawie</Link></li>
          </ul>
        </div>

        <div className="footerColumn footerSeasons">
          <h3><CalendarDays size={17} aria-hidden="true" /> Na sezon</h3>
          <ul>
            {listSeasons().map((season) => (
              <li key={season.slug}><Link href={`/${season.slug}`}>{season.linkLabel}</Link></li>
            ))}
          </ul>
        </div>

      </div>

      <div className="footerBottom">
        <span id="cookie-settings" />
        <p>(c) {new Date().getFullYear()} MapaImprez.pl</p>
      </div>
    </footer>
  );
}
