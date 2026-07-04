---
'scalar-fastapi': minor
'scalar-ninja': minor
---

feat: add an optional `document_type` field for AsyncAPI documents

`OpenAPISource` (used in `sources`) and the top-level configuration now accept an optional `document_type` ('openapi' or 'asyncapi'), serialized as `documentType`. The field is a forward-compatible hint: the renderer keeps auto-detecting the type from document content, so it stays optional.
