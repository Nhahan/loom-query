# LoomQuery API Reference

Base URL: `http://localhost:3000`

---

## Upload Endpoint

### POST /api/documents/upload

Upload a document for processing and embedding.

**Request**

```
Content-Type: multipart/form-data
```

| Field | Type   | Required | Description                  |
|-------|--------|----------|------------------------------|
| file  | File   | Yes      | PDF or text file to upload   |

**curl Example**

```bash
curl -X POST \
  -F "file=@document.pdf" \
  http://localhost:3000/api/documents/upload
```

**Response 200**

```json
{
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "waiting",
  "fileName": "document.pdf"
}
```

**Response 400** — Missing or invalid file

```json
{ "error": "No file provided" }
```

**Response 500** — Server error

```json
{ "error": "Failed to process upload" }
```

---

## Search Endpoint

### GET /api/documents/search

Semantic search across uploaded documents using vector similarity.

**Query Parameters**

| Parameter | Type   | Required | Description         |
|-----------|--------|----------|---------------------|
| q         | string | Yes      | Search query text   |

**curl Example**

```bash
curl "http://localhost:3000/api/documents/search?q=machine+learning"
```

**Response 200**

```json
{
  "results": [
    {
      "document_id": "550e8400-e29b-41d4-a716-446655440000",
      "text": "Machine learning is a subset of artificial intelligence...",
      "similarity": 0.92,
      "metadata": {
        "document_id": "550e8400-e29b-41d4-a716-446655440000",
        "chunk_index": 3
      }
    }
  ],
  "response_time": 245
}
```

| Field         | Type   | Description                                  |
|---------------|--------|----------------------------------------------|
| document_id   | string | Source document ID (null if unknown)         |
| text          | string | Matching chunk text                          |
| similarity    | number | Cosine similarity score 0–1 (higher = better)|
| metadata      | object | Additional chunk metadata                    |
| response_time | number | Total search duration in milliseconds        |

**Response 400** — Missing query

```json
{ "error": "Search query is required" }
```

**Response 500** — Embedding or ChromaDB error

```json
{ "error": "Failed to generate embedding" }
```

---

## Analytics Endpoint

### GET /api/documents/analytics

Returns aggregated search usage statistics.

**curl Example**

```bash
curl "http://localhost:3000/api/documents/analytics"
```

**Response 200**

```json
{
  "top_searches": [
    { "query": "machine learning", "count": 42, "avg_result_count": 4.76 },
    { "query": "neural networks",  "count": 31, "avg_result_count": 3.90 }
  ]
}
```

| Field            | Type   | Description                             |
|------------------|--------|-----------------------------------------|
| query            | string | Searched query text                     |
| count            | number | Number of times this query was searched |
| avg_result_count | number | Average number of results returned      |

---

## Status Codes

| Code | Meaning               |
|------|-----------------------|
| 200  | Success               |
| 400  | Bad request / invalid input |
| 500  | Internal server error |
