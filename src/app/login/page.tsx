"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_ACCOUNTS = [
  { email: "admin@d1.local", role: "Administrador" },
  { email: "especialista@d1.local", role: "Especialista interno" },
  { email: "forwarder@d1.local", role: "Agente de carga" },
  { email: "aduana@d1.local", role: "Agencia de aduana" },
  { email: "proveedor@d1.local", role: "Proveedor" },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("especialista@d1.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Credenciales inválidas o usuario inactivo.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(227,6,19,0.08),_transparent_50%),linear-gradient(180deg,#ffffff_0%,#f4f6f8_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(227,6,19,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(227,6,19,0.35)_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative z-10 grid w-full max-w-4xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden flex-col justify-center lg:flex">
          <p className="board-header mb-3">Tablero de control de importaciones</p>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            Tablero unificado de órdenes de importación: booking, embarque, aduana, costeo y
            documentación — un solo registro, trazabilidad completa.
          </p>
          <div className="board-panel mt-8 border-l-4 border-l-secondary p-4">
            <p className="board-header mb-3">Cuentas demo · contraseña: password123</p>
            <ul className="space-y-2 font-mono text-sm text-foreground">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email} className="flex justify-between gap-4">
                  <button
                    type="button"
                    className="text-left text-primary hover:underline"
                    onClick={() => setEmail(a.email)}
                  >
                    {a.email}
                  </button>
                  <span className="text-muted-foreground">{a.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="board-panel p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <p className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
              AURA
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Logistics Doc Tracker
            </p>
            <p className="mt-3 text-sm text-muted-foreground">Iniciar sesión</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
            Demo: especialista@d1.local / password123
          </p>
        </div>
      </div>
    </div>
  );
}
