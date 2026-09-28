import fireSiteImage from "../assets/merchant-sites/fire-site.webp";
import tanxiangSiteImage from "../assets/merchant-sites/tanxiang-site.webp";
import greensaveSiteImage from "../assets/merchant-sites/greensave-site.webp";
import aiCompanionSiteImage from "../assets/merchant-sites/ai-companion-site.webp";

export type MerchantSite = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  url: string;
  image: string;
  category: string;
  tags: string[];
  featured: boolean;
  sortOrder: number;
  active: boolean;
};

// Add or disable merchants here. The directory derives both sections from this list.
export const merchantSites: MerchantSite[] = [
  {
    id: "merchant-001",
    name: "雷火龍／火龍罐網站",
    shortName: "雷火龍",
    description: "傳承火龍罐養生智慧，認識陳美玲老師的調理服務與師承教學。",
    url: "https://chen-meiling-fire-cupping.www-asdfg14.chatgpt.site/",
    image: fireSiteImage,
    category: "傳統養生",
    tags: ["傳統養生", "健康調理", "火龍罐"],
    featured: true,
    sortOrder: 1,
    active: true,
  },
  {
    id: "merchant-002",
    name: "檀香網站",
    shortName: "檀香雲境",
    description: "探索天然檀香與沉香文化，讓香氣融入日常生活。",
    url: "https://baiyeconnect.com/tanxiang-stable/?v=2a1a4c4",
    image: tanxiangSiteImage,
    category: "生活美學",
    tags: ["天然檀香", "沉香文化", "生活美學"],
    featured: false,
    sortOrder: 2,
    active: true,
  },
  {
    id: "merchant-003",
    name: "GreenSave Energy",
    shortName: "GreenSave",
    description: "以智慧能源管理與需求側節能，探索更永續的用電方式。",
    url: "https://gavin1424.github.io/greensave-energy/",
    image: greensaveSiteImage,
    category: "綠色能源",
    tags: ["綠色能源", "節能方案", "永續生活"],
    featured: false,
    sortOrder: 3,
    active: true,
  },
  {
    id: "merchant-004",
    name: "AI 虛擬生命陪伴網站",
    shortName: "AI 虛擬生命",
    description: "認識會隨互動成長的 AI 虛擬生命，感受更有溫度的陪伴。",
    url: "https://ai-life-companion.www-asdfg14.chatgpt.site/",
    image: aiCompanionSiteImage,
    category: "智慧生活",
    tags: ["AI 陪伴", "情感互動", "智慧生活"],
    featured: false,
    sortOrder: 4,
    active: true,
  },
];

export function getActiveMerchantSites() {
  return merchantSites.filter((site) => site.active).sort((a, b) => a.sortOrder - b.sortOrder);
}
