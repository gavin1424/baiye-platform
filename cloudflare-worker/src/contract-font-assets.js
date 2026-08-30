const REGULAR_KEY = "contract-assets/fonts/NotoSansTC-Regular-ContractSubset.ttf";
const BOLD_KEY = "contract-assets/fonts/NotoSansTC-Bold-ContractSubset.ttf";
const MONO_KEY = "contract-assets/fonts/NotoSansMono-Regular.ttf";
const REGULAR_SHA256 = "6f228a0415ada99b413bca4e9ee44c89851a1e7ff7c831f5f55731db4a8f7cf6";
const BOLD_SHA256 = "b2219c4e23f99230a90ecef0624c877129f36e3187b926529e51207dc71ed1ff";
const MONO_SHA256 = "44cc404d8cea929c02a92900a646598bafc9ef726b7d881e7525296adc9fb8ac";

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
  cachedContractFontAssets = { regularBytes, boldBytes, monoBytes, regularSha256, boldSha256, monoSha256 };
  return cachedContractFontAssets;
}

export const CONTRACT_FONT_ASSET_KEYS = Object.freeze({ regular: REGULAR_KEY, bold: BOLD_KEY, mono: MONO_KEY });
export const CONTRACT_FONT_ASSET_SHA256 = Object.freeze({ regular: REGULAR_SHA256, bold: BOLD_SHA256, mono: MONO_SHA256 });
