// src/App.jsx
import PVScreen from "./pages/PVPage";
import ESSPage from "./pages/ESSPage";
import VPPPage from "./pages/VPPPage";
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
  Sun,
  Activity, // ★ 추가: 우측 지표 카드 아이콘
} from "lucide-react";

// ───────── 백엔드 폴링 훅 ─────────
function useBackendStatus(intervalMs = 60000) { // 60초마다 갱신
  const [status, setStatus] = React.useState(null);
  React.useEffect(() => {
    let timer;
    const load = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/status");
        const data = await res.json();
        setStatus(data);
      } catch (e) {
        console.error("API 불러오기 실패:", e);
      }
    };
    load();
    if (intervalMs > 0) timer = setInterval(load, intervalMs);
    return () => timer && clearInterval(timer);
  }, [intervalMs]);
  return status;
}

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

/* ============ 좌측 누적 전력량 (정확 정렬 버전) ============ */
const AccumChart = ({ status }) => {
  const max = 6000;
  const ticks = [0, 2000, 4000, 6000];

  // 안전한 숫자 변환 유틸
  const N = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  // status 매핑 (없으면 0 유지)
  // 단위: 그래프는 전부 kWh로 통일. (제약량은 MWh -> kWh로 변환)
  const gen_today_kwh   = N(status?.energy?.generation_today_kwh, 0);
  const gen_yday_kwh    = N(status?.energy?.generation_yday_kwh, 0);

  const ess_chg_today   = N(status?.energy?.ess_charge_today_kwh, 0);
  const ess_chg_yday    = N(status?.energy?.ess_charge_yday_kwh, 0);

  const ess_dis_today   = N(status?.energy?.ess_discharge_today_kwh, 0);
  const ess_dis_yday    = N(status?.energy?.ess_discharge_yday_kwh, 0);

  const vpp_shed_today  = N(status?.energy?.vpp_shed_today_kwh, 0);
  const vpp_shed_yday   = N(status?.energy?.vpp_shed_yday_kwh, 0);

  // 출력제어: MWh → kWh 환산
  const curtail_today_mwh = N(status?.curtailment?.actual_cum_today, 0);
  const curtail_yday_mwh  = N(status?.curtailment?.actual_yday_total, 0);
  const curtail_today_kwh = curtail_today_mwh * 1000;
  const curtail_yday_kwh  = curtail_yday_mwh * 1000;

  // 차트 항목 (전일/금일 비교 유지)
  const data = [
    { name: "발전량", prev: gen_yday_kwh,     today: gen_today_kwh,  color: "#c5ff46" },
    { name: "ESS 충전",    prev: ess_chg_yday,     today: ess_chg_today,  color: "#63d8ff" },
    { name: "ESS 방전",    prev: ess_dis_yday,     today: ess_dis_today,  color: "#f1a256" },
    { name: "VPP 감축",    prev: vpp_shed_yday,    today: vpp_shed_today, color: "#ae8bff" },
    { name: "출력제어 누적", prev: curtail_yday_kwh, today: curtail_today_kwh, color: "#ff9ab3" },
  ];


  const BAR_H = 20;
  const BAR_GAP = 8;

  const prevStyle  = (base) => ({ background: base, opacity: 0.35 });
  const todayStyle = (base) => ({ background: base, opacity: 0.95 });

  const chartRef = React.useRef(null);
  const plotRef  = React.useRef(null);
  const [plotBox, setPlotBox] = React.useState({ left: 0, width: 0 });

  React.useEffect(() => {
    const sync = () => {
      if (!chartRef.current || !plotRef.current) return;
      const c = chartRef.current.getBoundingClientRect();
      const p = plotRef.current.getBoundingClientRect();
      setPlotBox({ left: p.left - c.left, width: p.width });
    };
    const ro1 = new ResizeObserver(sync);
    const ro2 = new ResizeObserver(sync);
    chartRef.current && ro1.observe(chartRef.current);
    plotRef.current && ro2.observe(plotRef.current);
    sync();
    return () => { ro1.disconnect(); ro2.disconnect(); };
  }, []);

  const tickX = (t) => plotBox.left + (t / max) * plotBox.width;

  return (
    <div className="rounded-[1px] bg-[#162430] border border-[#22394b] overflow-hidden" style={{ height: 460 }}>
      <div className="px-4 py-2 bg-[#14222c] border-b border-[#22394b] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#9fd6ff]" />
        <span className="text-[14px] font-semibold text-[#d7e9f6]">누적 전력량</span>
      </div>

      <div ref={chartRef} className="relative px-4 pt-6 pb-4 h-[375px]">
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-0 bottom-0 border-r"
            style={{ left: `${tickX(t)}px`, borderColor: "#2a3f50", opacity: 0.35 }}
          />
        ))}

        {data.map((row, idx) => {
          const prevPct  = Math.max(0, Math.min(100, (row.prev  / max) * 100));
          const todayPct = Math.max(0, Math.min(100, (row.today / max) * 100));

          return (
            <div key={row.name} className="grid grid-cols-12 items-center gap-2 mb-5">
              <div className="col-span-2 text-[13px] text-slate-200">{row.name}</div>
              <div className="col-span-8">
                <div ref={idx === 0 ? plotRef : null} className="relative overflow-visible" style={{ height: BAR_H*2 + BAR_GAP }}>
                  <div className="absolute left-0 top-0 right-0">
                    <div className="bg-transparent" style={{ height: BAR_H }}>
                      <div className="h-full" style={{ width: `${prevPct}%`, borderRadius: 0, ...prevStyle(row.color) }} />
                    </div>
                  </div>
                  <div className="absolute left-0" style={{ top: BAR_H + BAR_GAP, right: 0 }}>
                    <div className="bg-transparent" style={{ height: BAR_H }}>
                      <div className="h-full" style={{ width: `${todayPct}%`, borderRadius: 0, ...todayStyle(row.color) }} />
                    </div>
                  </div>

                  <div
                    className="absolute text-[12px] text-slate-100"
                    style={{
                      left: `${plotBox.width + 20}px`,
                      top: `${BAR_H/2}px`,
                      transform: "translateY(-50%)",
                      width: 80,
                      textAlign: "left",
                    }}
                  >
                    {row.prev.toLocaleString()}
                  </div>
                  <div
                    className="absolute text-[12px] text-slate-100"
                    style={{
                      left: `${plotBox.width + 20}px`,
                      top: `${BAR_H + BAR_GAP + BAR_H/2}px`,
                      transform: "translateY(-50%)",
                      width: 80,
                      textAlign: "left",
                    }}
                  >
                    {row.today.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="col-span-2" />
            </div>
          );
        })}

        {ticks.map((t) => (
          <span
            key={`label-${t}`}
            className="absolute bottom-0 text-[11px] text-slate-300"
            style={{
              left: `${tickX(t)}px`,
              transform: "translateX(-50%)",
            }}
          >
            {t.toLocaleString()}
          </span>
        ))}

        <div className="mt-12 flex justify-center gap-8 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="w-4 h-2 rounded-sm" style={prevStyle("#9fb6c9")} />
            <span className="text-slate-200">전일</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-2 rounded-sm" style={todayStyle("#c5ff46")} />
            <span className="text-slate-200">금일</span>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ============ 좌측 하단: 금액 패널 (그래프 제거, 2+1 레이아웃) ============ */
const PricePanel = ({ status }) => {
  const smpNow  = Number(status?.economics?.smp_now ?? 0)
  const smpAvg  = Number(status?.economics?.smp_avg ?? 0)
  const recNow  = Number(status?.economics?.rec_now ?? 0)
  const updated = status?.economics?.updated_at ?? ""
  const sumNow  = smpNow + recNow

  return (
    <div className="rounded-[1px] bg-[#1a2a36] border border-[#22394b] p-3 h-[215px]">
      {/* 상단 2카드: SMP / REC */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md bg-[#172633] border border-[#244255] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-slate-300">SMP (현재/일평균)</div>
            <div className="text-[11px] text-slate-400">{updated && `${updated} 갱신`}</div>
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight">
            {smpNow.toLocaleString()} <span className="text-slate-300 text-[12px]">원/kWh</span>
          </div>
          <div className="mt-1 text-[12px] text-slate-400">평균 {smpAvg.toLocaleString()} 원/kWh</div>
        </div>

        <div className="rounded-md bg-[#172633] border border-[#244255] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-slate-300">REC (현물)</div>
            <div className="text-[11px] text-slate-400">{updated && `${updated} 갱신`}</div>
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight">
            {recNow.toLocaleString()} <span className="text-slate-300 text-[12px]">원/kWh</span>
          </div>
        </div>
      </div>

      {/* 하단 합계 */}
      <div className="mt-3 rounded-md bg-[#14222c] border border-[#22394b] p-4 flex items-baseline justify-between">
        <div className="text-[20px] text-slate-300">SMP + REC 금액</div>
        <div className="text-4xl font-black tracking-tight leading-none">
          {sumNow.toLocaleString()} <span className="text-slate-300 text-[16px] font-semibold ml-1">원/kWh</span>
        </div>
      </div>
    </div>
  )
}


/* ============ 하단: 실시간 그래프 패널 (상단 헤더 + 새로고침 버튼) ============ */
const MiddleGraphPanel = () => {
  const data = Array.from({ length: 30 }, (_, i) => ({
    x: i,
    y: Math.max(0, Math.min(300, 150 + Math.sin(i / 3) * 100 + Math.random() * 30)),
  }));

  const W = 520, H = 126.5, padL = 40, padR = 20, padT = 20, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const minY = 0, maxY = 300;

  const path = data
    .map((d, i) => {
      const x = padL + (i / (data.length - 1)) * innerW;
      const y = padT + innerH * (1 - (d.y - minY) / (maxY - minY));
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-[1px] bg-[#1a2a36] border border-[#22394b] h-[215px]">
      <div className="px-3 py-2 bg-[#14222c] border-b border-[#22394b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[#9fd6ff]" />
          <span className="text-[13px] font-semibold text-[#d7e9f6]">
            실시간 그래프 <span className="opacity-70">(1분 주기)</span>
          </span>
        </div>
        <button
          type="button"
          className="p-1.5 rounded border border-[#2a3e4d] hover:bg-[#1b2b36] text-[#cfe7f6]"
          title="새로고침"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="relative m-3 rounded-md bg-[#14222c] border border-[#22394b]">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const y = padT + innerH * t;
            return (
              <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#2a3f50" opacity="0.3" />
            );
          })}
          <path d={path} fill="none" stroke="#69e3ff" strokeWidth="2" />
          {[0, 100, 200, 300].map((val, i) => {
            const y = padT + innerH * (1 - val / maxY);
            return (
              <text key={i} x={5} y={y + 4} fontSize="11" fill="#a8c7d6">
                {val}
              </text>
            );
          })}
        </svg>
        <div className="absolute right-2 bottom-1 text-[11px] text-slate-400">단위: kW</div>
      </div>
    </div>
  );
};

/* ============ 하단: 시스템 로그 패널 (알림 리스트) ============ */
const SystemLogPanel = () => {
  const logs = [
    { id: 1, scope: "BMS[BMS]", time: "2018-08-09 00:01:41", msg: "NPS ( Normal Po… )", level: "info" },
    { id: 2, scope: "PCS[PCS]", time: "2018-07-20 17:17:44", msg: "MC RUN (INV)", level: "warn" },
    { id: 3, scope: "PCS[PCS]", time: "2018-07-20 17:17:44", msg: "INV RUN (INV)", level: "warn" },
  ];

  const colorByLevel = (lv) =>
    lv === "warn" ? "#ffcf77" : lv === "error" ? "#ff8b8b" : "#8fd3ff";

  return (
    <div className="rounded-[1px] bg-[#1a2a36] border border-[#22394b] h-[215px] flex flex-col">
      <div className="px-3 py-2 bg-[#14222c] border-b border-[#22394b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[#9fd6ff]" />
          <span className="text-[13px] font-semibold text-[#d7e9f6]">알람 : 시스템 로그</span>
        </div>
        <button
          type="button"
          className="p-1.5 rounded border border-[#2a3e4d] hover:bg-[#1b2b36] text-[#cfe7f6]"
          title="새로고침"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="px-3 py-2 flex-1 overflow-y-auto">
        {logs.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-12 items-center py-2 border-b border-[#22394b]/60 last:border-b-0"
          >
            <div className="col-span-4 text-[13px] text-[#cfe7f6] truncate">{row.scope}</div>
            <div className="col-span-4 text-[12px] text-slate-400">{row.time}</div>
            <div
              className="col-span-4 text-[13px] font-semibold truncate"
              style={{ color: colorByLevel(row.level) }}
              title={row.msg}
            >
              {row.msg}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============ 지표(아이콘 2단) 컴포넌트 ============ */
const IconMetricGroup = ({ icon, rows }) => (
  <div className="flex items-start gap-4">
    <div className="w-[44px] h-[44px] flex items-center justify-center rounded-lg bg-[#16303b] border border-[#285064]">
      {icon}
    </div>
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

/* ============ FlowPanel (대시보드 메인) ============ */
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

const FlowPanel = ({ status }) => {
  const STAGE = { w: 2300, h: 838 }; // 높이 보정
  const L = { x: 0, y: 670, w: 980, h: 140 };
  const M = { x: L.x + L.w + 20, y: 670, w: 520, h: 140 };
  const R = { x: M.x + M.w, y: 670, w: 800, h: 140 };

  const BOTTOM = { x: L.x, y: 530, w: R.x + R.w - L.x, h: 280 };
  const L_RATIO = (L.w / (L.w + M.w + R.w)) * 100;
  const LM_RATIO = ((L.w + M.w) / (L.w + M.w + R.w)) * 100;

  const PV = { x: 100, y: 186, w: 280 };
  const PIPE = { x: 360, y: 270, w: 1220, h: 40 };
  const PV_LABEL = { x: 650, y: 202 };

  const PCS = { x: 1020, y: 622, w: 320, h: 104 };
  const TOWER = { x: 1500, y: 128, w: 300 };

  const BAT = { x: 1500, y: 600, w: 280, h: 150 };
  const SOH_TEMP = { x: BAT.x + BAT.w + 60, y: BAT.y - 10, w: 280 };
  const BMS = { x: BAT.x + BAT.w + 396, y: BAT.y - 68, w: 110, h: BAT.h + 125 };

  const BRANCH = { x: PIPE.x + 820, y: PIPE.y + PIPE.h - 6, w: 22, h: 318 };

  const TOPBAR = { x: 15, y: 6, w: STAGE.w - 24, h: 102 };

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
      className="relative rounded-md bg-[#1a2a36] border border-[#22394b] p-4 pt-[205px] overflow-visible"
      style={{ width: STAGE.w, height: STAGE.h }}
    >
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
          <MiniPill icon={<Thermometer size={24} className="text-[#69e3ff]" />}>
            <span>온도</span>&nbsp;22.9℃
          </MiniPill>
        </div>
      </div>

      <div
        className="absolute rounded-md border"
        style={{
          left: BOTTOM.x,
          top: BOTTOM.y,
          width: BOTTOM.w-20,
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

      <div className="absolute" style={{ left: PV.x, top: PV.y, zIndex: 10 }}>
        <PVIcon w={PV.w} className="text-slate-200" />
      </div>

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

      <div className="absolute text-[#79e9ff]" style={{ left: 650, top: 202 }}>
        <span className="text-[24px] font-semibold">PV. Meter</span>
        <span className="ml-3 text-white font-extrabold text-[28px] align-middle">305</span>
        <span className="ml-1 text-[#63d8ff] font-semibold text-[20px] align-middle">kW</span>
      </div>

      <div className="absolute flex gap-2" style={{ left: 970, top: 204 }}>
        <div className="h-8 px-3 rounded bg-[#173241] border border-[#295065] text-[24px] text-[#bfefff] flex items-center">
          <Zap size={46} className="mr-1 text-[#69e3ff]" />
          충전 9 kW
        </div>
      </div>

      <div
        className="absolute rounded bg-[#59e6e2]/60"
        style={{ left: BRANCH.x, top: BRANCH.y, width: BRANCH.w, height: 318, zIndex: 2 }}
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

      <div className="absolute" style={{ left: 1500, top: 128 }}>
        <TowerIcon w={300} className="text-slate-200" />
      </div>

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

      {/* 좌측: PCS 운영상태 */}
      <div
        className="absolute flex"
        style={{
          left: 4,
          top: BOTTOM.y + 14,
          width: 980 - 24,
          height: BOTTOM.h - 8,
          zIndex: 2,
        }}
      >
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

      {/* 중앙: PCS 카드 */}
      <div
        className="absolute rounded-xl border-2 border-[#a9c6d6] px-7 py-5 text-center bg-[#1b2a35] shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
        style={{ left: 1020, top: 622, width: 320, height: 104, zIndex: 2 }}
      >
        <div className="text-[44px] text-slate-200 mb-1">PCS #1</div>
      </div>

      <div
        className="absolute text-center text-white font-extrabold"
        style={{ left: 1020, top: 622 + 104 + 8, width: 320, zIndex: 2 }}
      >
        0.0 kW
      </div>

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
      <div className="absolute" style={{ left: 1500, top: 600, width: 280, zIndex: 2 }}>
        <div
          className="relative rounded-[16px] bg-[#1e2d3a] border-2 border-[#6e8594] shadow-[inset_0_8px_18px_rgba(0,0,0,0.55)]"
          style={{ height: 150 }}
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
        style={{ left: 1840, top: 590, width: 280, zIndex: 3 }}
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

      {/* BMS 박스 */}
      <div
        className="absolute"
        style={{
          left: 2190, // BMS.x
          top: 531,   // BMS.y (보정)
          width: 110,
          height: 278,
          background: "#213547",
          border: "1px solid #2b4658",
          borderRadius: 8,
          zIndex: 2,
        }}
      >
        <div className="w-full h-full grid place-items-center text-[#69e3ff] font-extrabold text-[36px]">BMS</div>
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
    <div className="flex items-center px-8 py-3">
      <div className="relative w-[88px] h-[88px] mr-5">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(${ring} ${angle}deg, #2e4150 0)` }}
        />
        <div className="absolute inset-[12px] rounded-full bg-[#15212b] grid place-items-center">
          <span className="text-[13px] font-bold text-slate-100">{pct}%</span>
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
};

/* ============ 본문 라우터: 도넛 아래만 변경 ============ */
const HomeContent = ({ status }) => (
  <div className="w-full px-2 mt-1 grid grid-cols-12 gap-1 pb-4">
    <div className="col-span-3 space-y-1">
      <AccumChart status={status}/>
      <PricePanel status={status}/>
    </div>

    <div className="col-span-9 space-y-2">
      <ScaledStage designW={2300} designH={820} className="w-full">
        <FlowPanel status={status}/>
      </ScaledStage>

      <div className="mt-3.5 flex gap-1">
        <div className="w-2/3">
          <MiddleGraphPanel />
        </div>
        <div className="flex-1">
          <SystemLogPanel />
        </div>
      </div>
    </div>
  </div>
);

// 간단 Placeholder들(필요한 패널로 대체 예정)
const Placeholder = ({ title, desc }) => (
  <div className="px-4 py-10">
    <div className="rounded-lg border border-[#2a3e4d] bg-[#15222b] p-6">
      <div className="text-2xl font-bold mb-2 text-[#9fd6ff]">{title}</div>
      <div className="text-slate-300">{desc}</div>
    </div>
  </div>
);

const PVPlaceholder = () => (
  <div className="w-full px-2 mt-1 pb-4">
    <Placeholder
      title="PV 모듈 페이지"
      desc="여기에 발전소 문자열별 발전량, 일사/온도 상관 분석, 인버터별 효율 그래프 등을 배치합니다."
    />
  </div>
);
const PCSPage = () => (
  <div className="w-full px-2 mt-1 pb-4">
    <Placeholder
      title="PCS 페이지"
      desc="PCS 상태/전환 이력, 유효/무효전력, 모드 전환 제어 영역 등을 배치합니다."
    />
  </div>
);
const BMSPage = () => (
  <div className="w-full px-2 mt-1 pb-4">
    <Placeholder
      title="BMS 페이지"
      desc="셀 밸런싱, 전압/온도 분포, 알람 이력, SOH 추정 차트 등을 배치합니다."
    />
  </div>
);
const ReportPage = () => (
  <div className="w-full px-2 mt-1 pb-4">
    <Placeholder
      title="보고서 페이지"
      desc="일/주/월 리포트 다운로드, KPI 카드, PDF 생성 버튼 등을 배치합니다."
    />
  </div>
);
const AlarmPage = () => (
  <div className="w-full px-2 mt-1 pb-4">
    <Placeholder
      title="경보 페이지"
      desc="실시간 알람 스트림, 필터/검색, Ack/Close 동작(시뮬레이션) 등을 배치합니다."
    />
  </div>
);
const SettingsPage = () => (
  <div className="w-full px-2 mt-1 pb-4">
    <Placeholder
      title="설정 페이지"
      desc="API 키/엔드포인트, 대시보드 테마, 단위/표기 형식 설정 등을 배치합니다."
    />
  </div>
);

const ContentRouter = ({ activeTab }) => {
  switch (activeTab) {
    case "HOME": return <HomeContent />;
    case "PV": return <PVScreen />;
    case "PCS": return <PCSPage />;
    case "BMS": return <BMSPage />;
    case "ESS": return <ESSPage />;
    case "VPP": return <VPPPage />;
    case "보고서": return <ReportPage />;
    case "경보": return <AlarmPage />;
    case "설정": return <SettingsPage />;
    default: return <HomeContent />;
  }
};

/* ============ 메인 ============ */
export default function App() {
  const now = useClock();
  const status = useBackendStatus (60000);
  const [activeTab, setActiveTab] = useState("HOME");

  // ── 상단 도넛 표시값/퍼센트 계산 (status 미연동 시에도 기본값 표시)
const predVal = useMemo(() => Number(status?.curtailment?.pred_today ?? 0).toFixed(1), [status])
const predBase = Number(status?.curtailment?.pred_daily_max ?? status?.curtailment?.pred_today ?? 0) || 1
const predPct = useMemo(() => Math.max(0, Math.min(100, Math.round((Number(predVal) / predBase) * 100))), [predVal, predBase])

const cumVal = useMemo(() => Number(status?.curtailment?.actual_cum_today ?? 0).toFixed(1), [status])
const cumPct = useMemo(() => {
  const p = Number(status?.curtailment?.pred_today ?? 0) || 1
  return Math.max(0, Math.min(100, Math.round((Number(cumVal) / p) * 100)))
}, [cumVal, status])

// 예상 출력제어 '집중' 시간대 (예: "13:00~15:00") + 위험도 퍼센트
const peakWinStr = useMemo(() => {
  const arr = status?.curtailment?.peak_windows
  if (Array.isArray(arr) && arr.length) {
    const { start, end } = arr[0]
    const fmt = (s) => (typeof s === "string" ? s : "")
    return `${fmt(start)}~${fmt(end)}`
  }
  return "-"
}, [status])
const peakRiskPct = useMemo(() => Math.max(0, Math.min(100, Math.round(Number(status?.curtailment?.peak_risk_pct ?? 0)))), [status])

// ESS: 현재 전력(kW) + SOC(%)
const essPower = useMemo(() => Math.round(Number(status?.ess?.power_kw ?? 0)), [status])
const socPct = useMemo(() => Math.max(0, Math.min(100, Math.round(Number(status?.ess?.soc ?? 0)))), [status])

// VPP: 활성/전체 → 가동률(%)
const vppActive = Number(status?.vpp?.active_nodes ?? 0)
const vppTotal  = Number(status?.vpp?.total_nodes ?? 0)
const vppPct    = useMemo(() => (vppTotal ? Math.round((vppActive / vppTotal) * 100) : 0), [vppActive, vppTotal])

  
  const TabButton = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      className={`h-12 flex items-center justify-center transition-colors ${
        active ? "bg-[#1c2c39] text-[#69e3ff] font-semibold" : "hover:bg-[#1c2c39] text-[#cfe7f6]"
      }`}
    >
      {children}
    </button>
  );

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
              <span>26.0</span>
              <span className="opacity-80">℃</span>
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
          <TabButton active={activeTab === "HOME"} onClick={() => setActiveTab("HOME")}>
            <Home size={18} />
          </TabButton>
          {["PV", "PCS", "BMS", "ESS", "VPP", "보고서", "경보", "설정"].map((t) => (
            <TabButton key={t} active={activeTab === t} onClick={() => setActiveTab(t)}>
              {t}
            </TabButton>
          ))}
        </nav>
      </div>

    {/* ▼▼▼ HOME 탭일 때만 도넛 표시 ▼▼▼ */}
    {activeTab === "HOME" && (
      <div className="w-full bg-[#162430] grid grid-cols-5 divide-x divide-[#2a3e4d]">
        {/* ① 예측 출력제어량 (금일 예측 총량) */}
        <DonutTile
          pct={predPct ?? 0}            // [1]에서 만든 파생값(없으면 0)
          ring="#a47dff"
          title="예측 출력제어량"
          value={predVal ?? "0.0"}      // 예: "12.4"
          unit="MWh"
        />

        {/* ② 누적 출력제어량 (금일 현재까지 실측 누적) */}
        <DonutTile
          pct={cumPct ?? 0}
          ring="#ffb84d"
          title="누적 출력제어량"
          value={cumVal ?? "0.0"}
          unit="MWh"
        />

        {/* ③ 예상 제약 시간대 (집중 구간) */}
        <DonutTile
          pct={peakRiskPct ?? 0}        // 위험도/집중도 % (없으면 0)
          ring="#ff6b6b"
          title="예상 제약 시간대"
          value={peakWinStr ?? "-"}     // 예: "13:00~15:00"
          unit=""
        />

        {/* ④ ESS 운전 (현재 충·방전 전력) */}
        <DonutTile
          pct={socPct ?? 0}             // SOC %
          ring="#00c2a8"
          title="ESS 운전"
          value={(essPower ?? 0).toString()} // 예: "35"
          unit="kW"
        />

        {/* ⑤ VPP 가동률 (활성 노드 비율) */}
        <DonutTile
          pct={vppPct ?? 0}             // 가동률 %
          ring="#46b0ff"
          title="VPP 가동률"
          value={(vppPct ?? 0).toString()}
          unit="%"
        />
      </div>
    )}


      {/* ▼▼▼ 도넛 아래만 탭에 따라 변경 ▼▼▼ */}
      {/* ★ ContentRouter 대신 인라인 조건부 렌더링 */}
      <div className="w-full">
        {activeTab === "HOME" && <HomeContent status={status}/>}
        {activeTab === "PV" && <PVScreen />}{/* PV 탭에서 새 페이지 컴포넌트 */}
        {activeTab === "PCS" && <PCSPage />}
        {activeTab === "BMS" && <BMSPage />}
        {activeTab === "ESS" && <ESSPage />}
        {activeTab === "VPP" && <VPPPage />}
        {activeTab === "보고서" && <ReportPage />}
        {activeTab === "경보" && <AlarmPage />}
        {activeTab === "설정" && <SettingsPage />}
      </div>
      {/* ★ 변경 끝 */}

      {/* ★ 변경 끝 */}
    </div>
  );
}
