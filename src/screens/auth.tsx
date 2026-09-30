import { useState } from "react";
import type { FormEvent } from "react";
import { SetupCard } from "@/components/app/setup-card";
import { Button } from "@/components/ui/button";
import { Field, FieldSkeleton, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { signIn, signUp } from "@/authClient";

function copy(registered: boolean) {
  return {
    eyebrow: "Общий профиль",
    title: registered ? "Войти в семейный профиль" : "Создать семейный профиль",
    description: registered
      ? "Используйте общий email и пароль на обоих устройствах."
      : "Профиль создаётся один раз. Для первого запуска нужен ключ, который хранится у владельца приложения.",
    footnote: "Пароль должен содержать не менее 12 символов. Ранее внесённые записи перенесутся в общий профиль после входа."
  };
}

export function AuthPanel({ registered, onAuthenticated }: {
  registered: boolean;
  onAuthenticated: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
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
    <SetupCard {...copy(registered)}>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Email" htmlFor="auth-email">
          <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Пароль" htmlFor="auth-password">
          <Input id="auth-password" type="password" autoComplete={registered ? "current-password" : "new-password"}
            minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        {!registered && (
          <Field label="Ключ первого запуска" htmlFor="auth-setup-key">
            <Input id="auth-setup-key" type="password" autoComplete="off" value={setupKey} onChange={(event) => setSetupKey(event.target.value)} required />
          </Field>
        )}
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Подождите…" : registered ? "Войти" : "Создать профиль"}
        </Button>
      </form>
    </SetupCard>
  );
}

export function AuthSkeleton() {
  return (
    <SetupCard skeleton {...copy(true)}>
      <div className="grid gap-4">
        <FieldSkeleton label="Email" />
        <FieldSkeleton label="Пароль" />
        <Skeleton className="h-12" />
      </div>
    </SetupCard>
  );
}
