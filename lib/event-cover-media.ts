import media from "@/data/media/editorial-photos.json";

export type EditorialPhoto = {
  id: string;
  url: string;
  author: string;
  source: string;
  license_url: string;
};

const photos: ReadonlyMap<string, EditorialPhoto> = new Map(media.photos.map(photo => [photo.id, photo]));

/** A contextual photo is never presented as a photograph of the actual event. */
export function getEventCoverPhoto(event: { title: string; categorySlug?: string }): EditorialPhoto | undefined {
  const title = event.title.toLocaleLowerCase("pl-PL").replaceAll("ł", "l")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let theme: string | undefined;
  if (/szydel|wloczk|rekodziel|haft|szyci/.test(title)) theme = "craft";
  else if (/ornitolog|ptak/.test(title)) theme = "birds";
  else if (/exotic|terrar|akwar|jaszczur/.test(title)) theme = "terrarium";
  else if (/\blego\b|klock/.test(title)) theme = "blocks";
  else if (/\bjazz|boto|saksofon|potanc|\bswing/.test(title)) theme = "jazz";
  else if (/kino|film|seans|widmo wolnosci/.test(title)) theme = "cinema";
  else if (/bach|brahms|paderewski|filharm|\bchor(?:u|y|em|ze|al\w*)?\b|opera|cracovia|fermata|christmas|muzykoteka/.test(title)) theme = "piano";
  else if (/warsztat|edukac|finanse|portfel|w kontakcie|spotkanie|salon kobiet|wyklad/.test(title)) theme = "education";
  return theme ? photos.get(theme) : undefined;
}
