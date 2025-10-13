// src/pages/PVPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Bell, RotateCcw, Zap, Sun, Clock3, Calendar, BarChart3 } from "lucide-react";

/* ===== 상단 5개 정보 타일 ===== */
const IconTile = ({ title="", titleColor="text-[#c5ff46]", value="", unit="", icon=null, iconBg="#1c2a36" }) => (
  <div className="flex items-center px-8 py-3">
    <div className="relative w-[72px] h-[72px] mr-5">
      <div className="absolute inset-0 rounded-full grid place-items-center" style={{ background: iconBg, border: "1px solid #2a3e4d" }}>
        {icon}
      </div>
    </div>
    <div className="leading-tight">
      <div className={`text-[17px] font-extrabold ${titleColor}`}>{title}</div>
      <div className="flex items-end gap-1 mt-1">
        <div className="text-[38px] font-extrabold tracking-tight text-slate-100">{value}</div>
        <div className="mb-2 text-[14px] font-semibold text-[#63d8ff]">{unit}</div>
      </div>
    </div>
  </div>
);

/* ===== 스케일 조정용 컨테이너 ===== */
function ScaledStage({ designW, designH, className = "", children }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const resize = () => setScale(Math.min(1, el.clientWidth / designW));
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    return () => ro.disconnect();
  }, [designW]);
  return (
    <div ref={wrapRef} className={className} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: designW, height: designH, transform: `scale(${scale})`, transformOrigin: "left top" }}>
        {children}
      </div>
      <div style={{ height: designH * scale }} />
    </div>
  );
}

/* ===== 공용 카드 ===== */
const CardShell = ({ title, right, className = "", children }) => (
  <div className={`rounded-[1px] bg-[#162430] border border-[#22394b] ${className}`}>
    {(title || right) && (
      <div className="px-4 py-2 bg-[#14222c] border-b border-[#22394b] flex items-center justify-between">
        {title ? <span className="text-[14px] font-semibold text-[#d7e9f6]">{title}</span> : <span />}
        {right}
      </div>
    )}
    {children}
  </div>
);

/* ===== 시스템 로그 ===== */
const SystemLogPanel = () => {
  const logs = [
    { id: 1, scope: "BMS[BMS]", time: "2018-08-09 00:01:41", msg: "NPS ( Normal Po… )", level: "info" },
    { id: 2, scope: "PCS[PCS]", time: "2018-07-20 17:17:44", msg: "MC RUN (INV)", level: "warn" },
    { id: 3, scope: "PCS[PCS]", time: "2018-07-20 17:17:44", msg: "INV RUN (INV)", level: "warn" },
  ];
  const colorByLevel = (lv) => (lv === "warn" ? "#ffcf77" : lv === "error" ? "#ff8b8b" : "#8fd3ff");
  return (
    <div className="rounded-[1px] bg-[#1a2a36] border border-[#22394b] h-[199.5px] flex flex-col">
      <div className="px-3 py-2 bg-[#14222c] border-b border-[#22394b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[#9fd6ff]" />
          <span className="text-[13px] font-semibold text-[#d7e9f6]">알람 : 시스템 로그</span>
        </div>
        <button type="button" className="p-1.5 rounded border border-[#2a3e4d] hover:bg-[#1b2b36] text-[#cfe7f6]" title="새로고침">
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="px-3 py-2 flex-1 overflow-y-auto">
        {logs.map((row) => (
          <div key={row.id} className="grid grid-cols-12 items-center py-2 border-b border-[#22394b]/60 last:border-b-0">
            <div className="col-span-4 text-[13px] text-[#cfe7f6] truncate">{row.scope}</div>
            <div className="col-span-4 text-[12px] text-slate-400">{row.time}</div>
            <div className="col-span-4 text-[13px] font-semibold truncate" style={{ color: colorByLevel(row.level) }} title={row.msg}>
              {row.msg}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ===== SVG 게이지 (시침 제거 + 크기 60%) ===== */
const Gauge = ({
  value = 0, min = 0, max = 100,
  label = "", unit = "",
  track = "#203340", bandFrom = "#39e2cf", bandTo = "#6be7ff",
}) => {
  const W = 332;   // 620 * 0.6
  const H = 206;   // 360 * 0.6
  const cx = W / 2, cy = H * 0.80;
  const r  = Math.min(W, H) * 0.48;
  const sw = 38;

  const clamp = (v) => Math.max(min, Math.min(max, v));
  const pct = (clamp(value) - min) / (max - min);
  const toRad = (deg) => (Math.PI / 180) * deg;
  const start = 180, end = 360;
  const valueDeg = start + (end - start) * pct;

  const arcPath = (startDeg, endDeg, radius) => {
    const sx = cx + radius * Math.cos(toRad(startDeg));
    const sy = cy + radius * Math.sin(toRad(startDeg));
    const ex = cx + radius * Math.cos(toRad(endDeg));
    const ey = cy + radius * Math.sin(toRad(endDeg));
    const large = endDeg - startDeg <= 180 ? 0 : 1;
    return `M ${sx} ${sy} A ${radius} ${radius} 0 ${large} 1 ${ex} ${ey}`;
  };

  return (
    <div className="h-full flex flex-col items-stretch">
      <svg className="flex-1" width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* 트랙 & 밴드 */}
        <path d={arcPath(start, end, r)} stroke={track} strokeWidth={sw} fill="none" strokeLinecap="round" />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={bandFrom} /><stop offset="100%" stopColor={bandTo} />
          </linearGradient>
        </defs>
        <path d={arcPath(start, valueDeg, r)} stroke="url(#gaugeGrad)" strokeWidth={sw} fill="none" strokeLinecap="round" />

        {/* 값 텍스트 */}
        <text x={cx} y={cy - 10} fontSize="24" fill="#eaf6ff" textAnchor="middle" fontWeight="800">
          {value.toLocaleString()}{unit ? ` ${unit}` : ""}
        </text>

        {/* 라벨 */}
        <text x={cx} y={cy + 32} fontSize="12" fill="#8fe9d2" textAnchor="middle" fontWeight="600">
          {label}
        </text>
      </svg>
    </div>
  );
};

/* ===== Power Status 패널 ===== */
const PowerStatusPanel = () => (
  <div className="relative rounded-md bg-[#1a2a36] border border-[#22394b] overflow-hidden" style={{ width: 2300, height: 840 }}>
    <div className="absolute left-0 right-0 top-0 px-3 py-2 h-[70px] flex items-center bg-[#14222c] border-b border-[#22394b]">
      <span className="text-[22px] font-semibold text-[#d7e9f6]">
        Power Status <span className="opacity-70"> ( 현재발전기준 : INV )</span>
      </span>
    </div>
    <div className="absolute left-3 right-3 top-[30px] bottom-0 grid grid-cols-3 gap-4 place-items-center scale-[0.85] -translate-y-[28px]">
      <Gauge label="인버터(DC/AC)변환효율" value={96.7} min={0} max={100} unit="%" />
      <Gauge label="현재발전출력" value={69.6} min={0} max={627.12} unit="kW" bandFrom="#b4d04a" bandTo="#6a7b2e" />
      <Gauge label="발전효율" value={11.1} min={0} max={100} unit="%" bandFrom="#6bd2ff" bandTo="#2d7aa0" />
    </div>
  </div>
);

/* ===== PV 페이지 전체 ===== */
export default function PVScreen() {
  return (
    <div className="w-full">
      {/* 상단 5개 패널 */}
      <div className="w-full bg-[#162430] grid grid-cols-5 divide-x divide-[#2a3e4d] h-[110px]">
        <IconTile title="현재출력" value="69.6" unit="kW" titleColor="text-[#c5ff46]" icon={<Zap size={28} className="text-[#d5ff6a]" />} />
        <IconTile title="금일발전량" value="1,815.0" unit="kWh" titleColor="text-[#7ddbd7]" icon={<Sun size={28} className="text-[#7de3dc]" />} />
        <IconTile title="금일발전시간" value="2.9" unit="Hour" titleColor="text-[#f1a256]" icon={<Clock3 size={28} className="text-[#f1b67a]" />} />
        <IconTile title="금월발전량" value="34.5" unit="MWh" titleColor="text-[#a08bff]" icon={<Calendar size={28} className="text-[#b7a5ff]" />} />
        <IconTile title="금년발전량" value="813.3" unit="MWh" titleColor="text-[#69e3ff]" icon={<BarChart3 size={28} className="text-[#69e3ff]" />} />
      </div>

      {/* 본문 */}
      <div className="w-full px-2 mt-1 grid grid-cols-12 gap-1 pb-4">
        <div className="col-span-3 space-y-1">
          <CardShell title="누적 전력량" className="h-[460px] overflow-hidden" />
          <CardShell className="h-[199.5px] overflow-hidden" />
        </div>
        <div className="col-span-9 space-y-2">
          <ScaledStage designW={2300} designH={820} className="w-full">
            <PowerStatusPanel />
          </ScaledStage>
          <div className="mt-3.5 flex gap-1">
            <div className="w-2/3">
              <CardShell title="발전량 추이" className="h-[199.5px]" />
            </div>
            <div className="flex-1">
              <SystemLogPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
