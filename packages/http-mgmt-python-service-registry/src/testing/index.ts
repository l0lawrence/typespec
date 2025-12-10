import { resolvePath } from "@typespec/compiler";
import { createTestLibrary, TypeSpecTestLibrary } from "@typespec/compiler/testing";
import { fileURLToPath } from "url";

export const HttpMgmtPythonServiceRegistryTestLibrary: TypeSpecTestLibrary = createTestLibrary({
  name: "http-mgmt-python-service-registry",
  packageRoot: resolvePath(fileURLToPath(import.meta.url), "../../../../"),
});
