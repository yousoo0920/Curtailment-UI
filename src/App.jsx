// src/App.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Home,
  Thermometer,
  Bell,
  LogOut,
  Bolt,
  Battery,
  Droplets,
  BatteryCharging,
  Pause,
  Power,
  RotateCcw,
  Zap,
  ShieldOff,
  Sun, // ★ 추가: 우측 지표 카드 아이콘
} from "lucide-react";

/* ============ 공통 유틸 ============ */
const pad = (n) => String(n).padStart(2, "0");
const useClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(
    now.getDate()
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

/* ============ 스케일 래퍼 (100%에서 가로 잘림 방지) ============ */
function ScaledStage({ designW, designH, children, className = "" }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const resize = () => {
      const avail = el.clientWidth;
      const s = Math.min(1, avail / designW); // 확대 금지
      setScale(s);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    return () => ro.disconnect();
  }, [designW]);

  return (
    <div ref={wrapRef} className={className} style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: designW,
          height: designH,
          transform: `scale(${scale})`,
          transformOrigin: "left top",
        }}
      >
        {children}
      </div>
      <div style={{ height: designH * scale }} />
    </div>
  );
}

/* ============ 공용 작은 UI ============ */
const Chip = ({ children, color = "#69e3ff", dim = false }) => (
  <span
    className={`px-8 py-1.5 rounded border text-[24px] ${
      dim ? "bg-[#1f2b36] border-[#2c4454] text-slate-200" : ""
    }`}
    style={!dim ? { background: `${color}22`, borderColor: `${color}55`, color } : {}}
  >
    {children}
  </span>
);

const MiniPill = ({ icon, children }) => (
  <span
    className="h-[40px] px-3 rounded-md border text-[24px] inline-flex items-center gap-2"
    style={{
      background: "rgba(21,35,45,0.6)",
      borderColor: "#2a4456",
      color: "#bfefff",
    }}
  >
    {icon}
    {children}
  </span>
);

const Tag = ({ children }) => (
  <div className="h-6 px-2 rounded bg-[#173241] border border-[#295065] text-[12px] text-[#bfefff] flex items-center shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
    {children}
  </div>
);

const SoftPanel = ({ x, y, w, h }) => (
  <div
    className="absolute rounded-md border"
    style={{
      left: x,
      top: y,
      width: w,
      height: h,
      background: "linear-gradient(180deg,#1d2c37,#17242e)",
      borderColor: "#22394b",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
    }}
  />
);

const PVIcon = ({ w = 210, className = "" }) => (
  <svg
    viewBox="0 0 120 100"
    width={w}
    height={(w * 100) / 120}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="6" y="14" width="108" height="56" rx="6" />
    <path d="M6 33 H114 M6 51 H114" />
    <path d="M26 14 V70 M46 14 V70 M66 14 V70 M86 14 V70" />
    <path d="M60 70 L48 90 M60 70 L72 90 M38 90 H82" />
  </svg>
);

const TowerIcon = ({ w = 210, className = "" }) => (
  <svg
    viewBox="0 0 90 120"
    width={w}
    height={(w * 120) / 90}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M45 8 L20 28 H70 Z" />
    <path d="M45 8 L18 56 H72 Z" />
    <path d="M24 28 L18 56 M66 28 L72 56" />
    <path d="M45 8 L33 56 M45 8 L57 56" />
    <path d="M22 112 L33 56 H57 L68 112" />
    <path d="M16 112 H74" />
  </svg>
);

/* ============ 좌측 누적 전력량 ============ */
const AccumChart = () => {
  const max = 6000;
  const ticks = [0, 2000, 4000, 6000];
  const data = [
    { name: "발전", today: 330.0, prev: 4045.8, color: "#c5ff46", todayColor: "#eefc71" },
    { name: "충전", today: 42.0, prev: 2670.7, color: "#63d8ff", todayColor: "#63d8ff" },
    { name: "방전", today: 0.0, prev: 2269.4, color: "#f1a256", todayColor: "#ffc27e" },
    { name: "송전", today: 288.0, prev: 1375.0, color: "#ae8bff", todayColor: "#ae8bff" },
  ];
  return (
    <div className="rounded-md bg-[#1a2a36] border border-[#22394b] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="px-2 py-1 rounded bg-[#243646] border border-[#2a3f50]">일</span>
          <span className="px-2 py-1 rounded border border-transparent text-slate-300">월</span>
        </div>
        <div className="text-[12px] text-slate-300">단위 kWh</div>
      </div>
      <div className="mt-4">
        {data.map((row) => {
          const prevPct = Math.max(0, Math.min(100, (row.prev / max) * 100));
          const todayPct = Math.max(0, Math.min(100, (row.today / max) * 100));
          return (
            <div key={row.name} className="grid grid-cols-12 items-center gap-2 mb-3">
              <div className="col-span-2 text-[13px] text-slate-200">{row.name}</div>
              <div className="col-span-8">
                <div className="relative h-3 bg-[#253647] rounded">
                  <div className="h-full rounded-l" style={{ width: `${prevPct}%`, background: row.color, opacity: 0.6 }} />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm"
                    style={{
                      left: `calc(${todayPct}% - 6px)`,
                      background: row.todayColor,
                      boxShadow: "0 0 0 2px #0f1a23",
                    }}
                  />
                </div>
              </div>
              <div className="col-span-2 text-right text-[12px] text-slate-100">
                {row.prev.toLocaleString()}
              </div>
            </div>
          );
        })}
        <div className="mt-3 flex justify-between text-[11px] text-slate-300">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============ 좌측 하단: 금액 패널 + 미니 라인 차트 (SVG) ============ */
const PricePanel = () => {
  const data = useMemo(() => {
    const arr = [];
    let v = 180;
    for (let i = 0; i < 60; i++) {
      v += (Math.random() - 0.5) * 10;
      arr.push(Math.max(120, Math.min(360, v)));
    }
    return arr;
  }, []);
  const W = 520,
    H = 90,
    padL = 30,
    padR = 10,
    padT = 10,
    padB = 18;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const minV = 120,
    maxV = 360;
  const path = data
    .map((v, i) => {
      const x = padL + (i / (data.length - 1)) * innerW;
      const y = padT + innerH * (1 - (v - minV) / (maxV - minV));
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="rounded-md bg-[#1a2a36] border border-[#22394b] p-3">
      <div className="flex gap-4">
        <div className="flex-1 rounded-md bg-[#172633] border border-[#244255] p-3">
          <div className="text-[12px] text-slate-300">SMP 금액</div>
          <div className="text-xl font-bold">
            0 <span className="text-slate-300 text-[12px]">원/kWh</span>
          </div>
        </div>
        <div className="flex-1 rounded-md bg-[#172633] border border-[#244255] p-3">
          <div className="text-[12px] text-slate-300">REC 금액</div>
          <div className="text-xl font-bold">
            0 <span className="text-slate-300 text-[12px]">원/kWh</span>
          </div>
        </div>
        <div className="flex-1 rounded-md bg-[#172633] border border-[#244255] p-3">
          <div className="text-[12px] text-slate-300">SMP + REC 금액</div>
          <div className="text-xl font-bold">
            0 <span className="text-slate-300 text-[12px]">원/kWh</span>
          </div>
        </div>
      </div>
      <div className="mt-3 relative rounded-md bg-[#14222c] border border-[#22394b]">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const y = padT + innerH * t;
            return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#2a3f50" strokeWidth="1" opacity="0.35" />;
          })}
          <path d={path} fill="none" stroke="#69e3ff" strokeWidth="2" />
        </svg>
        <div className="absolute right-2 bottom-1 text-[10px] text-slate-400">실시간 그래프 (1분 주기)</div>
      </div>
    </div>
  );
};

/* ============ 지표(아이콘 2단) 컴포넌트 ============ */
const IconMetricGroup = ({ icon, rows }) => (
  <div className="flex items-start gap-4">
    {/* 아이콘 */}
    <div className="w-[44px] h-[44px] flex items-center justify-center rounded-lg bg-[#16303b] border border-[#285064]">
      {icon}
    </div>

    {/* 라벨/값 2줄 */}
    <div className="flex-1 grid grid-cols-2 gap-y-1 leading-tight">
      {rows.map((r) => (
        <React.Fragment key={r.label}>
          <div className="text-[18px] text-[#8fe9d2]">{r.label}</div>
          <div className="text-[18px]">
            <span className="font-semibold text-white mr-1">{r.val}</span>
            <span className="opacity-70">{r.unit}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  </div>
);

/* ============ FlowPanel ============ */
const MetricRow = ({ dot, label, val, unit, size = "md" }) => {
  const isLg = size === "lg";
  return (
    <div className={`flex items-center gap-3 ${isLg ? "text-[18px] mb-2" : "text-[13px] mb-1.5"} text-slate-200`}>
      <span className={`${isLg ? "w-3 h-3" : "w-2 h-2"} rounded-full`} style={{ background: dot }} />
      <span className={isLg ? "w-12" : "w-8"}>{label}</span>
      <span className={`font-semibold text-white ${isLg ? "text-[22px]" : ""}`}>{val}</span>
      <span className="opacity-70 ml-1">{unit}</span>
    </div>
  );
};

const FlowPanel = () => {
  const STAGE = { w: 2300, h: 560 };

  // 바닥 패널 섹션
  const L = { x: 0, y: 670, w: 980, h: 140 };
  const M = { x: L.x + L.w + 20, y: 670, w: 520, h: 140 };
  const R = { x: M.x + M.w - 50, y: 670, w: 800, h: 140 };

  // 한 줄 하단 패널
  const BOTTOM = { x: L.x, y: 530, w: R.x + R.w - L.x, h: 280 };
  const L_RATIO = (L.w / (L.w + M.w + R.w)) * 100;
  const LM_RATIO = ((L.w + M.w) / (L.w + M.w + R.w)) * 100;

  // 상단 오브젝트
  const PV = { x: 100, y: 186, w: 280 };
  const PIPE = { x: 360, y: 270, w: 1220, h: 40 };
  const PV_LABEL = { x: 650, y: 202 };

  // 중앙/하단
  const PCS = { x: 1020, y: 622, w: 320, h: 104 };
  const TOWER = { x: 1500, y: 128, w: 300 };

  // 배터리/부가
  const BAT = { x: 1500, y: 600, w: 280, h: 150 };
  const BAT_CELL = { w: 42, h: 62 };
  const SOH_TEMP = { x: BAT.x + BAT.w + 60, y: BAT.y - 10, w: 280 };
  const BMS = { x: BAT.x + BAT.w + 396, y: BAT.y - 68, w: 110, h: BAT.h + 125 };

  // 라인
  const BRANCH = { x: PIPE.x + 820, y: PIPE.y + PIPE.h - 6, w: 22, h: 318 };
  const PCS_LINE = { x: 1335, y: 665, w: 200, h: 16 };

  // 최상단 바
  const TOPBAR = { x: 15, y: 6, w: STAGE.w - 24, h: 102 };

  // 타일
  const Tile = ({ icon, label, active = false }) => (
    <div
      className="flex flex-col items-center justify-center h-[242px] w-[124px] rounded-md border transition-colors"
      style={{
        background: active ? "rgba(44,120,134,0.22)" : "rgba(21,35,45,0.45)",
        borderColor: active ? "#3aa9be" : "#2a4556",
      }}
    >
      <div className={`mb-2 ${active ? "text-[#4de4e9]" : "text-[#9fcad9]"}`}>{icon}</div>
      <div className={`text-[24px] font-bold ${active ? "text-[#bffaff]" : "text-slate-300"}`}>{label}</div>
    </div>
  );

  return (
    <div
      className="relative rounded-md bg-[#1a2a36] border border-[#22394b] p-4 pt-205 overflow-visible"
      style={{ width: STAGE.w, height: STAGE.h }}
    >
      {/* 최상단 어두운 패널 */}
      <div
        className="absolute flex items-center justify-between rounded-md border px-3"
        style={{
          left: TOPBAR.x,
          top: TOPBAR.y,
          width: TOPBAR.w,
          height: TOPBAR.h,
          background: "#162430",
          borderColor: "#2a3e4d",
          zIndex: 50,
        }}
      >
        <div className="flex items-center gap-2">
          <Chip dim>ESS상태</Chip>
          <Chip color="#7aa6ff">
            <Zap size={24} className="inline mr-1" />
            충전중
          </Chip>
        <Chip color="#25d3a2">A 자동</Chip>
        </div>

        <div className="flex items-center gap-2">
          <MiniPill icon={<span className="opacity-80">⚙️</span>}>항온항습기 2</MiniPill>
          <MiniPill icon={<Droplets size={24} className="text-[#69e3ff]" />}>습도 73.6%</MiniPill>
          <MiniPill icon={<Thermometer size={24} className="text-[#69e3ff]" />}>온도 22.9℃</MiniPill>
        </div>
      </div>

      {/* 하단 통합 패널 배경 */}
      <div
        className="absolute rounded-md border"
        style={{
          left: BOTTOM.x,
          top: BOTTOM.y,
          width: BOTTOM.w,
          height: BOTTOM.h,
          background: `linear-gradient(
            90deg,
            rgba(29,44,55,0.95) 0% ${L_RATIO}%,
            rgba(26,41,52,0.95) ${L_RATIO}% ${LM_RATIO}%,
            rgba(23,38,49,0.95) ${LM_RATIO}% 100%
          )`,
          borderColor: "#22394b",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
          zIndex: 1,
        }}
      />

      {/* 좌측 PV */}
      <div className="absolute" style={{ left: PV.x, top: PV.y, zIndex: 10 }}>
        <PVIcon w={PV.w} className="text-slate-200" />
      </div>

      {/* 상단 파이프 */}
      <div
        className="absolute rounded-full"
        style={{
          left: PIPE.x,
          top: PIPE.y,
          width: PIPE.w,
          height: PIPE.h,
          background: "#0f2d37",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="absolute inset-[4px] rounded-full overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-[#23e3c2] via-[#53e6f2] to-[#a9f1ff]" />
        </div>
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full blur-sm"
          style={{ background: "#a9f1ff55" }}
        />
      </div>

      {/* 파이프 라벨 (크게) */}
      <div className="absolute text-[#79e9ff]" style={{ left: PV_LABEL.x, top: PV_LABEL.y }}>
        <span className="text-[24px] font-semibold">PV. Meter</span>
        <span className="ml-3 text-white font-extrabold text-[28px] align-middle">305</span>
        <span className="ml-1 text-[#63d8ff] font-semibold text-[20px] align-middle">kW</span>
      </div>

      {/* 오른쪽 칩 (크게) */}
      <div className="absolute flex gap-2" style={{ left: PV_LABEL.x + 320, top: PV_LABEL.y + 2 }}>
        <div className="h-8 px-3 rounded bg-[#173241] border border-[#295065] text-[24px] text-[#bfefff] flex items-center">
          <Zap size={46} className="mr-1 text-[#69e3ff]" />
          충전 9 kW
        </div>
      </div>

      {/* 분기선 + 칩 */}
      <div
        className="absolute rounded bg-[#59e6e2]/60"
        style={{ left: BRANCH.x, top: BRANCH.y, width: BRANCH.w, height: BRANCH.h, zIndex: 2 }}
      />
      <div className="absolute flex flex-col gap-2 text-[13px]" style={{ left: BRANCH.x + 50, top: BRANCH.y + 34 }}>
        <Chip color="#63d8ff">
          <Zap size={13} className="inline mr-1" />
          충전 <b>9</b> kW
        </Chip>
        <Chip color="#f1a256">
          <Zap size={13} className="inline mr-1 rotate-180" />
          방전 <b>0</b> kW
        </Chip>
      </div>

      {/* 송전탑 */}
      <div className="absolute" style={{ left: TOWER.x, top: TOWER.y }}>
        <TowerIcon w={TOWER.w} className="text-slate-200" />
      </div>

      {/* 우측 지표 카드 (아이콘 버전) */}
      <div
        className="absolute rounded-md border border-[#2a4456] p-4 space-y-4"
        style={{ left: 1855, top: 236, width: 410, background: "rgba(22,36,48,0.65)" }}
      >
        <IconMetricGroup
          icon={<Sun size={36} className="text-[#56e3c1]" />}
          rows={[
            { label: "경사", val: "455", unit: "W/㎡" },
            { label: "수평", val: "449", unit: "W/㎡" },
          ]}
        />
        <IconMetricGroup
          icon={<Thermometer size={36} className="text-[#56e3c1]" />}
          rows={[
            { label: "모듈", val: "48", unit: "℃" },
            { label: "외기", val: "32", unit: "℃" },
          ]}
        />
      </div>

      {/* =================== PCS 운영상태 (좌 라벨 + 우 박스) =================== */}
      <div
        className="absolute flex"
        style={{
          left: L.x + 12,
          top: BOTTOM.y + 14,
          width: L.w - 24,
          height: BOTTOM.h - 8,
          zIndex: 2,
        }}
      >
        {/* 좌측 세로 라벨 패널 */}
        <div
          className="h-full rounded-l-md border grid place-items-center"
          style={{
            width: 96,
            background: "linear-gradient(180deg,#1b2a35,#15222c)",
            borderColor: "#2a4556",
          }}
        >
          <div className="text-center leading-tight">
            <div className="text-[28px] font-bold text-[#bfefff]">PCS</div>
            <div className="text-[22px] text-slate-300 mt-1">운영상태</div>
          </div>
        </div>

        {/* 우측 컨트롤 박스 */}
        <div
          className="flex-1 rounded-r-md border p-4"
          style={{
            background: "rgba(21,35,45,0.55)",
            borderColor: "#2a4556",
          }}
        >
          <div className="flex flex-wrap gap-4">
            <Tile icon={<BatteryCharging size={36} />} label="충전" />
            <Tile icon={<Power size={36} />} label="방전" />
            <Tile icon={<RotateCcw size={36} />} label="활성" active />
            <Tile icon={<Pause size={36} />} label="정지" />
            <Tile icon={<Pause size={36} />} label="대기" active />
            <Tile icon={<ShieldOff size={36} />} label="통신두절" />
          </div>
        </div>
      </div>
      {/* ==================================================================== */}

      {/* 중앙: PCS 카드 */}
      <div
        className="absolute rounded-xl border-2 border-[#a9c6d6] px-7 py-5 text-center bg-[#1b2a35] shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
        style={{ left: PCS.x, top: PCS.y, width: PCS.w, height: PCS.h, zIndex: 2 }}
      >
        <div className="text-[44px] text-slate-200 mb-1">PCS #1</div>
      </div>

      {/* 카드 아래 라벨: 0.0 kW */}
      <div
        className="absolute text-center text-white font-extrabold"
        style={{ left: PCS.x, top: PCS.y + PCS.h + 8, width: PCS.w, zIndex: 2 }}
      >
        0.0 kW
      </div>

      {/* PCS → 배터리 라인 */}
      <div
        className="absolute rounded"
        style={{
          left: 1335,
          top: 665,
          width: 200,
          height: 16,
          backgroundImage: "linear-gradient(to right,#38e2cf,#6be7ff)",
          zIndex: 2,
        }}
      />

      {/* 배터리 게이지 */}
      <div className="absolute" style={{ left: BAT.x, top: BAT.y, width: BAT.w, zIndex: 2 }}>
        <div
          className="relative rounded-[16px] bg-[#1e2d3a] border-2 border-[#6e8594] shadow-[inset_0_8px_18px_rgba(0,0,0,0.55)]"
          style={{ height: BAT.h }}
        >
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-[14px] bg-gradient-to-r from-[#3be2cf] to-[#6be7ff]"
            style={{ width: 42, height: 62 }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-white font-extrabold text-[40px]">3.5%</div>
          </div>
          <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 w-3 h-7 rounded bg-[#1e2d3a] border-2 border-[#6e8594]" />
        </div>
      </div>

      {/* SOH / TEMP */}
      <div
        className="absolute text-[16px] space-y-3"
        style={{ left: SOH_TEMP.x, top: SOH_TEMP.y, width: SOH_TEMP.w, zIndex: 3 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-[84px] flex justify-center">
            <Battery size={70} className="text-[#63d8ff]" />
          </div>
          <span className="text-[32px] text-slate-200 font-semibold ml-2">SOH</span>
          <span className="ml-auto font-bold text-[32px] whitespace-nowrap">100%</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-[84px] flex justify-center">
            <Thermometer size={70} className="text-[#63d8ff]" />
          </div>
          <span className="text-[32px] text-slate-200 font-semibold">TEMP</span>
          <span className="ml-auto font-bold text-[32px] whitespace-nowrap">25 ℃</span>
        </div>
      </div>

      {/* BMS 연결 세로 라인 + 박스 */}
      <div
        className="absolute"
        style={{
          left: BMS.x - 10,
          top: BAT.y - 6,
          width: 2,
          height: BAT.h + 22,
          background: "#2a4456",
          borderRadius: 1,
          zIndex: 2,
        }}
      />
      <div
        className="absolute grid place-items-center text-[#69e3ff] font-extrabold text-[36px]"
        style={{
          left: BMS.x,
          top: BMS.y,
          width: BMS.w,
          height: BMS.h,
          background: "#213547",
          border: "1px solid #2b4658",
          borderRadius: 8,
          zIndex: 2,
        }}
      >
        BMS
      </div>
    </div>
  );
};

/* ============ 상단 도넛 5개 ============ */
const DonutTile = ({
  pct = 0,
  ring = "#c7ff3a",
  title = "발전",
  titleColor = "text-[#c5ff46]",
  value = "305",
  unit = "kW",
}) => {
  const angle = Math.max(0, Math.min(100, pct)) * 3.6;
  return (
    <div className="flex items-center px-8 py-6">
      <div className="relative w-[94px] h-[94px] mr-6">
        <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${ring} ${angle}deg, #2e4150 0)` }} />
        <div className="absolute inset-[12px] rounded-full bg-[#15212b] grid place-items-center">
          <span className="text-[16px] font-bold text-slate-100">{pct}%</span>
        </div>
      </div>
      <div className="leading-tight">
        <div className={`text-[20px] font-extrabold ${titleColor}`}>{title}</div>
        <div className="flex items-end gap-1 mt-1">
          <div className="text-[44px] font-extrabold tracking-tight text-slate-100">{value}</div>
          <div className="mb-2 text-[16px] font-semibold text-[#63d8ff]">{unit}</div>
        </div>
      </div>
    </div>
  );
};

/* ============ 메인 ============ */
export default function App() {
  const now = useClock();

  return (
    <div className="min-h-screen w-screen bg-[#0c131a] text-slate-100 overflow-x-hidden">
      {/* 최상단 바 */}
      <div className="w-full bg-[#0c131a] border-b border-[#2a3e4d] text-[13px]">
        <div className="w-full px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-extrabold tracking-tight">
              출력제어 예측 <span className="text-[#69e3ff]">(yousoo)</span>
            </span>
          </div>
          <div className="flex items-center gap-5 text-[#cfe7f6]">
            <span>{now}</span>
            <div className="flex items-center gap-1">
              <Bolt size={16} className="text-[#69e3ff]" />
              800.0 <span className="opacity-80">kWp</span>
            </div>
            <div className="flex items-center gap-1">
              <Battery size={16} className="text-[#69e3ff]" />
              2,660.0 <span className="opacity-80">kWh</span>
            </div>
            <div className="flex items-center gap-1">
              <Thermometer size={16} className="text-[#69e3ff]" />
              26.0 <span className="opacity-80">℃</span>
            </div>
            <button className="flex items-center gap-1">
              <LogOut size={16} /> 로그아웃
            </button>
            <Bell size={16} className="text-[#a6c7da]" />
          </div>
        </div>
      </div>

      {/* 상단 탭 */}
      <div className="w-full bg-[#162430] border-b border-[#2a3e4d] mt-2">
        <nav className="grid grid-cols-9 divide-x divide-[#2a3e4d]">
          <button className="h-12 flex items-center justify-center hover:bg-[#1c2c39]">
            <Home size={18} />
          </button>
          {["PV", "PCS", "BMS", "ESS", "VPP", "보고서", "경보", "설정"].map((t) => (
            <button key={t} className="h-12 text-[#63d8ff] hover:bg-[#1c2c39]">
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* 상단 도넛 5개 */}
      <div className="w-full bg-[#162430] grid grid-cols-5 divide-x divide-[#2a3e4d]">
        <DonutTile pct={38} ring="#c7ff3a" title="발전" value="305" unit="kW" />
        <DonutTile pct={1} ring="#38d0c9" title="충전" value="9" unit="kW" />
        <DonutTile pct={0} ring="#d7925b" title="방전" value="0" unit="kW" />
        <DonutTile pct={37} ring="#a08bff" title="충전" value="296" unit="kW" />
        <div className="flex items-center px-8 py-6">
          <div className="relative w-[94px] h-[94px] mr-6">
            <div className="absolute inset-0 rounded-full bg-[#1c2a36] grid place-items-center">
              <div className="w-10 h-10 rounded-full border-2 border-[#63d8ff] relative">
                <div className="absolute -right-2 -top-2 w-5 h-5 rounded-full border-2 border-[#63d8ff]" />
              </div>
            </div>
          </div>
          <div>
            <div className="text-[18px] font-extrabold text-[#69e3ff]">TEMP ▸</div>
            <div className="flex items-end gap-1 mt-1">
              <div className="text-[44px] font-extrabold">26</div>
              <div className="mb-2 text-[16px] text-[#63d8ff]">℃</div>
            </div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="w-full px-6 mt-3 grid grid-cols-12 gap-3 pb-10">
        <div className="col-span-3 space-y-3">
          <AccumChart />
          <PricePanel />
        </div>
        <div className="col-span-9">
          <ScaledStage designW={2300} designH={560} className="w-full">
            <FlowPanel />
          </ScaledStage>
        </div>
      </div>
    </div>
  );
}
