/**
 * Polish locative ("w Gdyni", "we Wrocławiu") for city names used in titles, headings and descriptions.
 * Known cities come from a dictionary that covers every active city in the database; unknown names
 * fall back to suffix rules that handle the most common Polish place-name endings.
 */

const KNOWN: Record<string, string> = {
  "aleksandrow lodzki": "w Aleksandrowie Łódzkim",
  "augustow": "w Augustowie",
  "bialka": "w Białce",
  "bialystok": "w Białymstoku",
  "bielawa": "w Bielawie",
  "bielsk podlaski": "w Bielsku Podlaskim",
  "bielsko": "w Bielsku-Białej",
  "bielsko biala": "w Bielsku-Białej",
  "boszkowo": "w Boszkowie",
  "bukowiec": "w Bukowcu",
  "bydgoszcz": "w Bydgoszczy",
  "bytom": "w Bytomiu",
  "chojnice": "w Chojnicach",
  "chorzow": "w Chorzowie",
  "cisna": "w Cisnej",
  "czerna": "w Czernej",
  "czestochowa": "w Częstochowie",
  "cmielow": "w Ćmielowie",
  "dabrowa gornicza": "w Dąbrowie Górniczej",
  "dzierzoniow": "w Dzierżoniowie",
  "elblag": "w Elblągu",
  "elk": "w Ełku",
  "emilianow": "w Emilianowie",
  "gdansk": "w Gdańsku",
  "gdansk sobieszewo": "w Gdańsku-Sobieszewie",
  "gdansk sopot": "w Gdańsku i Sopocie",
  "gdynia": "w Gdyni",
  "gizycko": "w Giżycku",
  "gliwice": "w Gliwicach",
  "glogow": "w Głogowie",
  "gniezno": "w Gnieźnie",
  "gorzow wielkopolski": "w Gorzowie Wielkopolskim",
  "grudziadz": "w Grudziądzu",
  "hel": "na Helu",
  "ilza": "w Iłży",
  "inowroclaw": "w Inowrocławiu",
  "jastrzebie zdroj": "w Jastrzębiu-Zdroju",
  "jaworzno": "w Jaworznie",
  "jedwabno": "w Jedwabnie",
  "jelenia gora": "w Jeleniej Górze",
  "kalisz": "w Kaliszu",
  "karpacz": "w Karpaczu",
  "kartuzy": "w Kartuzach",
  "kasinka mala": "w Kasince Małej",
  "katowice": "w Katowicach",
  "kazimierz dolny": "w Kazimierzu Dolnym",
  "kielce": "w Kielcach",
  "klodzko": "w Kłodzku",
  "kolobrzeg": "w Kołobrzegu",
  "konin": "w Koninie",
  "koszalin": "w Koszalinie",
  "krakow": "w Krakowie",
  "krosno": "w Krośnie",
  "leba": "w Łebie",
  "legionowo": "w Legionowie",
  "legnica": "w Legnicy",
  "leszno": "w Lesznie",
  "lomza": "w Łomży",
  "lodz": "w Łodzi",
  "lubawka": "w Lubawce",
  "lubin": "w Lubinie",
  "lublin": "w Lublinie",
  "ludwikowice klodzkie": "w Ludwikowicach Kłodzkich",
  "lyski": "w Lyskach",
  "lawszowa": "w Ławszowej",
  "malbork": "w Malborku",
  "marki": "w Markach",
  "mielec": "w Mielcu",
  "mikolajki": "w Mikołajkach",
  "mragowo": "w Mrągowie",
  "myslenice": "w Myślenicach",
  "nowa ruda": "w Nowej Rudzie",
  "nowa sol": "w Nowej Soli",
  "nowy sacz": "w Nowym Sączu",
  "nysa": "w Nysie",
  "okuninka": "w Okunince",
  "olsztyn": "w Olsztynie",
  "olawa": "w Oławie",
  "opole": "w Opolu",
  "ostroda": "w Ostródzie",
  "ostroleka": "w Ostrołęce",
  "ostrow wielkopolski": "w Ostrowie Wielkopolskim",
  "otwock": "w Otwocku",
  "otwock wielki": "w Otwocku Wielkim",
  "pelczyce": "w Pełczycach",
  "pila": "w Pile",
  "piotrkow trybunalski": "w Piotrkowie Trybunalskim",
  "plock": "w Płocku",
  "polanica zdroj": "w Polanicy-Zdroju",
  "poznan": "w Poznaniu",
  "pruszcz gdanski": "w Pruszczu Gdańskim",
  "pruszkow": "w Pruszkowie",
  "przemysl": "w Przemyślu",
  "przytkowice": "w Przytkowicach",
  "pulawy": "w Puławach",
  "radom": "w Radomiu",
  "reda": "w Redzie",
  "ruda slaska": "w Rudzie Śląskiej",
  "rumia": "w Rumi",
  "rybnik": "w Rybniku",
  "rzeszow": "w Rzeszowie",
  "sanok": "w Sanoku",
  "siedlce": "w Siedlcach",
  "slupsk": "w Słupsku",
  "sopot": "w Sopocie",
  "sosnowiec": "w Sosnowcu",
  "srebrna gora": "w Srebrnej Górze",
  "stalowa wola": "w Stalowej Woli",
  "stargard": "w Stargardzie",
  "sulnowko": "w Sulnówku",
  "suwalki": "w Suwałkach",
  "swidnica": "w Świdnicy",
  "swinoujscie": "w Świnoujściu",
  "szczecin": "w Szczecinie",
  "szczecinek": "w Szczecinku",
  "szczyrk": "w Szczyrku",
  "szklarska poreba": "w Szklarskiej Porębie",
  "scinawka gorna": "w Ścinawce Górnej",
  "swietochlowice": "w Świętochłowicach",
  "tarnow": "w Tarnowie",
  "tczew": "w Tczewie",
  "torun": "w Toruniu",
  "trojmiasto": "w Trójmieście",
  "tychy": "w Tychach",
  "ustka": "w Ustce",
  "walbrzych": "w Wałbrzychu",
  "warszawa": "w Warszawie",
  "wejherowo": "w Wejherowie",
  "wisla": "w Wiśle",
  "wladyslawowo": "we Władysławowie",
  "wloclawek": "we Włocławku",
  "wroclaw": "we Wrocławiu",
  "zabrze": "w Zabrzu",
  "zakopane": "w Zakopanem",
  "zamosc": "w Zamościu",
  "zawiercie": "w Zawierciu",
  "zgorzelec": "w Zgorzelcu",
  "zielona gora": "w Zielonej Górze",
  "zwierzyniec": "w Zwierzyńcu",
  "zywiec": "w Żywcu",
};

/** First words that are adjectives ("Nowa Ruda", "Stalowa Wola"), unlike nouns such as "Dąbrowa". */
const LEADING_ADJECTIVES = new Set([
  "nowa", "nowy", "nowe", "stara", "stary", "stare", "zielona", "stalowa", "biała", "czarna", "srebrna",
  "złota", "jelenia", "wysoka", "wielka", "mała", "dolna", "górna", "dolny", "górny", "kamienna", "polska",
]);

export function foldCityKey(name: string) {
  return name
    .trim()
    .toLocaleLowerCase("pl-PL")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s\-/]+/g, " ");
}

/** Ordered suffix rules: [ending, replacement]. The first matching ending wins. */
const NOUN_RULES: [string, string][] = [
  // -a (feminine)
  ["ria", "rii"], ["lia", "lii"], ["gia", "gii"], ["kia", "kii"], ["ia", "i"], ["sła", "śle"], ["ca", "cy"], ["ża", "ży"], ["cza", "czy"], ["sza", "szy"], ["rza", "rzy"], ["dza", "dzy"],
  ["la", "li"], ["ka", "ce"], ["ga", "dze"], ["cha", "sze"], ["ła", "le"], ["ra", "rze"], ["da", "dzie"], ["sta", "ście"],
  ["ta", "cie"], ["a", "ie"],
  // -o (neuter)
  ["ko", "ku"], ["go", "gu"], ["cho", "chu"], ["rzno", "rznie"], ["zno", "źnie"], ["sno", "śnie"], ["miasto", "mieście"], ["sto", "ście"],
  ["to", "cie"], ["do", "dzie"], ["ło", "le"], ["ro", "rze"], ["o", "ie"],
  // -e (plural / neuter)
  ["ice", "icach"], ["ce", "cach"], ["ane", "anem"], ["ie", "iu"], ["e", "u"],
  // -y / -i (plural)
  ["ki", "kach"], ["gi", "gach"], ["y", "ach"], ["i", "ach"],
  // consonants
  ["ów", "owie"], ["ew", "ewie"], ["ść", "ściu"], ["dź", "dzi"], ["ń", "niu"], ["ź", "ziu"], ["ć", "ciu"],
  ["niec", "ńcu"], ["iec", "cu"], ["ec", "cu"], ["ław", "ławiu"], ["om", "omiu"], ["im", "imiu"], ["ym", "ymiu"],
  ["sk", "sku"], ["ck", "cku"], ["k", "ku"], ["g", "gu"], ["ch", "chu"], ["h", "hu"],
  ["cz", "czu"], ["sz", "szu"], ["rz", "rzu"], ["dz", "dzu"], ["ż", "żu"], ["c", "cu"], ["l", "lu"], ["ój", "oju"], ["j", "ju"],
  ["st", "ście"], ["t", "cie"], ["d", "dzie"], ["ł", "le"], ["r", "rze"],
  ["m", "mie"], ["n", "nie"], ["p", "pie"], ["b", "bie"], ["f", "fie"], ["w", "wie"], ["s", "sie"], ["z", "zie"],
];

function applyRules(word: string, rules: [string, string][]) {
  const lower = word.toLocaleLowerCase("pl-PL");
  for (const [ending, replacement] of rules) {
    if (!lower.endsWith(ending)) continue;
    const stem = word.slice(0, word.length - ending.length);
    // Keep the capital letter when the rule replaces the whole word ("Miasto" -> "Mieście").
    return stem || word[0] === word[0].toLocaleLowerCase("pl-PL")
      ? stem + replacement
      : replacement.charAt(0).toLocaleUpperCase("pl-PL") + replacement.slice(1);
  }
  return word;
}

function adjectiveLocative(word: string, plural: boolean) {
  const lower = word.toLocaleLowerCase("pl-PL");
  const softStem = /[kg]$/.test(lower.replace(/[aeiouy]+$/, ""));
  if (/(ie|e)$/.test(lower)) {
    // Neuter singular "Nowe Miasto" -> "Nowym", plural "Ludwikowice Kłodzkie" -> "Kłodzkich".
    const stem = word.replace(/i?e$/i, "");
    return `${stem}${softStem ? (plural ? "ich" : "im") : (plural ? "ych" : "ym")}`;
  }
  if (/(i|y)$/.test(lower)) return `${word}m`; // Wielkopolski -> Wielkopolskim, Dolny -> Dolnym
  if (/a$/.test(lower)) return `${word.slice(0, -1)}${softStem ? "iej" : "ej"}`; // Śląska -> Śląskiej, Mała -> Małej
  return null;
}

function isAdjective(word: string) {
  return /(ski|cki|dzki|ska|cka|dzka|skie|ckie|dzkie|ny|na|ne|wy|wa|we|ły|ła|łe|ty|ta)$/i.test(word);
}

function inflectWord(word: string, index: number, plural: boolean): string {
  if (word.includes("-")) return word.split("-").map((part, partIndex) => inflectWord(part, index + partIndex, plural)).join("-");
  const lower = word.toLocaleLowerCase("pl-PL");
  const treatAsAdjective = index === 0 ? LEADING_ADJECTIVES.has(lower) : isAdjective(word);
  if (treatAsAdjective) {
    const adjective = adjectiveLocative(word, plural);
    if (adjective) return adjective;
  }
  return applyRules(word, NOUN_RULES);
}

function preposition(locative: string) {
  return /^[wf][^aeiouyąęó]/i.test(locative) ? "we" : "w";
}

export function cityLocative(city: string) {
  const name = city.trim().replace(/\s+/g, " ");
  if (!name) return "w Polsce";
  const known = KNOWN[foldCityKey(name)];
  if (known) return known;
  const words = name.split(" ");
  const noun = words.find((word, index) => index > 0 || !LEADING_ADJECTIVES.has(word.toLocaleLowerCase("pl-PL"))) ?? words[0];
  const plural = /(ice|ce|y|i)$/i.test(noun);
  const locative = words.map((word, index) => inflectWord(word, index, plural)).join(" ");
  return `${preposition(locative)} ${locative}`;
}
