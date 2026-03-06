import { SearchResults } from "@/features/documents/components/SearchResults";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">문서 검색</h1>
        <p className="text-muted-foreground">업로드된 문서에서 내용을 검색하세요.</p>
      </div>
      <SearchResults />
    </div>
  );
}
