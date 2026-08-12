import catalog from "../data/shop-products.json";
import type { FulfillmentType, ShopProduct } from "./shop-types";

export const defaultShopProducts = catalog as ShopProduct[];

export const shopCategories = ["全部商品", ...Array.from(new Set(defaultShopProducts.map((product) => product.category)))];

export const fulfillmentLabels: Record<FulfillmentType, string> = {
  delivery: "宅配",
  "store-pickup": "店到店",
  "digital-service": "數位商品／服務",
};

export function formatPrice(value: number) {
  return `NT$${value.toLocaleString("zh-TW")}`;
}

export function slugifyProductName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `product-${Date.now()}`;
}
