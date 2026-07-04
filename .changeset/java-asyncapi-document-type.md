---
'@scalar/java-integration': minor
---

feat: add an optional documentType to sources for AsyncAPI documents

`ScalarSource` now accepts an optional `documentType` (`ScalarDocumentType.OPENAPI` or `ScalarDocumentType.ASYNCAPI`), serialized as `documentType`. The field is a forward-compatible hint: the renderer keeps auto-detecting the type from document content, so it stays optional.
