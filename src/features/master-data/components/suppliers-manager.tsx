"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createSupplierAction,
  toggleSupplierActiveAction,
  updateSupplierAction,
} from "@/features/master-data/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type SupplierRow = {
  id: string;
  name: string;
  type: string;
  country: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  averageLeadTimeDays: number | null;
  active: boolean;
  sanitaryRegistration: unknown;
};

function sanitaryFields(value: unknown): { number: string; expiry: string } {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return {
      number: String(obj.number ?? ""),
      expiry: String(obj.expiry ?? ""),
    };
  }
  return { number: "", expiry: "" };
}

export function SuppliersManager({ suppliers }: { suppliers: SupplierRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  function run(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData) {
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
          Nuevo proveedor
        </h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(createSupplierAction, new FormData(e.currentTarget));
            e.currentTarget.reset();
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <select id="type" name="type" className={selectClass} defaultValue="international">
              <option value="international">Internacional</option>
              <option value="national">Nacional</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">País *</Label>
            <Input id="country" name="country" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactName">Contacto</Label>
            <Input id="contactName" name="contactName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Correo de contacto</Label>
            <Input id="contactEmail" name="contactEmail" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Teléfono</Label>
            <Input id="contactPhone" name="contactPhone" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="averageLeadTimeDays">Tiempo de entrega (días)</Label>
            <Input id="averageLeadTimeDays" name="averageLeadTimeDays" type="number" min={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sanitaryNumber">Registro sanitario Nº</Label>
            <Input id="sanitaryNumber" name="sanitaryNumber" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sanitaryExpiry">Vencimiento sanitario</Label>
            <Input id="sanitaryExpiry" name="sanitaryExpiry" type="date" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Crear proveedor"}
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
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">País</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Tiempo de entrega</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => {
              const sanitary = sanitaryFields(s.sanitaryRegistration);
              const isEditing = editingId === s.id;
              return (
                <tr key={s.id} className="border-b border-border align-top">
                  {isEditing ? (
                    <td colSpan={7} className="px-4 py-4">
                      <form
                        className="grid gap-3 sm:grid-cols-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(updateSupplierAction, new FormData(e.currentTarget));
                        }}
                      >
                        <input type="hidden" name="id" value={s.id} />
                        <Input name="name" defaultValue={s.name} required />
                        <select
                          name="type"
                          className={selectClass}
                          defaultValue={s.type}
                        >
                          <option value="international">Internacional</option>
                          <option value="national">Nacional</option>
                        </select>
                        <Input name="country" defaultValue={s.country} required />
                        <Input
                          name="contactName"
                          defaultValue={s.contactName ?? ""}
                          placeholder="Contacto"
                        />
                        <Input
                          name="contactEmail"
                          defaultValue={s.contactEmail ?? ""}
                          placeholder="Email"
                        />
                        <Input
                          name="contactPhone"
                          defaultValue={s.contactPhone ?? ""}
                          placeholder="Teléfono"
                        />
                        <Input
                          name="averageLeadTimeDays"
                          type="number"
                          defaultValue={s.averageLeadTimeDays ?? ""}
                          placeholder="Días"
                        />
                        <Input
                          name="sanitaryNumber"
                          defaultValue={sanitary.number}
                          placeholder="Registro sanitario"
                        />
                        <Input
                          name="sanitaryExpiry"
                          type="date"
                          defaultValue={sanitary.expiry}
                        />
                        <select
                          name="active"
                          className={selectClass}
                          defaultValue={s.active ? "true" : "false"}
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
                      <td className="px-4 py-3 text-foreground">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.type === "international" ? "Internacional" : "Nacional"}
                      </td>
                      <td className="px-4 py-3 text-foreground/80">{s.country}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.contactName || "—"}
                        {s.contactEmail ? (
                          <span className="block text-xs">{s.contactEmail}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {s.averageLeadTimeDays ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.active ? "ok" : "muted"}>
                          {s.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(s.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => {
                              const fd = new FormData();
                              fd.set("id", s.id);
                              fd.set("active", s.active ? "false" : "true");
                              run(toggleSupplierActiveAction, fd);
                            }}
                          >
                            {s.active ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
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
