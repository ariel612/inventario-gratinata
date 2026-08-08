import type { Role } from "@/generated/prisma/enums";

// IMPORTANT: next-auth v5 re-exports User/Session/JWT from @auth/core via
// `export type { ... } from "@auth/core/types"` — augmenting "next-auth"
// directly does NOT merge (no local interface to merge into). The real
// declarations live in @auth/core, so that's what must be augmented.
declare module "@auth/core/types" {
  interface User {
    role: Role;
    username: string;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      username: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    username: string;
    sub: string;
  }
}
