import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getSuppliers } from "@/features/master-data/service";
import { SuppliersManager } from "@/features/master-data/components/suppliers-manager";

export default async function SuppliersMasterPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) !== Role.admin) redirect("/?error=forbidden");

  const suppliers = await getSuppliers();

  return (
    <div className="space-y-6">
      <div>
        <p className="board-header">
          <Link href="/master-data" className="hover:text-primary">
            Datos maestros
          </Link>{" "}
          / Proveedores
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">Proveedores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alta y edición · desactivar en lugar de borrar
        </p>
      </div>
      <SuppliersManager suppliers={suppliers} />
    </div>
  );
}
