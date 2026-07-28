"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getHomePathForRole,
  getNavItemsForRole,
  isExternalRole,
  ROLE_LABELS,
} from "@/lib/rbac";
import type { AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  Bell,
  BookOpen,
  Boxes,
  CalendarDays,
  ClipboardList,
  Database,
  FileText,
  LogOut,
  Package,
  Ship,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

type AppShellProps = {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    role: AppRole;
    companyName?: string | null;
  };
  unreadCount?: number;
};

const NAV_ICONS: Record<string, LucideIcon> = {
  "/tablero": CalendarDays,
  "/orders": ClipboardList,
  "/booking": Ship,
  "/shipment": Package,
  "/customs": Boxes,
  "/costing": BookOpen,
  "/documentacion": FileText,
  "/master-data": Database,
  "/reports": ClipboardList,
};

function iconForHref(href: string): LucideIcon {
  return NAV_ICONS[href] ?? ClipboardList;
}

export function AppShell({ children, user, unreadCount = 0 }: AppShellProps) {
  const pathname = usePathname();
  const items = getNavItemsForRole(user.role);
  const home = getHomePathForRole(user.role);
  const showNotifications = !isExternalRole(user.role);

  return (
    <div className="relative min-h-screen">
      {/* Soft pastel atmosphere (Apple-like depth) */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-[#f7f9fb] via-[#e9eef4] to-[#f3f5f7]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(15,39,68,0.06),transparent_55%),radial-gradient(ellipse_55%_45%_at_100%_100%,rgba(47,111,106,0.07),transparent_50%)]" />

      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Desktop frosted sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-gray-200/50 bg-white/70 px-3 py-5 shadow-soft backdrop-blur-xl lg:flex">
          <Link
            href={home}
            className="mb-8 flex items-center gap-2.5 px-2 transition-all duration-300 ease-in-out hover:opacity-90"
            aria-label="AURA Logistics Doc Tracker"
          >
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-[-0.02em] text-foreground">
                AURA
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          </Link>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = iconForHref(item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-in-out",
                    active
                      ? "bg-white/90 text-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-white/50 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors duration-300",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-3 border-t border-gray-200/50 pt-4">
            {showNotifications && (
              <Link
                href="/notificaciones"
                className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-300 ease-in-out hover:bg-white/50 hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                Notificaciones
                {unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-soft">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            )}

            <div className="rounded-xl bg-white/60 px-3 py-3 shadow-soft">
              <p className="truncate font-display text-sm font-semibold tracking-tight text-foreground">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-8 w-full justify-start rounded-full px-2 text-muted-foreground hover:bg-white hover:text-foreground"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-3.5 w-3.5" />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-gray-200/50 bg-white/70 px-4 py-3 shadow-soft backdrop-blur-xl lg:hidden">
            <Link href={home} className="min-w-0 shrink-0" aria-label="AURA Logistics Doc Tracker">
              <p className="font-display text-sm font-bold tracking-tight text-foreground">
                AURA
              </p>
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold tracking-tight">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            {showNotifications && (
              <Link
                href="/notificaciones"
                className="relative rounded-full p-2 text-muted-foreground transition-all duration-300 hover:bg-white/80"
                aria-label="Notificaciones"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </header>

          {/* Mobile nav strip */}
          <div className="sticky top-[57px] z-30 flex gap-1 overflow-x-auto border-b border-gray-200/40 bg-white/60 px-3 py-2 backdrop-blur-xl lg:hidden">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={`${item.href}-${item.label}-m`}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 ease-in-out",
                    active
                      ? "bg-white text-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-white/70",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <main className="animate-slide-in flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
