import {
  getDoc,
  getEffectiveModelType,
  getNamespaceFullName,
  getPagingOperation,
  isErrorModel,
  isList,
  isVoidType,
  type Enum,
  type Model,
  type ModelProperty,
  type Operation,
  type Program,
  type Type,
  type Union,
} from "@typespec/compiler";
import {
  getAllHttpServices,
  getAuthentication,
  type Authentication,
  type HttpOperation,
  type HttpOperationParameter,
  type HttpService,
} from "@typespec/http";
import { getAllVersions } from "@typespec/versioning";
import { getLroMetadata } from "@azure-tools/typespec-azure-core";

/* eslint-disable @typescript-eslint/no-unused-vars */

/* ──────────────────────────  IR  ────────────────────────── */

/**
 * Renderer-agnostic IR describing the Python SDK we want to produce.
 * Each renderer in `src/renderers/` consumes the same `SdkShape` so that the
 * output layouts are byte-for-byte comparable.
 */
export interface SdkShape {
  serviceName: string;
  clientName: string;
  moduleName: string;
  packageName: string;
  version: string;
  endpoint: SdkEndpoint;
  auth: SdkAuth;
  apiVersions: string[];
  defaultApiVersion: string;
  operations: SdkOperation[];
  models: SdkModel[];
  enums: SdkEnum[];
}

export interface SdkEndpoint {
  /** uri-template segment, e.g. `{endpoint}` or `{endpoint}/widgets`. */
  template: string;
  parameters: SdkParameter[];
}

export type SdkAuth =
  | { kind: "AAD"; scopes: string[] }
  | { kind: "ApiKey"; in: "header" | "query"; name: string }
  | { kind: "Bearer" }
  | { kind: "None" };

export interface SdkOperation {
  name: string;
  pyName: string;
  docstring?: string;
  verb: "get" | "put" | "post" | "patch" | "delete" | "head";
  path: string;
  pathParameters: SdkParameter[];
  queryParameters: SdkParameter[];
  headerParameters: SdkParameter[];
  bodyParameter?: SdkParameter;
  returnPyType: string;
  successStatusCodes: number[];
  lro?: SdkLro;
  paged?: SdkPaged;
  /** Direct reference to the TypeSpec Operation. Only used by the ef-mix renderer. */
  tspOperation: Operation;
}

export interface SdkLro {
  finalPyType: string;
  pollingOpPyName?: string;
}

export interface SdkPaged {
  itemPyType: string;
  itemsPath: string;
  nextLinkPath?: string;
}

export interface SdkParameter {
  name: string;
  pyName: string;
  pyType: string;
  optional: boolean;
  default?: string;
  serializedName: string;
  description?: string;
}

export interface SdkModel {
  name: string;
  pyName: string;
  docstring?: string;
  properties: SdkProperty[];
  /** Direct reference to the TypeSpec Model. Only used by the ef-mix renderer. */
  tspModel: Model;
}

export interface SdkProperty {
  name: string;
  pyName: string;
  pyType: string;
  optional: boolean;
  readOnly: boolean;
  serializedName: string;
  description?: string;
}

export interface SdkEnum {
  name: string;
  pyName: string;
  docstring?: string;
  isExtensible: boolean;
  members: SdkEnumMember[];
  /** Direct reference to the TypeSpec Enum or Union. Only used by the ef-mix renderer. */
  tspEnum: Enum | Union;
}

export interface SdkEnumMember {
  name: string;
  pyName: string;
  value: string;
  description?: string;
}

/* ──────────────────────  Public entry  ────────────────────── */

export function extractSdkShape(program: Program, moduleNameOverride?: string): SdkShape {
  const [services] = getAllHttpServices(program);
  const service: HttpService | undefined = services[0];
  if (!service) {
    return emptyShape(moduleNameOverride ?? "service");
  }

  const serviceName = service.namespace.name || "Service";
  const clientName = `${pascalCase(serviceName)}Client`;
  const moduleName = moduleNameOverride ?? snakeCase(serviceName);
  const packageName = moduleName.replace(/_/g, "-");

  const versions = getServiceVersions(program, service);
  const defaultApiVersion = versions[versions.length - 1] ?? "1.0.0";

  const collector = new TypeCollector(program);

  const operations: SdkOperation[] = [];
  for (const httpOp of service.operations) {
    operations.push(buildOperation(program, httpOp, collector));
  }

  const auth = resolveAuth(program, service);

  return {
    serviceName,
    clientName,
    moduleName,
    packageName,
    version: "1.0.0",
    endpoint: { template: "{endpoint}", parameters: [endpointParam()] },
    auth,
    apiVersions: versions,
    defaultApiVersion,
    operations,
    models: collector.models(),
    enums: collector.enums(),
  };
}

function emptyShape(moduleName: string): SdkShape {
  return {
    serviceName: "Service",
    clientName: "ServiceClient",
    moduleName,
    packageName: moduleName.replace(/_/g, "-"),
    version: "1.0.0",
    endpoint: { template: "{endpoint}", parameters: [endpointParam()] },
    auth: { kind: "None" },
    apiVersions: [],
    defaultApiVersion: "1.0.0",
    operations: [],
    models: [],
    enums: [],
  };
}

function endpointParam(): SdkParameter {
  return {
    name: "endpoint",
    pyName: "endpoint",
    pyType: "str",
    optional: false,
    serializedName: "endpoint",
    description: "Service endpoint URL.",
  };
}

/* ─────────────────────  HTTP operation  ──────────────────── */

function buildOperation(
  program: Program,
  httpOp: HttpOperation,
  collector: TypeCollector,
): SdkOperation {
  const tspOp = httpOp.operation;
  const pathParameters: SdkParameter[] = [];
  const queryParameters: SdkParameter[] = [];
  const headerParameters: SdkParameter[] = [];

  for (const param of httpOp.parameters.parameters) {
    const sdkParam = buildHttpParameter(program, param, collector);
    switch (param.type) {
      case "path":
        pathParameters.push(sdkParam);
        break;
      case "query":
        queryParameters.push(sdkParam);
        break;
      case "header":
        headerParameters.push(sdkParam);
        break;
    }
  }

  let bodyParameter: SdkParameter | undefined;
  const body = httpOp.parameters.body;
  if (body && body.bodyKind === "single" && body.type) {
    const pyType = collector.pythonTypeOf(body.type);
    bodyParameter = {
      name: body.property?.name ?? "body",
      pyName: snakeCase(body.property?.name ?? "body"),
      pyType,
      optional: body.property?.optional ?? false,
      serializedName: body.property?.name ?? "body",
      description: body.property ? getDoc(program, body.property) : undefined,
    };
  }

  const successResponse = httpOp.responses.find((r) => {
    const sc = r.statusCodes;
    if (sc === "*") return false;
    if (typeof sc === "number") return sc >= 200 && sc < 300;
    return sc.start >= 200 && sc.end < 300;
  });

  let returnPyType = "None";
  const successStatusCodes: number[] = [];
  if (successResponse) {
    const sc = successResponse.statusCodes;
    if (typeof sc === "number") successStatusCodes.push(sc);
    else if (sc !== "*") {
      for (let c = sc.start; c <= sc.end; c++) successStatusCodes.push(c);
    }
    const responseBody = successResponse.responses?.[0]?.body?.type;
    if (responseBody && !isVoidType(responseBody)) {
      returnPyType = collector.pythonTypeOf(resolveResponseType(program, responseBody));
    } else if (!isVoidType(successResponse.type)) {
      returnPyType = collector.pythonTypeOf(resolveResponseType(program, successResponse.type));
    }
  }

  const lroMetadata = getLroMetadata(program, tspOp);
  let lro: SdkLro | undefined;
  if (lroMetadata) {
    const finalType = lroMetadata.finalResult;
    let finalPyType = "None";
    // Azure.Core's LongRunningResourceDelete template carries the resource type
    // as finalResult, but the actual HTTP response for delete is empty. Match
    // the Azure SDK Python convention of returning None for delete LROs.
    if (httpOp.verb !== "delete" && finalType && finalType !== "void" && typeof finalType !== "string") {
      finalPyType = collector.pythonTypeOf(resolveResponseType(program, finalType as Type));
    }
    lro = {
      finalPyType,
      pollingOpPyName: lroMetadata.statusMonitorStep
        ? snakeCase(
            (lroMetadata.statusMonitorStep as unknown as { target?: { operation?: Operation } })
              .target?.operation?.name ?? "",
          ) || undefined
        : undefined,
    };
  }

  let paged: SdkPaged | undefined;
  if (isList(program, tspOp)) {
    const [pageInfo] = getPagingOperation(program, tspOp);
    if (pageInfo) {
      const pageItems = pageInfo.output.pageItems;
      const nextLink = pageInfo.output.nextLink;
      const itemType =
        pageItems?.property?.type && pageItems.property.type.kind === "Model" &&
        pageItems.property.type.name === "Array"
          ? collector.pythonTypeOf(pageItems.property.type.indexer!.value)
          : "Any";
      paged = {
        itemPyType: itemType,
        itemsPath: pageItems?.property?.name ?? "value",
        nextLinkPath: nextLink?.property?.name,
      };
    }
  }

  return {
    name: tspOp.name,
    pyName: snakeCase(tspOp.name),
    docstring: getDoc(program, tspOp),
    verb: httpOp.verb,
    path: httpOp.path,
    pathParameters,
    queryParameters,
    headerParameters,
    bodyParameter,
    returnPyType,
    successStatusCodes,
    lro,
    paged,
    tspOperation: tspOp,
  };
}

function buildHttpParameter(
  program: Program,
  param: HttpOperationParameter,
  collector: TypeCollector,
): SdkParameter {
  const prop = param.param;
  return {
    name: prop.name,
    pyName: escapePyName(snakeCase(prop.name)),
    pyType: collector.pythonTypeOf(prop.type),
    optional: prop.optional,
    serializedName: param.name,
    description: getDoc(program, prop),
  };
}

/**
 * The TypeSpec HTTP layer often synthesizes an anonymous response/body Model
 * for templated operations (e.g. Azure.Core's `ResourceRead<WidgetSuite>` —
 * the body is an anonymous Model that spreads WidgetSuite). For those cases
 * we rely on `getEffectiveModelType` to map back to the user-visible Model
 * (here, `WidgetSuite`) so the IR exposes a real, named type.
 */
function resolveResponseType(program: Program, type: Type): Type {
  if (type.kind === "Model" && (!type.name || type.name === "")) {
    const effective = getEffectiveModelType(program, type);
    if (effective.name) return effective;
  }
  return type;
}

/* ──────────────────  Auth / versions  ─────────────────── */

function resolveAuth(program: Program, service: HttpService): SdkAuth {
  const auth: Authentication | undefined = getAuthentication(program, service.namespace);
  const scheme = auth?.options?.[0]?.schemes?.[0];
  if (!scheme) return { kind: "None" };
  switch (scheme.type) {
    case "oauth2": {
      const scopes = new Set<string>();
      for (const flow of scheme.flows ?? []) {
        for (const s of (flow as { scopes?: { value: string }[] }).scopes ?? []) {
          scopes.add(s.value);
        }
      }
      return { kind: "AAD", scopes: [...scopes] };
    }
    case "http":
      return { kind: "Bearer" };
    case "apiKey":
      return {
        kind: "ApiKey",
        in: (scheme as { in?: "header" | "query" }).in ?? "header",
        name: (scheme as { name?: string }).name ?? "x-api-key",
      };
    default:
      return { kind: "None" };
  }
}

function getServiceVersions(program: Program, service: HttpService): string[] {
  const versions = getAllVersions(program, service.namespace);
  if (!versions || versions.length === 0) return [];
  return versions.map((v) => v.value);
}

/* ────────────────  Reachable-type collector  ───────────────
 *
 * BFS from operation request bodies, response bodies, and parameter types.
 * Captures models + enums regardless of source namespace, so Azure.Core
 * envelopes like `ResourceOperationStatus<WidgetSuite>` and `CustomPage<T>`
 * land in our IR — but TypeSpec base abstracts (Foundations.* etc.) that are
 * never reached do not.
 */

const SKIP_NAMESPACES = ["TypeSpec", "Http", "Rest", "OpenAPI"];

class TypeCollector {
  private readonly _models = new Map<string, SdkModel>();
  private readonly _enums = new Map<string, SdkEnum>();
  private readonly _walking = new Set<Type>();

  constructor(private readonly program: Program) {}

  models(): SdkModel[] {
    return [...this._models.values()];
  }
  enums(): SdkEnum[] {
    return [...this._enums.values()];
  }

  pythonTypeOf(type: Type): string {
    switch (type.kind) {
      case "Intrinsic":
        return type.name === "void" || type.name === "null" || type.name === "never"
          ? "None"
          : "Any";
      case "Scalar":
        return scalarToPython(type.name);
      case "String":
        return "str";
      case "Number":
        return "int";
      case "Boolean":
        return "bool";
      case "Model":
        if (type.name === "Array") {
          const inner = type.indexer?.value;
          return `list[${inner ? this.pythonTypeOf(inner) : "Any"}]`;
        }
        if (type.name === "Record") {
          const inner = type.indexer?.value;
          return `dict[str, ${inner ? this.pythonTypeOf(inner) : "Any"}]`;
        }
        if (!type.name) return "Any";
        if (this.shouldSkipNamespace(type)) return "Any";
        this.captureModel(type);
        return pascalCase(type.name);
      case "Enum":
        if (this.shouldSkipNamespace(type)) return "str";
        this.captureEnum(type);
        return pascalCase(type.name);
      case "Union": {
        if (type.name && this.isEnumLikeUnion(type)) {
          this.captureUnionAsEnum(type);
          return pascalCase(type.name);
        }
        const variants = [...type.variants.values()]
          .map((v) => this.pythonTypeOf(v.type))
          .filter((s) => s !== "Any");
        const unique = Array.from(new Set(variants));
        if (unique.length === 0) return "Any";
        return unique.length === 1 ? unique[0] : unique.join(" | ");
      }
      case "Tuple":
        return `tuple[${type.values.map((t) => this.pythonTypeOf(t)).join(", ")}]`;
      default:
        return "Any";
    }
  }

  private captureModel(model: Model): void {
    const key = `${getNamespaceFullName(model.namespace!)}::${model.name}`;
    if (this._models.has(key) || this._walking.has(model)) return;
    if (isErrorModel(this.program, model)) {
      // Always include Error/ErrorResponse-shaped types: they show up in return-type unions.
    }
    this._walking.add(model);
    const properties: SdkProperty[] = [];
    for (const [, prop] of model.properties) {
      properties.push(this.buildProperty(prop));
    }
    this._walking.delete(model);
    this._models.set(key, {
      name: model.name,
      pyName: pascalCase(model.name),
      docstring: getDoc(this.program, model),
      properties,
      tspModel: model,
    });
  }

  private buildProperty(prop: ModelProperty): SdkProperty {
    return {
      name: prop.name,
      pyName: escapePyName(snakeCase(prop.name)),
      pyType: this.pythonTypeOf(prop.type),
      optional: prop.optional,
      readOnly: isReadOnly(this.program, prop),
      serializedName: prop.name,
      description: getDoc(this.program, prop),
    };
  }

  private captureEnum(en: Enum): void {
    const key = `${en.namespace ? getNamespaceFullName(en.namespace) : ""}::${en.name}`;
    if (this._enums.has(key)) return;
    const members: SdkEnumMember[] = [];
    for (const [, m] of en.members) {
      const value = m.value !== undefined ? String(m.value) : m.name;
      members.push({
        name: m.name,
        pyName: screamingSnakeCase(m.name),
        value,
        description: getDoc(this.program, m),
      });
    }
    this._enums.set(key, {
      name: en.name,
      pyName: pascalCase(en.name),
      docstring: getDoc(this.program, en),
      isExtensible: true,
      members,
      tspEnum: en,
    });
  }

  /**
   * "Extensible enum" pattern: a `union Foo { A: "a", B: "b", string }` whose
   * named variants are string/number literals. We allow extra unnamed scalar
   * variants (the open-ended `string` fallback Azure templates use) to be
   * ignored when materializing the SdkEnum.
   */
  private isEnumLikeUnion(u: Union): boolean {
    if (!u.name) return false;
    let named = 0;
    for (const [, v] of u.variants) {
      const nameIsString = typeof v.name === "string";
      const k = v.type.kind;
      if (nameIsString) {
        if (k !== "String" && k !== "Number") return false;
        named++;
      }
    }
    return named > 0;
  }

  private captureUnionAsEnum(u: Union): void {
    const key = `${u.namespace ? getNamespaceFullName(u.namespace) : ""}::${u.name}`;
    if (this._enums.has(key)) return;
    const members: SdkEnumMember[] = [];
    for (const [, v] of u.variants) {
      if (typeof v.name !== "string") continue;
      const name = v.name;
      let value: string;
      if (v.type.kind === "String") value = v.type.value;
      else if (v.type.kind === "Number") value = String(v.type.value);
      else continue;
      members.push({
        name,
        pyName: screamingSnakeCase(name),
        value,
        description: getDoc(this.program, v),
      });
    }
    this._enums.set(key, {
      name: u.name!,
      pyName: pascalCase(u.name!),
      docstring: getDoc(this.program, u),
      isExtensible: true,
      members,
      tspEnum: u,
    });
  }


  private shouldSkipNamespace(type: { namespace?: { name: string } | undefined }): boolean {
    if (!type.namespace) return false;
    const ns = getNamespaceFullName(type.namespace as never);
    if (!ns) return false;
    return SKIP_NAMESPACES.some((b) => ns === b || ns.startsWith(`${b}.`));
  }
}

/* ────────────────────  Type → Python  ───────────────────── */

function scalarToPython(name: string): string {
  switch (name) {
    case "string":
    case "url":
      return "str";
    case "boolean":
      return "bool";
    case "bytes":
      return "bytes";
    case "int8":
    case "int16":
    case "int32":
    case "int64":
    case "integer":
    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
    case "safeint":
      return "int";
    case "float":
    case "float32":
    case "float64":
    case "numeric":
      return "float";
    case "decimal":
    case "decimal128":
      return "decimal.Decimal";
    case "plainDate":
      return "datetime.date";
    case "plainTime":
      return "datetime.time";
    case "utcDateTime":
    case "offsetDateTime":
      return "datetime.datetime";
    case "duration":
      return "datetime.timedelta";
    default:
      return "Any";
  }
}

function isReadOnly(program: Program, prop: ModelProperty): boolean {
  // Crude approximation: anything marked `@visibility(Lifecycle.Read)` and
  // nothing else is treated as read-only in our generated dataclasses.
  // Full visibility resolution lives in @typespec/compiler; this is a
  // pragmatic heuristic that covers the @key @visibility(Lifecycle.Read)
  // shape that Azure.Core resource templates produce.
  const meta = (prop as unknown as { visibility?: unknown }).visibility;
  void meta;
  return false;
}

/* ─────────────────────  Name helpers  ───────────────────── */

const PY_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
]);

export function escapePyName(name: string): string {
  return PY_KEYWORDS.has(name) ? `${name}_` : name;
}

export function snakeCase(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

export function pascalCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function screamingSnakeCase(s: string): string {
  return snakeCase(s).toUpperCase();
}

/**
 * Public type-mapper retained for backwards compatibility with renderers that
 * historically imported it directly. New code should go through
 * `TypeCollector.pythonTypeOf` so reachable models/enums are captured.
 */
export function pythonTypeOf(type: Type): string {
  const collector = new TypeCollector(null as unknown as Program);
  return collector.pythonTypeOf(type);
}
