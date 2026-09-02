import { Navigate, useSearchParams } from "react-router-dom";

export function QrMembershipJoinCompatibility() {
  const [params] = useSearchParams();
  const token = params.get("q")?.trim() || "";
  return token ? <Navigate to={`/q/${encodeURIComponent(token)}`} replace /> : <Navigate to="/member/join" replace />;
}

export function MemberLoginCompatibility() {
  return <Navigate to="/member/join" replace />;
}

export function MerchantQrCodesCompatibility() {
  return <Navigate to="/merchant-admin/ordering" replace />;
}
