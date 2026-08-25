import { DEMO_MODE } from "../demo-mode";

export function DemoModeBanner() {
  if (!DEMO_MODE) return null;
  return (
    <aside className="demo-mode-banner" role="status">
      <strong>範例展示站</strong>
      <span>此網站為創百業智慧鏈功能展示版本，不進行正式交易或資料異動。</span>
    </aside>
  );
}
