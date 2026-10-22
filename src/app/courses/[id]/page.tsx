import { Editor } from "@/components/Editor";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Editor courseId={id} />;
}
