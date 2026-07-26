import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import {
  getOrdersForExport,
  ordersToCsv,
} from "@/features/reports/service";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const role = session.user.role as Role;
  if (role !== Role.admin && role !== Role.internal_specialist) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const rows = await getOrdersForExport();
  const csv = ordersToCsv(rows);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `d1-ordenes-${date}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
