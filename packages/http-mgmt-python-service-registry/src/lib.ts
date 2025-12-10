import { createTypeSpecLibrary } from "@typespec/compiler";

export const $lib = createTypeSpecLibrary({
  name: "http-mgmt-python-service-registry",
  diagnostics: {},
});

export const { reportDiagnostic, createDiagnostic } = $lib;
