import { PreviewFrame } from "@/components/PreviewFrame";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PreviewFrame courseId={id} />;
}
