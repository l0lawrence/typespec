import { createHttpMgmtPythonServiceRegistryTestHost } from "../dist/test/test-host.js";
import { getAllHttpServices } from "@typespec/http";

const host = await createHttpMgmtPythonServiceRegistryTestHost();

const code = `
import "@typespec/http";
using TypeSpec.Http;

@service
namespace Demo {
  model Store {
    name: string;
  }

  @get
  op getStore(): {
    @body body: Store;
  };
}
`;

await host.addTypeSpecFile("main.tsp", code);
await host.compile("main.tsp");
const { program } = host;
const [services] = getAllHttpServices(program);
const httpOp = services[0].operations[0];

console.log("httpOp keys:", Object.keys(httpOp));
console.log("returnType kind:", httpOp.operation.returnType?.kind);

console.log("responses is array:", Array.isArray(httpOp.responses));
console.log(
  "response keys:",
  httpOp.responses?.map((r) => Object.keys(r))
);
console.log(
  "statusCodes:",
  httpOp.responses?.map((r) => r.statusCodes)
);
console.log(
  "body kind:",
  httpOp.responses?.map((r) => r.body?.type?.kind)
);
console.log(
  "body type name:",
  httpOp.responses?.map((r) => r.body?.type?.name)
);

console.log(
  "response.type keys:",
  httpOp.responses?.map((r) => (r.type ? Object.keys(r.type) : undefined))
);
console.log(
  "response.type kind:",
  httpOp.responses?.map((r) => r.type?.kind)
);
console.log(
  "response.type name:",
  httpOp.responses?.map((r) => r.type?.name)
);
