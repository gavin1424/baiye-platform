import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeSlash,
  Handshake,
  Lock,
  ShieldCheck,
  ShoppingCart,
  Storefront,
} from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PlatformLogo, PublicLayout } from "../components";
import { useAppStore } from "../store";

function AuthShell({ children, kind = "login" }: { children: ReactNode; kind?: "login" | "register" | "forgot" }) {
  return (
    <div className="auth-page">
      <aside className="auth-visual">
        <Link to="/" className="auth-back">
          <ArrowLeft /> 回到首頁
        </Link>
        <PlatformLogo />
        <div className="auth-visual-copy">
          <span className="eyebrow">每個行業，都值得擁有自己的網站。</span>
          <h1>正式帳號，安全管理平台</h1>
          <p>此入口僅供已建立的正式平台管理員使用；承攬夥伴請使用獨立登入入口。</p>
          <div className="auth-benefits">
            {[
              [ShoppingCart, "商城購物", "瀏覽商品、購物車與結帳"],
              [Storefront, "商家正式上架", "建立公開頁面與商家網站"],
              [Handshake, "合作媒合", "找到客戶與跨業夥伴"],
            ].map(([Icon, title, text]) => {
              const ItemIcon = Icon as typeof Storefront;
              return (
                <div key={String(title)}>
                  <span>
                    <ItemIcon weight="duotone" />
                  </span>
                  <div>
                    <strong>{String(title)}</strong>
                    <small>{String(text)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="auth-visual-quote"><p>正式商家加入與帳號開通皆由平台完成審核。</p></div>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-logo">
          <PlatformLogo />
        </div>
        {children}
      </main>
    </div>
  );
}

export function AdminLoginPage() {
  const { login, session } = useAppStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session.role === "admin") navigate("/admin", { replace: true });
  }, [navigate, session.role]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
      const result = await login(email, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      navigate(result.role === "admin" ? "/admin" : result.role === "business" ? "/dashboard" : "/account");
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <span className="eyebrow">歡迎回來</span>
        <h1>平台管理員登入</h1>
        <p>使用後端驗證與安全工作階段登入正式營運控制中心。</p>
        <form className="form-stack auth-form" onSubmit={submit}>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <label className="field">
            <span>Email</span>
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label className="field">
            <span>密碼</span>
            <div className="password-input">
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}>
                {showPassword ? <EyeSlash /> : <Eye />}
              </button>
            </div>
          </label>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? "登入中…" : "登入"}
            {!loading && <ArrowRight />}
          </button>
        </form>
        <p className="auth-switch">承攬夥伴請使用獨立入口。<Link to="/partner/login">承攬夥伴登入</Link></p>
        <p className="auth-switch">商家加入請先了解方案並完成平台審核。<Link to="/pricing">了解商家方案</Link></p>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register, registerMerchant } = useAppStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [registrationType, setRegistrationType] = useState<"member" | "merchant">(() =>
    params.get("type") === "merchant" ? "merchant" : "member",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    if (registrationType === "merchant") {
      registerMerchant(name, email);
      navigate("/dashboard");
      return;
    }
    register(name, email);
    navigate("/shop");
  };

  const registrationTypes = [
    {
      id: "member" as const,
      icon: ShoppingCart,
      title: "免費會員",
      price: "NT$0",
      text: "一般購物使用",
      features: ["免費註冊", "商城購物", "購物車", "結帳"],
      cta: "免費註冊",
    },
    {
      id: "merchant" as const,
      icon: Storefront,
      title: "商家 AI 行銷推廣方案",
      price: "NT$18,000",
      billing: "推廣優惠價（原價 NT$30,000）",
      text: "行銷推廣、平台上架與數位服務費；標準網站免費附贈",
      features: ["商家正式上架", "專屬商家頁", "商品／服務與作品", "合作媒合與商家後台"],
      cta: "申請商家推廣上架",
    },
  ];
  const selectedRegistration = registrationTypes.find((item) => item.id === registrationType)!;

  return (
    <AuthShell kind="register">
      <div className="auth-card auth-card-register">
        <div className="auth-register-progress">
          <span className="active">1</span>
          <i className={step === 2 ? "active" : ""} />
          <span className={step === 2 ? "active" : ""}>2</span>
          <small>選擇註冊方式</small>
          <small>建立帳號</small>
        </div>
        <span className="eyebrow">建立會員資料</span>
        <h1>{step === 1 ? "你想如何使用平台？" : "建立你的創百業智慧鏈帳號"}</h1>
        <p>
          {step === 1
            ? "免費會員只用於商城購物；商家功能需完成 AI 行銷推廣方案。"
            : registrationType === "merchant"
              ? "完成後將開通商家公開頁、網站與完整商家後台。"
              : "完成後即可瀏覽商城、使用購物車並結帳。"}
        </p>
        <form className="form-stack auth-form" onSubmit={submit}>
          {step === 1 ? (
            <div className="role-options">
              {registrationTypes.map((item) => {
                const Icon = item.icon;
                return (
                  <label key={item.id} className={registrationType === item.id ? "selected" : ""}>
                    <input
                      type="radio"
                      name="registrationType"
                      value={item.id}
                      checked={registrationType === item.id}
                      onChange={() => setRegistrationType(item.id)}
                    />
                    <span className="role-icon">
                      <Icon weight="duotone" />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <span className="registration-price">
                        {item.price}
                        {item.billing && <small>{item.billing}</small>}
                      </span>
                      <p>{item.text}</p>
                      <ul>
                        {item.features.map((feature) => (
                          <li key={feature}>
                            <Check weight="bold" /> {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <span className="radio-check">{registrationType === item.id && <Check weight="bold" />}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <>
              <label className="field">
                <span>{registrationType === "merchant" ? "商家名稱" : "姓名"} *</span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={registrationType === "merchant" ? "例如：山海設計工作室" : "例如：王小明"}
                />
              </label>
              <label className="field">
                <span>Email *</span>
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
              </label>
              <label className="field">
                <span>密碼 *</span>
                <div className="password-input">
                  <input
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="至少 8 個字元"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}>
                    {showPassword ? <EyeSlash /> : <Eye />}
                  </button>
                </div>
                <span className="password-strength">
                  <i className={password.length >= 8 ? "good" : ""} />
                  <i className={/[A-Z]/.test(password) ? "good" : ""} />
                  <i className={/\d/.test(password) ? "good" : ""} />
                  <small>建議包含英文大寫與數字</small>
                </span>
              </label>
              <label className="consent-row">
                <input type="checkbox" required />
                <span>
                  我同意<Link to="/terms">使用條款</Link>與<Link to="/privacy">隱私權政策</Link>。
                </span>
              </label>
            </>
          )}
          <div className="form-actions">
            {step === 2 && (
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                上一步
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-lg">
              {selectedRegistration.cta}
              <ArrowRight />
            </button>
          </div>
        </form>
        <p className="auth-switch">
          已經有帳號？<Link to="/login">登入</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export function MemberAccountPage() {
  const { session, shopCart, shopOrders, logout } = useAppStore();
  const navigate = useNavigate();
  const cartCount = shopCart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <PublicLayout>
      <section className="section member-account-page">
        <div className="container">
          <div className="member-account-card">
            <span className="role-icon">
              <ShoppingCart weight="duotone" />
            </span>
            <span className="eyebrow">免費會員</span>
            <h1>{session.name || "購物會員"}</h1>
            <p>你的帳號可使用商城購物、購物車與結帳；商家功能需另外完成商家 AI 行銷推廣方案。</p>
            <div className="member-account-stats">
              <div>
                <span>會員費用</span>
                <strong>NT$0</strong>
              </div>
              <div>
                <span>購物車</span>
                <strong>{cartCount} 件</strong>
              </div>
              <div>
                <span>商城訂單</span>
                <strong>{shopOrders.length} 筆</strong>
              </div>
            </div>
            <div className="form-actions">
              <Link to="/shop" className="btn btn-primary">
                前往商城
              </Link>
              <Link to="/cart" className="btn btn-outline">
                查看購物車
              </Link>
              <Link to="/pricing" className="btn btn-outline">
                申請商家上架
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <AuthShell kind="forgot">
      <div className="auth-card forgot-card">
        <span className="forgot-icon">
          {sent ? <Check weight="bold" /> : <Lock weight="duotone" />}
        </span>
        <span className="eyebrow">帳號協助</span>
        <h1>{sent ? "重設信已寄出" : "忘記密碼？"}</h1>
        <p>
          {sent
            ? `我們已將模擬重設連結寄到 ${email}。請查看信箱並依指示設定新密碼。`
            : "輸入註冊 Email，我們會寄送密碼重設連結。"}
        </p>
        {!sent ? (
          <form
            className="form-stack auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSent(true);
            }}
          >
            <label className="field">
              <span>Email</span>
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
            </label>
            <button type="submit" className="btn btn-primary btn-lg">
              寄送重設連結
              <ArrowRight />
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-outline btn-lg" onClick={() => setSent(false)}>
            重新寄送
          </button>
        )}
        <Link to="/login" className="back-to-login">
          <ArrowLeft /> 返回登入
        </Link>
      </div>
    </AuthShell>
  );
}
