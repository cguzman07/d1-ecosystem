"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createExternalUserAction,
  updateExternalUserAction,
} from "@/features/master-data/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type ActorRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  companyName: string | null;
  profile: {
    companyName: string;
    serviceRegions: string[];
    contactEmail: string | null;
    contactPhone: string | null;
    notes: string | null;
    active: boolean;
  } | null;
};

type Props = {
  role: "freight_forwarder" | "customs_agency";
  title: string;
  actors: ActorRow[];
};

export function ExternalActorsManager({ role, title, actors }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  function run(
    action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>,
    fd: FormData,
  ) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await action(fd);
      if (!result.ok) {
        setError(result.error ?? "Error");
        return;
      }
      setSuccess("Guardado correctamente");
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="board-panel p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
          Nuevo · {title}
        </h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("role", role);
            run(createExternalUserAction, fd);
            e.currentTarget.reset();
          }}
        >
          <input type="hidden" name="role" value={role} />
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del contacto *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo (login) *</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña *</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Empresa *</Label>
            <Input id="companyName" name="companyName" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="serviceRegions">Regiones / puertos</Label>
            <textarea
              id="serviceRegions"
              name="serviceRegions"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Callao, Buenaventura (separados por coma)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email de contacto</Label>
            <Input id="contactEmail" name="contactEmail" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Teléfono</Label>
            <Input id="contactPhone" name="contactPhone" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" name="notes" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear usuario y perfil"}
            </Button>
          </div>
        </form>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-board-ok/10 px-3 py-2 text-sm text-board-ok">
          {success}
        </p>
      )}

      <div className="board-panel overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Regiones</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {actors.map((actor) => {
              const profile = actor.profile;
              const isEditing = editingId === actor.id;
              return (
                <tr key={actor.id} className="border-b border-border align-top">
                  {isEditing ? (
                    <td colSpan={5} className="px-4 py-4">
                      <form
                        className="grid gap-3 sm:grid-cols-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(updateExternalUserAction, new FormData(e.currentTarget));
                        }}
                      >
                        <input type="hidden" name="userId" value={actor.id} />
                        <Input name="name" defaultValue={actor.name} required />
                        <Input
                          name="companyName"
                          defaultValue={profile?.companyName || actor.companyName || ""}
                          required
                        />
                        <textarea
                          name="serviceRegions"
                          rows={2}
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2"
                          defaultValue={(profile?.serviceRegions ?? []).join(", ")}
                        />
                        <Input
                          name="contactEmail"
                          defaultValue={profile?.contactEmail ?? actor.email}
                        />
                        <Input
                          name="contactPhone"
                          defaultValue={profile?.contactPhone ?? ""}
                        />
                        <Input name="notes" defaultValue={profile?.notes ?? ""} />
                        <select
                          name="active"
                          className={selectClass}
                          defaultValue={actor.active ? "true" : "false"}
                        >
                          <option value="true">Activo</option>
                          <option value="false">Inactivo</option>
                        </select>
                        <div className="flex gap-2 sm:col-span-2">
                          <Button type="submit" size="sm" disabled={pending}>
                            Guardar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <p className="text-foreground">
                          {profile?.companyName || actor.companyName || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{actor.email}</p>
                      </td>
                      <td className="px-4 py-3 text-foreground/80">
                        {actor.name}
                        {profile?.contactPhone ? (
                          <span className="block text-xs text-muted-foreground">
                            {profile.contactPhone}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(profile?.serviceRegions ?? []).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={actor.active ? "ok" : "muted"}>
                          {actor.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(actor.id)}
                        >
                          Editar
                        </Button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
