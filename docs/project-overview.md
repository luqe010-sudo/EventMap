# Project Overview

## Cel projektu

MapaImprez.pl to aplikacja webowa do odkrywania lokalnych wydarzeń w Polsce. Kod wskazuje na portal, w którym użytkownik może przeglądać wydarzenia według daty, lokalizacji, promienia, kategorii i ceny, a organizatorzy oraz administratorzy mogą dodawać i moderować treści.

Główne dane aplikacji pochodzą z Supabase/PostgreSQL. Warstwa publiczna pobiera wydarzenia przez `lib/events.ts`, a panele korzystają z server actions w `lib/admin-events.ts`, `lib/organizer-events.ts`, `lib/admin-organizers.ts` i `lib/user-account-actions.ts`.

## Typy użytkowników

- Gość przegląda publiczne wydarzenia; zalogowany Widz ma dodatkowo `/account`, nazwę użytkownika i zapisane wydarzenia.
- Organizator: po zalogowaniu ma dostęp do `/organizer` i może zarządzać wydarzeniami przypisanymi do organizatorów połączonych z jego kontem przez `organizer_users`.
- Admin: po zalogowaniu ma dostęp do `/admin`, może zarządzać wszystkimi wydarzeniami i organizatorami.

## Najważniejsze ekrany

- `/` - strona główna z hero, wyszukiwarką, filtrami, wyróżnionymi wydarzeniami i listą.
- `/wydarzenie/[slug]` - szczegóły wydarzenia po `events.slug`.
- `/wydarzenia/[city]` - strona miasta po `cities.slug`; stare adresy wydarzeń w tym formacie przekierowują na `/wydarzenie/[slug]`.
- `/kategoria/[slug]` - lista wydarzeń dla kategorii.
- `/login` - logowanie przez Supabase Auth email/hasło lub Google OAuth.
- `/account` - panel konta Widza (oraz kont administracyjnych) z nazwą użytkownika i `saved_events`; organizatorzy korzystają zamiast niego z odpowiednich sekcji `/organizer/settings` i `/organizer/saved`.
- `/admin` - dashboard admina.
- `/admin/events` - tabela wydarzeń i akcje moderacyjne.
- `/admin/events/new` oraz `/admin/events/[id]/edit` - formularz wydarzenia.
- `/admin/organizers`, `/admin/organizers/new`, `/admin/organizers/[id]/edit` - zarządzanie organizatorami.
- `/organizer` - dashboard organizatora.
- `/organizer/saved` - zapisane wydarzenia zalogowanego organizatora.
- `/organizer/events/new` oraz `/organizer/events/[id]/edit` - dodawanie i edycja własnych wydarzeń.

## Aktualny stan względem pierwotnego briefu

`PROJECT_BRIEF.md` opisuje MVP z lokalnymi danymi demonstracyjnymi i bez paneli zarządzania. Rzeczywisty kod jest dalej rozwinięty: korzysta już z Supabase, ma Supabase Auth, role, panele admina i organizatora oraz formularze zapisu wydarzeń.

## Elementy wymagające potwierdzenia

- Środowisko deploymentu wymaga potwierdzenia. W `app/layout.tsx` ustawiono `metadataBase` na `https://mapaimprez.pl`, ale konfiguracja hostingu nie jest w repozytorium.
- Faktyczne aktywne RLS policies w Supabase. W repozytorium nie ma migracji/polityk SQL.
- Proces scrapowania i AI ekstrakcji. Tabele techniczne istnieją częściowo w typach, ale w kodzie aplikacji nie ma implementacji crawlera ani pipeline'u AI.
- Konfiguracja dostawców Supabase Auth poza email/hasło.
