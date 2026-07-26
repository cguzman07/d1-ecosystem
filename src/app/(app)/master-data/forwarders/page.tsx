import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getForwarders } from "@/features/master-data/service";
import { ExternalActorsManager } from "@/features/master-data/components/external-actors-manager";

export default async function ForwardersMasterPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) !== Role.admin) redirect("/?error=forbidden");

  const forwarders = await getForwarders();

  return (
    <div className="space-y-6">
      <div>
        <p className="board-header">
          <Link href="/master-data" className="hover:text-primary">
            Datos maestros
          </Link>{" "}
          / Agentes de carga
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">Agentes de carga</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Usuarios con rol freight_forwarder y su perfil de empresa
        </p>
      </div>
      <ExternalActorsManager
        role="freight_forwarder"
        title="Agente de carga"
        actors={forwarders.map((f) => ({
          id: f.id,
          name: f.name,
          email: f.email,
          active: f.active,
          companyName: f.companyName,
          profile: f.freightForwarderProfile
            ? {
                companyName: f.freightForwarderProfile.companyName,
                serviceRegions: f.freightForwarderProfile.serviceRegions,
                contactEmail: f.freightForwarderProfile.contactEmail,
                contactPhone: f.freightForwarderProfile.contactPhone,
                notes: f.freightForwarderProfile.notes,
                active: f.freightForwarderProfile.active,
              }
            : null,
        }))}
      />
    </div>
  );
}
