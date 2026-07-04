---
'scalar_api_reference': minor
---

feat: add an optional documentType to sources for AsyncAPI documents

`Source` now has a `document_type: Option<DocumentType>` field (serialized as `documentType`), plus a `Source::asyncapi(url)` constructor and a `with_document_type` builder method. The field is a forward-compatible hint: the renderer keeps auto-detecting the type from document content, so it stays optional.

Note: this adds a public field to `Source`, which breaks exhaustive struct-literal construction (`Source { url, agent }`) — the crate is pre-1.0, so this is not treated as a breaking-change bump. Use `Source::new(url)` / `Source::asyncapi(url)` instead.
