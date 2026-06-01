# Project Overview

## Cel projektu

EventMap to aplikacja webowa do odkrywania lokalnych wydarzeń w Polsce. Kod wskazuje na portal, w którym użytkownik może przeglądać wydarzenia według daty, lokalizacji, promienia, kategorii i ceny, a organizatorzy oraz administratorzy mogą dodawać i moderować treści.

Główne dane aplikacji pochodzą z Supabase/PostgreSQL. Warstwa publiczna pobiera wydarzenia przez `lib/events.ts`, a panele zarządzania korzystają z server actions w `lib/admin-events.ts`, `lib/organizer-events.ts` i `lib/admin-organizers.ts`.

## Typy użytkowników

- Gość lub zwykły użytkownik: przegląda publiczne wydarzenia.
- Organizator: po zalogowaniu ma dostęp do `/organizer` i może zarządzać wydarzeniami przypisanymi do organizatorów połączonych z jego kontem przez `organizer_users`.
- Admin: po zalogowaniu ma dostęp do `/admin`, może zarządzać wszystkimi wydarzeniami i organizatorami.

## Najważniejsze ekrany

- `/` - strona główna z hero, wyszukiwarką, filtrami, wyróżnionymi wydarzeniami i listą.
- `/wydarzenie/[slug]` - szczegóły wydarzenia po `events.slug`.
- `/wydarzenia/[city]` - strona miasta po `city_pages.slug`; stare adresy wydarzeń w tym formacie przekierowują na `/wydarzenie/[slug]`.
- `/kategoria/[slug]` - lista wydarzeń dla kategorii.
- `/login` - logowanie przez Supabase Auth email/hasło.
- `/admin` - dashboard admina.
- `/admin/events` - tabela wydarzeń i akcje moderacyjne.
- `/admin/events/new` oraz `/admin/events/[id]/edit` - formularz wydarzenia.
- `/admin/organizers`, `/admin/organizers/new`, `/admin/organizers/[id]/edit` - zarządzanie organizatorami.
- `/organizer` - dashboard organizatora.
- `/organizer/events/new` oraz `/organizer/events/[id]/edit` - dodawanie i edycja własnych wydarzeń.

## Aktualny stan względem pierwotnego briefu

`PROJECT_BRIEF.md` opisuje MVP z lokalnymi danymi demonstracyjnymi i bez paneli zarządzania. Rzeczywisty kod jest dalej rozwinięty: korzysta już z Supabase, ma Supabase Auth, role, panele admina i organizatora oraz formularze zapisu wydarzeń.

## Elementy wymagające potwierdzenia

- Docelowa domena produkcyjna i środowisko deploymentu. W `app/layout.tsx` ustawiono `metadataBase` na `https://eventmap.pl`, ale konfiguracja hostingu nie jest w repozytorium.
- Faktyczne aktywne RLS policies w Supabase. W repozytorium nie ma migracji/polityk SQL.
- Proces scrapowania i AI ekstrakcji. Tabele techniczne istnieją częściowo w typach, ale w kodzie aplikacji nie ma implementacji crawlera ani pipeline'u AI.
- Konfiguracja dostawców Supabase Auth poza email/hasło.
