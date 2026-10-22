import { NextResponse } from "next/server";
import { loadCourseTree, toPackage } from "@/lib/course";
import { notFound } from "@/lib/http";
import { currentUser } from "@/lib/user";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const course = await loadCourseTree((await params).id, user.id);
  return course ? NextResponse.json(toPackage(course)) : notFound();
}
