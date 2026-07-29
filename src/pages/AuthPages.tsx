import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  Check,
  Eye,
  EyeSlash,
  Handshake,
  Lock,
  ShieldCheck,
  Storefront,
  User,
  UserCircle,
} from "@phosphor-icons/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlatformLogo } from "../components";
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
          <h1>{kind === "register" ? "把你的專業，變成可被信任的品牌頁面" : "一個帳號，管理網站與所有合作機會"}</h1>
          <p>展示服務與作品、回覆詢價、發布需求，讓商機不再散落在不同管道。</p>
          <div className="auth-benefits">
            {[
              [Storefront, "專屬商家網站", "快速建立公開專業頁面"],
              [Handshake, "合作媒合", "找到客戶與跨業夥伴"],
              [ShieldCheck, "信任認證", "累積評價與合作紀錄"],
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
        <div className="auth-visual-quote">
          <p>「上線兩週後，收到第一筆來自企業的合作詢問。」</p>
          <span>木日木工工作室・商家會員</span>
        </div>
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

export function LoginPage() {
  const { login } = useAppStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@baiye.local");
  const [password, setPassword] = useState("Demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    window.setTimeout(() => {
      const result = login(email, password);
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      navigate(email.startsWith("admin") ? "/admin" : "/dashboard");
    }, 520);
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <span className="eyebrow">歡迎回來</span>
        <h1>登入百業共創</h1>
        <p>繼續管理商家網站、合作與詢價。</p>
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
          <div className="auth-form-row">
            <label className="check-row">
              <input type="checkbox" defaultChecked />
              <span>記住我</span>
            </label>
            <Link to="/forgot-password">忘記密碼？</Link>
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? "登入中…" : "登入"}
            {!loading && <ArrowRight />}
          </button>
        </form>
        <div className="demo-accounts">
          <strong>快速填入測試帳號</strong>
          <button
            type="button"
            onClick={() => {
              setEmail("demo@baiye.local");
              setPassword("Demo1234");
            }}
          >
            <Storefront />
            <span>
              <b>一般商家</b>
              demo@baiye.local
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail("admin@baiye.local");
              setPassword("Admin1234");
            }}
          >
            <ShieldCheck />
            <span>
              <b>平台管理員</b>
              admin@baiye.local
            </span>
          </button>
        </div>
        <p className="auth-switch">
          還沒有帳號？<Link to="/register">註冊會員</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAppStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("business");
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
    register(name, email);
    navigate("/dashboard");
  };

  const roles = [
    { id: "individual", icon: UserCircle, title: "個人會員", text: "自由工作者、老師與專業接案者" },
    { id: "business", icon: Storefront, title: "商家會員", text: "店家、工作室、供應商與品牌", recommended: true },
    { id: "enterprise", icon: Buildings, title: "企業會員", text: "採購團隊、多位成員與供應商管理" },
  ];

  return (
    <AuthShell kind="register">
      <div className="auth-card auth-card-register">
        <div className="auth-register-progress">
          <span className="active">1</span>
          <i className={step === 2 ? "active" : ""} />
          <span className={step === 2 ? "active" : ""}>2</span>
          <small>選擇會員類型</small>
          <small>建立帳號</small>
        </div>
        <span className="eyebrow">建立會員資料</span>
        <h1>{step === 1 ? "你想如何使用平台？" : "建立你的百業共創帳號"}</h1>
        <p>{step === 1 ? "選擇最接近的身份，之後仍可在設定中調整。" : "完成後會自動建立可編輯的商家網站草稿。"}</p>
        <form className="form-stack auth-form" onSubmit={submit}>
          {step === 1 ? (
            <div className="role-options">
              {roles.map((item) => {
                const Icon = item.icon;
                return (
                  <label key={item.id} className={role === item.id ? "selected" : ""}>
                    {item.recommended && <span className="recommended-label">最多人選擇</span>}
                    <input type="radio" name="role" value={item.id} checked={role === item.id} onChange={() => setRole(item.id)} />
                    <span className="role-icon">
                      <Icon weight="duotone" />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </div>
                    <span className="radio-check">{role === item.id && <Check weight="bold" />}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <>
              <label className="field">
                <span>{role === "individual" ? "姓名" : "商家／企業名稱"} *</span>
                <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：山海設計工作室" />
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
              {step === 1 ? "繼續" : "建立會員帳號"}
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
