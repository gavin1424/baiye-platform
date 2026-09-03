import { Camera, CheckCircle, QrCode, ShieldCheck } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { IScannerControls } from "@zxing/browser";
import { PlatformLogo } from "../components";
import { orderingRouteFromQrValue } from "../qr-scanner-validation.mjs";

type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

export function QrScannerPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const animationRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");

  const stop = () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  };

  useEffect(() => stop, []);

  const accept = (value: string) => {
    const route = orderingRouteFromQrValue(value, window.location.origin);
    if (!route) {
      setMessage("此 QR Code 不是創百業有效點餐碼。");
      return false;
    }
    stop();
    navigate(route);
    return true;
  };

  const startWithBarcodeDetector = async () => {
    const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !videoRef.current) return false;
    let detector: BarcodeDetectorInstance;
    try {
      detector = new Detector({ formats: ["qr_code"] });
    } catch {
      return false;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    const detect = async () => {
      if (!videoRef.current || !streamRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes[0]?.rawValue && accept(codes[0].rawValue)) return;
      } catch {
        // A frame can be unreadable while the camera is moving; keep scanning.
      }
      animationRef.current = requestAnimationFrame(() => void detect());
    };
    animationRef.current = requestAnimationFrame(() => void detect());
    return true;
  };

  const startScanner = async () => {
    setMessage("");
    setActive(true);
    try {
      if (await startWithBarcodeDetector()) return;
      if (!videoRef.current) throw new Error("CAMERA_PREVIEW_UNAVAILABLE");
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 180 });
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result) accept(result.getText());
      });
    } catch (error) {
      stop();
      const denied = error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name);
      setMessage(denied ? "相機權限未開啟。請允許相機權限，或使用手機原生相機掃描桌上的 QR Code。" : "目前無法開啟相機，請使用手機原生相機掃描桌上的 QR Code。");
    }
  };

  return (
    <main className="ordering-scan-page">
      <header className="ordering-topbar"><PlatformLogo /><span>掃碼點餐</span></header>
      <section className="ordering-scan-card">
        <span className="ordering-scan-icon"><QrCode weight="duotone" /></span>
        <p className="partner-eyebrow">手機快速點餐</p>
        <h1>掃碼點餐</h1>
        <p>掃描桌上的 QR Code<br />即可查看菜單並開始點餐</p>
        <div className={`ordering-camera-frame ${active ? "is-active" : ""}`}>
          <video ref={videoRef} muted playsInline aria-label="QR Code 相機預覽" />
          {!active && <QrCode aria-hidden="true" />}
        </div>
        <button className="btn btn-primary btn-lg" type="button" onClick={() => void startScanner()} disabled={active}>
          <Camera weight="fill" /> {active ? "正在掃描…" : "開啟相機掃描 QR Code"}
        </button>
        {active && <button className="btn btn-outline" type="button" onClick={stop}>停止掃描</button>}
        {message && <p className="ordering-message" role="status">{message}</p>}
        <p className="ordering-scan-help">也可以直接使用手機原生相機掃描桌上的 QR Code。</p>
        <div className="ordering-scan-security"><ShieldCheck weight="fill" /><span>只會開啟創百業網站內的有效點餐碼</span></div>
        <Link className="ordering-scan-home" to="/"><CheckCircle />返回創百業首頁</Link>
      </section>
    </main>
  );
}
