interface DocumentDetailPageProps {
  params: Promise<{ documentId: string }>;
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { documentId } = await params;
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">문서 상세: {documentId}</h1>
    </div>
  );
}
