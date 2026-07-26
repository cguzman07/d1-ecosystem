import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { Building2, Ship, Warehouse } from "lucide-react";
import { getSession } from "@/lib/session";
import {
  getCustomsAgencies,
  getForwarders,
  getSuppliers,
} from "@/features/master-data/service";

export default async function MasterDataHubPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) !== Role.admin) {
    redirect("/?error=forbidden");
  }

  const [suppliers, forwarders, agencies] = await Promise.all([
    getSuppliers(),
    getForwarders(),
    getCustomsAgencies(),
  ]);

  const cards = [
    {
      href: "/master-data/suppliers",
      title: "Proveedores",
      description: "Internacionales y nacionales, contactos y lead times",
      count: suppliers.length,
      active: suppliers.filter((s) => s.active).length,
      icon: Warehouse,
    },
    {
      href: "/master-data/forwarders",
      title: "Agentes de carga",
      description: "Usuarios freight_forwarder y perfiles de empresa",
      count: forwarders.length,
      active: forwarders.filter((f) => f.active).length,
      icon: Ship,
    },
    {
      href: "/master-data/customs",
      title: "Agencias de aduana",
      description: "Usuarios customs_agency y regiones de servicio",
      count: agencies.length,
      active: agencies.filter((a) => a.active).length,
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="board-header">Administración</p>
        <h1 className="font-display text-3xl font-bold text-foreground">Datos maestros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catálogos que alimentan órdenes, booking, embarque y aduana
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="board-panel block p-6 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {card.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
              <p className="mt-4 font-mono text-sm text-primary">
                {card.active} activos · {card.count} total
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
