import { useState } from "react";
import { signIn, signUp } from "./authClient";

export function AuthPanel({ registered, onAuthenticated }: {
  registered: boolean;
  onAuthenticated: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (registered) await signIn(email.trim(), password);
      else await signUp(email.trim(), password, setupKey.trim());
      setPassword("");
      setSetupKey("");
      await onAuthenticated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выполнить вход.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="setup-card auth-card">
      <span className="eyebrow">Общий профиль</span>
      <h2>{registered ? "Войти в семейный профиль" : "Создать семейный профиль"}</h2>
      <p>{registered
        ? "Используйте общий email и пароль на обоих устройствах."
        : "Профиль создаётся один раз. Для первого запуска нужен ключ из локального файла .dev.vars."}</p>
      <form onSubmit={submit}>
        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" type="email" autoComplete="email" value={email}
          onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="auth-password">Пароль</label>
        <input id="auth-password" type="password" autoComplete={registered ? "current-password" : "new-password"}
          minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required />
        {!registered && <>
          <label htmlFor="auth-setup-key">Ключ первого запуска</label>
          <input id="auth-setup-key" type="password" autoComplete="off" value={setupKey}
            onChange={(event) => setSetupKey(event.target.value)} required />
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Подождите…" : registered ? "Войти" : "Создать профиль"}
        </button>
      </form>
      <p className="setup-footnote">Пароль должен содержать не менее 12 символов. Ранее внесённые записи перенесутся в общий профиль после входа.</p>
    </section>
  );
}
