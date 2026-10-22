import type { Metadata } from "next";
import { safeNext } from "@/lib/auth";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Sign up · LearnForge" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <AuthForm mode="signup" next={safeNext((await searchParams).next)} />;
}
