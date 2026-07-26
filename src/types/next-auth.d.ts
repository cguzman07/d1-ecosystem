import { Role } from "@prisma/client";
import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import type { AppRole } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      companyName?: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: AppRole;
    companyName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: AppRole;
    companyName?: string | null;
  }
}

// Keep Role import referenced so Prisma enum stays available to consumers
export type { Role };
