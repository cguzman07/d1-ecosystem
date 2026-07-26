import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { getHomePathForRole, isRoleAllowedForPath } from "@/lib/rbac";
import { isAppRole } from "@/lib/roles";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (!token || !isAppRole(token.role)) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const home = getHomePathForRole(token.role);

    // Role-based root landing (preserve error query for UX)
    if (pathname === "/") {
      const dest = new URL(home, req.url);
      const err = req.nextUrl.searchParams.get("error");
      if (err) dest.searchParams.set("error", err);
      return NextResponse.redirect(dest);
    }

    if (!isRoleAllowedForPath(token.role, pathname)) {
      const dest = new URL(home, req.url);
      dest.searchParams.set("error", "forbidden");
      return NextResponse.redirect(dest);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        if (pathname.startsWith("/login")) return true;
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: [
    "/",
    "/tablero",
    "/tablero/:path*",
    "/ordenes/:path*",
    "/orders",
    "/orders/:path*",
    "/booking",
    "/booking/:path*",
    "/shipment",
    "/shipment/:path*",
    "/embarque",
    "/embarque/:path*",
    "/customs",
    "/customs/:path*",
    "/aduana",
    "/aduana/:path*",
    "/costing",
    "/costing/:path*",
    "/costeo",
    "/costeo/:path*",
    "/documentacion",
    "/documentacion/:path*",
    "/master-data",
    "/master-data/:path*",
    "/maestros",
    "/maestros/:path*",
    "/reports",
    "/reports/:path*",
    "/reportes",
    "/reportes/:path*",
    "/notificaciones",
    "/notificaciones/:path*",
  ],
};
