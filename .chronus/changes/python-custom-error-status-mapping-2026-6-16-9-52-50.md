---
changeKind: fix
packages:
  - "@typespec/http-client-python"
---

Raise the dedicated azure-core error type for standard status codes (401, 404, 409, 304) whenever a customized error model covers them (ranged or default error responses), instead of falling back to a generic `HttpResponseError` or raising without the error body. The error body is now deserialized into the customized error model first and attached to the raised error. For example, a `401` covered by a custom error model now raises `ClientAuthenticationError` with the customized error body shape.
