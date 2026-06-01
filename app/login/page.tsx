import { signInAction } from "@/lib/auth-actions";

export default function LoginPage() {
  return (
    <main className="appShell managementShell">
      <section className="managementPanel loginPanel">
        <p className="eyebrow">EventMap</p>
        <h1>Logowanie</h1>
        <form action={signInAction} className="managementForm">
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Haslo
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <button type="submit" className="primaryButton">Zaloguj</button>
        </form>
      </section>
    </main>
  );
}
