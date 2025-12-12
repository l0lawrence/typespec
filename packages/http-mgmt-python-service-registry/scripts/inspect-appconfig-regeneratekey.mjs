import { resolve } from "node:path";
import { getAllHttpServices } from "@typespec/http";
import { compile, NodeHost } from "@typespec/compiler";

const mainPath = resolve(
  "C:/Users/llawrence/Desktop/Repo/azure-rest-api-specs/specification/appconfiguration/resource-manager/Microsoft.AppConfiguration/AppConfiguration/main.tsp"
);

const program = await compile(NodeHost, mainPath, {
  noEmit: true,
});

const [services] = getAllHttpServices(program);
const ops = services.flatMap((s) => s.operations);

const regen = ops.find((o) => o.operation.name === "regenerateKey");
if (!regen) {
  console.error("regenerateKey not found; candidates:", ops.slice(0, 20).map((o) => o.operation.name));
  process.exit(1);
}

console.log("op:", regen.operation.name, regen.verb, regen.path);

for (const r of regen.responses ?? []) {
  const codes = Array.isArray(r.statusCodes) ? r.statusCodes : [r.statusCodes];
  console.log("  statusCodes:", codes);
  console.log("  type.kind:", r.type?.kind);
  console.log("  type.name:", r.type?.name);
}

const rawParams = regen.parameters;
const params = Array.isArray(rawParams) ? rawParams : rawParams ? Object.values(rawParams) : [];

console.log("parameters kind:", Array.isArray(rawParams) ? "array" : typeof rawParams);
console.log(
  "param names:",
  params.map((p) => p.param?.name ?? p.name ?? "?")
);
console.log(
  "body params:",
  params
    .filter((p) => p.type === "body" || p.type === "bodyRoot")
    .map((p) => ({
      name: p.param?.name,
      modelKind: p.param?.type?.kind,
      modelName: p.param?.type?.name,
    }))
);

console.log(
  "param entries:",
  params.map((p) => ({
    kind: p.type ?? p.kind,
    name: p.param?.name ?? p.name,
    paramTypeKind: p.param?.type?.kind,
    paramTypeName: p.param?.type?.name,
  }))
);
