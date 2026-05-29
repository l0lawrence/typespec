import { emitFile, joinPaths, type Program } from "@typespec/compiler";
import type { OutputFile } from "./types.js";

/** Write an in-memory file list to disk via the TypeSpec compiler host. */
export async function writeFiles(program: Program, baseDir: string, files: OutputFile[]) {
  for (const f of files) {
    await emitFile(program, {
      path: joinPaths(baseDir, f.path),
      content: f.content,
    });
  }
}
