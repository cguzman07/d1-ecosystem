import type { AppRole } from "@/lib/roles";

/** Spanish labels for roles — UI only */
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  internal_specialist: "Especialista interno",
  freight_forwarder: "Agente de carga",
  customs_agency: "Agencia de aduana",
  supplier: "Proveedor",
};

/** Spanish labels for order statuses — UI only */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  created: "Creada",
  booking_pending: "Booking pendiente",
  booked: "Con booking",
  shipped: "Embarcada",
  customs_in_process: "En aduana",
  customs_cleared: "Levante",
  costed: "Costeada",
  closed: "Cerrada",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  no_booking: "Sin booking",
  with_booking: "Con booking",
  shipped: "Embarcado",
};

/** Landing path after login / when hitting `/` */
export function getHomePathForRole(role: AppRole): string {
  switch (role) {
    case "freight_forwarder":
      return "/booking";
    case "customs_agency":
      return "/customs";
    case "supplier":
      return "/shipment";
    case "admin":
    case "internal_specialist":
    default:
      return "/tablero";
  }
}

export function isExternalRole(role: AppRole): boolean {
  return (
    role === "freight_forwarder" ||
    role === "customs_agency" ||
    role === "supplier"
  );
}

/** Nav items visible per role */
export type NavItem = {
  href: string;
  label: string;
  roles: AppRole[] | "all";
};

/** Internal staff navigation (global ops) */
const INTERNAL_NAV: NavItem[] = [
  {
    href: "/tablero",
    label: "Tablero",
    roles: ["admin", "internal_specialist"],
  },
  {
    href: "/orders",
    label: "Órdenes",
    roles: ["admin", "internal_specialist"],
  },
  {
    href: "/booking",
    label: "Booking",
    roles: ["admin", "internal_specialist"],
  },
  {
    href: "/shipment",
    label: "Embarque",
    roles: ["admin", "internal_specialist"],
  },
  {
    href: "/customs",
    label: "Aduana",
    roles: ["admin", "internal_specialist"],
  },
  {
    href: "/costing",
    label: "Costeo",
    roles: ["admin", "internal_specialist"],
  },
  {
    href: "/documentacion",
    label: "Documentación",
    roles: ["admin", "internal_specialist"],
  },
  {
    href: "/master-data",
    label: "Datos maestros",
    roles: ["admin"],
  },
  {
    href: "/reports",
    label: "Reportes",
    roles: ["admin", "internal_specialist"],
  },
];

/**
 * Strict panel isolation: external actors only see their lane.
 * Internal staff see the full ops suite.
 */
export function getNavItemsForRole(role: AppRole): NavItem[] {
  if (role === "freight_forwarder") {
    return [{ href: "/booking", label: "Mis Bookings", roles: ["freight_forwarder"] }];
  }
  if (role === "customs_agency") {
    return [{ href: "/customs", label: "Mis Aduanas", roles: ["customs_agency"] }];
  }
  if (role === "supplier") {
    return [{ href: "/shipment", label: "Mis Embarques", roles: ["supplier"] }];
  }
  return INTERNAL_NAV.filter((item) => canAccessNav(role, item));
}

/** @deprecated Prefer getNavItemsForRole — kept for any legacy imports */
export const NAV_ITEMS: NavItem[] = INTERNAL_NAV;

export function canAccessNav(role: AppRole, item: NavItem): boolean {
  if (item.roles === "all") return true;
  return item.roles.includes(role);
}

/**
 * Strict path allow-list. External roles cannot open global calendar,
 * orders list, costing, master data, reports, etc.
 */
export function isRoleAllowedForPath(role: AppRole, pathname: string): boolean {
  if (pathname.startsWith("/notificaciones")) {
    // Externals stay in their lane — no global inbox in nav, but allow deep link if needed
    return !isExternalRole(role);
  }

  if (pathname === "/" || pathname === "") {
    return true; // middleware redirects to home
  }

  if (role === "admin") {
    return true;
  }

  if (role === "internal_specialist") {
    if (pathname.startsWith("/master-data") || pathname.startsWith("/maestros")) {
      return false;
    }
    return true;
  }

  if (role === "freight_forwarder") {
    if (pathname === "/booking" || pathname.startsWith("/booking/")) return true;
    if (/^\/orders\/[^/]+\/booking(\/|$)/.test(pathname)) return true;
    return false;
  }

  if (role === "customs_agency") {
    if (
      pathname === "/customs" ||
      pathname.startsWith("/customs/") ||
      pathname.startsWith("/aduana")
    ) {
      return true;
    }
    if (/^\/orders\/[^/]+\/customs(\/|$)/.test(pathname)) return true;
    return false;
  }

  if (role === "supplier") {
    if (
      pathname === "/shipment" ||
      pathname.startsWith("/shipment/") ||
      pathname.startsWith("/embarque")
    ) {
      return true;
    }
    if (/^\/orders\/[^/]+\/shipment(\/|$)/.test(pathname)) return true;
    return false;
  }

  return false;
}

/** Legacy map kept for documentation / tests — prefer isRoleAllowedForPath */
export const ROUTE_ROLE_MAP: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/tablero", roles: ["admin", "internal_specialist"] },
  { prefix: "/master-data", roles: ["admin"] },
  { prefix: "/maestros", roles: ["admin"] },
  { prefix: "/costing", roles: ["admin", "internal_specialist"] },
  { prefix: "/costeo", roles: ["admin", "internal_specialist"] },
  { prefix: "/reports", roles: ["admin", "internal_specialist"] },
  { prefix: "/reportes", roles: ["admin", "internal_specialist"] },
  { prefix: "/booking", roles: ["admin", "internal_specialist", "freight_forwarder"] },
  { prefix: "/shipment", roles: ["admin", "internal_specialist", "supplier"] },
  { prefix: "/embarque", roles: ["admin", "internal_specialist", "supplier"] },
  { prefix: "/customs", roles: ["admin", "internal_specialist", "customs_agency"] },
  { prefix: "/aduana", roles: ["admin", "internal_specialist", "customs_agency"] },
];
