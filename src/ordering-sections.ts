export const ORDERING_SECTION_IDS = {
  overview: "ordering-overview",
  orders: "ordering-orders",
  qrs: "ordering-qrs",
  menu: "ordering-menu",
  options: "ordering-options",
  members: "ordering-members",
  settings: "ordering-settings",
  invoice: "ordering-invoice",
} as const;

export type OrderingSection = keyof typeof ORDERING_SECTION_IDS;

export const ORDERING_SECTION_TABS: ReadonlyArray<{ label: string; section: OrderingSection }> = [
  { label: "總覽", section: "overview" },
  { label: "即時訂單", section: "orders" },
  { label: "桌號 QR", section: "qrs" },
  { label: "菜單", section: "menu" },
  { label: "加料選項", section: "options" },
  { label: "會員", section: "members" },
  { label: "付款", section: "orders" },
  { label: "設定", section: "settings" },
  { label: "電子發票", section: "invoice" },
];

export function normalizeOrderingSection(value: string | null): OrderingSection {
  return value && Object.hasOwn(ORDERING_SECTION_IDS, value) ? value as OrderingSection : "overview";
}

export function orderingSectionPath(section: OrderingSection) {
  return `/merchant-admin/ordering?section=${section}`;
}

export function scrollToOrderingSection(section: OrderingSection, behavior: ScrollBehavior = "smooth") {
  document.getElementById(ORDERING_SECTION_IDS[section])?.scrollIntoView({ behavior, block: "start" });
}
