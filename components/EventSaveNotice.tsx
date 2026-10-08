const messages: Record<string, string> = {
  unconfirmed: "Nie udało się potwierdzić zapisu wydarzenia. Sprawdź listę i szczegóły wydarzenia przed ponowną próbą, aby uniknąć duplikatu.",
  "source-unconfirmed": "Kopia wydarzenia została zapisana, ale nie udało się potwierdzić skopiowania źródła. Sprawdź źródło w oryginalnym wydarzeniu i uzupełnij je w tej kopii.",
  "moderation-unconfirmed": "Status wydarzenia został zapisany, ale nie udało się potwierdzić historii moderacji lub powiadomień. Sprawdź historię i powiadomienia przed ponowną decyzją."
};

/** URL flags display fixed feedback only; they never authorize a write or recovery. */
export default function EventSaveNotice({ value }: { value?: string | string[] }) {
  const message = typeof value === "string" && Object.hasOwn(messages, value) ? messages[value] : null;
  return message ? <p className="formError" role="alert">{message}</p> : null;
}
