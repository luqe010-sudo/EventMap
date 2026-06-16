"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

type NavbarAuth =
  | { isLoggedIn: false }
  | {
      isLoggedIn: true;
      displayName: string;
      email: string;
      role: string;
    };

type NavbarClientProps = {
  auth: NavbarAuth;
};

/* ── SVG icon helpers (inline, no dependency) ── */

function IconDiscover() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconOrganizer() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconPanel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconLogin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

export default function NavbarClient({ auth }: NavbarClientProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const dashboardHref =
    auth.isLoggedIn && auth.role === "admin"
      ? "/admin"
      : auth.isLoggedIn && auth.role === "organizer"
        ? "/organizer"
        : null;

  const roleLabel =
    auth.isLoggedIn && auth.role === "admin"
      ? "Administrator"
      : auth.isLoggedIn && auth.role === "organizer"
        ? "Organizator"
        : "Użytkownik";

  /* Close mobile menu on route change */
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  /* Close profile dropdown on click outside */
  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  /* Lock body scroll when mobile menu is open */
  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add("bodyScrollLock");
      document.documentElement.classList.add("bodyScrollLock");
    } else {
      document.body.classList.remove("bodyScrollLock");
      document.documentElement.classList.remove("bodyScrollLock");
    }
    return () => {
      document.body.classList.remove("bodyScrollLock");
      document.documentElement.classList.remove("bodyScrollLock");
    };
  }, [menuOpen]);

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const navLinks = [
    { href: "/", label: "Odkryj", icon: <IconDiscover /> },
    { href: "/#events-list", label: "Mapa", icon: <IconMap /> },
    { href: "/organizer", label: "Dla organizatorów", icon: <IconOrganizer /> },
    { href: "/regulamin", label: "Regulamin", icon: <IconDocument /> },
  ];

  return (
    <>
      <nav className={`navbar${menuOpen ? " navbarFixed" : ""}`} aria-label="Nawigacja główna">
        <div className="navbarInner">
        {/* ── Left: Logo ── */}
        <div className="navLeft">
          <Link href="/" className="navLogo">
            <img src="/mapaimprez_logo.svg" alt="" className="brandLogoMark" aria-hidden="true" />
            <span className="brandLogoText">Mapa<span>Imprez.pl</span></span>
          </Link>
        </div>

        {/* ── Center: Navigation links (desktop) ── */}
        <div className="navLinks">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`navLink${isActive(link.href) ? " navLinkActive" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* ── Right: Auth area (desktop) ── */}
        <div className="navRight">
          {auth.isLoggedIn ? (
            <div className="navProfileWrap" ref={profileRef}>
              <button
                type="button"
                className={`navProfileTrigger${profileOpen ? " navProfileTriggerOpen" : ""}`}
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                aria-label="Menu profilu"
              >
                <span className="navUserInitial">{auth.displayName.charAt(0).toUpperCase()}</span>
                <span className="navProfileName">{auth.displayName}</span>
                <svg className="navProfileChevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* ── Profile dropdown ── */}
              {profileOpen && (
                <div className="navProfileDropdown" role="menu">
                  <div className="navDropdownHeader">
                    <span className="navDropdownInitial">{auth.displayName.charAt(0).toUpperCase()}</span>
                    <div className="navDropdownUserInfo">
                      <span className="navDropdownName">{auth.displayName}</span>
                      {auth.email && <span className="navDropdownEmail">{auth.email}</span>}
                      <span className="navDropdownRole">{roleLabel}</span>
                    </div>
                  </div>
                  <div className="navDropdownDivider" />
                  {dashboardHref && (
                    <Link href={dashboardHref} className="navDropdownItem" role="menuitem" onClick={() => setProfileOpen(false)}>
                      <IconPanel />
                      <span>Panel zarządzania</span>
                    </Link>
                  )}
                  <div className="navDropdownDivider" />
                  <form action="/auth/sign-out" method="post" className="navDropdownForm">
                    <button type="submit" className="navDropdownItem navDropdownLogout" role="menuitem">
                      <IconLogout />
                      <span>Wyloguj się</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="navLoginBtn">
              <IconLogin />
              <span>Zaloguj</span>
            </Link>
          )}
        </div>

        {/* ── Hamburger (mobile) ── */}
        <button
          className={`navHamburger${menuOpen ? " navHamburgerOpen" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu nawigacji"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      </nav>
      {menuOpen && <div className="navbarSpacer" style={{ height: "64px" }} />}

      {/* ── Mobile overlay + menu ── */}
      {menuOpen && (
        <div className="navMobileOverlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}
      <div className={`navMobileMenu${menuOpen ? " navMobileMenuOpen" : ""}`}>
        <div className="navMobileLinks">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`navMobileLink${isActive(link.href) ? " navMobileLinkActive" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          ))}
        </div>

        <div className="navMobileDivider" />

        <div className="navMobileUserSection">
          {auth.isLoggedIn ? (
            <>
              <div className="navMobileUserInfo">
                <span className="navMobileUserInitial">{auth.displayName.charAt(0).toUpperCase()}</span>
                <div className="navMobileUserMeta">
                  <span className="navMobileUserName">{auth.displayName}</span>
                  <span className="navMobileUserRole">{roleLabel}</span>
                </div>
              </div>
              {dashboardHref && (
                <Link
                  href={dashboardHref}
                  className="navMobilePanelBtn"
                  onClick={() => setMenuOpen(false)}
                >
                  <IconPanel />
                  <span>Panel zarządzania</span>
                </Link>
              )}
              <form action="/auth/sign-out" method="post">
                <button type="submit" className="navMobileLogoutBtn">
                  <IconLogout />
                  <span>Wyloguj się</span>
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="navMobileLoginBtn" onClick={() => setMenuOpen(false)}>
              <IconLogin />
              <span>Zaloguj się</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
