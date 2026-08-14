import {
  ArrowLeft,
  ArrowRight,
  BookmarkSimple,
  Briefcase,
  CalendarBlank,
  CaretDown,
  Check,
  Clock,
  CurrencyCircleDollar,
  FileArrowUp,
  FileText,
  Handshake,
  Info,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  Plus,
  SealCheck,
  ShieldCheck,
  Sparkle,
  UploadSimple,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BusinessLogo,
  EmptyState,
  FavoriteButton,
  IndustryIcon,
  Modal,
  NeedCard,
  Pagination,
  PublicLayout,
  Rating,
  SectionHeading,
  TrustBadges,
} from "../components";
import { businesses, categories, collaborationNeeds } from "../data";
import { useAppStore } from "../store";
import type { CollaborationNeed } from "../types";

const needTypes = [
  "尋找供應商",
  "尋找承包商",
  "異業合作",
  "商品採購",
  "批發合作",
  "通路合作",
  "尋找設計或行銷",
  "尋找技術人員",
  "專案外包",
  "短期支援",
  "場地合作",
  "活動合作",
  "長期合作夥伴",
];

function readCustomNeeds(): CollaborationNeed[] {
  try {
    return JSON.parse(window.localStorage.getItem("baiye:custom-needs") || "[]") as CollaborationNeed[];
  } catch {
    return [];
  }
}

export function CollaborationsPage() {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [customNeeds] = useState(readCustomNeeds);
  const allNeeds = [...customNeeds, ...collaborationNeeds];

  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return allNeeds
      .filter(
        (need) =>
          (!term ||
            need.title.toLowerCase().includes(term) ||
            need.description.toLowerCase().includes(term) ||
            need.type.toLowerCase().includes(term)) &&
          (!category || need.category === category || need.type === category) &&
          (!location || need.location.includes(location)) &&
          (!budget || need.budget.includes(budget)),
      )
      .sort((a, b) => {
        if (sort === "budget") return b.budget.localeCompare(a.budget, "zh-TW");
        if (sort === "proposals") return b.proposals - a.proposals;
        if (sort === "deadline") return a.deadline.localeCompare(b.deadline);
        return b.id - a.id;
      });
  }, [allNeeds, keyword, category, location, budget, sort]);

  return (
    <PublicLayout>
      <section className="collab-hero">
        <div className="container collab-hero-inner">
          <div>
            <span className="eyebrow">
              <Handshake weight="fill" />
              合作需求廣場
            </span>
            <h1>讓專業遇見需求，<br />讓合作開始發生</h1>
            <p>發布採購、外包或異業合作需求，找到願意一起把事情做好的夥伴。</p>
            <div className="collab-hero-stats">
              <span>
                <strong>326</strong>
                本月新需求
              </span>
              <span>
                <strong>1,842</strong>
                活躍提案
              </span>
              <span>
                <strong>86%</strong>
                需求有回覆
              </span>
            </div>
          </div>
          <div className="collab-publish-panel">
            <span className="collab-panel-icon">
              <Plus weight="bold" />
            </span>
            <h2>有合作需求？</h2>
            <p>用 3 分鐘說清楚需求，讓合適夥伴主動提案。</p>
            <Link to="/collaborations/new" className="btn btn-accent btn-lg">
              發布合作需求
              <ArrowRight />
            </Link>
            <span className="panel-note">
              <ShieldCheck weight="fill" /> 可隨時編輯或關閉
            </span>
          </div>
        </div>
      </section>
      <section className="collaboration-directory">
        <div className="container">
          <div className="collab-search-row">
            <div className="collab-search">
              <MagnifyingGlass />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜尋合作需求關鍵字"
              />
              <button type="button" className="btn btn-primary">
                搜尋
              </button>
            </div>
            <button type="button" className="btn btn-outline collab-mobile-filter" onClick={() => setMobileFilters(true)}>
              篩選條件
              <CaretDown />
            </button>
            <Link to="/collaborations/new" className="btn btn-outline desktop-publish">
              <Plus weight="bold" />
              發布合作需求
            </Link>
          </div>
          <div className={`collab-filters ${mobileFilters ? "mobile-open" : ""}`}>
            <div className="mobile-filter-head">
              <strong>篩選合作需求</strong>
              <button type="button" onClick={() => setMobileFilters(false)} aria-label="關閉">
                <X />
              </button>
            </div>
            <label>
              <span>需求類型</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">全部類型</option>
                {needTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              <span>地區</span>
              <select value={location} onChange={(event) => setLocation(event.target.value)}>
                <option value="">所有地區</option>
                {["台北市", "新北市", "桃園市", "台中市", "台南市", "高雄市", "全台", "線上"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>預算範圍</span>
              <select value={budget} onChange={(event) => setBudget(event.target.value)}>
                <option value="">不限預算</option>
                <option value="50,000">含 NT$ 50,000</option>
                <option value="100,000">含 NT$ 100,000</option>
                <option value="200,000">含 NT$ 200,000</option>
                <option value="500,000">含 NT$ 500,000</option>
              </select>
            </label>
            <label>
              <span>排序方式</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="newest">最新發布</option>
                <option value="deadline">即將截止</option>
                <option value="proposals">提案最多</option>
                <option value="budget">預算最高</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary mobile-apply-filter" onClick={() => setMobileFilters(false)}>
              顯示 {filtered.length} 筆結果
            </button>
          </div>
          <div className="collab-result-heading">
            <div>
              <strong>{filtered.length} 則合作需求</strong>
              <span>已經有 {filtered.reduce((sum, need) => sum + need.proposals, 0)} 份提案</span>
            </div>
            <div className="quick-chips">
              {["熱門需求", "最新發布", "我的追蹤"].map((item) => (
                <button type="button" key={item}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <>
              <div className="need-list">
                {filtered.slice((page - 1) * 6, page * 6).map((need) => (
                  <NeedCard key={need.id} need={need} />
                ))}
              </div>
              <Pagination page={page} pages={Math.max(1, Math.ceil(filtered.length / 6))} onChange={setPage} />
            </>
          ) : (
            <EmptyState
              title="找不到相符的合作需求"
              description="換個關鍵字，或放寬地區與預算條件試試看。"
              action={{
                label: "清除條件",
                onClick: () => {
                  setKeyword("");
                  setCategory("");
                  setLocation("");
                  setBudget("");
                },
              }}
            />
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

export function CollaborationDetailPage() {
  const navigate = useNavigate();
  const { id = "1" } = useParams();
  const custom = readCustomNeeds();
  const need = [...custom, ...collaborationNeeds].find((item) => String(item.id) === id) || collaborationNeeds[0];
  const publisher = businesses.find((business) => business.id === need.publisherId) || businesses[0];
  const { session, needFavorites, toggleNeedFavorite, submitProposal, proposals, notify } = useAppStore();
  const [proposalOpen, setProposalOpen] = useState(false);
  const [step, setStep] = useState(1);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 2) {
      setStep(2);
      return;
    }
    submitProposal(need.id);
    setProposalOpen(false);
    setStep(1);
  };

  const openProposal = () => {
    if (session.role === "business" || session.role === "admin") {
      if (!proposals.includes(need.id)) setProposalOpen(true);
      return;
    }
    notify("商家提案功能需完成 NT$18,000 一次性商家上架註冊。", "warning");
    navigate(session.role === "guest" ? "/login" : "/pricing");
  };

  return (
    <PublicLayout>
      <section className="detail-page-header">
        <div className="container">
          <nav className="breadcrumb" aria-label="麵包屑">
            <Link to="/">首頁</Link>
            <span>/</span>
            <Link to="/collaborations">合作需求</Link>
            <span>/</span>
            <span>需求詳情</span>
          </nav>
          <Link to="/collaborations" className="back-link">
            <ArrowLeft /> 回到合作廣場
          </Link>
        </div>
      </section>
      <section className="collaboration-detail">
        <div className="container collaboration-detail-grid">
          <div className="collaboration-detail-main">
            <article className="detail-card need-detail-card">
              <div className="need-detail-top">
                <div className="need-detail-icon">
                  <IndustryIcon category={need.category} size={34} weight="duotone" />
                </div>
                <div>
                  <div className="tag-row">
                    {need.urgent && <span className="tag tag-danger">急件</span>}
                    <span className="tag">{need.type}</span>
                    <span className="tag tag-muted">{need.category}</span>
                  </div>
                  <h1>{need.title}</h1>
                  <div className="need-publish-meta">
                    <span>發布於 {need.createdAt}</span>
                    <span>瀏覽 286 次</span>
                    <span>需求編號 BY-{String(need.id).padStart(5, "0")}</span>
                  </div>
                </div>
                <FavoriteButton
                  active={needFavorites.includes(need.id)}
                  onClick={() => toggleNeedFavorite(need.id)}
                  label="追蹤需求"
                />
              </div>
              <div className="need-highlight-grid">
                <div>
                  <CurrencyCircleDollar weight="duotone" />
                  <small>預算範圍</small>
                  <strong>{need.budget}</strong>
                </div>
                <div>
                  <MapPin weight="duotone" />
                  <small>合作地區</small>
                  <strong>{need.location}</strong>
                </div>
                <div>
                  <CalendarBlank weight="duotone" />
                  <small>提案截止</small>
                  <strong>{need.deadline}</strong>
                </div>
                <div>
                  <UsersThree weight="duotone" />
                  <small>已收到提案</small>
                  <strong>{need.proposals} 份</strong>
                </div>
              </div>
              <div className="need-detail-section">
                <h2>合作內容</h2>
                <p>{need.description}</p>
                <p>
                  本次合作希望先以小規模專案建立工作默契，若執行成果符合預期，將優先洽談後續季度或年度合作。報價請清楚列出服務範圍、修改次數與不包含項目。
                </p>
              </div>
              <div className="need-detail-section">
                <h2>所需條件</h2>
                <ul className="requirement-list">
                  {need.requirements.map((requirement) => (
                    <li key={requirement}>
                      <Check weight="bold" />
                      {requirement}
                    </li>
                  ))}
                  <li>
                    <Check weight="bold" />
                    可配合線上或現場進度會議
                  </li>
                </ul>
              </div>
              <div className="need-detail-section">
                <h2>附件</h2>
                <button type="button" className="attachment-card">
                  <FileText weight="duotone" />
                  <span>
                    <strong>合作需求規格說明.pdf</strong>
                    <small>2.4 MB</small>
                  </span>
                  <ArrowRight />
                </button>
              </div>
            </article>
            <div className="proposal-cta-card">
              <div>
                <span>
                  <Sparkle weight="fill" />
                </span>
                <div>
                  <h2>你的專業符合這項需求嗎？</h2>
                  <p>附上清楚的合作方案與案例，讓發布者更快理解你的優勢。</p>
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-lg ${proposals.includes(need.id) ? "btn-success" : "btn-primary"}`}
                onClick={openProposal}
              >
                {proposals.includes(need.id) ? (
                  <>
                    <Check /> 提案已送出
                  </>
                ) : (
                  <>
                    <PaperPlaneTilt /> 立即提案
                  </>
                )}
              </button>
            </div>
            <section className="similar-needs">
              <SectionHeading title="你可能也適合" description="相同類型的最新合作需求" />
              {collaborationNeeds
                .filter((item) => item.id !== need.id)
                .slice(0, 3)
                .map((item) => (
                  <NeedCard key={item.id} need={item} compact />
                ))}
            </section>
          </div>
          <aside className="collaboration-sidebar">
            <section className="publisher-card">
              <span className="publisher-label">需求發布者</span>
              <div className="publisher-business">
                <BusinessLogo business={publisher} size="md" />
                <div>
                  <Link to={`/business/${publisher.slug}`}>{publisher.name}</Link>
                  <Rating value={publisher.rating} count={publisher.reviewCount} compact />
                </div>
              </div>
              <TrustBadges business={publisher} compact />
              <dl>
                <div>
                  <dt>加入平台</dt>
                  <dd>{publisher.joinedAt}</dd>
                </div>
                <div>
                  <dt>回覆率</dt>
                  <dd>{publisher.responseRate}%</dd>
                </div>
                <div>
                  <dt>平均回覆</dt>
                  <dd>{publisher.responseTime}</dd>
                </div>
                <div>
                  <dt>完成合作</dt>
                  <dd>{publisher.completed} 次</dd>
                </div>
              </dl>
              <Link to={`/business/${publisher.slug}`} className="btn btn-outline">
                查看商家資料
              </Link>
              <Link to={`/messages?business=${publisher.id}`} className="btn btn-ghost">
                先傳訊息詢問
              </Link>
            </section>
            <section className="safety-card">
              <ShieldCheck weight="duotone" />
              <div>
                <h3>安心合作提醒</h3>
                <p>確認雙方身份與正式報價，重要約定請保留於站內訊息與合作紀錄。</p>
              </div>
            </section>
          </aside>
        </div>
      </section>

      <Modal open={proposalOpen} title="送出合作提案" onClose={() => setProposalOpen(false)} size="lg">
        <div className="modal-stepper">
          <span className={step >= 1 ? "active" : ""}>1</span>
          <i />
          <span className={step >= 2 ? "active" : ""}>2</span>
          <div>
            <small>合作方案</small>
            <small>確認送出</small>
          </div>
        </div>
        <form className="form-stack" onSubmit={submit}>
          {step === 1 ? (
            <>
              <label className="field">
                <span>自我介紹 *</span>
                <textarea required rows={4} placeholder="簡單介紹你／團隊的專業與相關經驗" />
              </label>
              <div className="form-grid-two">
                <label className="field">
                  <span>報價 *</span>
                  <input required inputMode="numeric" placeholder="例如：80,000" />
                </label>
                <label className="field">
                  <span>預計完成時間 *</span>
                  <input required placeholder="例如：確認後 30 個工作天" />
                </label>
              </div>
              <label className="field">
                <span>合作方案 *</span>
                <textarea required rows={6} placeholder="說明執行方式、交付項目、時程與修改方式" />
              </label>
              <label className="upload-zone">
                <FileArrowUp weight="duotone" />
                <strong>上傳作品案例或附件</strong>
                <span>PDF、JPG、PNG，單檔 10MB 以內</span>
                <input type="file" multiple />
              </label>
            </>
          ) : (
            <div className="proposal-review">
              <span className="review-icon">
                <Check weight="bold" />
              </span>
              <h3>確認送出提案</h3>
              <p>送出後發布者會收到通知，你可以在「我的提案」追蹤回覆與合作進度。</p>
              <div>
                <span>提案對象</span>
                <strong>{need.title}</strong>
              </div>
              <div>
                <span>聯絡資料</span>
                <strong>demo@baiye.local</strong>
              </div>
            </div>
          )}
          <div className="form-actions">
            {step === 2 && (
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                上一步
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {step === 1 ? "下一步" : "確認送出"}
              <ArrowRight />
            </button>
          </div>
        </form>
      </Modal>
    </PublicLayout>
  );
}

export function NewCollaborationPage() {
  const navigate = useNavigate();
  const { notify } = useAppStore();
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "",
    category: "",
    budgetMin: "",
    budgetMax: "",
    location: "",
    deadline: "",
    description: "",
    requirements: "",
    contact: "站內私訊",
  });

  const next = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 3) {
      setStep((value) => value + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const custom = readCustomNeeds();
    const need: CollaborationNeed = {
      id: Date.now(),
      title: form.title,
      type: form.type,
      category: form.category,
      budget: `NT$ ${Number(form.budgetMin || 0).toLocaleString("zh-TW")}－${Number(form.budgetMax || 0).toLocaleString("zh-TW")}`,
      location: form.location,
      deadline: form.deadline.replaceAll("-", "/"),
      description: form.description,
      requirements: form.requirements
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      publisher: "強哥水族",
      publisherId: 1,
      proposals: 0,
      createdAt: "剛剛",
    };
    window.localStorage.setItem("baiye:custom-needs", JSON.stringify([need, ...custom]));
    setSuccess(true);
    notify("合作需求已成功發布");
  };

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <PublicLayout>
      <section className="publish-page">
        <div className="container publish-container">
          <div className="publish-header">
            <Link to="/collaborations" className="back-link">
              <ArrowLeft /> 返回合作廣場
            </Link>
            <span className="eyebrow">發布合作需求</span>
            <h1>把需求說清楚，讓對的夥伴找到你</h1>
            <p>資料越完整，收到合適提案的機會越高。</p>
          </div>
          <div className="publish-stepper">
            {[
              ["01", "基本資訊"],
              ["02", "合作內容"],
              ["03", "確認發布"],
            ].map(([number, label], index) => (
              <div key={number} className={step >= index + 1 ? "active" : ""}>
                <span>{step > index + 1 ? <Check weight="bold" /> : number}</span>
                <div>
                  <strong>{label}</strong>
                  <small>{index === 0 ? "需求類型與預算" : index === 1 ? "內容與條件" : "預覽與聯絡"}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="publish-layout">
            <form className="publish-form detail-card" onSubmit={next}>
              {step === 1 && (
                <div className="form-step">
                  <div className="form-section-title">
                    <span>1</span>
                    <div>
                      <h2>基本資訊</h2>
                      <p>先讓合作夥伴快速理解你需要什麼。</p>
                    </div>
                  </div>
                  <label className="field">
                    <span>需求標題 *</span>
                    <input
                      required
                      maxLength={60}
                      value={form.title}
                      onChange={(event) => update("title", event.target.value)}
                      placeholder="例如：尋找長期穩定的食品原料供應商"
                    />
                    <small>{form.title.length}/60</small>
                  </label>
                  <div className="form-grid-two">
                    <label className="field">
                      <span>需求類型 *</span>
                      <select required value={form.type} onChange={(event) => update("type", event.target.value)}>
                        <option value="" disabled>
                          請選擇
                        </option>
                        {needTypes.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>產業分類 *</span>
                      <select required value={form.category} onChange={(event) => update("category", event.target.value)}>
                        <option value="" disabled>
                          請選擇
                        </option>
                        {categories.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-grid-two">
                    <label className="field">
                      <span>最低預算（NT$）*</span>
                      <input
                        required
                        type="number"
                        min="0"
                        value={form.budgetMin}
                        onChange={(event) => update("budgetMin", event.target.value)}
                        placeholder="50,000"
                      />
                    </label>
                    <label className="field">
                      <span>最高預算（NT$）*</span>
                      <input
                        required
                        type="number"
                        min={form.budgetMin || 0}
                        value={form.budgetMax}
                        onChange={(event) => update("budgetMax", event.target.value)}
                        placeholder="200,000"
                      />
                    </label>
                  </div>
                  <div className="form-grid-two">
                    <label className="field">
                      <span>合作地區 *</span>
                      <select required value={form.location} onChange={(event) => update("location", event.target.value)}>
                        <option value="" disabled>
                          請選擇
                        </option>
                        {["台北市", "新北市", "桃園市", "台中市", "台南市", "高雄市", "全台", "線上"].map(
                          (location) => (
                            <option key={location}>{location}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="field">
                      <span>提案截止日 *</span>
                      <input
                        required
                        type="date"
                        value={form.deadline}
                        onChange={(event) => update("deadline", event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="form-step">
                  <div className="form-section-title">
                    <span>2</span>
                    <div>
                      <h2>合作內容</h2>
                      <p>說明交付期待、條件與合作方式。</p>
                    </div>
                  </div>
                  <label className="field">
                    <span>合作內容 *</span>
                    <textarea
                      required
                      rows={8}
                      value={form.description}
                      onChange={(event) => update("description", event.target.value)}
                      placeholder="說明背景、需求內容、數量、規格與希望合作方式"
                    />
                  </label>
                  <label className="field">
                    <span>所需條件 *</span>
                    <textarea
                      required
                      rows={5}
                      value={form.requirements}
                      onChange={(event) => update("requirements", event.target.value)}
                      placeholder={"每行一個條件，例如：\n具相關合作案例\n可提供正式報價\n可配合 8 月完成"}
                    />
                  </label>
                  <label className="upload-zone">
                    <UploadSimple weight="duotone" />
                    <strong>上傳需求附件</strong>
                    <span>可上傳 PDF、DOCX、JPG 或 PNG，最多 5 個檔案</span>
                    <input type="file" multiple />
                  </label>
                </div>
              )}
              {step === 3 && (
                <div className="form-step">
                  <div className="form-section-title">
                    <span>3</span>
                    <div>
                      <h2>確認並發布</h2>
                      <p>確認資訊無誤後，需求會立即出現在合作廣場。</p>
                    </div>
                  </div>
                  <div className="publish-preview">
                    <div className="tag-row">
                      <span className="tag">{form.type}</span>
                      <span className="tag tag-muted">{form.category}</span>
                    </div>
                    <h3>{form.title}</h3>
                    <p>{form.description}</p>
                    <div className="need-highlight-grid compact">
                      <div>
                        <CurrencyCircleDollar />
                        <small>預算</small>
                        <strong>
                          NT$ {Number(form.budgetMin).toLocaleString("zh-TW")}－
                          {Number(form.budgetMax).toLocaleString("zh-TW")}
                        </strong>
                      </div>
                      <div>
                        <MapPin />
                        <small>地區</small>
                        <strong>{form.location}</strong>
                      </div>
                      <div>
                        <CalendarBlank />
                        <small>截止</small>
                        <strong>{form.deadline}</strong>
                      </div>
                    </div>
                  </div>
                  <label className="field">
                    <span>聯絡方式</span>
                    <select value={form.contact} onChange={(event) => update("contact", event.target.value)}>
                      <option>站內私訊</option>
                      <option>站內私訊＋Email</option>
                      <option>顯示商家電話</option>
                    </select>
                  </label>
                  <label className="consent-row">
                    <input type="checkbox" required />
                    <span>
                      我確認內容真實，並同意平台的<Link to="/terms">使用條款</Link>與需求發布規範。
                    </span>
                  </label>
                </div>
              )}
              <div className="publish-actions">
                {step > 1 && (
                  <button type="button" className="btn btn-outline" onClick={() => setStep((value) => value - 1)}>
                    上一步
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-lg">
                  {step < 3 ? "下一步" : "確認發布"}
                  <ArrowRight />
                </button>
              </div>
            </form>
            <aside className="publish-tips">
              <Info weight="duotone" />
              <h3>讓需求更容易收到好提案</h3>
              <ul>
                <li>標題清楚說明需要什麼角色</li>
                <li>提供可討論的預算範圍</li>
                <li>列出必要條件與希望完成時間</li>
                <li>附件避免包含個資或機密資料</li>
              </ul>
              <div className="tip-progress">
                <span>資料完整度</span>
                <strong>{step === 1 ? "35%" : step === 2 ? "72%" : "100%"}</strong>
                <i>
                  <b style={{ width: step === 1 ? "35%" : step === 2 ? "72%" : "100%" }} />
                </i>
              </div>
            </aside>
          </div>
        </div>
      </section>
      <Modal open={success} title="合作需求已發布" onClose={() => setSuccess(false)} size="sm">
        <div className="publish-success">
          <span>
            <Check weight="bold" />
          </span>
          <h3>需求已上線！</h3>
          <p>合適的商家與專業工作者現在可以查看並向你提案。</p>
          <div>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/collaborations")}>
              查看合作廣場
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate("/dashboard/collaborations")}>
              管理需求
            </button>
          </div>
        </div>
      </Modal>
    </PublicLayout>
  );
}

