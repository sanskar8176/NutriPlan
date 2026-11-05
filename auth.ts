import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/api-schemas";
import { rateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

// A real bcrypt hash of a random string. When the e-mail is unknown we still
// run bcrypt.compare against it so "no such user" and "wrong password" take the
// same time — otherwise response timing reveals which e-mails are registered.
const DUMMY_HASH = "$2b$12$80r9.i.FmVA4jlbpA.1f5u5c4/Oi.8nhXJo1WVN9EnZwIgbRwj00i";

const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    // Only register Google when it is configured so a missing secret cannot
    // produce a half-working provider.
    ...(googleConfigured
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
    Credentials({
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const limited = rateLimit(`login:${getClientIp(request)}`, RATE_LIMITS.login);
        if (!limited.ok) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        const valid = await bcrypt.compare(parsed.data.password, user?.password ?? DUMMY_HASH);
        if (!user?.password || !valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
