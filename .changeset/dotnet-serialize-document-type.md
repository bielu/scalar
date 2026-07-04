---
'@scalar/dotnet-shared': minor
'@scalar/aspnetcore': minor
'@scalar/aspire': minor
---

feat: serialize documentType for AsyncAPI sources

`DocumentType` now serializes as `documentType` on a source (e.g. `"asyncapi"`), omitted for the default OpenAPI type. This brings the .NET integrations in line with the `documentType` hint already available in the shared JS source configuration.
