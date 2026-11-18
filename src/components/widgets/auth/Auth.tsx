import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { SetupCard } from "@/components/ui/setup-card";
import { Button } from "@/components/ui/button";
import { Field, FieldSkeleton, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonSwap } from "@/components/ui/skeleton-swap";
import type { AuthProps } from "./types";

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

function AuthForm({ di, registered }: Omit<AuthProps, "skeleton">) {
  const signIn = useMutation(di.signIn.mo());
  const signUp = useMutation(di.signUp.mo());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      if (registered) await signIn.mutateAsync({ email, password });
      else await signUp.mutateAsync({ email, password, setupKey });
      setPassword("");
      setSetupKey("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выполнить вход.");
    }
  }

  const submitting = signIn.isPending || signUp.isPending;
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

function AuthSkeleton({ registered }: { registered: boolean }) {
  return (
    <SetupCard skeleton {...copy(registered)}>
      <div className="grid gap-4">
        <FieldSkeleton label="Email" />
        <FieldSkeleton label="Пароль" />
        <Skeleton className="h-12" />
      </div>
    </SetupCard>
  );
}

/** Sign-in to the shared profile, or its one-time creation. */
export function Auth({ di, registered, skeleton = false }: AuthProps) {
  return (
    <SkeletonSwap loading={skeleton} skeleton={() => <AuthSkeleton registered={registered} />}>
      <AuthForm di={di} registered={registered} />
    </SkeletonSwap>
  );
}
