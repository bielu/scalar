---
'@scalar/oas-utils': minor
'@scalar/api-client': minor
---

feat: pluggable transports for client plugins. Plugins can now register custom transports via the new `transports` field on `ClientPlugin`, keyed by document type (`openapi` / `asyncapi`) and target protocol (`http`, `wss`, `mqtt`, …). Two kinds are supported: `kind: 'http'` replaces the built-in fetch engine for one-shot request/response operations — `send(request, context)` receives the built fetch `Request` and returns a standard `Response`, so the rest of the pipeline (streaming detection, cookies, response body decoding, plugin hooks) keeps working unchanged. `kind: 'channel'` serves long-lived bidirectional connections (SignalR, gRPC streaming, MQTT, …) — `connect` resolves once the connection is established and is driven through the same session state machine as the built-in WebSocket client, so the message log, connection states, and WebSocket plugin hooks work identically. The first matching registration in plugin order wins, app-level overrides (`customFetch`, an explicit `customWebSocket`) still take precedence, and requests executed through a plugin transport bypass the CORS proxy.
