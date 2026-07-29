export type Business = {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  category: string;
  location: string;
  district: string;
  serviceMode: string[];
  rating: number;
  reviewCount: number;
  verified: boolean;
  invoice: boolean;
  enterprise: boolean;
  recommended: boolean;
  accent: string;
  cover: string;
  tagline: string;
  intro: string;
  services: string[];
  products: string[];
  priceRange: string;
  years: number;
  completed: number;
  responseRate: number;
  responseTime: string;
  joinedAt: string;
  lastOnline: string;
  phone: string;
  email: string;
  line: string;
  address: string;
  hours: string;
  certificates: string[];
  partners: string[];
};

export type CollaborationNeed = {
  id: number;
  title: string;
  type: string;
  category: string;
  budget: string;
  location: string;
  deadline: string;
  description: string;
  requirements: string[];
  publisher: string;
  publisherId: number;
  proposals: number;
  urgent?: boolean;
  createdAt: string;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  type: string;
  category: string;
  price: number;
  wholesalePrice: number;
  moq: number;
  image: string;
  businessId: number;
  description: string;
  specs: string[];
  rating: number;
  reviewCount: number;
};

export type Review = {
  id: number;
  businessId: number;
  author: string;
  rating: number;
  content: string;
  date: string;
  project: string;
};

export type Conversation = {
  id: number;
  businessId: number;
  name: string;
  preview: string;
  time: string;
  unread: number;
  messages: {
    id: number;
    from: "me" | "them";
    text: string;
    time: string;
    read: boolean;
    card?: { type: "quote" | "product" | "need"; title: string; meta: string };
  }[];
};

export type QuoteRecord = {
  id: string;
  kind: "詢價" | "報價";
  customer: string;
  subject: string;
  amount: string;
  status: "待回覆" | "議價中" | "已接受" | "已完成";
  date: string;
};

export type SiteSettings = {
  name: string;
  tagline: string;
  intro: string;
  logo: string;
  cover: string;
  primaryColor: string;
  template: "professional" | "portfolio" | "commerce";
  fontStyle: "modern" | "humanist" | "classic";
  visibleSections: Record<string, boolean>;
  sectionOrder: string[];
};
