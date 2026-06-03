import Link from "next/link";

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
            Dane wydarzen pochodza z bazy Supabase.
          </p>
          <div className="footerSocial">
            <a href="#" aria-label="Facebook" className="footerSocialLink">FB</a>
            <a href="#" aria-label="Instagram" className="footerSocialLink">IG</a>
            <a href="#" aria-label="TikTok" className="footerSocialLink">TT</a>
          </div>
        </div>

        <div className="footerColumn">
          <h3>Nawigacja</h3>
          <ul>
            <li><Link href="/">Odkryj wydarzenia</Link></li>
            <li><Link href="/#events-list">Mapa i lista</Link></li>
            <li><Link href="/organizer">Panel organizatora</Link></li>
            <li><Link href="/login">Logowanie</Link></li>
          </ul>
        </div>

        <div className="footerColumn">
          <h3>Zarzadzanie</h3>
          <ul>
            <li><Link href="/admin">Panel admina</Link></li>
            <li><Link href="/admin/events">Wydarzenia</Link></li>
            <li><Link href="/admin/organizers">Organizatorzy</Link></li>
          </ul>
        </div>

        <div className="footerColumn footerNewsletter">
          <h3>Badz na biezaco</h3>
          <p>Zapisz sie do newslettera, gdy funkcja powiadomien bedzie gotowa.</p>
          <div className="footerNewsletterForm">
            <input type="email" placeholder="Twoj adres e-mail" className="footerNewsletterInput" />
            <button type="button" className="footerNewsletterBtn">Zapisz sie</button>
          </div>
        </div>
      </div>

      <div className="footerBottom">
        <p>(c) {new Date().getFullYear()} MapaImprez.pl</p>
      </div>
    </footer>
  );
}
