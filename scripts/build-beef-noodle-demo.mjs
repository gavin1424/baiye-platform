import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js");
const build = spawn(process.execPath, [viteBin, "build"], {
  env: { ...process.env, VITE_APP_VARIANT: "beef-noodle-demo" },
  stdio: "inherit",
  shell: false,
});

const exitCode = await new Promise((resolve, reject) => {
  build.once("error", reject);
  build.once("exit", (code) => resolve(code ?? 1));
});
if (exitCode !== 0) process.exit(exitCode);

await import("./prepare-beef-noodle-demo.mjs");
