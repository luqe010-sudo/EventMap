"use client";

type DeleteCategoryButtonProps = {
  deleteAction: () => Promise<void>;
  categoryName: string;
};

export default function DeleteCategoryButton({
  deleteAction,
  categoryName
}: DeleteCategoryButtonProps) {
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`Czy na pewno chcesz usunąć kategorię "${categoryName}"?`)) {
      e.preventDefault();
    }
  }

  return (
    <form
      action={async () => {
        try {
          await deleteAction();
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : "Wystąpił błąd podczas usuwania kategorii.");
        }
      }}
      onSubmit={onSubmit}
      style={{ display: "inline" }}
    >
      <button
        type="submit"
        className="dangerButton"
        title={`Usuń kategorię ${categoryName}`}
      >
        Usuń
      </button>
    </form>
  );
}
