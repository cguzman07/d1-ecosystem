import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getCustomsAgencies } from "@/features/master-data/service";
import { ExternalActorsManager } from "@/features/master-data/components/external-actors-manager";

export default async function CustomsMasterPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) !== Role.admin) redirect("/?error=forbidden");

  const agencies = await getCustomsAgencies();

  return (
    <div className="space-y-6">
      <div>
        <p className="board-header">
          <Link href="/master-data" className="hover:text-primary">
            Datos maestros
          </Link>{" "}
          / Agencias de aduana
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Agencias de aduana
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Usuarios con rol customs_agency y su perfil de empresa
        </p>
      </div>
      <ExternalActorsManager
        role="customs_agency"
        title="Agencia de aduana"
        actors={agencies.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          active: a.active,
          companyName: a.companyName,
          profile: a.customsAgencyProfile
            ? {
                companyName: a.customsAgencyProfile.companyName,
                serviceRegions: a.customsAgencyProfile.serviceRegions,
                contactEmail: a.customsAgencyProfile.contactEmail,
                contactPhone: a.customsAgencyProfile.contactPhone,
                notes: a.customsAgencyProfile.notes,
                active: a.customsAgencyProfile.active,
              }
            : null,
        }))}
      />
    </div>
  );
}
