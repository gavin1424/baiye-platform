// V1.3 transitional terminology normalizer.
// Shared layout contains legacy labels used by many pages; normalize only exact UI labels
// so general phrases such as「尋找合作夥伴」remain unchanged.
const replacements = new Map<string, string>([
  ["合作夥伴／業務專區", "承攬夥伴專區"],
  ["加入合作夥伴", "申請成為承攬夥伴"],
  ["夥伴登入", "承攬夥伴登入"],
  ["合作夥伴中心", "承攬夥伴中心"],
  ["合作夥伴", "承攬夥伴"],
]);

function normalize(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const value = node.nodeValue;
    if (!value) continue;
    const trimmed = value.trim();
    const next = replacements.get(trimmed);
    if (!next) continue;
    node.nodeValue = value.replace(trimmed, next);
  }
}

if (typeof document !== "undefined") {
  const run = () => document.body && normalize(document.body);
  queueMicrotask(run);
  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}
