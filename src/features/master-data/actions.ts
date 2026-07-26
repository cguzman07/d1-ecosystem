"use server";

import { Role, SupplierType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/session";
import {
  createExternalUser,
  createSupplier,
  setSupplierActive,
  updateExternalUser,
  updateSupplier,
  type ExternalActorRole,
} from "@/features/master-data/service";

export type MasterDataActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function mapError(error: unknown): string {
  if (!(error instanceof Error)) return "Error inesperado";
  switch (error.message) {
    case "UNAUTHORIZED":
      return "Debes iniciar sesión";
    case "FORBIDDEN":
      return "Solo administradores pueden gestionar datos maestros";
    case "NAME_REQUIRED":
      return "El nombre es obligatorio";
    case "COUNTRY_REQUIRED":
      return "El país es obligatorio";
    case "SUPPLIER_NOT_FOUND":
      return "Proveedor no encontrado";
    case "REQUIRED_FIELDS_MISSING":
      return "Completa nombre, correo y empresa";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 8 caracteres";
    case "EMAIL_ALREADY_EXISTS":
      return "Ya existe un usuario con ese correo";
    case "USER_NOT_FOUND":
      return "Usuario no encontrado";
    case "NOT_EXTERNAL_ACTOR":
      return "El usuario no es agente de carga ni agencia de aduana";
    default:
      return error.message || "Error inesperado";
  }
}

function revalidateMasterPaths() {
  revalidatePath("/master-data");
  revalidatePath("/master-data/suppliers");
  revalidatePath("/master-data/forwarders");
  revalidatePath("/master-data/customs");
  revalidatePath("/maestros");
  revalidatePath("/orders/new");
}

export async function createSupplierAction(
  formData: FormData,
): Promise<MasterDataActionResult> {
  try {
    await requireRoles([Role.admin]);

    const typeRaw = String(formData.get("type") ?? "international");
    const type = Object.values(SupplierType).includes(typeRaw as SupplierType)
      ? (typeRaw as SupplierType)
      : SupplierType.international;

    const leadRaw = String(formData.get("averageLeadTimeDays") ?? "").trim();
    const sanitaryNumber = String(formData.get("sanitaryNumber") ?? "").trim();
    const sanitaryExpiry = String(formData.get("sanitaryExpiry") ?? "").trim();

    const supplier = await createSupplier({
      name: String(formData.get("name") ?? ""),
      type,
      country: String(formData.get("country") ?? ""),
      contactName: String(formData.get("contactName") ?? "") || null,
      contactEmail: String(formData.get("contactEmail") ?? "") || null,
      contactPhone: String(formData.get("contactPhone") ?? "") || null,
      averageLeadTimeDays: leadRaw ? Number(leadRaw) : null,
      sanitaryRegistration:
        sanitaryNumber || sanitaryExpiry
          ? {
              number: sanitaryNumber || null,
              expiry: sanitaryExpiry || null,
            }
          : null,
      active: true,
    });

    revalidateMasterPaths();
    return { ok: true, id: supplier.id };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function updateSupplierAction(
  formData: FormData,
): Promise<MasterDataActionResult> {
  try {
    await requireRoles([Role.admin]);
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "Proveedor no indicado" };

    const typeRaw = String(formData.get("type") ?? "international");
    const type = Object.values(SupplierType).includes(typeRaw as SupplierType)
      ? (typeRaw as SupplierType)
      : SupplierType.international;

    const leadRaw = String(formData.get("averageLeadTimeDays") ?? "").trim();
    const sanitaryNumber = String(formData.get("sanitaryNumber") ?? "").trim();
    const sanitaryExpiry = String(formData.get("sanitaryExpiry") ?? "").trim();
    const active = String(formData.get("active") ?? "true") === "true";

    await updateSupplier(id, {
      name: String(formData.get("name") ?? ""),
      type,
      country: String(formData.get("country") ?? ""),
      contactName: String(formData.get("contactName") ?? "") || null,
      contactEmail: String(formData.get("contactEmail") ?? "") || null,
      contactPhone: String(formData.get("contactPhone") ?? "") || null,
      averageLeadTimeDays: leadRaw ? Number(leadRaw) : null,
      sanitaryRegistration:
        sanitaryNumber || sanitaryExpiry
          ? {
              number: sanitaryNumber || null,
              expiry: sanitaryExpiry || null,
            }
          : null,
      active,
    });

    revalidateMasterPaths();
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function toggleSupplierActiveAction(
  formData: FormData,
): Promise<MasterDataActionResult> {
  try {
    await requireRoles([Role.admin]);
    const id = String(formData.get("id") ?? "").trim();
    const active = String(formData.get("active") ?? "false") === "true";
    if (!id) return { ok: false, error: "Proveedor no indicado" };

    await setSupplierActive(id, active);
    revalidateMasterPaths();
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function createExternalUserAction(
  formData: FormData,
): Promise<MasterDataActionResult> {
  try {
    await requireRoles([Role.admin]);

    const roleRaw = String(formData.get("role") ?? "").trim() as ExternalActorRole;
    if (roleRaw !== "freight_forwarder" && roleRaw !== "customs_agency") {
      return { ok: false, error: "Rol externo no válido" };
    }

    const regionsRaw = String(formData.get("serviceRegions") ?? "");
    const serviceRegions = regionsRaw
      .split(/[\n,;]+/)
      .map((r) => r.trim())
      .filter(Boolean);

    const user = await createExternalUser({
      role: roleRaw,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      companyName: String(formData.get("companyName") ?? ""),
      serviceRegions,
      contactEmail: String(formData.get("contactEmail") ?? "") || null,
      contactPhone: String(formData.get("contactPhone") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    });

    revalidateMasterPaths();
    return { ok: true, id: user.id };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function updateExternalUserAction(
  formData: FormData,
): Promise<MasterDataActionResult> {
  try {
    await requireRoles([Role.admin]);
    const userId = String(formData.get("userId") ?? "").trim();
    if (!userId) return { ok: false, error: "Usuario no indicado" };

    const regionsRaw = String(formData.get("serviceRegions") ?? "");
    const serviceRegions = regionsRaw
      .split(/[\n,;]+/)
      .map((r) => r.trim())
      .filter(Boolean);

    const active = String(formData.get("active") ?? "true") === "true";

    await updateExternalUser({
      userId,
      name: String(formData.get("name") ?? ""),
      companyName: String(formData.get("companyName") ?? ""),
      serviceRegions,
      contactEmail: String(formData.get("contactEmail") ?? "") || null,
      contactPhone: String(formData.get("contactPhone") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      active,
    });

    revalidateMasterPaths();
    return { ok: true, id: userId };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}
