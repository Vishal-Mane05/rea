import type { Metadata } from "next";
import { safeNext } from "@/lib/auth";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Log in · LearnForge" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <AuthForm mode="login" next={safeNext((await searchParams).next)} />;
}
