import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production CSP permits the LINE LIFF SDK network flow", async () => {
  const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
  assert.match(headers, /script-src[^\n]*https:\/\/static\.line-scdn\.net/);
  assert.match(headers, /connect-src[^\n]*https:\/\/api\.line\.me/);
  assert.match(headers, /connect-src[^\n]*https:\/\/liff\.line\.me/);
  assert.match(headers, /connect-src[^\n]*https:\/\/access\.line\.me/);
  assert.match(headers, /frame-src[^\n]*https:\/\/liff\.line\.me[^\n]*https:\/\/access\.line\.me/);
  assert.match(headers, /form-action[^\n]*https:\/\/access\.line\.me/);
});
