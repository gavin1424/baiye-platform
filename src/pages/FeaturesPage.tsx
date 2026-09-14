import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  ChartLineUp,
  CheckCircle,
  FileText,
  GlobeHemisphereWest,
  Handshake,
  Lightning,
  Megaphone,
  Package,
  Receipt,
  Robot,
  ShieldCheck,
  ShoppingCart,
  Storefront,
  Target,
  Truck,
  UserCircle,
} from "@phosphor-icons/react";
import { Link, useSearchParams } from "react-router-dom";
import { CTASection, MarketingHero, MarketingSection, PublicLayout, SectionHeading } from "../components";
import "../features-page.css";
import "../feature-detail.css";

type FeatureItem = {
  name: string;
  description: string;
  sellingPoint: string;
};

type FeatureBenefit = {
  title: string;
  description: string;
};

type FeatureGroup = {
  slug: string;
  icon: typeof Storefront;
  title: string;
  description: string;
  salesLead: string;
  promise: string;
  painPoints: string[];
  benefits: FeatureBenefit[];
  items: FeatureItem[];
  scenarios: string[];
  idealFor: string[];
};

const groups: FeatureGroup[] = [
  {
    slug: "brand-website",
    icon: GlobeHemisphereWest,
    title: "品牌官網與內容管理",
    description: "把品牌介紹、商品服務、聯絡入口與搜尋曝光整合成真正能帶來客人的數位門面。",
    salesLead: "不要再讓顧客只從一則貼文、一張名片或一個平台頁面認識你。創百業協助商家建立自己的正式官網，讓品牌、服務、商品、聯絡方式與行動入口集中在一個真正屬於你的數位門面。",
    promise: "把網站從「有一個網址」升級成「可以替你介紹、接客、導流與累積品牌資產的線上店面」。",
    painPoints: [
      "顧客搜尋店名時找不到完整資訊，只能到處翻 Facebook、IG、Google 或 LINE。",
      "活動、價格、商品與服務散落在不同平台，店家每次更新都要重複處理。",
      "品牌長期依賴第三方平台，流量、內容與顧客入口沒有真正掌握在自己手上。",
    ],
    benefits: [
      { title: "建立品牌信任", description: "正式網域、完整品牌內容與一致視覺，讓顧客第一次看到你就更容易產生信任。" },
      { title: "把流量導到自己的入口", description: "Google、LINE、社群、QR Code 都能回到你的官網，避免顧客一直停留在別人的平台。" },
      { title: "一站完成下一步", description: "顧客看完介紹後，可以直接預約、加 LINE、點餐、加入會員或聯絡店家。" },
      { title: "累積長期搜尋資產", description: "透過網站內容與 SEO 持續累積被搜尋到的機會，而不是每次都重新買曝光。" },
    ],
    items: [
      { name: "專屬品牌官網", description: "依商家品牌、產業與服務內容建立 RWD 官網，手機、平板與電腦都能順暢瀏覽。", sellingPoint: "客戶看到的是你的品牌，不是套版工具的品牌。" },
      { name: "自有網域", description: "建立商家自己的正式網址，方便印在名片、菜單、招牌、社群與所有宣傳素材。", sellingPoint: "網址就是數位門牌，越早經營越能累積品牌辨識。" },
      { name: "商品與服務展示", description: "清楚呈現服務流程、商品、價格、照片、特色、常見問題、營業資訊與聯絡方式。", sellingPoint: "先替業務與店員回答大部分重複問題，讓顧客更快做決定。" },
      { name: "SEO 搜尋優化", description: "整理搜尋引擎需要的標題、描述、頁面結構與關鍵內容，增加自然搜尋能見度。", sellingPoint: "讓需要你服務的人，有機會在主動搜尋時找到你。" },
      { name: "網站內容管理", description: "依新品、活動、價格或營運需求更新文字、圖片與服務內容。", sellingPoint: "網站不是做完就不動，而是跟著生意一起成長。" },
    ],
    scenarios: ["新開店需要快速建立專業品牌形象", "已有 LINE／Facebook，但缺少自己的正式網站", "希望 Google 搜尋能找到服務與店家資訊", "需要把預約、會員、點餐或聯絡入口集中到同一個地方"],
    idealFor: ["餐飲店", "美容美業", "工作室", "課程講師", "顧問服務", "零售門市", "在地商家", "個人品牌"],
  },
  {
    slug: "line-ai",
    icon: Robot,
    title: "LINE 官方帳號 × AI 智能客服",
    description: "把官網、LINE 與 AI 串成同一套顧客服務入口，讓顧客更快得到答案，也更容易完成下一步。",
    salesLead: "很多店家的 LINE 已經有很多好友，但每天仍然在人工回答營業時間、價格、怎麼預約、地址在哪裡。創百業把 LINE 官方帳號、官網與 AI 客服整合，讓常見問題先自動處理，真正需要人的時候再交給店家。",
    promise: "把 LINE 從聊天工具，變成 24 小時替店家接待、導流、預約與成交的數位櫃台。",
    painPoints: [
      "每天重複回答一樣的問題，老闆與員工時間被大量零碎訊息吃掉。",
      "LINE 有很多好友，卻沒有把菜單、預約、會員、網站與活動真正串在一起。",
      "晚上或忙碌時無法即時回覆，顧客可能直接去找下一家。",
    ],
    benefits: [
      { title: "24 小時接待", description: "顧客想問問題時不必等店家有空，先得到清楚且一致的基本資訊。" },
      { title: "降低重複客服", description: "把營業時間、價格、地址、流程、常見問題交給系統回答，把人力留給真正需要服務的客人。" },
      { title: "把詢問導向成交", description: "不是只回答問題，而是把顧客引導到預約、點餐、加入會員、查看方案或聯絡真人。" },
      { title: "維持品牌一致", description: "以商家自己的資料與規則建立回答基礎，讓不同時間、不同顧客得到一致資訊。" },
    ],
    items: [
      { name: "LINE 官方帳號整合", description: "將 LINE OA、Rich Menu、網站、預約、會員與點餐入口整理在同一個顧客介面。", sellingPoint: "顧客不用下載新 App，直接用每天都在用的 LINE。" },
      { name: "網站 AI 客服", description: "官網訪客可直接詢問商品、服務、價格、營業資訊與常見問題。", sellingPoint: "把原本看完網站就離開的人，多留一個即時互動與轉換機會。" },
      { name: "LINE AI 客服", description: "顧客在 LINE 對話中即可查詢商家資訊與常見服務內容。", sellingPoint: "讓 LINE 好友不是只有被動接收訊息，而是能主動得到服務。" },
      { name: "商家專屬知識內容", description: "依店家的服務、FAQ、價格、流程與注意事項整理回答基礎。", sellingPoint: "AI 不是亂答，而是以你的生意內容為核心。" },
      { name: "AI 轉真人服務", description: "特殊需求、客訴、付款或需要判斷的情境可交由真人接手。", sellingPoint: "自動化負責效率，真人保留溫度與決策權。" },
    ],
    scenarios: ["LINE 每天收到大量重複詢問", "晚上與休假時間常錯過潛在顧客", "已有官網與 LINE，但兩邊資訊分散", "希望把客服直接串到預約、會員或點餐流程"],
    idealFor: ["餐飲店", "美容美業", "診所與健康服務", "課程與教學", "工作室", "門市零售", "顧問服務", "預約型商家"],
  },
  {
    slug: "booking",
    icon: CalendarCheck,
    title: "線上預約與行程管理",
    description: "從顧客選擇服務到商家安排人員與時段，讓預約流程更簡單、更清楚。",
    salesLead: "如果你的預約還靠 LINE 一句一句確認時間，就代表店家與顧客都在浪費時間。創百業讓顧客自己看服務、選時段、送出預約，店家再從後台統一管理。",
    promise: "讓預約從『一直來回問時間』變成『顧客自己完成、店家集中管理』。",
    painPoints: ["顧客問完時間又消失，店家花很多時間來回確認。", "不同員工各自記錄預約，容易重複、漏記或資訊不同步。", "忘記到店、臨時改期與取消造成大量人工溝通。"],
    benefits: [
      { title: "讓顧客自己選時間", description: "把可以預約的時段清楚呈現，減少『幾點有空』的來回訊息。" },
      { title: "降低撞單與漏單", description: "服務、人員、營業時間與既有預約集中管理，營運更清楚。" },
      { title: "24 小時接預約", description: "即使店家休息，顧客仍可先查看服務並完成預約需求。" },
      { title: "提升專業感", description: "從預約、提醒到改期都有一致流程，顧客感受到的是完整服務體驗。" },
    ],
    items: [
      { name: "24 小時線上預約", description: "顧客可從官網或 LINE 查看服務並送出預約，不受店家當下是否有空回覆限制。", sellingPoint: "不漏掉晚上、休假或忙碌時段的潛在客戶。" },
      { name: "服務與人員設定", description: "設定不同服務項目、所需時間、服務人員、營業時段與休息日。", sellingPoint: "把店內實際排班規則直接變成系統規則。" },
      { name: "可預約時段管理", description: "依營業時間、服務長度與既有行程呈現適合時段。", sellingPoint: "顧客看到的不是亂選，而是店家真正能接的時間。" },
      { name: "查詢／改期／取消", description: "顧客依規則管理自己的預約，商家後台同步掌握變化。", sellingPoint: "減少人工處理每一次改時間的成本。" },
      { name: "預約提醒與通知", description: "結合 LINE 等通知管道，提醒顧客即將到店或預約狀態。", sellingPoint: "降低忘記到店與店員人工提醒負擔。" },
      { name: "日／週／月行事曆", description: "以行事曆方式查看預約、人員與處理進度。", sellingPoint: "老闆一眼就知道今天忙不忙、哪個時段還能接客。" },
    ],
    scenarios: ["美容、美甲、美睫需要排服務人員", "課程、顧問與教學需要管理時段", "工作室每天靠 LINE 手動排客", "希望降低臨時改期與忘記到店造成的空檔"],
    idealFor: ["美容美業", "按摩與調理", "課程教學", "顧問服務", "工作室", "攝影服務", "寵物服務", "預約制門市"],
  },
  {
    slug: "crm",
    icon: UserCircle,
    title: "會員 CRM 與顧客經營",
    description: "不只完成一次交易，更把每一次消費與互動沉澱成可持續經營的會員資產。",
    salesLead: "真正值錢的不是今天有多少人進店，而是有多少人願意再回來。創百業把會員、消費、預約與互動紀錄集中起來，讓店家開始知道『誰是新客、誰是熟客、誰值得再次經營』。",
    promise: "把一次消費留下來，變成下一次回購、會員優惠與長期顧客關係。",
    painPoints: ["顧客來過很多次，但店家只記得臉，不知道實際消費與回購狀況。", "會員資料、LINE 好友、訂單與預約各自分散，無法形成完整顧客輪廓。", "促銷全部人一起發，沒有針對真正需要的客群。"],
    benefits: [
      { title: "掌握真正熟客", description: "從消費、預約與互動紀錄找出高價值顧客，不再只靠印象。" },
      { title: "精準分群", description: "新客、熟客、VIP、沉睡客與不同興趣客群可以有不同經營方式。" },
      { title: "增加回購理由", description: "會員價、分級、生日、回訪與專屬活動，讓顧客有理由再回來。" },
      { title: "把顧客變成資產", description: "每一次互動都累積在商家自己的顧客資料中，而不是只存在第三方平台。" },
    ],
    items: [
      { name: "快速加入會員", description: "透過 QR Code、LINE 或商家入口建立會員關係，降低加入門檻。", sellingPoint: "讓加入會員像掃碼一樣簡單，不用再填長表單。" },
      { name: "會員基本資料", description: "集中管理顧客基本資訊、聯絡方式與服務紀錄。", sellingPoint: "需要服務顧客時，不必到處找資料。" },
      { name: "會員標籤與分類", description: "依新客、熟客、VIP、興趣、消費習慣或店家自訂條件分群。", sellingPoint: "同一份優惠不再發給所有人，而是找對人說對話。" },
      { name: "會員分級與會員價", description: "依消費與店家規則建立會員等級、專屬優惠與會員價格。", sellingPoint: "讓高價值顧客感受到差異，也提高持續消費動機。" },
      { name: "消費與回購紀錄", description: "掌握顧客來店、訂單、服務與回購狀況。", sellingPoint: "用資料找出多久沒回來、誰最常買、什麼最容易回購。" },
      { name: "顧客互動 Timeline", description: "把預約、訂單、會員與服務紀錄整理成一條顧客歷程。", sellingPoint: "員工接手服務時也能快速理解顧客過往狀況。" },
    ],
    scenarios: ["想知道哪些顧客最常回購", "想建立 VIP 或熟客制度", "想做生日、回訪或沉睡客喚回", "希望 LINE 好友不只是好友數，而是可經營的會員"],
    idealFor: ["餐飲會員", "美容美業", "零售門市", "健身與健康服務", "課程教學", "工作室", "高回購商品", "熟客型商家"],
  },
  {
    slug: "smart-ordering",
    icon: ShoppingCart,
    title: "免 POS 機智慧點餐",
    description: "不一定需要傳統大型 POS 主機，顧客用手機點、店家用手機或行動裝置接，依店型選擇紙本出單或無紙化管理。",
    salesLead: "點餐不一定要先買一套大型 POS。創百業讓顧客直接用 LINE 或 QR Code 點餐，店家則可以用既有手機、平板或搭配列印機接單，把傳統人工抄單變成更簡單的數位流程。",
    promise: "少一台昂貴設備、少一次人工抄單、少一個出錯環節，讓小店也能使用更聰明的點餐方式。",
    painPoints: ["尖峰時間排隊點餐，店員又要聽、又要寫、又要輸入，容易出錯。", "傳統 POS 設備與導入成本高，小店不一定真的需要完整硬體。", "菜單一改價、缺貨或新增品項，紙本菜單與現場資訊容易不同步。"],
    benefits: [
      { title: "降低點餐人力", description: "顧客自己選餐、選規格、加料與送單，店員不用重複抄寫。" },
      { title: "減少點錯與漏單", description: "訂單直接從顧客選擇進入商家端，降低口頭傳遞錯誤。" },
      { title: "不綁大型 POS", description: "依店型使用手機、平板、後台或列印設備，不必一開始就投入高額硬體。" },
      { title: "菜單即時更新", description: "價格、圖片、品項與缺貨狀態可直接反映到顧客看到的菜單。" },
    ],
    items: [
      { name: "LINE／QR Code 手機點餐", description: "顧客掃碼或從 LINE 進入菜單，自己完成選餐與送單。", sellingPoint: "不用下載 App，掃一下就能開始點。" },
      { name: "桌號／內用／外帶辨識", description: "依店家流程辨識桌號、內用、外帶或不同點餐入口。", sellingPoint: "同一套餐系統可以依不同店型調整，而不是硬套同一流程。" },
      { name: "餐點規格與加料", description: "支援大小、口味、辣度、加料、套餐與各類客製選項。", sellingPoint: "把店員原本要記住的選項，直接交給菜單讓顧客自己選。" },
      { name: "即時訂單接收", description: "顧客送單後直接進入商家端，清楚顯示品項、規格、桌號與備註。", sellingPoint: "少一道人工重打，就少一次錯誤機會。" },
      { name: "列印機出單模式", description: "需要紙本流程的店家可搭配列印設備，讓廚房保留熟悉的接單方式。", sellingPoint: "數位點餐不代表一定要改掉廚房原本習慣。" },
      { name: "行動裝置無紙化模式", description: "以手機、平板或商家後台查看、處理與完成訂單。", sellingPoint: "適合小店、攤商、工作室與不想耗紙的營運模式。" },
    ],
    scenarios: ["牛肉麵、小吃、早餐、飲料等高頻點餐店", "只有一兩位人員，希望減少櫃台點餐工作", "想導入數位點餐但不想先買昂貴 POS", "希望同時保留紙本出單與未來無紙化彈性"],
    idealFor: ["小吃店", "早餐店", "飲料店", "咖啡店", "餐廳", "攤商", "美食街櫃位", "外帶店"],
  },
  {
    slug: "catalog-inventory",
    icon: Package,
    title: "菜單、商品與庫存管理",
    description: "商家可集中管理菜單、商品、圖片、價格、規格與庫存，讓前台顯示與後台營運一致。",
    salesLead: "商品管理最怕的是前台一個價格、LINE 一個價格、店內又一個價格。創百業把菜單、圖片、規格、上下架與庫存整理在同一個營運邏輯裡，讓店家改一次，就能更有效率地維持資訊一致。",
    promise: "讓商品資訊、價格與庫存跟著營運即時更新，不再靠人工記憶與多份表格。",
    painPoints: ["商品改價後要改很多地方，很容易有一個地方忘了更新。", "缺貨還在賣、庫存不知道剩多少，常到接單後才發現沒貨。", "商品規格、加購與圖片越多，越難靠人工維護。"],
    benefits: [
      { title: "資訊一致", description: "商品名稱、價格、圖片與規格集中管理，降低前後台不同步。" },
      { title: "快速換菜單", description: "新品、季節活動、停售與缺貨可以更快速反映到顧客端。" },
      { title: "降低超賣", description: "透過庫存與異動紀錄掌握剩餘數量，降低接單後才發現缺貨。" },
      { title: "看懂商品流向", description: "進貨、銷售、調整與剩餘量有紀錄，補貨與盤點更有依據。" },
    ],
    items: [
      { name: "菜單／商品新增與編輯", description: "管理名稱、價格、分類、說明、圖片、規格與加購內容。", sellingPoint: "店家自己就能處理日常菜單與商品變動。" },
      { name: "圖片快速更換", description: "新品、季節、節慶與活動期間可快速更換展示圖片。", sellingPoint: "讓菜單永遠跟目前正在賣的東西一致。" },
      { name: "上下架管理", description: "依營業狀態、缺貨或活動需求調整前台是否顯示。", sellingPoint: "暫時不賣不用刪掉，恢復供應時可以快速重新上架。" },
      { name: "多規格與 SKU", description: "管理尺寸、口味、版本、組合與不同庫存單位。", sellingPoint: "餐飲、零售與電商都能用同一套邏輯管理複雜商品。" },
      { name: "庫存數量紀錄", description: "記錄進貨、銷售、保留、調整與剩餘庫存。", sellingPoint: "知道還剩多少，才能提早補貨而不是臨時缺貨。" },
      { name: "庫存異動追蹤", description: "保留每次庫存增加、減少與調整紀錄。", sellingPoint: "盤點有問題時，可以往回查原因，而不是只看到一個數字。" },
    ],
    scenarios: ["每天菜單與缺貨狀態會變動", "商品有多種尺寸、口味與規格", "需要同時管理店內與線上商品", "想開始建立基本庫存與補貨習慣"],
    idealFor: ["餐飲店", "飲料店", "零售門市", "電商", "工作室", "手作品牌", "團購商家", "多規格商品"],
  },
  {
    slug: "orders-operations",
    icon: Receipt,
    title: "訂單、出單與營運管理",
    description: "把訂單從建立、製作、完成到售後集中管理，讓前場與後場都看得到同一份資訊。",
    salesLead: "接到訂單只是開始，真正影響營運的是後面有沒有清楚處理。創百業把新訂單、製作、完成、取消、備註與查詢集中起來，讓前場、廚房與管理者看到同一份資訊。",
    promise: "讓每一張訂單從進來到完成都有清楚狀態，減少口頭交代、漏單與找不到紀錄。",
    painPoints: ["訂單來自不同入口，店員要一直切換手機、紙本與平台。", "前場說做了、後場說沒看到，容易漏單或重複製作。", "客人回頭詢問訂單時，要花很多時間翻紀錄。"],
    benefits: [
      { title: "訂單集中", description: "把不同流程的訂單整理到同一個管理邏輯，降低資訊分散。" },
      { title: "狀態清楚", description: "新單、處理中、完成、取消等狀態清楚，交班與多人協作更簡單。" },
      { title: "減少錯單", description: "品項、數量、規格、加購、桌號與備註清楚呈現，降低口頭傳遞錯誤。" },
      { title: "售後有依據", description: "查詢、取消、退換貨與退款有紀錄，遇到問題不必靠記憶。" },
    ],
    items: [
      { name: "訂單狀態管理", description: "掌握新訂單、處理中、完成、取消與其他營運狀態。", sellingPoint: "每個人都知道這張單現在走到哪裡。" },
      { name: "廚房／工作區顯示", description: "依餐飲或服務流程建立清楚的製作與處理畫面。", sellingPoint: "讓後場看到需要做什麼，不再等前場口頭通知。" },
      { name: "訂單明細與備註", description: "完整呈現品項、數量、規格、加購、桌號與顧客備註。", sellingPoint: "客製需求直接跟著訂單走，降低漏掉備註。" },
      { name: "退換貨與退款管理", description: "依商家流程處理取消、退貨、部分退款與全額退款。", sellingPoint: "售後處理也能留下清楚紀錄。" },
      { name: "訂單查詢", description: "依日期、顧客、狀態或訂單資訊快速查找交易紀錄。", sellingPoint: "客人問一個月前的訂單，也不用翻半天。" },
    ],
    scenarios: ["前場與廚房需要共用訂單資訊", "有紙本與數位訂單混在一起", "需要查歷史訂單與顧客備註", "希望老闆能掌握每天訂單處理狀況"],
    idealFor: ["餐飲店", "外帶店", "零售門市", "電商", "服務型商家", "工作室", "多人協作店家"],
  },
  {
    slug: "payments-invoice",
    icon: Receipt,
    title: "付款、對帳與電子發票整合",
    description: "依商家使用情境整合付款、帳務與發票服務，讓交易流程從下單一路延伸到對帳。",
    salesLead: "當訂單、付款、退款、訂金與發票分散在不同地方，月底最痛苦的就是對帳。創百業以訂單為核心，把付款狀態、對帳資料與發票串接規劃在同一條流程上。",
    promise: "讓『收到錢了沒』、『這筆退了沒』、『月底怎麼對』都有一致的營運依據。",
    painPoints: ["訂單有了，但付款狀態要另外確認，容易漏掉未付款或退款。", "訂金、代收與不同付款方式混在一起，月底對帳非常花時間。", "發票、付款服務與訂單沒有串起來，需要人工重複輸入。"],
    benefits: [
      { title: "訂單與付款對得上", description: "從訂單追蹤付款狀態，減少『這筆到底有沒有付』的人工確認。" },
      { title: "月結更有依據", description: "將多筆交易、退款、費用與應收應付整理成可核對資料。" },
      { title: "降低重複輸入", description: "依採用的付款與發票服務進行整合，減少不同系統之間手動搬資料。" },
      { title: "報表可以留下來", description: "以 PDF／CSV 等方式整理交易與對帳資料，方便內部管理。" },
    ],
    items: [
      { name: "多元付款整合", description: "依商家方案與資格串接適合的線上或到店付款服務。", sellingPoint: "付款方式可以跟著店家的顧客習慣與營運情境選擇。" },
      { name: "付款狀態追蹤", description: "將訂單與已付款、待付款、退款等狀態整合。", sellingPoint: "不用再用人工備註猜這張單有沒有完成付款。" },
      { name: "電子發票整合", description: "依商家採用的發票服務商與資格串接開立流程。", sellingPoint: "把發票放進交易流程，而不是事後再重打一遍。" },
      { name: "訂金與月結對帳", description: "支援需要訂金、代收、月結或多筆交易彙整的營運方式。", sellingPoint: "特別適合預約型、服務型與需要周期性結算的商家。" },
      { name: "PDF／CSV 對帳資料", description: "將營運與帳務資料整理成可保存、可核對的報表。", sellingPoint: "月底對帳、內部管理與交給會計時更有依據。" },
    ],
    scenarios: ["有線上與到店多種付款方式", "服務需要收訂金", "月底需要整理多筆交易與退款", "希望付款、訂單與發票流程不要各自分開"],
    idealFor: ["餐飲店", "預約型商家", "課程與服務業", "零售門市", "電商", "需要訂金的店家", "多付款方式商家"],
  },
  {
    slug: "delivery-logistics",
    icon: Truck,
    title: "外送、物流與取貨",
    description: "把店內、外帶、外送與電商出貨整合在同一個數位營運架構中。",
    salesLead: "顧客不一定會到店裡消費。創百業協助商家把外送平台、自有訂購、宅配、超取與取貨方式整理成清楚入口，讓不同成交方式都回到同一個品牌營運架構。",
    promise: "讓顧客想內用、外帶、外送或宅配時，都能快速找到最適合的下單與取貨方式。",
    painPoints: ["外送平台、自有 LINE、網站與實體店入口彼此分散。", "顧客常問『可以外送嗎』『怎麼取貨』『運費多少』，店員重複回覆。", "商品開始跨區銷售後，運費、取貨與物流資訊越來越難管理。"],
    benefits: [
      { title: "多通路入口集中", description: "外送、自取、宅配與既有平台入口可以統一呈現在商家自己的數位門面。" },
      { title: "顧客更快下單", description: "讓顧客不用到處找外送連結或詢問取貨方式。" },
      { title: "配送規則更清楚", description: "依配送方式、區域、金額或商品建立對應運費與取貨說明。" },
      { title: "保留擴充彈性", description: "未來依商家需求與服務商資格，可逐步串接更完整物流流程。" },
    ],
    items: [
      { name: "Uber Eats／foodpanda 導流", description: "在商家入口整合既有外送平台連結，讓顧客快速前往下單。", sellingPoint: "不放棄既有外送平台，同時把入口掌握在自己的品牌頁面。" },
      { name: "自有外送／LINE 導流", description: "可串接商家自己的外送、LINE 或其他訂購方式。", sellingPoint: "既有熟客可以走你最適合的自有流程。" },
      { name: "宅配與超商取貨", description: "規劃適用商品的宅配、超取與取貨流程。", sellingPoint: "讓在地商家也能往跨區銷售延伸。" },
      { name: "運費與取貨規則", description: "依配送方式、區域、金額或商品條件設定對應規則。", sellingPoint: "先把規則講清楚，客服就少一半。" },
      { name: "物流服務串接", description: "依商家需求與物流服務商資格進行系統整合。", sellingPoint: "從簡單導流開始，再依訂單量逐步升級。" },
    ],
    scenarios: ["已有 Uber Eats／foodpanda，希望集中入口", "店家自己有外送或 LINE 訂購", "開始販售可宅配的商品", "希望把內用、外帶、外送與宅配一起規劃"],
    idealFor: ["餐飲外送", "伴手禮", "零售商品", "電商", "團購", "工作室商品", "跨區服務商家"],
  },
  {
    slug: "marketing-automation",
    icon: Megaphone,
    title: "行銷、優惠與自動化",
    description: "用會員資料與消費行為做分眾溝通，讓促銷不只是打折，而是有目的地帶動回購。",
    salesLead: "行銷不是每天發優惠券，而是在對的時間找對的人。創百業把會員、消費、回購與通知工具串在一起，讓店家能針對新客、熟客、VIP、生日客與沉睡客安排不同溝通方式。",
    promise: "把『想到就發一篇』的行銷，變成可以持續經營會員與回購的營運流程。",
    painPoints: ["活動一直做，但不知道到底是誰因為活動回來。", "所有 LINE 好友收到一樣訊息，容易造成打擾與封鎖。", "顧客買過一次後沒有後續接觸，很快就忘記店家。"],
    benefits: [
      { title: "分眾而不是群發", description: "依會員、消費與互動條件找出真正適合的客群。" },
      { title: "增加回購時機", description: "生日、補貨、回訪、沉睡客與特定週期都能成為再次接觸的理由。" },
      { title: "優惠更有策略", description: "滿額、加購、會員價與專屬活動可以配合不同營運目標。" },
      { title: "建立長期關係", description: "行銷不只是一次促銷，而是持續把顧客帶回品牌。" },
    ],
    items: [
      { name: "優惠活動", description: "規劃滿額折扣、滿額贈、免運、加購、會員優惠與活動價格。", sellingPoint: "每個優惠都可以有目的：拉高客單、清庫存、帶回購或推新品。" },
      { name: "生日與回購提醒", description: "依會員資料與消費週期安排再次接觸顧客的時機。", sellingPoint: "在顧客最容易回來的時候提醒，而不是每天打擾。" },
      { name: "補貨與商品提醒", description: "依商品特性與顧客條件安排再次購買提醒。", sellingPoint: "特別適合耗材、食品、美容與有固定消耗週期的商品。" },
      { name: "LINE／Email／SMS 行銷", description: "依商家採用的通訊服務進行分眾通知、活動與顧客關係經營。", sellingPoint: "選顧客最常用的渠道，而不是逼顧客換平台。" },
      { name: "團購與分享分潤", description: "支援團購、分享來源、推廣歸因與分潤型商業模式。", sellingPoint: "把熟客、團主與推廣者變成新的銷售入口。" },
    ],
    scenarios: ["想提高會員回購率", "LINE 好友很多但互動不高", "商品有固定回購週期", "想做團購、分享或介紹分潤"],
    idealFor: ["會員型餐飲", "美容美業", "零售門市", "食品與耗材", "電商", "課程服務", "團購商家", "高回購產業"],
  },
  {
    slug: "analytics-finance",
    icon: ChartLineUp,
    title: "營運數據與財務報表",
    description: "把每天發生的訂單、會員、預約、庫存與收入整理成店家真正看得懂的營運資訊。",
    salesLead: "很多店家每天很忙，月底卻說不清楚到底哪個商品賺、哪個時段忙、哪些客人最常回來。創百業把營運資料整理成老闆看得懂的數字，讓決策不只靠感覺。",
    promise: "把每天累積的營運紀錄，變成可以幫你調整商品、排班、備貨與行銷的決策資訊。",
    painPoints: ["知道今天很忙，卻不知道到底賣了什麼、客單多少、哪個時段最忙。", "庫存、收入、退款與支出分散在不同表格，月底很難整理。", "做了會員與促銷，卻不知道回購有沒有真的變好。"],
    benefits: [
      { title: "看懂營收變化", description: "從訂單數、營收、客單與期間變化掌握生意走勢。" },
      { title: "找出真正熱銷", description: "用商品銷售資料協助調整菜單、備貨與主推品項。" },
      { title: "追蹤會員價值", description: "觀察新客、熟客、回購與會員經營成效。" },
      { title: "財務資料更整齊", description: "把收款、退款、費用與支出整理成日常管理與對帳依據。" },
    ],
    items: [
      { name: "營收與訂單統計", description: "查看交易金額、訂單數、客單與不同期間的營運變化。", sellingPoint: "今天、這週、這個月好不好，不再只靠感覺。" },
      { name: "商品銷售分析", description: "掌握熱銷商品、品項表現與銷售組合。", sellingPoint: "讓菜單調整與備貨更接近真實需求。" },
      { name: "會員與回購分析", description: "觀察新客、熟客、會員回購與顧客經營成果。", sellingPoint: "會員不是只看人數，而是看有沒有真的再回來。" },
      { name: "庫存與成本紀錄", description: "將庫存異動與營運資料整理，協助掌握備貨與成本狀況。", sellingPoint: "知道賣得好，也要知道備貨與成本是否合理。" },
      { name: "財務帳本與報表", description: "整理收款、退款、費用、支出與淨額。", sellingPoint: "每天留下資料，月底才不會從零開始整理。" },
      { name: "AI 財務整理", description: "運用 AI 協助分類、摘要、找出異常與整理日常財務資訊。", sellingPoint: "把大量零碎紀錄先整理成老闆看得懂的重點。" },
    ],
    scenarios: ["想知道哪些商品最值得主推", "月底常常為了整理帳務很痛苦", "想看會員回購有沒有成長", "希望排班、備貨與促銷能有數據依據"],
    idealFor: ["餐飲店", "零售門市", "多商品店家", "會員型商家", "預約服務業", "電商", "需要月報的店家"],
  },
  {
    slug: "contracts-partners",
    icon: Handshake,
    title: "電子契約與合作夥伴管理",
    description: "從合作申請、簽署、成交到獎勵紀錄，讓商務合作也能數位化管理。",
    salesLead: "當合作夥伴、業務、介紹人或承攬人數增加，光靠 LINE 對話與 Excel 很快就會失控。創百業把申請、簽署、帳號、成交與獎勵紀錄整理成可追蹤流程。",
    promise: "讓合作關係從『口頭說好』變成『資料、契約、進度與成果都有紀錄』。",
    painPoints: ["合作條件散落在聊天紀錄，久了很難確認當初約定。", "不同合作夥伴帶來的案件與成交很難整理。", "獎勵、資格與付款若只靠人工表格，容易出現爭議。"],
    benefits: [
      { title: "合作流程標準化", description: "申請、簽約、啟用與後續管理有一致流程。" },
      { title: "文件可追蹤", description: "重要契約與簽署紀錄集中留存，不必在聊天紀錄中翻找。" },
      { title: "成果有依據", description: "成交、案件、資格與獎勵都有對應紀錄，降低人工作業爭議。" },
      { title: "方便擴大團隊", description: "當合作夥伴增加時，不需要每一個人都靠老闆親自記住。" },
    ],
    items: [
      { name: "線上電子簽署", description: "支援線上閱讀契約、簽名與文件留存。", sellingPoint: "不用印、寄、掃描，合作流程可以更快開始。" },
      { name: "合作夥伴帳號", description: "提供合作夥伴專屬登入與案件管理入口。", sellingPoint: "每個人看到自己的資料與進度，降低人工查詢。" },
      { name: "成交與獎勵紀錄", description: "依合作規則記錄成交、資格與獎勵資訊。", sellingPoint: "獎勵怎麼算有資料，不再只靠人工表格。" },
      { name: "商務轉介", description: "可依正式合作關係延伸商家服務、資源與合作機構轉介。", sellingPoint: "把單次介紹發展成可持續的合作網路。" },
    ],
    scenarios: ["有業務、介紹人或承攬夥伴", "需要線上簽署合作文件", "需要追蹤成交與獎勵", "希望把商務合作從 Excel 升級成正式流程"],
    idealFor: ["平台型公司", "加盟與合作體系", "業務團隊", "承攬夥伴", "介紹分潤模式", "顧問與服務公司"],
  },
  {
    slug: "merchant-backoffice",
    icon: ShieldCheck,
    title: "商家後台、安全與系統整合",
    description: "所有前台功能背後，都由商家後台、權限管理與資料保護機制支撐，讓日常營運更集中。",
    salesLead: "前台做得漂亮只是第一步，真正每天要用的是商家後台。創百業把預約、會員、菜單、訂單、庫存、報表與設定集中管理，並搭配角色權限、資料隔離與系統整合能力。",
    promise: "讓老闆不用每天在五六個 App 之間切換，把營運需要看的東西集中到一個管理入口。",
    painPoints: ["網站、LINE、訂單、會員、預約與庫存各有一套後台。", "老闆、店長、員工共用同一組帳號，權限與責任不清楚。", "系統越多，資料越分散，未來要整合時成本越高。"],
    benefits: [
      { title: "一個後台管理", description: "把日常會用到的營運模組集中，降低切換不同工具的時間。" },
      { title: "角色權限更清楚", description: "依老闆、店長與員工規劃可操作範圍，降低誤操作風險。" },
      { title: "不同商家資料隔離", description: "會員、訂單與營運資料依商家分開管理。" },
      { title: "保留串接彈性", description: "透過 API、Webhook 與整合架構，未來可連接其他服務與設備。" },
    ],
    items: [
      { name: "商家專屬後台", description: "集中管理網站、預約、會員、菜單、訂單、庫存、報表與營運設定。", sellingPoint: "少開幾個系統，多一個真正可以每天工作的入口。" },
      { name: "角色與權限", description: "依老闆、店長、員工等角色規劃不同操作權限。", sellingPoint: "該看的看得到，不該動的不要讓所有人都能改。" },
      { name: "商家資料隔離", description: "不同商家的會員、訂單與營運資料分開管理。", sellingPoint: "平台化不代表資料混在一起，每家店仍有自己的資料邊界。" },
      { name: "操作與資料紀錄", description: "重要操作與營運資料保留紀錄，方便後續追蹤與管理。", sellingPoint: "發生問題時有機會找到發生過什麼，而不是只靠問人。" },
      { name: "API／Webhook 整合", description: "依實際需求串接外部系統、服務商、設備與自動化流程。", sellingPoint: "今天從基本功能開始，未來生意變大仍保留擴充空間。" },
      { name: "備份與版本管理", description: "重要資料與系統更新採取備份與版本管理機制。", sellingPoint: "營運系統不是只求能用，更要考慮長期維護與風險。" },
    ],
    scenarios: ["每天要切換很多後台管理生意", "多人共用系統，需要分角色權限", "已有既有系統，未來希望逐步串接", "希望建立可長期擴充的數位營運底座"],
    idealFor: ["所有正式商家", "多員工商家", "多門市營運", "成長型品牌", "平台型服務", "需要系統整合的店家"],
  },
];

const allItems = groups.flatMap((group) => group.items);

const valuePoints = [
  { icon: GlobeHemisphereWest, title: "讓客戶找得到你", description: "品牌官網、SEO、LINE 官方帳號與數位入口，建立自己的線上門面。" },
  { icon: ShoppingCart, title: "讓客戶直接完成交易", description: "預約、點餐、購物、付款與會員流程都能從手機開始。" },
  { icon: UserCircle, title: "把一次消費變成長期會員", description: "會員 CRM、標籤、回購紀錄與行銷工具，幫助店家持續經營熟客。" },
];

function FeatureDetail({ group }: { group: FeatureGroup }) {
  const Icon = group.icon;
  return (
    <PublicLayout>
      <MarketingHero
        eyebrow="創百業智慧鏈｜功能詳解"
        title={group.title}
        description={group.salesLead}
        primary={{ label: "詢問這項功能", to: "/contact" }}
        secondary={{ label: "查看商家方案", to: "/pricing" }}
      >
        <aside className="feature-detail-hero-card premium-card">
          <span className="feature-detail-hero-icon"><Icon weight="duotone" /></span>
          <strong>這套功能要替商家做到什麼？</strong>
          <p>{group.promise}</p>
        </aside>
      </MarketingHero>

      <MarketingSection className="feature-detail-back-section">
        <Link className="feature-detail-back" to="/features"><ArrowLeft /> 返回全部功能</Link>
      </MarketingSection>

      <MarketingSection className="feature-detail-pain-section">
        <SectionHeading eyebrow="先解決真正的營運問題" title="如果你也遇到這些情況，這套功能就是為此而設計" description="我們不是為了讓店家多一個系統，而是先把每天最浪費時間、最容易出錯、最難持續經營的地方整理掉。" />
        <div className="feature-detail-pain-grid">
          {group.painPoints.map((pain, index) => (
            <article className="premium-card feature-detail-pain-card" key={pain}>
              <span>0{index + 1}</span>
              <p>{pain}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="feature-detail-benefit-section">
        <SectionHeading eyebrow="導入後的商業價值" title="你買的不是功能，而是更有效率、更容易成交的營運方式" description="每個模組都以店家實際營運成果為出發點，讓科技最後回到生意本身。" />
        <div className="feature-detail-benefit-grid">
          {group.benefits.map((benefit) => (
            <article className="premium-card feature-detail-benefit-card" key={benefit.title}>
              <CheckCircle size={28} weight="fill" />
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="feature-detail-items-section">
        <SectionHeading eyebrow="完整功能拆解" title="每一項功能，都要對店家的日常營運產生幫助" description="以下不是工程規格表，而是商家實際使用時會感受到的價值。" />
        <div className="feature-detail-items-grid">
          {group.items.map((item, index) => (
            <article className="premium-card feature-detail-item-card" key={item.name}>
              <div className="feature-detail-item-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="feature-detail-selling-point"><Lightning weight="fill" /> <strong>商家優點：</strong>{item.sellingPoint}</div>
              </div>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="feature-detail-scenarios-section">
        <SectionHeading eyebrow="實際使用情境" title="不是展示用功能，而是放進每天的生意流程" description="以下情況只要符合其中一項，就值得評估把這個模組導入。" />
        <div className="feature-detail-scenarios-grid">
          {group.scenarios.map((scenario) => (
            <article className="premium-card feature-detail-scenario-card" key={scenario}>
              <Target size={26} weight="duotone" />
              <p>{scenario}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="feature-detail-ideal-section">
        <SectionHeading eyebrow="適合商家" title="哪些店家特別適合這套功能？" />
        <div className="feature-detail-tags">
          {group.idealFor.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="feature-detail-final-card premium-card">
          <div>
            <span className="feature-detail-final-eyebrow">創百業的做法</span>
            <h2>不用一次全部重來，先從最痛的地方開始。</h2>
            <p>我們會先了解你現在使用的 LINE、網站、預約、點餐、會員或後台方式，再安排適合的導入順序。功能可以逐步增加，但顧客資料與營運流程從一開始就朝整合方向設計。</p>
          </div>
          <Link className="btn btn-primary" to="/contact">讓我們評估你的店 <ArrowRight /></Link>
        </div>
        <p className="features-availability-note">實際可啟用項目、第三方服務、付款、發票、物流與設備串接，依所選方案、商家資格及合作服務商條件辦理。</p>
      </MarketingSection>

      <CTASection eyebrow="不只是介紹功能，而是找出最適合你的做法" title={`想知道「${group.title}」怎麼放進你的店？`} description="告訴我們你的產業、目前做法與最想改善的問題，我們會依店型安排適合的流程。" primary={{ label: "聯絡我們", to: "/contact" }} secondary={{ label: "看其他功能", to: "/features" }} />
    </PublicLayout>
  );
}

export function FeaturesPage() {
  const [searchParams] = useSearchParams();
  const selectedSlug = searchParams.get("module");
  const selectedGroup = selectedSlug ? groups.find((group) => group.slug === selectedSlug) : undefined;

  if (selectedGroup) return <FeatureDetail group={selectedGroup} />;

  return (
    <PublicLayout>
      <MarketingHero eyebrow="創百業智慧鏈｜商家數位營運平台" title="一套平台，把官網、LINE、AI、預約、會員、點餐與營運管理串在一起" description="從客戶第一次看到你的品牌，到加入 LINE、預約、點餐、消費、成為會員，再到店家後台管理訂單、庫存與營運數據，創百業協助商家建立一套真正屬於自己的數位營運系統。" primary={{ label: "查看商家方案", to: "/pricing" }} secondary={{ label: "聯絡我們", to: "/contact" }}>
        <aside className="features-summary-card premium-card">
          <CheckCircle size={44} weight="duotone" />
          <strong>{groups.length} 大功能模組</strong>
          <p>{allItems.length} 項商家數位能力，每個模組都可點進去查看完整銷售介紹與使用情境。</p>
        </aside>
      </MarketingHero>

      <MarketingSection className="features-status-section">
        <SectionHeading eyebrow="一套系統，串起整個生意流程" title="不是多裝幾個工具，而是把顧客與店家流程真正連起來" description="創百業從品牌曝光、顧客服務、成交、回購到後台管理，協助店家把分散的數位工具整理成同一套營運流程。" />
        <div className="features-status-grid">
          {valuePoints.map(({ icon: IconValue, title, description }) => (
            <article className="features-status-card premium-card card-stagger status-live" key={title}>
              <IconValue size={34} weight="duotone" />
              <strong>{title}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="features-groups-section">
        <SectionHeading eyebrow="完整功能介紹" title="每個區塊都可以點進去，直接當成客戶銷售簡報來看" description="點選任何功能模組，即可查看商家痛點、導入價值、詳細功能、實際使用情境與適合產業。" />
        <div className="features-groups-grid">
          {groups.map(({ slug, icon: IconGroup, title, description, items }) => (
            <Link className="features-group-card-link" to={`/features?module=${slug}`} key={title}>
              <article className="features-group-card premium-card card-stagger features-group-card-clickable">
                <div className="features-group-heading">
                  <span className="features-group-icon"><IconGroup weight="duotone" /></span>
                  <div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </div>
                </div>
                <div className="features-items-list">
                  {items.slice(0, 4).map((item) => (
                    <div className="features-item" key={item.name}>
                      <div><strong>{item.name}</strong><p>{item.description}</p></div>
                      <CheckCircle className="features-customer-check" size={22} weight="fill" aria-hidden="true" />
                    </div>
                  ))}
                </div>
                <div className="features-group-detail-cta">查看完整介紹、商家優點與使用情境 <ArrowRight /></div>
              </article>
            </Link>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="features-principles-section">
        <SectionHeading eyebrow="適合哪些商家" title="依你的生意模式，組合真正會用到的數位工具" description="不論你現在只有 LINE、只有實體店，或已經有網站與既有系統，都可以從最需要的環節開始導入。" />
        <div className="features-principles-grid">
          <article className="premium-card"><ShoppingCart size={34} weight="duotone" /><h3>餐飲與門市</h3><p>LINE／QR 點餐、菜單管理、列印或無紙化接單、會員、庫存與營運報表。</p></article>
          <article className="premium-card"><CalendarCheck size={34} weight="duotone" /><h3>美容、課程與服務業</h3><p>品牌官網、LINE AI 客服、線上預約、會員 CRM、提醒通知與回購經營。</p></article>
          <article className="premium-card"><Storefront size={34} weight="duotone" /><h3>零售、工作室與電商</h3><p>商品展示、購物流程、會員、庫存、物流、優惠活動與多通路顧客經營。</p></article>
        </div>
      </MarketingSection>

      <MarketingSection className="features-principles-section">
        <SectionHeading eyebrow="導入方式" title="從現在的營運方式開始，不必一次全部重來" description="我們先了解店家目前使用的 LINE、網站、預約、點餐與後台流程，再安排最適合的導入順序。" />
        <div className="features-principles-grid">
          <article className="premium-card"><FileText size={34} weight="duotone" /><h3>1. 了解店家需求</h3><p>確認產業、現有工具、客戶流程與店內實際操作方式。</p></article>
          <article className="premium-card"><Package size={34} weight="duotone" /><h3>2. 組合適合模組</h3><p>從官網、LINE、AI、預約、會員、點餐、庫存與報表中選擇適合的配置。</p></article>
          <article className="premium-card"><Handshake size={34} weight="duotone" /><h3>3. 上線並持續營運</h3><p>依方案完成設定與串接，後續可再依店家成長持續擴充功能。</p></article>
        </div>
        <p className="features-availability-note">實際可啟用項目、第三方服務、付款、發票、物流與設備串接，依所選方案、商家資格及合作服務商條件辦理。</p>
      </MarketingSection>

      <CTASection eyebrow="讓店家少一點系統，多一套真正能營運的流程" title="從你現在最需要解決的問題開始" description="告訴我們你的店型與目前做法，我們會依網站、LINE、預約、會員、點餐與營運需求，安排適合的導入方式。" primary={{ label: "查看方案", to: "/pricing" }} secondary={{ label: "比較免 POS 機點餐方式", to: "/pos-comparison" }} />
    </PublicLayout>
  );
}
