export type FulfillmentType = "delivery" | "store-pickup" | "digital-service";

export type ShopProduct = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  price: number;
  originalPrice: number;
  category: string;
  industry: string;
  shortDescription: string;
  description: string;
  features: string[];
  image: string;
  gallery: string[];
  stock: number;
  fulfillmentTypes: FulfillmentType[];
  featured: boolean;
  active: boolean;
  isExample: boolean;
  brandName?: string;
  sellerName?: string;
  sourceName?: string;
  createdAt: string;
};

export type ShopCartItem = {
  productId: number;
  quantity: number;
};

export type ShopCustomer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  note: string;
};

export type ShopPaymentMethod = "card" | "apple-pay" | "line-pay";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";
export type OrderStatus = "processing" | "paid" | "shipped" | "completed" | "cancelled";

export type ShopOrderItem = {
  productId: number;
  sku: string;
  name: string;
  price: number;
  quantity: number;
};

export type ShopOrder = {
  id: string;
  orderNumber: string;
  items: ShopOrderItem[];
  customer: ShopCustomer;
  fulfillmentType: FulfillmentType;
  paymentMethod: ShopPaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  providerReference?: string;
};

export type CartOperationResult = {
  ok: boolean;
  message: string;
};
