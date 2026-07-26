/**
 * D1 Ecosystem — linear workflow demo seed
 * Three pristine cases that tell a coherent pipeline story.
 */
import {
  BookingStatus,
  DocumentChecklistStatus,
  InspectionStatus,
  OrderStatus,
  PrismaClient,
  Role,
  SupplierType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";

const BASE_EMAILS = [
  "admin@d1.local",
  "especialista@d1.local",
  "forwarder@d1.local",
  "aduana@d1.local",
  "proveedor@d1.local",
] as const;

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day, 15, 0, 0));
}

async function cleanOperationalData() {
  await prisma.notification.deleteMany();
  await prisma.bookingRevision.deleteMany();
  await prisma.costingLineItem.deleteMany();
  await prisma.shipmentRequiredDocument.deleteMany();
  await prisma.document.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.shipmentRecord.deleteMany();
  await prisma.customsRecord.deleteMany();
  await prisma.costingRecord.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reportSnapshot.deleteMany();
  await prisma.transitTime.deleteMany();
  await prisma.freightForwarderProfile.deleteMany({
    where: { user: { email: { notIn: [...BASE_EMAILS] } } },
  });
  await prisma.customsAgencyProfile.deleteMany({
    where: { user: { email: { notIn: [...BASE_EMAILS] } } },
  });
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { notIn: [...BASE_EMAILS] } },
  });
}

async function ensureBaseUsers(passwordHash: string) {
  const users = [
    {
      email: "admin@d1.local",
      name: "Ana Administradora",
      role: Role.admin,
      companyName: "D1 Interno",
    },
    {
      email: "especialista@d1.local",
      name: "Carlos Especialista",
      role: Role.internal_specialist,
      companyName: "D1 Interno",
    },
    {
      email: "forwarder@d1.local",
      name: "Luis Forwarder",
      role: Role.freight_forwarder,
      companyName: "Andes Cargo S.A.",
    },
    {
      email: "aduana@d1.local",
      name: "María Aduanas",
      role: Role.customs_agency,
      companyName: "Aduanas del Pacífico",
    },
    {
      email: "proveedor@d1.local",
      name: "Elena Proveedora",
      role: Role.supplier,
      companyName: "Global Supplies Ltd.",
    },
  ] as const;

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        companyName: u.companyName,
        passwordHash,
        active: true,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        companyName: u.companyName,
        passwordHash,
        active: true,
      },
    });
  }
}

async function addHistory(
  orderId: string,
  changedById: string,
  steps: { status: OrderStatus; at: Date; note: string }[],
) {
  let previous: OrderStatus | null = null;
  for (const step of steps) {
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: previous,
        newStatus: step.status,
        changedById,
        note: step.note,
        createdAt: step.at,
      },
    });
    previous = step.status;
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const year = 2026;

  console.log("Cleaning operational data…");
  await cleanOperationalData();
  await ensureBaseUsers(passwordHash);

  const specialist = await prisma.user.findUniqueOrThrow({
    where: { email: "especialista@d1.local" },
  });
  const forwarder = await prisma.user.findUniqueOrThrow({
    where: { email: "forwarder@d1.local" },
  });
  const agency = await prisma.user.findUniqueOrThrow({
    where: { email: "aduana@d1.local" },
  });
  const supplierUser = await prisma.user.findUniqueOrThrow({
    where: { email: "proveedor@d1.local" },
  });

  await prisma.freightForwarderProfile.upsert({
    where: { userId: forwarder.id },
    update: {
      companyName: "Andes Cargo S.A.",
      serviceRegions: ["Callao", "Buenaventura"],
      contactEmail: "forwarder@d1.local",
      active: true,
    },
    create: {
      userId: forwarder.id,
      companyName: "Andes Cargo S.A.",
      serviceRegions: ["Callao", "Buenaventura"],
      contactEmail: "forwarder@d1.local",
      active: true,
    },
  });

  await prisma.customsAgencyProfile.upsert({
    where: { userId: agency.id },
    update: {
      companyName: "Aduanas del Pacífico",
      serviceRegions: ["Callao"],
      contactEmail: "aduana@d1.local",
      active: true,
    },
    create: {
      userId: agency.id,
      companyName: "Aduanas del Pacífico",
      serviceRegions: ["Callao"],
      contactEmail: "aduana@d1.local",
      active: true,
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      name: "Global Supplies Ltd.",
      type: SupplierType.international,
      country: "China",
      contactName: "Elena Proveedora",
      contactEmail: "proveedor@d1.local",
      contactPhone: "+86 21 5555 0100",
      averageLeadTimeDays: 35,
      active: true,
      userId: supplierUser.id,
      sanitaryRegistration: {
        number: "RS-CN-2024-8812",
        expiry: "2027-06-30",
      },
    },
  });

  // -------------------------------------------------------------------------
  // Case 1 — Fully closed (linear story)
  // Docs Jul 1 → SARPE Jul 5 → Arrival Jul 25 → Levante Jul 28 → Costing Jul 30
  // -------------------------------------------------------------------------
  const case1 = await prisma.order.create({
    data: {
      orderNumber: `ORD-${year}-001`,
      sapReference: `SAP-${year}-1001`,
      supplierId: supplier.id,
      freightForwarderId: forwarder.id,
      customsAgencyId: agency.id,
      status: OrderStatus.closed,
      notes: "Caso demo cerrado de punta a punta",
      createdById: specialist.id,
      createdAt: d(year, 6, 28),
      lastActivityAt: d(year, 7, 30),
    },
  });

  await addHistory(case1.id, specialist.id, [
    { status: OrderStatus.created, at: d(year, 6, 28), note: "Orden creada" },
    {
      status: OrderStatus.booking_pending,
      at: d(year, 7, 1),
      note: "Documentos de embarque aprobados",
    },
    {
      status: OrderStatus.booked,
      at: d(year, 7, 5),
      note: "SARPE registrado",
    },
    {
      status: OrderStatus.shipped,
      at: d(year, 7, 25),
      note: "Arribo registrado",
    },
    {
      status: OrderStatus.customs_in_process,
      at: d(year, 7, 26),
      note: "Ingreso a aduana",
    },
    {
      status: OrderStatus.customs_cleared,
      at: d(year, 7, 28),
      note: "Levante",
    },
    { status: OrderStatus.costed, at: d(year, 7, 30), note: "Costeo finalizado" },
    { status: OrderStatus.closed, at: d(year, 7, 30), note: "Caso cerrado" },
  ]);

  const ship1 = await prisma.shipmentRecord.create({
    data: {
      orderId: case1.id,
      createdAt: d(year, 6, 29),
      requiredDocuments: {
        create: [
          {
            documentType: "Factura comercial",
            status: DocumentChecklistStatus.approved,
            updatedById: specialist.id,
            updatedAt: d(year, 7, 1),
          },
          {
            documentType: "Lista de empaque",
            status: DocumentChecklistStatus.approved,
            updatedById: specialist.id,
            updatedAt: d(year, 7, 1),
          },
          {
            documentType: "Conocimiento de embarque (BL / AWB)",
            status: DocumentChecklistStatus.approved,
            updatedById: specialist.id,
            updatedAt: d(year, 7, 1),
          },
        ],
      },
    },
  });
  void ship1;

  await prisma.booking.create({
    data: {
      orderId: case1.id,
      departureDate: d(year, 7, 5),
      arrivalDate: d(year, 7, 25),
      containerNumbers: ["MSCU1234567"],
      carrier: "Maersk",
      status: BookingStatus.shipped,
      createdAt: d(year, 7, 5),
    },
  });

  await prisma.customsRecord.create({
    data: {
      orderId: case1.id,
      customsAgencyId: agency.id,
      declarationNumber: `DAM-${year}-000101`,
      presentationDate: d(year, 7, 26),
      releaseDate: d(year, 7, 28),
      inspectionStatus: InspectionStatus.completed,
      inspectionCompletedAt: d(year, 7, 27),
      createdAt: d(year, 7, 26),
    },
  });

  await prisma.costingRecord.create({
    data: {
      orderId: case1.id,
      freightCost: 4200,
      customsFees: 890,
      supplierGoodsCost: 28500,
      otherCosts: 350,
      totalLandedCost: 33940,
      currency: "USD",
      calculatedAt: d(year, 7, 30),
      calculatedById: specialist.id,
      closed: true,
      lineItems: {
        create: [
          {
            category: "goods",
            description: "Mercancía FOB",
            amount: 28500,
            currency: "USD",
          },
          {
            category: "freight",
            description: "Flete marítimo",
            amount: 4200,
            currency: "USD",
          },
          {
            category: "customs",
            description: "Gastos de aduana",
            amount: 890,
            currency: "USD",
          },
          {
            category: "other",
            description: "Seguro y local",
            amount: 350,
            currency: "USD",
          },
        ],
      },
    },
  });

  // -------------------------------------------------------------------------
  // Case 2 — In customs (docs approved → shipped → customs_in_process)
  // -------------------------------------------------------------------------
  const case2 = await prisma.order.create({
    data: {
      orderNumber: `ORD-${year}-002`,
      sapReference: `SAP-${year}-1002`,
      supplierId: supplier.id,
      freightForwarderId: forwarder.id,
      customsAgencyId: agency.id,
      status: OrderStatus.customs_in_process,
      notes: "Caso en aduana — espera levante",
      createdById: specialist.id,
      createdAt: d(year, 7, 2),
      lastActivityAt: d(year, 7, 20),
    },
  });

  await addHistory(case2.id, specialist.id, [
    { status: OrderStatus.created, at: d(year, 7, 2), note: "Orden creada" },
    {
      status: OrderStatus.booking_pending,
      at: d(year, 7, 4),
      note: "Documentos aprobados",
    },
    { status: OrderStatus.booked, at: d(year, 7, 8), note: "SARPE" },
    { status: OrderStatus.shipped, at: d(year, 7, 18), note: "Arribo" },
    {
      status: OrderStatus.customs_in_process,
      at: d(year, 7, 20),
      note: "En proceso de aduana",
    },
  ]);

  await prisma.shipmentRecord.create({
    data: {
      orderId: case2.id,
      requiredDocuments: {
        create: [
          {
            documentType: "Factura comercial",
            status: DocumentChecklistStatus.approved,
            updatedById: specialist.id,
          },
          {
            documentType: "Lista de empaque",
            status: DocumentChecklistStatus.approved,
            updatedById: specialist.id,
          },
          {
            documentType: "Conocimiento de embarque (BL / AWB)",
            status: DocumentChecklistStatus.approved,
            updatedById: specialist.id,
          },
        ],
      },
    },
  });

  await prisma.booking.create({
    data: {
      orderId: case2.id,
      departureDate: d(year, 7, 8),
      arrivalDate: d(year, 7, 18),
      containerNumbers: ["TCLU7654321"],
      carrier: "MSC",
      status: BookingStatus.shipped,
    },
  });

  await prisma.customsRecord.create({
    data: {
      orderId: case2.id,
      customsAgencyId: agency.id,
      declarationNumber: `DAM-${year}-000102`,
      presentationDate: d(year, 7, 20),
      inspectionStatus: InspectionStatus.in_process,
    },
  });

  // -------------------------------------------------------------------------
  // Case 3 — With supplier (created, waiting for docs)
  // -------------------------------------------------------------------------
  const case3 = await prisma.order.create({
    data: {
      orderNumber: `ORD-${year}-003`,
      sapReference: `SAP-${year}-1003`,
      supplierId: supplier.id,
      freightForwarderId: forwarder.id,
      customsAgencyId: agency.id,
      status: OrderStatus.created,
      notes: "Caso nuevo — espera documentos del proveedor",
      createdById: specialist.id,
      createdAt: d(year, 7, 22),
      lastActivityAt: d(year, 7, 22),
    },
  });

  await addHistory(case3.id, specialist.id, [
    { status: OrderStatus.created, at: d(year, 7, 22), note: "Orden creada" },
  ]);

  await prisma.shipmentRecord.create({
    data: {
      orderId: case3.id,
      requiredDocuments: {
        create: [
          {
            documentType: "Factura comercial",
            status: DocumentChecklistStatus.pending,
          },
          {
            documentType: "Lista de empaque",
            status: DocumentChecklistStatus.pending,
          },
          {
            documentType: "Conocimiento de embarque (BL / AWB)",
            status: DocumentChecklistStatus.pending,
          },
        ],
      },
    },
  });

  console.log("Seed complete — 3 linear cases:");
  console.log(`  ${case1.orderNumber} closed (full pipeline)`);
  console.log(`  ${case2.orderNumber} customs_in_process`);
  console.log(`  ${case3.orderNumber} created (waiting supplier docs)`);
  console.log("Demo users password:", DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
