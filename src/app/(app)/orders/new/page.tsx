import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, requireRoles } from "@/lib/session";
import { Role } from "@prisma/client";
import { CreateOrderForm } from "@/features/orders/components/create-order-form";
import {
  getActiveSuppliers,
  getAssignableCustomsAgencies,
  getAssignableForwarders,
} from "@/features/orders/service";

export default async function NewOrderPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  try {
    await requireRoles([Role.admin, Role.internal_specialist]);
  } catch {
    redirect("/?error=forbidden");
  }

  const [suppliers, forwarders, agencies] = await Promise.all([
    getActiveSuppliers(),
    getAssignableForwarders(),
    getAssignableCustomsAgencies(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="board-header">
          <Link href="/orders" className="hover:text-primary">
            Órdenes
          </Link>{" "}
          / Nueva
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">Nueva orden de compra</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea el registro central. La referencia SAP queda lista para un sync futuro.
        </p>
      </div>

      <CreateOrderForm
        suppliers={suppliers}
        forwarders={forwarders}
        agencies={agencies}
      />
    </div>
  );
}
