# D1 Ecosystem

Plataforma de gestión de importaciones que reemplaza el flujo manual en Excel: un registro unificado de órdenes con booking, embarque, aduana, costeo, documentación y datos maestros.

## Arquitectura

- **Next.js 14 (App Router)** + TypeScript strict + Tailwind / shadcn/ui
- **Supabase Postgres** + **Prisma** (`prisma/schema.prisma`, `DATABASE_URL` pooler + `DIRECT_URL`)
- **NextAuth** (credentials, sesión JWT) + RBAC en middleware y server actions
- **Almacenamiento**: `src/lib/storage.ts` → **Supabase Storage** (service role, bucket `d1-documents`)
- **Email**: `src/lib/email.ts` → **Resend** (`RESEND_API_KEY`)
- **UI**: metáfora de tablero tipo “flight board”, marca D1 (rojo `#E30613`, amarillo `#FFF200`, blanco)

### Estructura modular (`src/features/`)

Cada dominio vive en su carpeta (servicios, actions, componentes). Las rutas UI están en `src/app/(app)/`.

| Módulo | Ruta UI | Feature |
|--------|---------|---------|
| Tablero | `/tablero` | `src/features/orders` (board) |
| Órdenes | `/orders` | `src/features/orders` |
| Booking | `/booking` | `src/features/booking` |
| Embarque | `/shipment` | `src/features/shipment` |
| Documentación | `/documentacion`, `/orders/[id]/documents` | `src/features/documents` |
| Aduana | `/customs` | `src/features/customs` |
| Costeo | `/costing` | `src/features/costing` |
| Datos maestros | `/master-data` | `src/features/master-data` |
| Reportes | `/reports` | `src/features/reports` |
| Notificaciones | `/notificaciones` | `src/features/notifications` |

Libs compartidas: `src/lib/` (`auth`, `db`, `rbac`, `storage`, `email`, `logger`).

## Flujo Operativo del Caso (Ciclo de Vida) y Trazabilidad Legal

Documento de procedimiento operativo estándar (SOP) y de cumplimiento. Describe el ciclo de vida completo de un caso de importación en D1 Ecosystem, los actores involucrados y los controles de trazabilidad exigidos para auditoría interna y cumplimiento aduanero.

### 1. Creación y Asignación

- El **especialista interno** (o administrador) crea el caso a partir de la referencia SAP (`sapReference`), vinculando el pedido al ecosistema D1.
- En la creación se **asignan** de forma explícita:
  - **Proveedor** (origen de la mercancía y documentos de embarque).
  - **Agente de carga / forwarder** (booking, SARPE y fechas de tránsito).
  - **Agencia de aduana** (declaración y levante).
- El caso nace en estado **`created`** y se **auto-publica en el calendario** (`/tablero`) según fechas sensitivas del ciclo (creación, zarpe, arribo, levante).
- Se dispara una **notificación / correo al proveedor** para que ingrese a su panel aislado y cargue la documentación obligatoria de embarque.

### 2. Fase de Proveedor (Embarque)

- El proveedor opera solo en su **panel aislado** (`/shipment`), sin acceso a tablero global, costeo ni datos de otros actores (RBAC estricto).
- Debe completar el **checklist de documentos obligatorios** (factura comercial, lista de empaque, BL/AWB, etc.) mediante carga de archivos versionados.
- Cada ítem del checklist tiene estados controlados:
  - **`pending`** — pendiente de carga.
  - **`submitted`** — enviado a revisión.
  - **`needs_correction`** — el especialista solicita corrección (con motivo registrado); el proveedor debe volver a subir.
  - **`approved`** — documento validado.
- Mientras el checklist no esté **totalmente aprobado**, el caso permanece en fase documental y el forwarder **no puede** registrar booking/SARPE.

### 3. Validación y Tránsito (Booking)

- El **especialista interno** revisa y aprueba (o marca `needs_correction`) los documentos del checklist.
- Con la documentación aprobada, el **agente de carga** registra en su panel:
  - Fechas **SARPE (zarpe)** y **llegada / arribo**.
  - Naviera, contenedores y datos de booking.
- Cada cambio material de booking genera un **“roleo” auditado** en la tabla **`BookingRevision`** (quién cambió qué y cuándo).
- El estado del caso avanza (p. ej. `booked` → `shipped`) y el **calendario refleja el cambio de color** según la paleta de estados (rojo, amarillo, azul, etc.), manteniendo visibles los hitos ZARPE / ARRIBO.

### 4. Liberación de Aduana

- La **agencia de aduana** trabaja únicamente en su panel (`/customs`), acotado a los casos que le fueron asignados.
- Registra números de **declaración / expediente**, fechas de presentación y, cuando corresponde, la fecha de **levante**.
- Al registrar el levante, el caso pasa a **`customs_cleared`** y se dispara **notificación / correo al personal interno** para continuar con costeo.
- El hito **LEVANTE** se publica automáticamente en el calendario del tablero.

### 5. Costeo y Cierre

- Solo el **personal interno** (administrador / especialista) puede operar el módulo de costeo.
- Los **totales se calculan estrictamente a partir de line items** (ítems de costo); **nunca** se ingresan totales manuales arbitrarios como fuente de verdad.
- Al finalizar el costeo de forma válida, el caso avanza a **`costed`** y, al cerrar el ciclo, a **`closed`**.
- Una vez cerrado, el caso permanece trazable en historial y repositorio documental, pero fuera del flujo operativo activo (filtros del tablero pueden ocultar `costed` / `closed` por defecto).

### 6. Compliance y Legalidad

- **`OrderStatusHistory`**: registra cada transición de estado del caso (estado anterior → nuevo, usuario, nota, marca de tiempo). Es un **rastro de auditoría inmutable** del ciclo de vida.
- **`BookingRevision`**: conserva el historial de roleos y cambios de booking (fechas SARPE/arribo y datos asociados), con autoría y timestamp.
- Este doble registro es crítico para:
  - **Cumplimiento aduanero (DIAN)** — quién declaró qué y cuándo.
  - **Auditoría financiera interna** — soporte del costeo y del cierre del caso.
- Todas las acciones de actores externos (proveedor, forwarder, aduana) están **estrictamente acotadas por RBAC** (navegación, middleware y server actions): no pueden ver ni modificar casos ajenos ni módulos fuera de su carril operativo.

### Resumen de actores y paneles

| Actor | Panel principal | Responsabilidad clave |
|-------|-----------------|------------------------|
| Especialista / Admin | `/tablero`, `/orders`, módulos globales | Crear caso, aprobar docs, costeo y cierre |
| Proveedor | `/shipment` | Cargar y corregir documentos de embarque |
| Agente de carga | `/booking` | SARPE, arribo y roleos de booking |
| Agencia de aduana | `/customs` | Declaración y levante |

## Arranque local (recomendado)

1. Crea un proyecto en [Supabase](https://supabase.com) y una API key en [Resend](https://resend.com).
2. En Supabase Storage, crea el bucket privado `d1-documents` (o deja que la app lo cree con la service role).
3. Configura entorno y arranca:

```bash
cp .env.example .env
# Completa DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM

npm install
npx prisma db push
npm run db:seed
npm run dev
```

App: http://localhost:3000

### Docker (opcional)

`docker compose` ya no levanta Postgres/MinIO/Mailhog. Solo el servicio `app`, que usa las credenciales cloud de `.env`:

```bash
docker compose up --build
```

Para desarrollo diario suele ser más simple `npm run dev` en el host.
## Credenciales demo

Contraseña para todos: `password123`

| Rol | Correo |
|-----|--------|
| Administrador | `admin@d1.local` |
| Especialista interno | `especialista@d1.local` |
| Agente de carga | `forwarder@d1.local` |
| Agencia de aduana | `aduana@d1.local` |
| Proveedor | `proveedor@d1.local` |

El seed (Milestone 10) carga proveedores, agentes, aduanas y ~14 órdenes a lo largo de todo el pipeline (incluye una orden stale >3 días y documentos `needs_correction`).

## Tests

```bash
# Unitarios (Vitest) — lógica de órdenes y costeo
npm test

# E2E (Playwright) — crear orden como especialista
npx playwright install chromium   # una vez
npm run db:seed
npm run test:e2e
```

Si ya tienes `npm run dev` activo, Playwright reutiliza el servidor (`reuseExistingServer`).

## Infraestructura (Supabase / Resend)

- **DB**: Prisma usa `DATABASE_URL` (transaction pooler :6543) y `DIRECT_URL` (session :5432) — ver `prisma/schema.prisma`.
- **Storage**: `src/lib/storage.ts` → Supabase Storage (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Firmas públicas (`uploadObject`, `getPresignedDownloadUrl`, …) sin cambios para features.
- **Email**: `src/lib/email.ts` → Resend (`RESEND_API_KEY`, `EMAIL_FROM`).

## Scripts útiles

| Script | Uso |
|--------|-----|
| `npm run dev` | Next.js local |
| `npm run db:seed` | Re-sembrar datos demo |
| `npm run db:studio` | Prisma Studio |
| `npm run build` | Build producción |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright |

## SAP

SAP permanece externo. Las órdenes tienen `sapReference` y existe `createOrderFromSap()` en `src/features/orders/service.ts` como punto limpio de integración futura (webhook/inbound).

## GitHub y despliegue (Netlify)

1. El repositorio remoto es el origen de verdad del código (sin `.env`).
2. En Netlify: **Add new site → Import from Git** → elige este repo.
3. Build: lo define `netlify.toml` (`prisma generate` + `next build` + plugin Next.js).
4. Configura en Netlify → **Site settings → Environment variables** las mismas claves de `.env.example`:
   - `DATABASE_URL`, `DIRECT_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
   - `RESEND_API_KEY`, `EMAIL_FROM`
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (usa la URL pública de Netlify)
5. Tras el primer deploy, actualiza `NEXTAUTH_URL` si la URL del sitio cambió.
