import { describe, expect, it } from "vitest";
import { cityLocative } from "../lib/city-locative";
import { formatInCity } from "../lib/slugs";

// Every active city in the database on 10 November 2026, with its correct locative.
const ACTIVE_CITIES: [string, string][] = [
  ["Aleksandrów Łódzki", "w Aleksandrowie Łódzkim"], ["Białka", "w Białce"], ["Białystok", "w Białymstoku"],
  ["Bielawa", "w Bielawie"], ["Bielsk Podlaski", "w Bielsku Podlaskim"], ["Bielsko-Biała", "w Bielsku-Białej"],
  ["Boszkowo", "w Boszkowie"], ["Bukowiec", "w Bukowcu"], ["Bydgoszcz", "w Bydgoszczy"], ["Chojnice", "w Chojnicach"],
  ["Cisna", "w Cisnej"], ["Czerna", "w Czernej"], ["Częstochowa", "w Częstochowie"], ["Ćmielów", "w Ćmielowie"],
  ["Dzierżoniów", "w Dzierżoniowie"], ["Elbląg", "w Elblągu"], ["Emilianów", "w Emilianowie"], ["Gdańsk", "w Gdańsku"],
  ["Gdańsk Sobieszewo", "w Gdańsku-Sobieszewie"], ["Gdańsk/Sopot", "w Gdańsku i Sopocie"], ["Gdynia", "w Gdyni"],
  ["Giżycko", "w Giżycku"], ["Gliwice", "w Gliwicach"], ["Gorzów Wielkopolski", "w Gorzowie Wielkopolskim"],
  ["Grudziądz", "w Grudziądzu"], ["Iłża", "w Iłży"], ["Jedwabno", "w Jedwabnie"], ["Kartuzy", "w Kartuzach"],
  ["Kasinka Mała", "w Kasince Małej"], ["Katowice", "w Katowicach"], ["Kazimierz Dolny", "w Kazimierzu Dolnym"],
  ["Kielce", "w Kielcach"], ["Kołobrzeg", "w Kołobrzegu"], ["Koszalin", "w Koszalinie"], ["Kraków", "w Krakowie"],
  ["Lubawka", "w Lubawce"], ["Lubin", "w Lubinie"], ["Lublin", "w Lublinie"], ["Ludwikowice Kłodzkie", "w Ludwikowicach Kłodzkich"],
  ["Lyski", "w Lyskach"], ["Ławszowa", "w Ławszowej"], ["Łódź", "w Łodzi"], ["Marki", "w Markach"], ["Mrągowo", "w Mrągowie"],
  ["Myślenice", "w Myślenicach"], ["Nowa Ruda", "w Nowej Rudzie"], ["Nowa Sól", "w Nowej Soli"], ["Nysa", "w Nysie"],
  ["Okuninka", "w Okunince"], ["Olsztyn", "w Olsztynie"], ["Oława", "w Oławie"], ["Opole", "w Opolu"], ["Ostróda", "w Ostródzie"],
  ["Otwock", "w Otwocku"], ["Otwock Wielki", "w Otwocku Wielkim"], ["Pełczyce", "w Pełczycach"], ["Piła", "w Pile"],
  ["Płock", "w Płocku"], ["Polanica-Zdrój", "w Polanicy-Zdroju"], ["Poznań", "w Poznaniu"], ["Przytkowice", "w Przytkowicach"],
  ["Radom", "w Radomiu"], ["Ruda Śląska", "w Rudzie Śląskiej"], ["Rzeszów", "w Rzeszowie"], ["Siedlce", "w Siedlcach"],
  ["Słupsk", "w Słupsku"], ["Sopot", "w Sopocie"], ["Sosnowiec", "w Sosnowcu"], ["Srebrna Góra", "w Srebrnej Górze"],
  ["Sulnówko", "w Sulnówku"], ["Suwałki", "w Suwałkach"], ["Szczecin", "w Szczecinie"], ["Szczecinek", "w Szczecinku"],
  ["Ścinawka Górna", "w Ścinawce Górnej"], ["Świętochłowice", "w Świętochłowicach"], ["Tarnów", "w Tarnowie"],
  ["Toruń", "w Toruniu"], ["Trójmiasto", "w Trójmieście"], ["Wałbrzych", "w Wałbrzychu"], ["Warszawa", "w Warszawie"],
  ["Wrocław", "we Wrocławiu"], ["Zabrze", "w Zabrzu"], ["Zamość", "w Zamościu"], ["Zawiercie", "w Zawierciu"],
  ["Zgorzelec", "w Zgorzelcu"], ["Zielona Góra", "w Zielonej Górze"], ["Zwierzyniec", "w Zwierzyńcu"], ["Żywiec", "w Żywcu"],
];

describe("cityLocative", () => {
  it("knows every active city", () => {
    for (const [city, expected] of ACTIVE_CITIES) expect(formatInCity(city), city).toBe(expected);
  });

  it("accepts slugs and ASCII spellings", () => {
    expect(cityLocative("wroclaw")).toBe("we Wrocławiu");
    expect(cityLocative("bielsko-biala")).toBe("w Bielsku-Białej");
    expect(cityLocative("  ZIELONA GÓRA ")).toBe("w Zielonej Górze");
  });

  it("inflects unknown cities with common endings", () => {
    const cases: [string, string][] = [
      ["Bochnia", "w Bochni"], ["Kalwaria Zebrzydowska", "w Kalwarii Zebrzydowskiej"], ["Brzesko", "w Brzesku"],
      ["Wieliczka", "w Wieliczce"], ["Oświęcim", "w Oświęcimiu"], ["Wadowice", "w Wadowicach"], ["Busko-Zdrój", "w Busku-Zdroju"],
      ["Nowy Targ", "w Nowym Targu"], ["Biłgoraj", "w Biłgoraju"], ["Chełm", "w Chełmie"], ["Ząbki", "w Ząbkach"],
      ["Wołomin", "w Wołominie"], ["Bolesławiec", "w Bolesławcu"], ["Jarosław", "w Jarosławiu"], ["Kutno", "w Kutnie"],
      ["Starogard Gdański", "w Starogardzie Gdańskim"], ["Nowe Miasto Lubawskie", "w Nowym Mieście Lubawskim"],
    ];
    for (const [city, expected] of cases) expect(cityLocative(city), city).toBe(expected);
  });
});
