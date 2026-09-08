const REGULAR_KEY = "contract-assets/fonts/NotoSansTC-Regular-Static-v2.ttf";
const BOLD_KEY = "contract-assets/fonts/NotoSansTC-Bold-ContractCorpus-v2.ttf";
const MONO_KEY = "contract-assets/fonts/NotoSansMono-Regular.ttf";
const REGULAR_SHA256 = "23b6963461eb279faa8f8b215f300be725efb3d729928b85034ba95680d6f93c";
const BOLD_SHA256 = "fcfb737e1c28799fd2e81210d29bc45ebe494a2427743f7888d876242f972451";
const MONO_SHA256 = "b4563af6f013732c8f40d206a05ff2ffc4eaeac0020d39393e59d0cf8a3ffeed";

let cachedContractFontAssets;

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readPrivateAsset(bucket, key) {
  if (!bucket) throw new Error("CONTRACT_FONT_ASSET_BUCKET_UNAVAILABLE");
  const object = await bucket.get(key);
  if (!object) throw new Error(`CONTRACT_FONT_ASSET_MISSING:${key}`);
  if (typeof object.arrayBuffer === "function") return new Uint8Array(await object.arrayBuffer());
  if (object.body instanceof Uint8Array) return object.body;
  if (object.body instanceof ArrayBuffer) return new Uint8Array(object.body);
  if (object.body) return new Uint8Array(await new Response(object.body).arrayBuffer());
  throw new Error(`CONTRACT_FONT_ASSET_UNREADABLE:${key}`);
}

export async function loadContractFontAssets(bucket) {
  if (cachedContractFontAssets) return cachedContractFontAssets;
  const [regularBytes, boldBytes, monoBytes] = await Promise.all([
    readPrivateAsset(bucket, REGULAR_KEY),
    readPrivateAsset(bucket, BOLD_KEY),
    readPrivateAsset(bucket, MONO_KEY),
  ]);
  const [regularSha256, boldSha256, monoSha256] = await Promise.all([
    sha256Hex(regularBytes),
    sha256Hex(boldBytes),
    sha256Hex(monoBytes),
  ]);
  if (regularSha256 !== REGULAR_SHA256 || boldSha256 !== BOLD_SHA256 || monoSha256 !== MONO_SHA256) {
    throw new Error("CONTRACT_FONT_ASSET_INTEGRITY_MISMATCH");
  }
  // Immutable Regular contains the broad Taiwan signatory-name repertoire; the
  // real Bold face contains every fixed contract title/heading/label collected
  // at build time. Runtime glyph collection and per-document subsetting stay off.
  cachedContractFontAssets = { regularBytes, boldBytes, monoBytes, regularSha256, boldSha256, monoSha256, subsetSafe: false };
  return cachedContractFontAssets;
}

export const CONTRACT_FONT_ASSET_KEYS = Object.freeze({ regular: REGULAR_KEY, bold: BOLD_KEY, mono: MONO_KEY });
export const CONTRACT_FONT_ASSET_SHA256 = Object.freeze({ regular: REGULAR_SHA256, bold: BOLD_SHA256, mono: MONO_SHA256 });
