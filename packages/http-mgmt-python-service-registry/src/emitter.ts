import {
  EmitContext,
  emitFile,
  getNamespaceFullName,
  isArrayModelType,
  isRecordModelType,
  resolvePath,
} from "@typespec/compiler";
import type { Model, ModelProperty, Program, Scalar, TemplateParameter, Type } from "@typespec/compiler";
import { getAllHttpServices, HttpOperation, HttpService } from "@typespec/http";
import { getExtensions } from "@typespec/openapi";
import { getVersions } from "@typespec/versioning";

interface MgmtEmitterOptions {
  /** Override API version; defaults to the latest discovered version. */
  "api-version"?: string;
  /** Override provider name used in module/class names. */
  "service-provider"?: string;

  /**
   * Override inferred return model types for specific operations.
   *
   * Keys are operation names (e.g. "regenerateKey") or "<VERB> <PATH>" (e.g. "POST /subscriptions/{subscriptionId}/.../regenerateKey").
   * Values are Python model names (e.g. "ApiKey", "ConfigurationStore").
   */
  "return-type-overrides"?: Record<string, string>;
}

interface OperationShape {
  verb: string;
  name: string;
  path: string;
  pathParams: string[];
  pathParamTypes: Record<string, string>;
  bodyParam?: { name: string; type: string };
  group: string;
  isLro: boolean;
  isPageable: boolean;
  returnType: string;
  pageItemType?: string;
}

interface ProviderModel {
  providerName: string;
  moduleName: string;
  className: string;
  apiVersion: string;
  program: Program;
  operations: OperationShape[];
  referencedModels: Model[];
}

export async function $onEmit(context: EmitContext<MgmtEmitterOptions>) {
  const program = context.program;
  const emitterOptions = context.options ?? {};

  const [services, diagnostics] = getAllHttpServices(program);
  program.reportDiagnostics(diagnostics);
  if (program.hasError()) {
    return;
  }

  const models = services.map((service: HttpService) =>
    buildProviderModel(program, service, emitterOptions),
  );

  const registryDir = resolvePath(context.emitterOutputDir, "_service_registry");
  const modelsRootDir = resolvePath(registryDir, "models");

  // Ensure models package exists so relative imports work.
  await emitFile(program, {
    path: resolvePath(modelsRootDir, "__init__.py"),
    content: "",
  });
  await emitFile(program, {
    path: resolvePath(registryDir, "service_factory.py"),
    content: renderServiceFactory(),
  });

  for (const model of models) {
    await emitFile(program, {
      path: resolvePath(registryDir, `${model.moduleName}.py`),
      content: renderProviderModule(model),
    });

    if (model.referencedModels.length) {
      await emitFile(program, {
        path: resolvePath(modelsRootDir, `${model.moduleName}.py`),
        content: renderProviderModelsFile(model.program, model),
      });
    }
  }

  await emitFile(program, {
    path: resolvePath(registryDir, "__init__.py"),
    content: renderInit(models),
  });
}

function buildProviderModel(program: Program, service: HttpService, options: MgmtEmitterOptions): ProviderModel {
  const providerName = inferProviderName(service, options);
  const moduleName = toSnakeCase(providerName);
  const className = `${toPascalCase(providerName)}Factory`;
  const apiVersion = pickApiVersion(program, service, options["api-version"]);

  const overrides = options["return-type-overrides"] ?? {};

  const referencedModelMap = new Map<string, Model>();

  const operations: OperationShape[] = service.operations.map((op: HttpOperation) => {
    const responseType = unwrapArmEnvelope(
      program,
      unwrapSingleBodyModel(getSuccessResponseBodyType(program, op) ?? op.operation.returnType),
    );
    const bodyParam = getBodyParam(program, op);

    const override =
      overrides[op.operation.name] ?? overrides[`${op.verb.toUpperCase()} ${op.path}`];

    const returnType = override ? override : typeToPython(responseType, program);
    const pageItemType = override ? override : getPageItemType(responseType, program);

    // Collect referenced TypeSpec models for later TypedDict emission.
    addReferencedModels(program, referencedModelMap, responseType);
    addReferencedModels(program, referencedModelMap, op.operation.returnType);
    addReferencedModels(program, referencedModelMap, op.operation.parameters as any);
    if (bodyParam) {
      const rawParams = (op as any).parameters;
      const params = Array.isArray(rawParams) ? rawParams : rawParams ? Object.values(rawParams) : [];
      const body = (params as any[]).find((p) => {
        const kind = p?.type ?? p?.kind;
        if (kind === "body" || kind === "bodyRoot") return true;
        if (p?.name === "body") return true;
        return false;
      });
      const bodyType: Type | undefined = body?.param?.type ?? body?.type;
      addReferencedModels(program, referencedModelMap, bodyType);
    }

    return {
      verb: op.verb.toUpperCase(),
      name: op.operation.name,
      path: op.path,
      pathParams: extractPathParams(op),
      pathParamTypes: getPathParamTypes(program, op),
      bodyParam,
      group: getOperationGroup(op),
      isLro: isLongRunning(program, op),
      isPageable: isPageable(program, op),
      returnType,
      pageItemType,
    };
  });

  const referencedModels = collectTransitiveModels(program, Array.from(referencedModelMap.values()));

  return { providerName, moduleName, className, apiVersion, program, operations, referencedModels };
}

function unwrapArmEnvelope(program: Program, type: Type | undefined): Type | undefined {
  if (!type || type.kind !== "Model") {
    return type;
  }

  // Heuristic: many ARM specs model responses as envelope types (ArmResponse, ArmDeletedResponse, etc.)
  // where the actual resource type is in `properties` or `body`. When we can find a clear candidate,
  // prefer it for nicer signatures.
  const model = type as Model;
  const name = model.name ?? "";
  const isEnvelope = /^(Arm(Response|DeletedResponse|ResourceUpdatedResponse)|ArmResourceCreatedResponse|ArmResourceUpdatedResponse)$/.test(
    name,
  );
  if (!isEnvelope) {
    return type;
  }

  const props = model.properties;
  const getProp = (propName: string): ModelProperty | undefined => {
    if (props instanceof Map) return props.get(propName);
    return (props as any)?.[propName];
  };

  // Common candidates in ARM common-types-ish envelopes.
  const candidate = getProp("properties") ?? getProp("body") ?? getProp("resource") ?? getProp("value");
  return candidate?.type ?? type;
}

function getSuccessResponseBodyType(program: Program, op: HttpOperation): Type | undefined {
  // HttpOperation.response entries often store the response body type on `response.type`.
  // Prefer 200/201/202; otherwise take the first non-error response.
  const responses = (op as any).responses as { statusCodes?: (string | number)[]; type?: Type; body?: { type?: Type } }[] | undefined;
  if (!Array.isArray(responses) || responses.length === 0) {
    return undefined;
  }

  const norm = (c: string | number) => String(c);
  const toCodes = (codes: unknown): string[] =>
    Array.isArray(codes) ? (codes as (string | number)[]).map(norm) : codes != null ? [String(codes)] : [];
  const pickByStatus = (wanted: string) => {
    const resp = responses.find((r) => toCodes(r.statusCodes).includes(wanted));
    return resp?.body?.type ?? resp?.type;
  };

  return (
    pickByStatus("200") ??
    pickByStatus("201") ??
    pickByStatus("202") ??
    // fall back to first response with a body type or type
    (() => {
      const resp = responses.find((r) => r.body?.type || r.type);
      return resp?.body?.type ?? resp?.type;
    })()
  );
}

function unwrapSingleBodyModel(type: Type | undefined): Type | undefined {
  if (!type || type.kind !== "Model") return type;
  const model = type as Model;
  const props = model.properties;
  const entries: [string, ModelProperty][] = props instanceof Map ? [...props.entries()] : Object.entries(props as any);
  if (entries.length !== 1) return type;
  const [name, prop] = entries[0];
  // Heuristic: an anonymous wrapper with a single property named 'body' is likely a body wrapper.
  if (!name || name.toLowerCase() !== "body") return type;
  return prop?.type ?? type;
}

function inferProviderName(service: HttpService, options: MgmtEmitterOptions): string {
  if (options["service-provider"]) {
    return options["service-provider"] as string;
  }

  for (const op of service.operations) {
    const match = op.path.match(/\/providers\/([^/]+)/i);
    if (match?.[1]) {
      return match[1];
    }
  }

  return getNamespaceFullName(service.namespace) ?? "UnknownProvider";
}

function pickApiVersion(program: Program, service: HttpService, overrideVersion: string | undefined): string {
  if (overrideVersion) {
    return overrideVersion;
  }

  const versionInfo = getVersions(program, service.namespace);
  if (Array.isArray(versionInfo) && versionInfo.length >= 2) {
    const candidate = versionInfo[1] as { getVersions?: () => { value?: unknown; name?: string }[] };
    const declared = candidate?.getVersions?.();
    if (declared && declared.length > 0) {
      const last = declared[declared.length - 1];
      return String(last.value ?? last.name ?? "latest");
    }
  }

  return "latest";
}

function extractPathParams(op: HttpOperation): string[] {
  const matches = [...op.path.matchAll(/\{([^}]+)\}/g)];
  return matches.map((m) => m[1].replace(/^\+/, "").replace(/[^\w]/g, ""));
}

function getPathParamTypes(program: Program, op: HttpOperation): Record<string, string> {
  const types: Record<string, string> = {};
  const paramsModel = op.operation.parameters;
  const props = (paramsModel as any)?.properties;

  if (props) {
    if (props instanceof Map) {
      for (const [name, prop] of props.entries() as Iterable<[string, ModelProperty]>) {
        const cleanName = name.replace(/^\+/, "").replace(/[^\w]/g, "");
        if (op.path.includes(`{${name}}`) || op.path.includes(`{${cleanName}}`)) {
          types[cleanName] = typeToPython(prop.type, program);
        }
      }
    } else if (typeof props === "object") {
      for (const [name, prop] of Object.entries(props) as [string, ModelProperty][]) {
        const cleanName = name.replace(/^\+/, "").replace(/[^\w]/g, "");
        if (op.path.includes(`{${name}}`) || op.path.includes(`{${cleanName}}`)) {
          types[cleanName] = typeToPython(prop.type, program);
        }
      }
    }
  }

  // Ensure every extracted path param has an entry.
  for (const p of extractPathParams(op)) {
    if (!types[p]) {
      types[p] = "str";
    }
  }

  return types;
}

function getOperationGroup(op: HttpOperation): string {
  const container = op.container as { kind?: string; name?: string };
  if (container?.kind === "Interface" && container.name) {
    return container.name;
  }
  if (container?.name) {
    return container.name;
  }
  return "default";
}

function getBodyParam(program: Program, op: HttpOperation): { name: string; type: string } | undefined {
  const rawParams = (op as any).parameters;
  const params = Array.isArray(rawParams) ? rawParams : rawParams ? Object.values(rawParams) : [];

  // Find an HTTP body parameter. Shape varies by compiler version, so we check a few patterns.
  const body = (params as any[]).find((p) => {
    const kind = p?.type ?? p?.kind;
    if (kind === "body" || kind === "bodyRoot") return true;
    // Sometimes the body param has a `name: "body"` and `type` is the model.
    if (p?.name === "body") return true;
    return false;
  });

  if (!body) return undefined;

  const bodyType: Type | undefined = body?.param?.type ?? body?.type;
  if (!bodyType) return undefined;

  // Don't invent a body parameter for `Void` bodies (e.g. POST actions with no request content).
  if (bodyType.kind === "Intrinsic" && (bodyType as any).name === "void") {
    return undefined;
  }

  // Prefer a stable pythonic name.
  const opName = op.operation.name;
  const inferredName = `${opName}Parameters`;
  return { name: toPythonIdentifier(inferredName, "body"), type: typeToPython(bodyType, program) };
}

function isLongRunning(program: Program, op: HttpOperation): boolean {
  const extensions = getExtensions(program, op.operation) ?? getExtensions(program, op as any);
  if (extensions?.get("x-ms-long-running-operation" as const)) {
    return true;
  }

  const decorators = (op.operation as any)?.decorators as { decorator?: { name?: string }; args?: { value?: unknown }[] }[] | undefined;
  if (decorators?.some((d) => d.decorator?.name === "$lro")) {
    return true;
  }

  // Fallback: treat operations that return 202/201 as long-running even if the extension is missing.
  const statusCodes = ((op as any).responses as { statusCodes?: (string | number)[] }[] | undefined)
    ?.flatMap((r) => r.statusCodes ?? [])
    .map((c) => String(c));
  if (statusCodes?.some((c) => c === "202" || c === "201")) {
    return true;
  }

  // Heuristic: many management LROs are create/update/delete style operations.
  return /^(begin|create|update|delete|purge|start|stop)/i.test(op.operation.name);
}

function isPageable(program: Program, op: HttpOperation): boolean {
  const extensions = getExtensions(program, op.operation) ?? getExtensions(program, op as any);
  if (extensions?.get("x-ms-pageable" as const)) {
    return true;
  }

  const decorators = (op.operation as any)?.decorators as { decorator?: { name?: string }; args?: { value?: unknown }[] }[] | undefined;
  if (decorators?.some((d) => d.decorator?.name === "$pageable")) {
    return true;
  }

  // Heuristic: list operations with skip tokens are pageable even if the extension is missing.
  const rawParams = (op as any).parameters;
  const params = Array.isArray(rawParams) ? rawParams : rawParams ? Object.values(rawParams) : [];
  const hasSkipToken = (params as { type?: { name?: string }; param?: { name?: string }; name?: string }[]).some(
    (p) => p?.type?.name === "skipToken" || (p as any)?.param?.name === "skipToken" || p?.name === "skipToken",
  );
  if (hasSkipToken) {
    return true;
  }

  return /^list/i.test(op.operation.name);
}

function renderServiceFactory(): string {
  return `from typing import Any, Dict, Optional

from azure.core.paging import ItemPaged
from azure.core.polling import LROPoller, NoPolling, PollingMethod
from azure.core.rest import HttpRequest, HttpResponse
from azure.core.pipeline import PipelineResponse, PipelineContext


class ServiceProviderFactory:
    """Base factory with convenience HTTP helpers."""

    def __init__(self, client: Any, service_provider: str, subscription_id: Optional[str] = None, api_version: Optional[str] = None) -> None:
        self.client = client
        self.service_provider = service_provider
        self.subscription_id = subscription_id
        self.api_version = api_version or "latest"

    def _format_url(self, path: str, path_params: Optional[Dict[str, Any]] = None) -> str:
        try:
            return path.format(**(path_params or {}))
        except KeyError as exc:
            missing = exc.args[0]
            raise ValueError(f"Missing path parameter: {missing}") from exc

    def _with_api_version(self, url: str, api_version: Optional[str] = None) -> str:
        version = api_version or self.api_version
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}api-version={version}"

    def _send(self, request: HttpRequest, **kwargs: Any) -> HttpResponse:
        return self.client._send_request(request, **kwargs)

    def get(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("GET", url)
        return self._send(request, **kwargs)

    def post(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, body: Any = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("POST", url)
        if body is not None:
            request.set_json_body(body)
        return self._send(request, **kwargs)

    def put(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, body: Any = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("PUT", url)
        if body is not None:
            request.set_json_body(body)
        return self._send(request, **kwargs)

    def patch(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, body: Any = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("PATCH", url)
        if body is not None:
            request.set_json_body(body)
        return self._send(request, **kwargs)

    def delete(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("DELETE", url)
        return self._send(request, **kwargs)

    def head(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("HEAD", url)
        return self._send(request, **kwargs)

    def options(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("OPTIONS", url)
        return self._send(request, **kwargs)

    def _create_item_paged(self, first_page: Callable[..., HttpResponse], *args: Any, **kwargs: Any) -> ItemPaged[Any]:
      def extract_data(response: HttpResponse) -> tuple[list[Any], str | None]:
        data = response.json() if hasattr(response, "json") else None
        if isinstance(data, dict):
          items = data.get("value") or data.get("items") or []
          if isinstance(items, dict):
            items = list(items.values())
          next_link = data.get("nextLink") or data.get("next_page_link") or data.get("next_page") or data.get("nextLinkName")
        elif isinstance(data, list):
          items = data
          next_link = None
        else:
          items = [] if data is None else [data]
          next_link = None
        return list(items), next_link

      def get_next(continuation_token: str | None = None):
        if continuation_token:
          resp = self.get(continuation_token, path_params=None, api_version=None, **kwargs)
        else:
          resp = first_page(*args, **kwargs)

        items, next_link = extract_data(resp)
        return items, next_link

      return ItemPaged(get_next)

    def _create_lro_poller(self, response: HttpResponse, **kwargs: Any) -> LROPoller[Any]:
        polling: PollingMethod | bool | None = kwargs.pop("polling", True)

        def get_output(pipeline_response: PipelineResponse) -> Any:
          json = pipeline_response.http_response.json if hasattr(pipeline_response.http_response, "json") else None
          return json() if callable(json) else None

        if polling is True or polling is None:
          polling_method: PollingMethod = NoPolling()
        elif polling is False:
          polling_method = NoPolling()
        else:
          polling_method = polling

        pipeline_response = PipelineResponse(HttpRequest("GET", response.request.url), response, PipelineContext(None))
        return LROPoller[Any](
          client=self.client._client if hasattr(self.client, "_client") else self.client,
          initial_response=pipeline_response,
          deserialization_callback=get_output,
          polling_method=polling_method,
        )
`;
}

function renderProviderModule(model: ProviderModel): string {
  const groupedOps = new Map<string, OperationShape[]>();
  const groupedByVerb = new Map<string, OperationShape[]>();
  const groupInfo = new Map<string, { name: string; protoName: string }>();

  for (const op of model.operations) {
    const groupKey = toPythonIdentifier(op.group, "group");
    const protoName = `${toPascalCase(op.group || "group")}Operations`;
    groupInfo.set(groupKey, { name: op.group, protoName });

    const list = groupedOps.get(groupKey) ?? [];
    list.push(op);
    groupedOps.set(groupKey, list);

    const byVerb = groupedByVerb.get(op.verb) ?? [];
    byVerb.push(op);
    groupedByVerb.set(op.verb, byVerb);
  }

  const protocolDefinitions = Array.from(groupInfo.entries())
    .map(([groupKey, info]) => {
      const ops = model.operations.filter((op) => toPythonIdentifier(op.group, "group") === groupKey);
      const methods = ops.map((op) => renderProtocolMethod(op)).join("\n");
      return `class ${info.protoName}(Protocol):\n${methods || "  ..."}`;
    })
    .join("\n\n");

  const operationsByGroupType = Array.from(groupInfo.entries())
    .map(([groupKey, info]) => `    ${groupKey}: ${info.protoName}`)
    .join("\n");

  const operationsByGroupMapping = Array.from(groupInfo.entries())
    .map(([groupKey, info]) => `      "${groupKey}": cast(${info.protoName}, self)`)
    .join(",\n");

  const routesByMethod = Array.from(groupedByVerb.entries())
    .map(([verb, ops]) => {
      const operations = ops
        .map((operation) => renderRouteEntry(operation))
        .join(",\n                ");
      return `    "${verb}": {\n                ${operations}\n            }`;
    })
    .join(",\n");

  const routeIndexEntries = model.operations
    .map((op) => `      "${op.name}": ("${op.verb}", ${renderOperationHandlerName(op)})`)
    .join(",\n");

  const groupProperties = Array.from(groupInfo.entries())
    .map(([groupKey, info]) => `  @property\n  def ${groupKey}(self) -> ${info.protoName}:\n    return cast(${info.protoName}, self)`)
    .join("\n\n");

  const needsLro = model.operations.some((op) => op.isLro);
  const needsPaging = model.operations.some((op) => op.isPageable);

  const modelTypeNames = collectReferencedModelTypeNames(model);
  const modelsByNameType = modelTypeNames.map((t) => `    ${toSnakeCase(t)}: type[${t}]`).join("\n");

  const typingImports = ["Any", "Callable", "Dict", "Protocol", "TypedDict", "cast"];
  if (needsPaging) typingImports.push("Iterable");
  const typingImportLine = typingImports.join(", ");

  const extraImports = ["from .service_factory import ServiceProviderFactory"];
  if (needsLro) {
    extraImports.unshift("from azure.core.polling import LROPoller");
  }
  if (needsPaging) {
    extraImports.unshift("from azure.core.paging import ItemPaged");
  }

  const modelImportLine = modelTypeNames.length
    ? `from .models.${model.moduleName} import ${modelTypeNames.join(", ")}`
    : "";

  return `from typing import ${typingImportLine}

${extraImports.join("\n")}${modelImportLine ? "\n" + modelImportLine : ""}


${protocolDefinitions}


class ModelsByName(TypedDict):
${modelsByNameType || "    ..."}


class OperationsByGroup(TypedDict):
${operationsByGroupType || "    ..."}


class ${model.className}(ServiceProviderFactory):
  def __init__(self, client: Any, service_provider: str, subscription_id: str | None = None, api_version: str | None = None):
    super().__init__(client, service_provider, subscription_id, api_version or "${model.apiVersion}")

    self.routes_by_method: Dict[str, Dict[str, Callable[..., Any]]] = {
${routesByMethod}
    }

    self._route_index: Dict[str, tuple[str, Callable[..., Any]]] = {
${routeIndexEntries}
    }

    self.operations_by_group: OperationsByGroup = {
${operationsByGroupMapping}
    }

  def _call_route(self, verb: str, operation: str, *args: Any, **kwargs: Any) -> Any:
    try:
      handler = self.routes_by_method[verb][operation]
    except KeyError as exc:
      raise AttributeError(f"Operation '{operation}' not registered for verb '{verb}'") from exc
    return handler(*args, **kwargs)

  def __getattr__(self, name: str) -> Any:
    route = self._route_index.get(name)
    if route is None:
      raise AttributeError(f"{type(self).__name__} has no attribute '{name}'")

    verb, handler = route

    def _bound(*args: Any, **kwargs: Any) -> Any:
      return self._call_route(verb, name, *args, **kwargs)

    return _bound

${groupProperties}
`;
}

function renderProviderModelsFile(program: Program, provider: ProviderModel): string {
  const blocks: string[] = [];
  for (const model of provider.referencedModels) {
    if (!model.name) continue;
    const name = toPascalCase(model.name ?? "Model");
    const fields = renderTypedDictFields(program, model);
    blocks.push(`class ${name}(TypedDict, total=False):\n${fields || "    pass"}`);
  }

  const imports = new Set(["TypedDict", "NotRequired", "Required"]);
  return `from __future__ import annotations
from typing import ${Array.from(imports).join(", ")}


${blocks.join("\n\n")}
`;
}

function renderTypedDictFields(program: Program, model: Model, entries?: [string, ModelProperty][]): string {
  entries ??= collectModelProperties(model);
  if (entries.length === 0) return "";

  const lines: string[] = [];
  for (const [propName, prop] of entries) {
    const propType = resolveTemplateType(model, prop.type as Type);
    const pyType = typeToPython(propType, program);
    const wrapped = prop.optional ? `NotRequired[${pyType}]` : `Required[${pyType}]`;
    const safeKey = JSON.stringify(propName);
    lines.push(`    ${safeKey}: ${wrapped}`);
  }
  return lines.join("\n");
}

function collectModelProperties(model: Model, seen = new Set<Model>()): [string, ModelProperty][] {
  if (seen.has(model)) return [];
  seen.add(model);

  const map = new Map<string, ModelProperty>();

  const merge = (entries: [string, ModelProperty][]) => {
    for (const [name, prop] of entries) {
      if (!map.has(name)) {
        map.set(name, prop);
      }
    }
  };

  if (model.baseModel) {
    merge(collectModelProperties(model.baseModel, seen));
  }

  for (const source of model.sourceModels ?? []) {
    if (source?.model) {
      merge(collectModelProperties(source.model, seen));
    }
  }

  merge(getModelPropertyEntries(model));

  return Array.from(map.entries());
}

function getModelPropertyEntries(model: Model): [string, ModelProperty][] {
  const props = model.properties as any;
  if (!props) return [];
  if (props instanceof Map) return [...props.entries()];
  if (typeof props.entries === "function") return Array.from(props.entries());
  if (typeof props.values === "function")
    return Array.from(props.values()).map((p: any) => [p.name, p as ModelProperty]);
  return Object.entries(props as any) as [string, ModelProperty][];
}

function resolveTemplateType(container: Model, type: Type): Type {
  if (type.kind === "TemplateParameter" && container.templateMapper?.args) {
    const paramName = (type as any)?.node?.id?.sv ?? (type as any).name;
    const params: any[] = (container as any).node?.templateParameters ?? [];
    const index = params.findIndex((p: any) => p.id?.sv === paramName || p.id?.text === paramName);
    const mapped = index >= 0 ? container.templateMapper.args[index] : undefined;
    if (mapped && (mapped as any).kind) {
      return mapped as Type;
    }
  }
  return type;
}

function addReferencedModels(
  program: Program,
  out: Map<string, Model>,
  type: Type | undefined,
  seen = new Set<Type>(),
): void {
  if (!type || seen.has(type)) return;
  seen.add(type);

  if (type.kind === "Model") {
    const model = type as Model;
    // Skip anonymous models (no name) because they can't be referenced cleanly.
    if (model.name) {
      out.set(model.name, model);
    }
    if (model.baseModel) {
      addReferencedModels(program, out, model.baseModel, seen);
    }
    for (const source of model.sourceModels ?? []) {
      addReferencedModels(program, out, source?.model, seen);
    }
    for (const arg of model.templateMapper?.args ?? []) {
      addReferencedModels(program, out, arg as Type, seen);
    }
    // If this is array/record wrapper, also walk into the value.
    if (isArrayModelType(program, model) || isRecordModelType(program, model)) {
      addReferencedModels(program, out, (model as any).value, seen);
    }
    // Walk model properties as well.
    for (const [, prop] of getModelPropertyEntries(model)) {
      addReferencedModels(program, out, prop.type, seen);
    }
    return;
  }

  if (type.kind === "Union") {
    const variants: any[] = (type as any).variants?.values?.() ? Array.from((type as any).variants.values()) : [];
    for (const v of variants) {
      addReferencedModels(program, out, (v as any)?.type, seen);
    }
  }
}

function collectTransitiveModels(program: Program, roots: Model[]): Model[] {
  const seen = new Map<string, Model>();
  const visited = new Set<Type>();
  for (const m of roots) {
    addReferencedModels(program, seen, m, visited);
  }
  return Array.from(seen.values()).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

function collectReferencedModelTypeNames(model: ProviderModel): string[] {
  const seen = new Set<string>();

  for (const op of model.operations) {
    addPythonModelTypeNames(seen, op.returnType);
    addPythonModelTypeNames(seen, op.pageItemType);
    if (op.bodyParam) {
      addPythonModelTypeNames(seen, op.bodyParam.type);
    }
    for (const t of Object.values(op.pathParamTypes)) {
      addPythonModelTypeNames(seen, t);
    }
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

function addPythonModelTypeNames(seen: Set<string>, pythonType: string | undefined): void {
  if (!pythonType) return;

  const tokens = pythonType.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  for (const token of tokens) {
    if (isPythonBuiltinOrTypingSymbol(token)) continue;
    // Our emitter uses PascalCase for model symbols.
    if (!/^[A-Z]/.test(token)) continue;
    seen.add(token);
  }
}

function isPythonBuiltinOrTypingSymbol(name: string): boolean {
  switch (name) {
    case "Any":
    case "Dict":
    case "Callable":
    case "Protocol":
    case "TypedDict":
    case "TypeAlias":
    case "Iterable":
    case "list":
    case "tuple":
    case "str":
    case "int":
    case "float":
    case "bool":
    case "bytes":
    case "None":
    case "ItemPaged":
    case "LROPoller":
      return true;
    default:
      return false;
  }
}

function renderOperationParameterList(op: OperationShape): string {
  const parts: string[] = [];
  for (const p of op.pathParams) {
    const pyName = p;
    const t = op.pathParamTypes[pyName] ?? "str";
    parts.push(`${pyName}: ${t}`);
  }
  if (op.bodyParam) {
    parts.push(`${op.bodyParam.name}: ${op.bodyParam.type}`);
  }
  parts.push("**kwargs: Any");
  return parts.join(", ");
}

function renderRouteEntry(op: OperationShape): string {
  const paramsSignature = op.pathParams.length
    ? `${op.pathParams.map((p) => `${p}: ${op.pathParamTypes[p] ?? "Any"}`).join(", ")}, `
    : "";
  const bodySignature = op.bodyParam ? `${op.bodyParam.name}: ${op.bodyParam.type}, ` : "";
  const pathDict = op.pathParams.length
    ? `{${op.pathParams.map((p) => `'${p}': ${p}`).join(", ")}}`
    : "None";

  const bodyArg = op.bodyParam ? `, body=${op.bodyParam.name}` : "";

  const callExpr = `self.${op.verb.toLowerCase()}("${op.path}", path_params=${pathDict}${bodyArg}, **kwargs)`;
  if (op.isLro) {
    return `"${op.name}": (lambda ${paramsSignature}${bodySignature}**kwargs: self._create_lro_poller(${callExpr}))`;
  }
  if (op.isPageable) {
    return `"${op.name}": (lambda ${paramsSignature}${bodySignature}**kwargs: self._create_item_paged(lambda **_kwargs: ${callExpr}, **kwargs))`;
  }
  return `"${op.name}": (lambda ${paramsSignature}${bodySignature}**kwargs: ${callExpr})`;
}

function renderProtocolMethod(op: OperationShape): string {
  const signature = renderOperationParameterList(op);
  const baseReturn = op.returnType || "Any";
  const pagedItem = op.pageItemType || baseReturn || "Any";
  const returnType = op.isLro ? `LROPoller[${baseReturn}]` : op.isPageable ? `ItemPaged[${pagedItem}]` : baseReturn;
  return `  def ${op.name}(self, ${signature}) -> ${returnType}: ...`;
}

function renderOperationHandlerName(op: OperationShape): string {
  return `self.${op.verb.toLowerCase()}`;
}

function renderInit(models: ProviderModel[]): string {
  const imports = models
    .map((m) => `from .${m.moduleName} import ${m.className}`)
    .join("\n");
  const mappings = models
    .map((m) => `    "${m.providerName}": ${m.className},`)
    .join("\n");

  return `${imports}

SERVICE_FACTORIES = {
${mappings}
}


def get_factory(provider: str, client, subscription_id: str | None = None, api_version: str | None = None):
    try:
        factory_cls = SERVICE_FACTORIES[provider]
    except KeyError as exc:
        raise ValueError(f"Service provider '{provider}' is not supported.") from exc
    return factory_cls(client, provider, subscription_id, api_version)
`;
}

function typeToPython(type: Type | undefined, program?: Program): string {
  if (!type) {
    return "Any";
  }

  switch (type.kind) {
    case "Scalar":
      return mapScalarToPython(type as Scalar);
    case "String":
      return "str";
    case "Number":
      return "float";
    case "Boolean":
      return "bool";
    case "Model": {
      const model = type as Model;
      if (program && isArrayModelType(program, model)) {
        return `list[${typeToPython((model as any).value, program)}]`;
      }
      if (program && isRecordModelType(program, model)) {
        return `Dict[str, ${typeToPython((model as any).value, program)}]`;
      }
      return toPascalCase(model.name ?? "Model");
    }
    case "Enum":
      return toPascalCase((type as any).name ?? "Enum");
    case "Tuple":
      return "tuple[Any, ...]";
    case "Union":
      return "Any";
    case "TemplateParameter":
      return "Any";
    case "Intrinsic":
      return toPascalCase((type as any).name ?? "Intrinsic");
    default:
      return "Any";
  }
}

function mapScalarToPython(scalar: Scalar): string {
  const name = scalar.name?.toLowerCase();
  if (!name) return "Any";

  if (name.includes("int")) return "int";
  if (name.includes("float") || name.includes("double") || name.includes("decimal")) return "float";
  if (name === "boolean" || name === "bool") return "bool";
  if (name === "string" || name === "uuid" || name === "uri" || name.endsWith("datetime")) return "str";
  if (name === "bytes" || name === "bytearray") return "bytes";
  return toPascalCase(scalar.name);
}

function getPageItemType(returnType: Type | undefined, program?: Program): string | undefined {
  if (!returnType) return undefined;

  // Direct arrays
  if (program && returnType.kind === "Model" && isArrayModelType(program, returnType as Model)) {
    return typeToPython((returnType as any).value, program);
  }

  if (returnType.kind === "Model") {
    const model = returnType as Model;
    const valueProp = getModelProperty(model, "value");
    if (valueProp) {
      if (program && valueProp.type?.kind === "Model" && isArrayModelType(program, valueProp.type as Model)) {
        return typeToPython((valueProp.type as any).value, program);
      }
      return typeToPython(valueProp.type, program);
    }
  }

  return typeToPython(returnType, program);
}

function getModelProperty(model: Model, name: string): ModelProperty | undefined {
  return model.properties?.get(name);
}

function toSnakeCase(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function toPythonIdentifier(value: string, fallback: string): string {
  const candidate = toSnakeCase(value);
  if (candidate.length > 0) {
    return candidate;
  }

  const fallbackId = toSnakeCase(fallback);
  return fallbackId.length > 0 ? fallbackId : "group";
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
