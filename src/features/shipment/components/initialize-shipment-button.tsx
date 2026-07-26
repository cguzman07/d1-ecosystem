"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function InitializeShipmentButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Inicializando…" : "Inicializar checklist"}
    </Button>
  );
}
