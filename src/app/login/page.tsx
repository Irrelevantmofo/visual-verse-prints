import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/logo";
import { getCurrentProfile, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const profile = await getCurrentProfile();
  if (profile?.active) redirect(homeFor(profile.role));

  const notice = error === "inactive" ? "Your account isn't active yet. Ask the shop admin to activate it." : undefined;

  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-paper lg:flex">
        <Link href="/" className="text-foil-light">
          <Wordmark />
        </Link>
        <p className="font-serif text-5xl leading-tight">
          Your referrals,
          <br />
          <span className="italic text-foil-light">in one place.</span>
        </p>
        <div aria-hidden className="flex h-2">
          <span className="flex-1 bg-cyan" />
          <span className="flex-1 bg-magenta" />
          <span className="flex-1 bg-yellow" />
          <span className="flex-[2] bg-foil" />
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block text-ink lg:hidden">
            <Wordmark />
          </Link>
          <h1 className="font-display text-4xl font-semibold uppercase">Staff sign in</h1>
          <p className="mt-1 mb-8 text-sm text-graphite">For Visual Verse admins and agents.</p>
          <LoginForm next={typeof next === "string" ? next : undefined} notice={notice} />
          <p className="mt-6 text-xs text-graphite">Forgot your password? Ask the shop admin to reset it.</p>
        </div>
      </div>
    </main>
  );
}
