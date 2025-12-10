import { Diagnostic, resolvePath } from "@typespec/compiler";
import {
  createTestHost,
  createTestWrapper,
  expectDiagnosticEmpty,
} from "@typespec/compiler/testing";
import { HttpTestLibrary } from "@typespec/http/testing";
import { VersioningTestLibrary } from "@typespec/versioning/testing";
import { HttpMgmtPythonServiceRegistryTestLibrary } from "../src/testing/index.js";

export async function createHttpMgmtPythonServiceRegistryTestHost() {
  return createTestHost({
    libraries: [HttpMgmtPythonServiceRegistryTestLibrary, HttpTestLibrary, VersioningTestLibrary],
  });
}

export async function createHttpMgmtPythonServiceRegistryTestRunner() {
  const host = await createHttpMgmtPythonServiceRegistryTestHost();

  return createTestWrapper(host, {
    compilerOptions: {
      noEmit: false,
      emit: ["http-mgmt-python-service-registry"],
    },
  });
}

async function readAllFiles(host: Awaited<ReturnType<typeof createHttpMgmtPythonServiceRegistryTestHost>>, base: string, relative = ""): Promise<Record<string, string>> {
  const entries = await host.program.host.readDir(base);
  const output: Record<string, string> = {};
  for (const entry of entries) {
    const fullPath = resolvePath(base, entry);
    const relPath = relative ? `${relative}/${entry}` : entry;
    try {
      const childEntries = await host.program.host.readDir(fullPath);
      if (childEntries.length === 0) {
        throw new Error("not-a-directory");
      }
      Object.assign(output, await readAllFiles(host, fullPath, relPath));
      continue;
    } catch {
      output[relPath] = (await host.program.host.readFile(fullPath)).text;
    }
  }
  return output;
}

export async function emitWithDiagnostics(
  code: string,
  emitterOptions?: Record<string, unknown>
): Promise<[Record<string, string>, readonly Diagnostic[]]> {
  const host = await createHttpMgmtPythonServiceRegistryTestHost();
  const runner = await createTestWrapper(host, {
    compilerOptions: {
      emit: ["http-mgmt-python-service-registry"],
      options: emitterOptions
        ? { "http-mgmt-python-service-registry": emitterOptions }
        : undefined,
      outputDir: "tsp-output",
    },
  });

  await runner.compileAndDiagnose(code);
  const emitterOutputDir = resolvePath("tsp-output", "http-mgmt-python-service-registry");
  const result = await readAllFiles(host, emitterOutputDir);
  return [result, host.program.diagnostics];
}

export async function emit(code: string): Promise<Record<string, string>> {
  const [result, diagnostics] = await emitWithDiagnostics(code);
  expectDiagnosticEmpty(diagnostics);
  return result;
}
