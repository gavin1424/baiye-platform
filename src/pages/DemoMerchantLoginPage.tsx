import { Storefront } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

export function DemoMerchantLoginPage() {
  return <main className="demo-merchant-login"><section className="demo-merchant-login-card"><div className="demo-environment-pill">DEPRECATED</div><Storefront size={48} weight="duotone" /><p>百工牛肉麵</p><h1>試用密碼入口已停用</h1><p>商家管理者已改用正式手機會員身份與 Staging OTP 登入；正式商家仍使用手機驗證。</p><Link className="btn btn-primary btn-lg" to="/merchant/login">前往手機登入</Link><a className="btn btn-ghost" href="#/q/myJghWaqQbCwMInWWsBUf2xRwsR02saT">先查看顧客點餐頁</a></section></main>;
}
