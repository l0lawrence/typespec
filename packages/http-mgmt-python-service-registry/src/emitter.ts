import {
  EmitContext,
  emitFile,
  getNamespaceFullName,
  isArrayModelType,
  isRecordModelType,
  resolvePath,
} from "@typespec/compiler";
import type { Model, ModelProperty, Program, Scalar, Type } from "@typespec/compiler";
import { getAllHttpServices, HttpOperation, HttpService } from "@typespec/http";
import { getExtensions } from "@typespec/openapi";
import { getVersions } from "@typespec/versioning";

interface MgmtEmitterOptions {
  /** Override API version; defaults to the latest discovered version. */
  "api-version"?: string;
  /** Override provider name used in module/class names. */
  "service-provider"?: string;
}

interface OperationShape {
  verb: string;
  name: string;
  path: string;
  pathParams: string[];
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
  operations: OperationShape[];
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
  await emitFile(program, {
    path: resolvePath(registryDir, "service_factory.py"),
    content: renderServiceFactory(),
  });

  for (const model of models) {
    await emitFile(program, {
      path: resolvePath(registryDir, `${model.moduleName}.py`),
      content: renderProviderModule(model),
    });
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

  const operations: OperationShape[] = service.operations.map((op: HttpOperation) => ({
    verb: op.verb.toUpperCase(),
    name: op.operation.name,
    path: op.path,
    pathParams: extractPathParams(op),
    group: getOperationGroup(op),
    isLro: isLongRunning(program, op),
    isPageable: isPageable(program, op),
    returnType: typeToPython(op.operation.returnType, program),
    pageItemType: getPageItemType(op.operation.returnType, program),
  }));

  return { providerName, moduleName, className, apiVersion, operations };
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

  return `from typing import ${typingImportLine}

${extraImports.join("\n")}


${protocolDefinitions}


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

function renderRouteEntry(op: OperationShape): string {
  const paramsSignature = op.pathParams.length ? `${op.pathParams.join(", ")}, ` : "";
  const pathDict = op.pathParams.length
    ? `{${op.pathParams.map((p) => `'${p}': ${p}`).join(", ")}}`
    : "None";

  const callExpr = `self.${op.verb.toLowerCase()}("${op.path}", path_params=${pathDict}, **kwargs)`;
  if (op.isLro) {
    return `"${op.name}": (lambda ${paramsSignature}**kwargs: self._create_lro_poller(${callExpr}))`;
  }
  if (op.isPageable) {
    return `"${op.name}": (lambda ${paramsSignature}**kwargs: self._create_item_paged(lambda **_kwargs: ${callExpr}, **kwargs))`;
  }
  return `"${op.name}": (lambda ${paramsSignature}**kwargs: ${callExpr})`;
}

function renderProtocolMethod(op: OperationShape): string {
  const params = op.pathParams.map((p) => `${p}: Any`).join(", ");
  const signature = params ? `${params}, **kwargs: Any` : "**kwargs: Any";
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
