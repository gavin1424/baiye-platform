import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const regularBytes = readFileSync(new URL("./fixtures/NotoSansTC-Regular.subset.ttf", import.meta.url));
const boldBytes = readFileSync(new URL("./fixtures/NotoSansTC-Bold.subset.ttf", import.meta.url));
const monoBytes = readFileSync(new URL("./fixtures/NotoSansMono-Regular.subset.ttf", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export const testContractFontAssets = Object.freeze({
  regularBytes,
  boldBytes,
  monoBytes,
  regularSha256: hash(regularBytes),
  boldSha256: hash(boldBytes),
  monoSha256: hash(monoBytes),
  subsetSafe: true,
});

export const testContractFontEnv = Object.freeze({
  CONTRACT_FONT_ASSETS_FOR_TESTS: testContractFontAssets,
});
