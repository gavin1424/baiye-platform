import {
  CheckCircle,
  CreditCard,
  Eye,
  MagnifyingGlass,
  Package,
  PencilSimple,
  Plus,
  Receipt,
  Storefront,
  ToggleLeft,
  ToggleRight,
  Truck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Modal } from "../components";
import { categories } from "../data";
import { formatPrice, fulfillmentLabels, shopCategories, slugifyProductName } from "../shop-data";
import type { FulfillmentType, OrderStatus, ShopProduct } from "../shop-types";
import { useAppStore } from "../store";

function emptyProduct(): ShopProduct {
  const id = Date.now();
  return {
    id,
    slug: `product-${id}`,
    sku: `BY-${String(id).slice(-8)}`,
    name: "",
    price: 0,
    originalPrice: 0,
    category: "手作文創",
    industry: "文創手作",
    shortDescription: "",
    description: "",
    features: [],
    image: "",
    gallery: [],
    stock: 0,
    fulfillmentTypes: ["delivery"],
    featured: false,
    active: false,
    isExample: false,
    brandName: "",
    sellerName: "百業共創平台",
    sourceName: "平台正式商品",
    createdAt: new Date().toISOString(),
  };
}

const fulfillmentOptions: FulfillmentType[] = ["delivery", "store-pickup", "digital-service"];

export function AdminShopProducts() {
  const { shopProducts, saveShopProduct, toggleShopProductActive, notify } = useAppStore();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [featureText, setFeatureText] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return shopProducts;
    return shopProducts.filter((product) =>
      [product.name, product.sku, product.category, product.industry].join(" ").toLowerCase().includes(keyword),
    );
  }, [search, shopProducts]);

  const openEditor = (product?: ShopProduct) => {
    const next = product ? { ...product, features: [...product.features], fulfillmentTypes: [...product.fulfillmentTypes] } : emptyProduct();
    setEditing(next);
    setFeatureText(next.features.join("\n"));
    setError("");
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (editing.name.trim().length < 2) return setError("請輸入商品名稱");
    if (editing.price < 1) return setError("售價必須大於 0");
    if (editing.stock < 0) return setError("庫存不可小於 0");
    if (!editing.image.trim()) return setError("請提供商品圖片網址");
    if (editing.fulfillmentTypes.length === 0) return setError("請至少選擇一種交付方式");
    const saved = {
      ...editing,
      name: editing.name.trim(),
      slug: editing.slug.startsWith("product-") ? `${slugifyProductName(editing.name)}-${String(editing.id).slice(-5)}` : editing.slug,
      shortDescription: editing.shortDescription.trim(),
      description: editing.description.trim(),
      features: featureText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    };
    saveShopProduct(saved);
    setEditing(null);
  };

  const activeCount = shopProducts.filter((product) => product.active).length;
  const lowStockCount = shopProducts.filter((product) => product.active && product.stock <= 5).length;

  return (
    <>
      <section className="admin-commerce-stats">
        <article><span><Package weight="duotone" /></span><small>全部商品</small><strong>{shopProducts.length}</strong></article>
        <article><span><CheckCircle weight="duotone" /></span><small>上架中</small><strong>{activeCount}</strong></article>
        <article><span><WarningCircle weight="duotone" /></span><small>低庫存／缺貨</small><strong>{lowStockCount}</strong></article>
        <article><span><Storefront weight="duotone" /></span><small>管理模式</small><strong>平台直營</strong></article>
      </section>

      <section className="admin-card admin-commerce-card">
        <div className="admin-commerce-toolbar">
          <div className="input-with-icon"><MagnifyingGlass /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋商品名稱、編號、分類或行業" data-testid="admin-product-search" /></div>
          <Link to="/shop" className="btn btn-outline btn-sm"><Eye /> 查看商城</Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openEditor()} data-testid="admin-add-product"><Plus /> 新增商品</button>
        </div>
        <div className="admin-commerce-note"><Storefront weight="duotone" /><div><strong>平台統一上架</strong><p>此區只供平台管理員使用，不提供商家自行上架或分潤功能。</p></div></div>
        <div className="admin-product-table">
          <div className="admin-product-head"><span>商品</span><span>分類／行業</span><span>售價</span><span>庫存</span><span>狀態</span><span>操作</span></div>
          {filtered.map((product) => (
            <div className="admin-product-row" key={product.id} data-testid={`admin-product-${product.id}`}>
              <div className="admin-product-name"><img src={product.image} alt={`${product.name}管理縮圖`} /><span><strong>{product.name}</strong><small>{product.sku} {product.isExample && "· 範例商品"}</small></span></div>
              <span>{product.category}<small>{product.industry}</small></span>
              <strong>{formatPrice(product.price)}<small><del>{formatPrice(product.originalPrice)}</del></small></strong>
              <span className={product.stock <= 5 ? "low-stock" : ""}>{product.stock}<small>{product.stock < 1 ? "缺貨" : product.stock <= 5 ? "低庫存" : "庫存正常"}</small></span>
              <span className={`status-badge ${product.active ? "status-success" : "status-warning"}`}>{product.active ? "上架中" : "已下架"}</span>
              <div className="admin-product-actions">
                <button type="button" onClick={() => openEditor(product)} aria-label={`編輯 ${product.name}`}><PencilSimple /></button>
                <button type="button" onClick={() => toggleShopProductActive(product.id)} aria-label={`${product.active ? "下架" : "上架"} ${product.name}`} data-testid={`toggle-product-${product.id}`}>{product.active ? <ToggleRight weight="fill" /> : <ToggleLeft />}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Modal
        open={Boolean(editing)}
        title={editing && shopProducts.some((product) => product.id === editing.id) ? "修改商城商品" : "新增商城商品"}
        onClose={() => setEditing(null)}
        size="lg"
        actions={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>取消</button>
            <button type="submit" form="admin-shop-product-form" className="btn btn-primary">儲存商品</button>
          </>
        }
      >
        {editing && (
          <form id="admin-shop-product-form" className="admin-product-form" onSubmit={save} noValidate>
            {error && <div className="form-error"><WarningCircle /> {error}</div>}
            <div className="admin-product-form-grid">
              <label><span>商品名稱 *</span><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
              <label><span>商品編號</span><input value={editing.sku} onChange={(event) => setEditing({ ...editing, sku: event.target.value })} /></label>
              <label><span>商品分類 *</span><select value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })}>{shopCategories.filter((item) => item !== "全部商品").map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>所屬行業 *</span><select value={editing.industry} onChange={(event) => setEditing({ ...editing, industry: event.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>售價 *</span><input type="number" min="1" value={editing.price} onChange={(event) => setEditing({ ...editing, price: Number(event.target.value) })} /></label>
              <label><span>原價</span><input type="number" min="0" value={editing.originalPrice} onChange={(event) => setEditing({ ...editing, originalPrice: Number(event.target.value) })} /></label>
              <label><span>庫存 *</span><input type="number" min="0" value={editing.stock} onChange={(event) => setEditing({ ...editing, stock: Number(event.target.value) })} /></label>
              <label><span>品牌名稱（預留）</span><input value={editing.brandName || ""} onChange={(event) => setEditing({ ...editing, brandName: event.target.value })} /></label>
              <label className="full"><span>商品圖片網址 *</span><input value={editing.image} onChange={(event) => setEditing({ ...editing, image: event.target.value })} placeholder="https://…" /></label>
              <label className="full"><span>商品摘要</span><input value={editing.shortDescription} onChange={(event) => setEditing({ ...editing, shortDescription: event.target.value })} /></label>
              <label className="full"><span>完整說明</span><textarea rows={4} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
              <label className="full"><span>商品特色（每行一項）</span><textarea rows={4} value={featureText} onChange={(event) => setFeatureText(event.target.value)} /></label>
              <fieldset className="full"><legend>交付方式 *</legend><div className="admin-fulfillment-checks">{fulfillmentOptions.map((type) => <label key={type}><input type="checkbox" checked={editing.fulfillmentTypes.includes(type)} onChange={(event) => setEditing({ ...editing, fulfillmentTypes: event.target.checked ? [...editing.fulfillmentTypes, type] : editing.fulfillmentTypes.filter((item) => item !== type) })} />{type === "delivery" ? <Truck /> : type === "store-pickup" ? <Storefront /> : <CreditCard />}{fulfillmentLabels[type]}</label>)}</div></fieldset>
              <label className="admin-switch-field"><input type="checkbox" checked={editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} /><span>立即上架</span></label>
              <label className="admin-switch-field"><input type="checkbox" checked={editing.featured} onChange={(event) => setEditing({ ...editing, featured: event.target.checked })} /><span>設為推薦商品</span></label>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

const statusLabels: Record<OrderStatus, string> = {
  processing: "處理中",
  paid: "已付款",
  shipped: "已出貨",
  completed: "已完成",
  cancelled: "已取消",
};

export function AdminShopOrders() {
  const { shopOrders, updateShopOrderStatus } = useAppStore();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return shopOrders;
    return shopOrders.filter((order) =>
      [order.orderNumber, order.customer.name, order.customer.email, order.customer.phone]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [search, shopOrders]);
  const paidCount = shopOrders.filter((order) => order.paymentStatus === "paid").length;
  const paidTotal = shopOrders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0);

  return (
    <>
      <section className="admin-commerce-stats">
        <article><span><Receipt weight="duotone" /></span><small>全部訂單</small><strong>{shopOrders.length}</strong></article>
        <article><span><CheckCircle weight="duotone" /></span><small>測試已付款</small><strong>{paidCount}</strong></article>
        <article><span><CreditCard weight="duotone" /></span><small>測試付款總額</small><strong>{formatPrice(paidTotal)}</strong></article>
        <article><span><WarningCircle weight="duotone" /></span><small>金流環境</small><strong>測試模式</strong></article>
      </section>
      <section className="admin-card admin-commerce-card">
        <div className="admin-commerce-toolbar">
          <div className="input-with-icon"><MagnifyingGlass /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋訂單編號、顧客姓名、電話或 Email" data-testid="admin-order-search" /></div>
        </div>
        <div className="admin-commerce-note payment-mode"><WarningCircle weight="fill" /><div><strong>所有訂單均為測試資料</strong><p>GitHub Pages 正式站目前沒有付款後端與正式金鑰，不會產生真實收款或退款。</p></div></div>
        {filtered.length === 0 ? (
          <EmptyState title="目前沒有訂單" description="完成一次商城測試結帳後，訂單會顯示在此處。" />
        ) : (
          <div className="admin-order-table">
            <div className="admin-order-head"><span>訂單／顧客</span><span>內容</span><span>金額</span><span>付款狀態</span><span>處理狀態</span></div>
            {filtered.map((order) => (
              <div className="admin-order-row" key={order.id} data-testid={`admin-order-${order.orderNumber}`}>
                <div><strong>{order.orderNumber}</strong><small>{order.customer.name} · {order.customer.email}</small><time>{new Date(order.createdAt).toLocaleString("zh-TW")}</time></div>
                <span>{order.items.map((item) => `${item.name} × ${item.quantity}`).join("、")}<small>{fulfillmentLabels[order.fulfillmentType]}</small></span>
                <strong>{formatPrice(order.total)}<small>含運 {formatPrice(order.shippingFee)}</small></strong>
                <span className={`payment-status payment-${order.paymentStatus}`}>{order.paymentStatus === "paid" ? "測試已付款" : order.paymentStatus === "pending" ? "待付款" : order.paymentStatus === "failed" ? "付款失敗" : order.paymentStatus === "cancelled" ? "已取消" : "已退款"}</span>
                <select value={order.status} onChange={(event) => updateShopOrderStatus(order.orderNumber, event.target.value as OrderStatus)} aria-label={`修改訂單 ${order.orderNumber} 狀態`}><option value="processing">處理中</option><option value="paid">已付款</option><option value="shipped">已出貨</option><option value="completed">已完成</option><option value="cancelled">已取消</option></select>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
