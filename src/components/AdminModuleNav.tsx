import { ArrowLeft, CalendarBlank, Handshake, Receipt } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

type AdminModule = "finance" | "bookings" | "partners";

export function AdminModuleNav({ current }: { current: AdminModule }) {
  return (
    <nav className="admin-module-nav" aria-label="管理模組導覽">
      <Link to="/admin" className="admin-module-nav-home">
        <ArrowLeft /> 返回平台總覽
      </Link>
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
      {current !== "partners" && (
        <Link to="/admin/partners">
          <Handshake /> 承攬夥伴管理
        </Link>
      )}
    </nav>
  );
}
