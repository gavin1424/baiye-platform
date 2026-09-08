import { ArrowLeft, CalendarBlank, Handshake, QrCode, Receipt, Signature } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

type AdminModule = "overview" | "finance" | "bookings" | "ordering" | "partners" | "contracts" | "google-booking";

export function AdminModuleNav({ current }: { current: AdminModule }) {
  return (
    <nav className="admin-module-nav" aria-label="管理模組導覽">
      {current !== "overview" && <Link to="/admin" className="admin-module-nav-home"><ArrowLeft /> 返回平台總覽</Link>}
      {current !== "finance" && (
        <Link to="/admin/finance">
          <Receipt /> 金流與記帳
        </Link>
      )}
      {current !== "bookings" && (
        <Link to="/admin/bookings">
          <CalendarBlank /> 預約管理
        </Link>
      )}
      {current !== "google-booking" && <Link to="/admin/google-maps-booking">Google 地圖預約</Link>}
      {current !== "ordering" && (
        <Link to="/admin/ordering">
          <QrCode /> 掃碼會員與點餐
        </Link>
      )}
      {current !== "partners" && (
        <Link to="/admin/partners">
          <Handshake /> 承攬夥伴管理
        </Link>
      )}
      {current !== "contracts" && (
        <Link to="/admin/contracts">
          <Signature /> 契約管理
        </Link>
      )}
      <Link to="/admin/addons">內容修改與加購</Link>
    </nav>
  );
}
