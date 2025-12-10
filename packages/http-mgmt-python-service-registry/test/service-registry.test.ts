import { ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { emit, emitWithDiagnostics } from "./test-host.js";

describe("service registry emitter", () => {
  it("emits registry with latest fallback when no version provided", async () => {
    const code = `
      import "@typespec/http";
      using TypeSpec.Http;

      @service(#{ title: "Demo" })
      @route("/providers/Microsoft.Demo")
      namespace Demo {
        @get @route("/widgets/{id}") op getWidget(@path id: string): string;
        @get @route("/widgets") op listWidgets(): string[];
      }
    `;

    const results = await emit(code);
    const providerModule = results["_service_registry/microsoft_demo.py"];
    ok(providerModule.includes("latest"));
    ok(providerModule.includes("Microsoft.Demo"));
    ok(providerModule.includes("widgets/{id}"));
    ok(providerModule.includes("class DemoOperations(Protocol)"));
    ok(providerModule.includes("class OperationsByGroup(TypedDict)"));
    ok(providerModule.includes("\"demo\": cast(DemoOperations, self)"));
    ok(providerModule.includes("def demo(self) -> DemoOperations"));
  });

  it("honors api-version option override", async () => {
    const code = `
      import "@typespec/http";
      using TypeSpec.Http;

      @service(#{ title: "Override" })
      @route("/providers/Microsoft.Override")
      namespace Override {
        @get @route("/items") op list(): void;
      }
    `;

    const [results, diagnostics] = await emitWithDiagnostics(code, { "api-version": "2022-01-01" });
    strictEqual(diagnostics.length, 0);
    const providerModule = results["_service_registry/microsoft_override.py"];
    ok(providerModule.includes("2022-01-01"));
    ok(providerModule.includes("Microsoft.Override"));
  });

  it("emits typed groups and flattened routes", async () => {
    const code = `
      import "@typespec/http";
      using TypeSpec.Http;

      @service(#{ title: "Multi" })
      @route("/providers/Microsoft.Multi")
      namespace Multi {
        interface Alpha {
          @get @route("/alpha") op alphaList(): void;
        }

        interface Beta {
          @get @route("/beta") op betaGet(): void;
        }
      }
    `;

    const results = await emit(code);
    const providerModule = results["_service_registry/microsoft_multi.py"];

    ok(providerModule.includes("class AlphaOperations(Protocol)"));
    ok(providerModule.includes("class BetaOperations(Protocol)"));
    ok(providerModule.includes("class OperationsByGroup(TypedDict)"));
    ok(providerModule.includes("\"alpha\": cast(AlphaOperations, self)"));
    ok(providerModule.includes("\"beta\": cast(BetaOperations, self)"));

    ok(providerModule.includes("self.routes_by_method: Dict[str, Dict[str, Callable[..., Any]]]"));
    ok(providerModule.includes("\"GET\": {"));
    ok(providerModule.includes("\"alphaList\": (lambda"));
    ok(providerModule.includes("\"betaGet\": (lambda"));
  });
});
