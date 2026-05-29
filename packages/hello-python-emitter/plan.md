# Plan: Full WidgetAnalytics SDK across all 4 renderers

## Goal
Compile `Azure/azure-rest-api-specs/specification/widget/data-plane/WidgetAnalytics` with
this emitter and have every renderer (`string`, `template`, `alloy`, `ef-mix`) produce a
runnable Azure-flavored Python SDK with **wired bodies**, not just stubs:
- Sync ops build `azure.core.rest.HttpRequest`, call `_send_request`, raise on error, deserialize body.
- LRO ops use `azure.core.polling.LROPoller`.
- Paged ops use `azure.core.paging.ItemPaged`.
- Auth uses `azure.core.credentials.TokenCredential` + `BearerTokenCredentialPolicy`.

## Output layout (per renderer)
```
azure_widget_analytics/
  __init__.py
  _client.py
  _configuration.py
  _version.py
  _vendor.py
  operations/
    __init__.py
    _operations.py
  models/
    __init__.py
    _models.py
    _enums.py
    _patch.py
```

## Spec-driven feature coverage
| TypeSpec construct | What we emit |
|---|---|
| `@useAuth(AadOauth2Auth<scopes>)` | `BearerTokenCredentialPolicy(credential, *scopes)` in `_configuration.py` |
| `@versioned` enum | `api_version: str = "<latest>"` kwarg on client + per-op |
| `@resource("widgets")` + `@key` | resource paths `/widgets/{widgetName}` baked into operations |
| `@visibility(Lifecycle.Read)` | property excluded from create/update bodies, kept on read |
| `ResourceRead<T>` | sync GET → `T` |
| `ResourceList<T,...>` | paged GET → `ItemPaged[T]` |
| `LongRunningResourceCreateOrUpdate<T>` | `begin_create_or_update_widget(...) → LROPoller[T]` |
| `LongRunningResourceDelete<T>` | `begin_delete_widget(...) → LROPoller[None]` |
| `GetResourceOperationStatus<T>` | sync GET → `ResourceOperationStatusResponse[T]` |
| `@pollingOperation(...)` | poller wired to the named status op |

## Phases (see todos table for live status)
1. **deps-setup** — add Azure.Core/rest/versioning deps; copy spec to `test/widget-analytics/`.
2. **compile-baseline** — `tsp compile` succeeds (even if output is wrong) to validate wiring.
3. **ir-richer** — IR now walks `HttpOperation`, detects LRO via `getLroMetadata`, paged via `getPagedResult`, auth via `getAuthentication`, versions via `getVersions`. Adds `SdkEnum`, splits params by HTTP location.
4. **renderer-string** — reference impl with wired bodies.
5. **renderer-template** — port to templates.
6. **renderer-alloy** — port to pure Alloy.
7. **renderer-efmix** — Alloy + EF for type-aware bits.
8. **verify-bench** — diff four outputs (should differ only in trivia); update BENCHMARKS.md.

## IR shape (target)
```ts
interface SdkShape {
  clientName: string;            // WidgetAnalyticsClient
  moduleName: string;            // azure_widget_analytics
  version: string;               // "1.0.0"
  endpoint: { template: string; parameters: SdkParameter[] };
  auth: { kind: "AAD"; scopes: string[] } | { kind: "None" };
  apiVersions: string[];
  operations: SdkOperation[];
  models: SdkModel[];
  enums: SdkEnum[];
}

interface SdkOperation {
  name: string; pyName: string; docstring?: string;
  verb: "get" | "put" | "post" | "delete" | "patch";
  path: string;
  pathParameters: SdkParameter[];
  queryParameters: SdkParameter[];
  headerParameters: SdkParameter[];
  bodyParameter?: SdkParameter;
  returnType: string;
  lro?: { kind: string; finalResultType: string; pollingOpName?: string };
  paged?: { itemType: string; itemsPath: string; nextLinkPath?: string };
  tspOperation: Operation;
}

interface SdkProperty {
  name: string; pyName: string; pyType: string;
  optional: boolean; readOnly: boolean; serializedName: string;
}

interface SdkEnum {
  name: string; pyName: string; isExtensible: boolean;
  members: { name: string; value: string }[];
}
```

## Risks / open Qs
- Azure.Core templates instantiate a *lot* of envelope types (`Page<>`, `ResourceOperationStatus<>`, etc.). Need to filter the model walker so we only emit envelopes that are actually used.
- `BearerTokenCredentialPolicy` requires a real `TokenCredential` import — that's fine for runtime, but our test doesn't actually call the service. Generated code just needs to import cleanly.
- ef-mix EF python helpers may not yet support every type Azure.Core throws at it (e.g. `ResourceOperationStatus<T>` generic). May need to fall back to string-built type names in those spots.
