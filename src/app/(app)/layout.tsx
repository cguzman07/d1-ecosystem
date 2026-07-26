import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const unreadCount = await prisma.notification.count({
    where: {
      recipientId: session.user.id,
      channel: "in_app",
      read: false,
    },
  });

  return (
    <AppShell user={session.user} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
