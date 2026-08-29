import { useEffect, useRef, useState } from "react";

export type SignaturePoint = [number, number];
export type SignatureValue = { strokes: SignaturePoint[][] };

export function ContractSignatureCanvas({ onChange }: { onChange: (value: SignatureValue) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<SignaturePoint[][]>([]);
  const activeStroke = useRef<SignaturePoint[] | null>(null);
  const [pointCount, setPointCount] = useState(0);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#3f2419";
    context.lineWidth = Math.max(2, window.devicePixelRatio * 1.2);
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke[0][0], stroke[0][1]);
      for (const point of stroke.slice(1)) context.lineTo(point[0], point[1]);
      context.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(180 * ratio);
      canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      redraw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>): SignaturePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.round((event.clientX - rect.left) * 100) / 100, Math.round((event.clientY - rect.top) * 100) / 100];
  };
  const emit = () => {
    setPointCount(strokesRef.current.reduce((sum, stroke) => sum + stroke.length, 0));
    onChange({ strokes: strokesRef.current.map((stroke) => [...stroke]) });
  };
  const clear = () => {
    strokesRef.current = [];
    activeStroke.current = null;
    emit();
    redraw();
  };

  return (
    <div className="contract-signature-field">
      <canvas
        ref={canvasRef}
        aria-label="手寫簽名區"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          const stroke = [point(event)];
          strokesRef.current.push(stroke);
          activeStroke.current = stroke;
        }}
        onPointerMove={(event) => {
          if (!activeStroke.current) return;
          event.preventDefault();
          activeStroke.current.push(point(event));
          redraw();
        }}
        onPointerUp={() => { activeStroke.current = null; emit(); }}
        onPointerCancel={() => { activeStroke.current = null; emit(); }}
      />
      <div className="contract-signature-actions">
        <span>{pointCount >= 6 ? "簽名已記錄" : "請以完整筆劃簽名（不可只點一下）"}</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={clear}>清除並重簽</button>
      </div>
    </div>
  );
}
