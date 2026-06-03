"use client";

import Link from "next/link";
import { useState } from "react";

type NavbarAuth =
  | { isLoggedIn: false }
  | {
      isLoggedIn: true;
      displayName: string;
      role: string;
    };

type NavbarClientProps = {
  auth: NavbarAuth;
};

export default function NavbarClient({ auth }: NavbarClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dashboardHref = auth.isLoggedIn && auth.role === "admin"
    ? "/admin"
    : auth.isLoggedIn && auth.role === "organizer"
      ? "/organizer"
      : null;

  return (
    <nav className="navbar" aria-label="Nawigacja glowna">
      <div className="navbarInner">
        <div className="navLeft">
          <Link href="/" className="navLogo">
            <img src="/mapaimprez_logo.svg" alt="" className="brandLogoMark" aria-hidden="true" />
            <span className="brandLogoText">Mapa<span>Imprez.pl</span></span>
          </Link>
        </div>

        <div className="navLinks">
          <Link href="/" className="navLink navLinkActive">
            Odkryj
          </Link>
          <Link href="/#events-list" className="navLink">
            Mapa
          </Link>
          <Link href="/organizer" className="navLink">
            Dla organizatorow
          </Link>
          {dashboardHref ? (
            <Link href={dashboardHref} className="navLink">
              Panel
            </Link>
          ) : null}
        </div>

        <div className="navRight">
          <button type="button" className="navThemeToggle" aria-label="Przelacz motyw">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
          {auth.isLoggedIn ? (
            <div className="navAccount">
              <span className="navUserInitial">{auth.displayName.charAt(0).toUpperCase()}</span>
              <span className="navUserName">{auth.displayName}</span>
              <form action="/auth/sign-out" method="post">
                <button type="submit" className="navAuthButton">Wyloguj</button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="navAuthButton">
              Zaloguj
            </Link>
          )}
        </div>

        <button
          className="navHamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu nawigacji"
          aria-expanded={menuOpen}
        >
          <span className={menuOpen ? "hamburgerOpen" : ""} />
          <span className={menuOpen ? "hamburgerOpen" : ""} />
          <span className={menuOpen ? "hamburgerOpen" : ""} />
        </button>
      </div>

      {menuOpen && (
        <div className="navMobileMenu">
          <Link href="/" onClick={() => setMenuOpen(false)}>Odkryj</Link>
          <Link href="/#events-list" onClick={() => setMenuOpen(false)}>Mapa</Link>
          <Link href="/organizer" onClick={() => setMenuOpen(false)}>Dla organizatorow</Link>
          {dashboardHref ? <Link href={dashboardHref} onClick={() => setMenuOpen(false)}>Panel</Link> : null}
          {auth.isLoggedIn ? (
            <form action="/auth/sign-out" method="post">
              <button type="submit">Wyloguj</button>
            </form>
          ) : (
            <Link href="/login" onClick={() => setMenuOpen(false)}>Zaloguj</Link>
          )}
        </div>
      )}
    </nav>
  );
}
