import { DocumentUpload } from "@/features/documents/components/DocumentUpload";
import DocumentList from "@/features/documents/components/DocumentList";

export default function UploadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">자료 업로드</h1>
        <p className="text-muted-foreground">문서를 업로드하여 분석을 시작하세요.</p>
      </div>
      <DocumentUpload />
      <DocumentList />
    </div>
  );
}
