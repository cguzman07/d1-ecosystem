import { Prisma, Role, SupplierType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export type SupplierInput = {
  name: string;
  type: SupplierType;
  country: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  averageLeadTimeDays?: number | null;
  sanitaryRegistration?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  active?: boolean;
  userId?: string | null;
};

export type ExternalActorRole = "freight_forwarder" | "customs_agency";

export type CreateExternalUserInput = {
  role: ExternalActorRole;
  name: string;
  email: string;
  password: string;
  companyName: string;
  serviceRegions: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
};

export type UpdateExternalUserInput = {
  userId: string;
  name?: string;
  companyName?: string;
  serviceRegions?: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  active?: boolean;
};

export async function getSuppliers(filters?: {
  activeOnly?: boolean;
  search?: string;
}) {
  const where: Prisma.SupplierWhereInput = {};
  if (filters?.activeOnly) where.active = true;
  if (filters?.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
      { contactEmail: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
    ];
  }

  return prisma.supplier.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, name: true, active: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function getSupplierById(id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true, active: true } },
    },
  });
}

export async function createSupplier(input: SupplierInput) {
  const name = input.name.trim();
  if (!name) throw new Error("NAME_REQUIRED");
  if (!input.country.trim()) throw new Error("COUNTRY_REQUIRED");

  return prisma.supplier.create({
    data: {
      name,
      type: input.type,
      country: input.country.trim(),
      contactName: input.contactName?.trim() || null,
      contactEmail: input.contactEmail?.trim().toLowerCase() || null,
      contactPhone: input.contactPhone?.trim() || null,
      averageLeadTimeDays:
        input.averageLeadTimeDays === null || input.averageLeadTimeDays === undefined
          ? null
          : Number(input.averageLeadTimeDays),
      sanitaryRegistration: input.sanitaryRegistration ?? undefined,
      metadata: input.metadata ?? undefined,
      active: input.active ?? true,
      userId: input.userId || null,
    },
  });
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new Error("SUPPLIER_NOT_FOUND");

  return prisma.supplier.update({
    where: { id },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,
      type: input.type,
      country: input.country !== undefined ? input.country.trim() : undefined,
      contactName:
        input.contactName !== undefined
          ? input.contactName?.trim() || null
          : undefined,
      contactEmail:
        input.contactEmail !== undefined
          ? input.contactEmail?.trim().toLowerCase() || null
          : undefined,
      contactPhone:
        input.contactPhone !== undefined
          ? input.contactPhone?.trim() || null
          : undefined,
      averageLeadTimeDays:
        input.averageLeadTimeDays !== undefined
          ? input.averageLeadTimeDays === null
            ? null
            : Number(input.averageLeadTimeDays)
          : undefined,
      sanitaryRegistration:
        input.sanitaryRegistration === null
          ? Prisma.JsonNull
          : input.sanitaryRegistration !== undefined
            ? input.sanitaryRegistration
            : undefined,
      metadata:
        input.metadata === null
          ? Prisma.JsonNull
          : input.metadata !== undefined
            ? input.metadata
            : undefined,
      active: input.active,
      userId:
        input.userId !== undefined ? input.userId || null : undefined,
    },
  });
}

/** Soft-deactivate supplier (no hard delete) */
export async function setSupplierActive(id: string, active: boolean) {
  return updateSupplier(id, { active });
}

export async function getForwarders() {
  return prisma.user.findMany({
    where: { role: Role.freight_forwarder },
    include: { freightForwarderProfile: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function getCustomsAgencies() {
  return prisma.user.findMany({
    where: { role: Role.customs_agency },
    include: { customsAgencyProfile: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

function parseRegions(regions: string[]): string[] {
  return regions.map((r) => r.trim()).filter(Boolean);
}

export async function createExternalUser(input: CreateExternalUserInput) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const companyName = input.companyName.trim();

  if (!email || !name || !companyName) throw new Error("REQUIRED_FIELDS_MISSING");
  if (!input.password || input.password.length < 8) {
    throw new Error("PASSWORD_TOO_SHORT");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("EMAIL_ALREADY_EXISTS");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const serviceRegions = parseRegions(input.serviceRegions);
  const role =
    input.role === "freight_forwarder"
      ? Role.freight_forwarder
      : Role.customs_agency;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        companyName,
        active: true,
      },
    });

    if (role === Role.freight_forwarder) {
      await tx.freightForwarderProfile.create({
        data: {
          userId: user.id,
          companyName,
          serviceRegions,
          contactEmail: input.contactEmail?.trim().toLowerCase() || email,
          contactPhone: input.contactPhone?.trim() || null,
          notes: input.notes?.trim() || null,
          active: true,
        },
      });
    } else {
      await tx.customsAgencyProfile.create({
        data: {
          userId: user.id,
          companyName,
          serviceRegions,
          contactEmail: input.contactEmail?.trim().toLowerCase() || email,
          contactPhone: input.contactPhone?.trim() || null,
          notes: input.notes?.trim() || null,
          active: true,
        },
      });
    }

    return user;
  });
}

export async function updateExternalUser(input: UpdateExternalUserInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      freightForwarderProfile: true,
      customsAgencyProfile: true,
    },
  });

  if (!user) throw new Error("USER_NOT_FOUND");
  if (
    user.role !== Role.freight_forwarder &&
    user.role !== Role.customs_agency
  ) {
    throw new Error("NOT_EXTERNAL_ACTOR");
  }

  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        companyName:
          input.companyName !== undefined
            ? input.companyName.trim()
            : undefined,
        active: input.active,
      },
    });

    const profileData = {
      companyName:
        input.companyName !== undefined
          ? input.companyName.trim()
          : undefined,
      serviceRegions:
        input.serviceRegions !== undefined
          ? parseRegions(input.serviceRegions)
          : undefined,
      contactEmail:
        input.contactEmail !== undefined
          ? input.contactEmail?.trim().toLowerCase() || null
          : undefined,
      contactPhone:
        input.contactPhone !== undefined
          ? input.contactPhone?.trim() || null
          : undefined,
      notes:
        input.notes !== undefined ? input.notes?.trim() || null : undefined,
      active: input.active,
    };

    if (user.role === Role.freight_forwarder) {
      if (user.freightForwarderProfile) {
        await tx.freightForwarderProfile.update({
          where: { userId: user.id },
          data: profileData,
        });
      } else {
        await tx.freightForwarderProfile.create({
          data: {
            userId: user.id,
            companyName:
              input.companyName?.trim() || user.companyName || user.name,
            serviceRegions: parseRegions(input.serviceRegions ?? []),
            contactEmail: input.contactEmail?.trim().toLowerCase() || user.email,
            contactPhone: input.contactPhone?.trim() || null,
            notes: input.notes?.trim() || null,
            active: input.active ?? true,
          },
        });
      }
    } else if (user.customsAgencyProfile) {
      await tx.customsAgencyProfile.update({
        where: { userId: user.id },
        data: profileData,
      });
    } else {
      await tx.customsAgencyProfile.create({
        data: {
          userId: user.id,
          companyName:
            input.companyName?.trim() || user.companyName || user.name,
          serviceRegions: parseRegions(input.serviceRegions ?? []),
          contactEmail: input.contactEmail?.trim().toLowerCase() || user.email,
          contactPhone: input.contactPhone?.trim() || null,
          notes: input.notes?.trim() || null,
          active: input.active ?? true,
        },
      });
    }

    return updatedUser;
  });
}
