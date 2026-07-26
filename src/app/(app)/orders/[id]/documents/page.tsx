import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getOrderById } from "@/features/orders/service";
import {
  assertOrderDocumentAccess,
  getDocumentsByOrder,
} from "@/features/documents/service";
import { DocumentsRepository } from "@/features/documents/components/documents-repository";
import { DocumentUploadForm } from "@/features/documents/components/document-upload-form";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { Button } from "@/components/ui/button";

type Props = { params: { id: string } };

export default async function OrderDocumentsPage({ params }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const order = await getOrderById(params.id);
  if (!order) notFound();

  try {
    await assertOrderDocumentAccess({
      orderId: order.id,
      role,
      userId: session.user.id,
    });
  } catch {
    redirect("/?error=forbidden");
  }

  const { grouped } = await getDocumentsByOrder(order.id);
  const canUpload =
    role === Role.admin ||
    role === Role.internal_specialist ||
    role === Role.supplier;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="board-header">
            <Link href="/documentacion" className="hover:text-primary">
              Documentación
            </Link>
            {" / "}
            <Link href={`/orders/${order.id}`} className="hover:text-primary">
              {order.orderNumber}
            </Link>
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Documentos · {order.orderNumber}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <span className="text-sm text-muted-foreground">{order.supplier.name}</span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/orders/${order.id}/shipment`}>Ir a embarque</Link>
        </Button>
      </div>

      {canUpload && (
        <div className="board-panel p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Cargar documento
          </h2>
          <DocumentUploadForm orderId={order.id} showCategorySelect />
        </div>
      )}

      <div className="board-panel p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
          Repositorio central
        </h2>
        <DocumentsRepository orderId={order.id} grouped={grouped} />
      </div>
    </div>
  );
}
