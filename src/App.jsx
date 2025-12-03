// src/App.jsx
import React, { useEffect, useState, useMemo } from "react";
import ESSPage from "./pages/ESSPage";
import VPPPage from "./pages/VPPPage";
import ReportPage from "./pages/ReportPage";
import {
  Home as HomeIcon,
  Thermometer,
  Bell,
  LogOut,
  Bolt,
  Battery,
  Activity,
  RotateCcw,
} from "lucide-react";

function useBackendStatus(selectedDate, intervalMs = 60000) {
  const [status, setStatus] = React.useState(null);
  React.useEffect(() => {
    let timer;
    const load = async () => {
      try {
        let url = "http://127.0.0.1:8000/api/status";
        if (selectedDate) {
          url += `?date=${selectedDate}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        setStatus(data);
      } catch (e) {
        console.error("API 불러오기 실패:", e);
      }
    };
    load();
    if (intervalMs > 0) timer = setInterval(load, intervalMs);
    return () => timer && clearInterval(timer);
  }, [intervalMs, selectedDate]);
  return status;
}

const pad = (n) => String(n).padStart(2, "0");
const useClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(
    now.getDate()
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )}`;
};

const Tag = ({ children }) => (
  <div className="h-7 px-3 rounded bg-[#173241] border border-[#295065] text-[13px] text-[#bfefff] flex items-center">
    {children}
  </div>
);

const AccumChart = ({ status }) => {
  const max = 6000;
  const ticks = [0, 2000, 4000, 6000];

  const N = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const gen_today_kwh = N(status?.energy?.generation_today_kwh, 0);
  const gen_yday_kwh = N(status?.energy?.generation_yday_kwh, 0);
  const ess_chg_today = N(status?.energy?.ess_charge_today_kwh, 0);
  const ess_chg_yday = N(status?.energy?.ess_charge_yday_kwh, 0);
  const ess_dis_today = N(status?.energy?.ess_discharge_today_kwh, 0);
  const ess_dis_yday = N(status?.energy?.ess_discharge_yday_kwh, 0);
  const vpp_shed_today = N(status?.energy?.vpp_shed_today_kwh, 0);
  const vpp_shed_yday = N(status?.energy?.vpp_shed_yday_kwh, 0);
  const curtail_today_mwh = N(status?.curtailment?.actual_cum_today, 0);
  const curtail_yday_mwh = N(status?.curtailment?.actual_yday_total, 0);
  const curtail_today_kwh = curtail_today_mwh * 1000;
  const curtail_yday_kwh = curtail_yday_mwh * 1000;

  const data = [
    { name: "발전량", prev: gen_yday_kwh, today: gen_today_kwh, color: "#c5ff46" },
    { name: "ESS 충전", prev: ess_chg_yday, today: ess_chg_today, color: "#63d8ff" },
    { name: "ESS 방전", prev: ess_dis_yday, today: ess_dis_today, color: "#f1a256" },
    { name: "VPP 감축", prev: vpp_shed_yday, today: vpp_shed_today, color: "#ae8bff" },
    { name: "출력제어 누적", prev: curtail_yday_kwh, today: curtail_today_kwh, color: "#ff9ab3" },
  ];

  const BAR_H = 20;
  const BAR_GAP = 8;

  const prevStyle = (base) => ({ background: base, opacity: 0.35 });
  const todayStyle = (base) => ({ background: base, opacity: 0.95 });

  const chartRef = React.useRef(null);
  const plotRef = React.useRef(null);
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
    if (chartRef.current) ro1.observe(chartRef.current);
    if (plotRef.current) ro2.observe(plotRef.current);
    sync();
    return () => {
      ro1.disconnect();
      ro2.disconnect();
    };
  }, []);

  const tickX = (t) => plotBox.left + (t / max) * plotBox.width;

  return (
    <div
      className="rounded-[1px] bg-[#162430] border border-[#22394b] overflow-hidden"
      style={{ height: 460 }}
    >
      <div className="h-10 px-4 bg-[#14222c] border-b border-[#22394b] flex items-center gap-2">
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
          const prevPct = Math.max(0, Math.min(100, (row.prev / max) * 100));
          const todayPct = Math.max(0, Math.min(100, (row.today / max) * 100));

          return (
            <div key={row.name} className="grid grid-cols-12 items-center gap-2 mb-5">
              <div className="col-span-2 text-[13px] text-slate-200">{row.name}</div>
              <div className="col-span-8">
                <div
                  ref={idx === 0 ? plotRef : null}
                  className="relative overflow-visible"
                  style={{ height: BAR_H * 2 + BAR_GAP }}
                >
                  <div className="absolute left-0 top-0 right-0">
                    <div className="bg-transparent" style={{ height: BAR_H }}>
                      <div
                        className="h-full"
                        style={{
                          width: `${prevPct}%`,
                          borderRadius: 0,
                          ...prevStyle(row.color),
                        }}
                      />
                    </div>
                  </div>
                  <div
                    className="absolute left-0"
                    style={{ top: BAR_H + BAR_GAP, right: 0 }}
                  >
                    <div className="bg-transparent" style={{ height: BAR_H }}>
                      <div
                        className="h-full"
                        style={{
                          width: `${todayPct}%`,
                          borderRadius: 0,
                          ...todayStyle(row.color),
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="absolute text-[12px] text-slate-100"
                    style={{
                      left: `${plotBox.width + 20}px`,
                      top: `${BAR_H / 2}px`,
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
                      top: `${BAR_H + BAR_GAP + BAR_H / 2}px`,
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

const PricePanel = ({ status }) => {
  const smpNow = Number(status?.economics?.smp_now ?? 0);
  const smpAvg = Number(status?.economics?.smp_avg ?? 0);
  const recNow = Number(status?.economics?.rec_now ?? 0);
  const updated = status?.economics?.updated_at ?? "";
  const unitPrice = smpNow + recNow;

  const predTodayMwh = Number(status?.curtailment?.pred_today ?? 0);
  const actualTodayMwh = Number(status?.curtailment?.actual_cum_today ?? 0);
  const avoidedMwh = Math.max(0, predTodayMwh - actualTodayMwh);
  const avoidedLossWon = avoidedMwh * 1000 * unitPrice * 0.001;

  return (
    <div className="rounded-[1px] bg-[#1a2a36] border border-[#22394b] p-1 h-[225px]">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md bg-[#172633] border border-[#244255] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-slate-300">SMP (현재/일평균)</div>
            <div className="text-[11px] text-slate-400">
              {updated && `${updated} 갱신`}
            </div>
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight">
            {smpNow.toLocaleString()}{" "}
            <span className="text-slate-300 text-[12px]">원/kWh</span>
          </div>
          <div className="mt-1 text-[12px] text-slate-400">
            평균 {smpAvg.toLocaleString()} 원/kWh
          </div>
        </div>

        <div className="rounded-md bg-[#172633] border border-[#244255] p-4">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-slate-300">REC (현물)</div>
            <div className="text-[11px] text-slate-400">
              {updated && `${updated} 갱신`}
            </div>
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight">
            {recNow.toLocaleString()}{" "}
            <span className="text-slate-300 text-[12px]">원/kWh</span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-md bg-[#14222c] border border-[#22394b] p-4 flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <div className="text-[20px] text-slate-300">
            예상 절감액
          </div>
          <div className="text-3xl md:text-4xl font-black tracking-tight leading-none">
            {avoidedLossWon.toLocaleString()}{" "}
            <span className="text-slate-300 text-[14px] md:text-[16px] font-semibold ml-1">
              원 (예상)
            </span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 text-right">
          (예측 {predTodayMwh.toFixed(1)} MWh - 실제 {actualTodayMwh.toFixed(
            1
          )} MWh) × (SMP + REC)
        </div>
      </div>
    </div>
  );
};

const MiddleGraphPanel = ({ status }) => {
  const series = Array.isArray(status?.energy?.curtailment_series)
    ? status.energy.curtailment_series
    : [];

  const data = series.map((p, idx) => ({
    idx,
    label: typeof p.time === "string" ? p.time : `${pad(idx)}:00`,
    value: Number(p.value ?? 0),
  }));

  const W = 520;
  const H = 140;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxY =
    data.length > 0
      ? Math.max(10, Math.max(...data.map((d) => d.value)) * 1.1)
      : 10;
  const minY = 0;

  const getX = (idx) =>
    padL +
    (data.length === 1
      ? innerW / 2
      : (idx / (data.length - 1 || 1)) * innerW);

  const path =
    data.length > 0
      ? data
          .map((d, i) => {
            const x = getX(d.idx);
            const y =
              padT +
              innerH * (1 - (d.value - minY) / (maxY - minY || 1));
            return `${i === 0 ? "M" : "L"}${x},${y}`;
          })
          .join(" ")
      : "";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(
    (t) => Math.round((minY + (maxY - minY) * (1 - t)) / 10) * 10
  );

  const xTickData =
    data.length > 0
      ? data.filter(
          (d, idx) => idx % 3 === 0 || idx === data.length - 1
        )
      : [];

  return (
    <div className="rounded-[1px] bg-[#1a2a36] border border-[#22394b] h-full">
      <div className="px-3 py-2 bg-[#14222c] border-b border-[#22394b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[#9fd6ff]" />
          <span className="text-[13px] font-semibold text-[#d7e9f6]">
            당일 출력제어량 그래프{" "}
            <span className="opacity-70">(시간별, 예측 MWh)</span>
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
        {data.length === 0 ? (
          <div className="h-[140px] flex items-center justify-center text-[12px] text-slate-400">
            출력제어 데이터가 없습니다.
          </div>
        ) : (
          <svg
            width="100%"
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
              const y = padT + innerH * t;
              return (
                <line
                  key={i}
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke="#2a3f50"
                  opacity="0.3"
                />
              );
            })}

            {xTickData.map((d, i) => {
              const x = getX(d.idx);
              return (
                <line
                  key={`xtick-line-${i}`}
                  x1={x}
                  y1={padT}
                  x2={x}
                  y2={padT + innerH}
                  stroke="#2a3f50"
                  opacity="0.2"
                />
              );
            })}

            {path && (
              <path d={path} fill="none" stroke="#69e3ff" strokeWidth="2" />
            )}

            {yTicks.map((val, i) => {
              const y =
                padT +
                innerH * (1 - (val - minY) / (maxY - minY || 1));
              return (
                <text
                  key={i}
                  x={5}
                  y={y + 4}
                  fontSize="11"
                  fill="#a8c7d6"
                >
                  {val}
                </text>
              );
            })}

            {xTickData.map((d, i) => {
              const x = getX(d.idx);
              return (
                <text
                  key={`xtick-label-${i}`}
                  x={x}
                  y={padT + innerH + 16}
                  fontSize="11"
                  fill="#a8c7d6"
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              );
            })}
          </svg>
        )}
        <div className="absolute right-2 bottom-1 text-[11px] text-slate-400">
          단위: MWh
        </div>
      </div>
    </div>
  );
};


const SystemLogPanel = () => {
  return (
    <div className="rounded-[1px] bg-[#1a2a36] border border-[#22394b] h-full">
      <div className="px-3 py-2 bg-[#14222c] border-b border-[#22394b] flex items-center gap-2">
        <Bell size={16} className="text-[#e3f2fd]" />
        <span className="text-[13px] font-semibold text-[#d7e9f6]">
          시스템 로그
        </span>
      </div>

      {/* 로그 내용 비우기 */}
      <div className="p-3 text-[12px] text-slate-400 h-[180px] overflow-y-auto">
        {/* 빈 상태 */}
        <div className="opacity-40 italic">기록된 로그가 없습니다.</div>
      </div>
    </div>
  );
};


const ESSSummaryCard = ({ status }) => {
  const essName = status?.ess?.name ?? "ESS #1";
  const essMode = status?.ess?.mode ?? "시뮬레이션";
  const essAuto = status?.ess?.auto_control ? "자율 제어 사용" : "자율 제어 미사용";
  const soc = Math.max(0, Math.min(100, Math.round(Number(status?.ess?.soc ?? 0))));
  const capacity = status?.ess?.capacity_kwh ?? "-";
  const ratedKw = status?.ess?.rated_kw ?? "-";
  const socMin = status?.ess?.soc_min ?? 0;
  const socMax = status?.ess?.soc_max ?? 100;
  const soh = status?.ess?.soh ?? 100;
  const temp = status?.ess?.temp ?? 25;
  const stateLabel = status?.ess?.state_label ?? "대기";

  return (
    <div className="h-full rounded-[1px] bg-[#162430] border border-[#22394b] flex flex-col overflow-hidden">
      <div className="h-10 px-4 bg-[#14222c] border-b border-[#22394b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Battery className="text-[#69e3ff]" size={18} />
          <span className="text-[14px] font-semibold text-[#e0f1ff]">
            ESS 요약
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Tag>{essName}</Tag>
          <Tag>{essMode}</Tag>
          <Tag>{essAuto}</Tag>
        </div>
      </div>
      <div className="flex flex-1">
        <div className="w-[240px] bg-[#162430] border-r border-[#22394b] flex flex-col items-center justify-center gap-2">
          <div className="text-[18px] text-slate-300">SOC</div>
          <div className="text-[52px] font-extrabold text-white leading-none">
            {soc}
            <span className="text-[32px] ml-1">%</span>
          </div>
          <div className="text-[16px] text-[#4de4a3]">{stateLabel}</div>
        </div>
        <div className="flex-1 px-10 py-6 grid grid-cols-2 gap-y-3 items-center">
          <div className="text-[15px] text-slate-300">정격용량</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white mr-1">
              {capacity}
            </span>
            <span className="text-slate-400 text-[13px]">kWh</span>
          </div>

          <div className="text-[15px] text-slate-300">정격전력</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white mr-1">
              {ratedKw}
            </span>
            <span className="text-slate-400 text-[13px]">kW</span>
          </div>

          <div className="text-[15px] text-slate-300">SOC 제약</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white">
              {socMin}% ~ {socMax}%
            </span>
          </div>

          <div className="text-[15px] text-slate-300">SOH</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white">{soh}%</span>
          </div>

          <div className="text-[15px] text-slate-300">온도</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white mr-1">
              {temp}
            </span>
            <span className="text-slate-400 text-[13px]">℃</span>
          </div>

          <div className="text-[15px] text-slate-300">상태</div>
          <div className="text-[16px] text-right text-[#4de4a3] font-semibold">
            {stateLabel}
          </div>
        </div>
      </div>
    </div>
  );
};

const VPPSummaryCard = ({ status }) => {
  const siteName = status?.vpp?.site_name ?? "산업단지 A";
  const planMin = status?.vpp?.plan_minutes ?? 60;
  const mode = status?.vpp?.mode ?? "자동";
  const totalRamp = status?.vpp?.total_ramp_kw_per_min ?? "-";
  const todayShed = status?.vpp?.shed_today_kwh ?? 0;
  const active = Number(status?.vpp?.active_nodes ?? 0);
  const total = Number(status?.vpp?.total_nodes ?? 0);
  const runPct = total ? Math.round((active / total) * 100) : 0;
  const stateLabel = status?.vpp?.state_label ?? "램프 한계 내 제어";

  return (
    <div className="h-full rounded-[1px] bg-[#162430] border border-[#22394b] flex flex-col overflow-hidden">
      <div className="h-10 px-4 bg-[#14222c] border-b border-[#22394b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HomeIcon className="text-[#69e3ff]" size={18} />
          <span className="text-[14px] font-semibold text-[#e0f1ff]">
            VPP 요약
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Tag>{siteName}</Tag>
          <Tag>제어 계획 {planMin}분</Tag>
          <Tag>{mode}</Tag>
        </div>
      </div>
      <div className="flex flex-1">
        <div className="w-[240px] bg-[#162430] border-r border-[#22394b] flex flex-col items-center justify-center gap-2">
          <div className="text-[18px] text-slate-300">가동률</div>
          <div className="text-[52px] font-extrabold text-white leading-none">
            {runPct}
            <span className="text-[32px] ml-1">%</span>
          </div>
          <div className="text-[15px] text-[#4de4a3]">
            활성 {active} / 전체 {total}
          </div>
        </div>
        <div className="flex-1 px-10 py-6 grid grid-cols-2 gap-y-3 items-center">
          <div className="text-[15px] text-slate-300">총 램프 한계</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white mr-1">
              {totalRamp}
            </span>
            <span className="text-slate-400 text-[13px]">kW/분</span>
          </div>

          <div className="text-[15px] text-slate-300">오늘 감축량</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white mr-1">
              {todayShed}
            </span>
            <span className="text-slate-400 text-[13px]">kWh</span>
          </div>

          <div className="text-[15px] text-slate-300">운영 모드</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white">{mode}</span>
          </div>

          <div className="text-[15px] text-slate-300">자원 수</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white">
              {total}개
            </span>
          </div>

          <div className="text-[15px] text-slate-300">활성 자원</div>
          <div className="text-[16px] text-right">
            <span className="font-semibold text-white">
              {active}개
            </span>
          </div>

          <div className="text-[15px] text-slate-300">상태</div>
          <div className="text-[16px] text-right text-[#4de4a3] font-semibold">
            {stateLabel}
          </div>
        </div>
      </div>
    </div>
  );
};

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
          style={{
            background: `conic-gradient(${ring} ${angle}deg, #2e4150 0)`,
          }}
        />
        <div className="absolute inset-[12px] rounded-full bg-[#15212b] grid place-items-center">
          <span className="text-[13px] font-bold text-slate-100">
            {pct}%
          </span>
        </div>
      </div>
      <div className="leading-tight">
        <div className={`text-[17px] font-extrabold ${titleColor}`}>
          {title}
        </div>
        <div className="flex items-end gap-1 mt-1">
          <div className="text-[38px] font-extrabold tracking-tight text-slate-100">
            {value}
          </div>
          <div className="mb-2 text-[14px] font-semibold text-[#63d8ff]">
            {unit}
          </div>
        </div>
      </div>
    </div>
  );
};

const HomeContent = ({ status }) => (
  <div className="w-full grid grid-cols-12 gap-[5px]">
    <div className="col-span-3 flex flex-col gap-[5px]">
      <AccumChart status={status} />
      <PricePanel status={status} />
    </div>

    <div className="col-span-9 flex flex-col gap-[5px]">
      <div className="grid grid-cols-2 h-[460px] gap-[5px]">
        <ESSSummaryCard status={status} />
        <VPPSummaryCard status={status} />
      </div>

      <div className="grid grid-cols-3 h-[225px] gap-[5px]">
        <div className="col-span-2">
          <MiddleGraphPanel status={status} />
        </div>
        <div className="col-span-1">
          <SystemLogPanel />
        </div>
      </div>
    </div>
  </div>
);

export default function App() {
  const now = useClock();
  const [selectedDate, setSelectedDate] = useState("20251203");
  const status = useBackendStatus(selectedDate, 60000);
  const [activeTab, setActiveTab] = useState("HOME");

  const predVal = useMemo(
    () => Number(status?.curtailment?.pred_today ?? 0).toFixed(1),
    [status]
  );
  const predBase =
    Number(
      status?.curtailment?.pred_daily_max ??
        status?.curtailment?.pred_today ??
        0
    ) || 1;
  const predPct = useMemo(
    () =>
      Math.max(
        0,
        Math.min(
          100,
          Math.round((Number(predVal) / predBase) * 100)
        )
      ),
    [predVal, predBase]
  );

  const peakWinStr = useMemo(() => {
    const arr = status?.curtailment?.peak_windows;
    if (Array.isArray(arr) && arr.length) {
      const { start, end } = arr[0];
      const fmt = (s) => (typeof s === "string" ? s : "");
      return `${fmt(start)}~${fmt(end)}`;
    }
    return "-";
  }, [status]);

  const peakRiskPct = useMemo(
    () =>
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Number(status?.curtailment?.peak_risk_pct ?? 0)
          )
        )
      ),
    [status]
  );

  const essPower = useMemo(
    () => Math.round(Number(status?.ess?.power_kw ?? 0)),
    [status]
  );
  const socPct = useMemo(
    () =>
      Math.max(
        0,
        Math.min(
          100,
          Math.round(Number(status?.ess?.soc ?? 0))
        )
      ),
    [status]
  );

  const vppActive = Number(status?.vpp?.active_nodes ?? 0);
  const vppTotal = Number(status?.vpp?.total_nodes ?? 0);
  const vppPct = useMemo(
    () => (vppTotal ? Math.round((vppActive / vppTotal) * 100) : 0),
    [vppActive, vppTotal]
  );

  const TabButton = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      className={`h-12 flex items-center justify-center transition-colors ${
        active
          ? "bg-[#1c2c39] text-[#69e3ff] font-semibold"
          : "hover:bg-[#1c2c39] text-[#cfe7f6]"
      }`}
    >
      {children}
    </button>
  );

  const dateButtons = [
    { label: "12/01", value: "20251201" },
    { label: "12/02", value: "20251202" },
    { label: "12/03", value: "20251203" },
  ];

  const formatSelectedDate = (v) =>
    `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

  return (
    <div className="min-h-screen w-screen bg-[#0c131a] text-slate-100 overflow-hidden">
      <div className="w-full bg-[#0c131a] border-b border-[#2a3e4d] text-[13px]">
        <div className="w-full px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-extrabold tracking-tight">
              출력제어 예측{" "}
              <span className="text-[#69e3ff]">(yousoo)</span>
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

      <div className="w-full bg-[#162430] border-b border-[#2a3e4d] mt-2">
        <nav className="grid grid-cols-4 divide-x divide-[#2a3e4d]">
          <TabButton
            active={activeTab === "HOME"}
            onClick={() => setActiveTab("HOME")}
          >
            <HomeIcon size={18} />
          </TabButton>
          <TabButton
            active={activeTab === "ESS"}
            onClick={() => setActiveTab("ESS")}
          >
            ESS
          </TabButton>
          <TabButton
            active={activeTab === "VPP"}
            onClick={() => setActiveTab("VPP")}
          >
            VPP
          </TabButton>
          <TabButton
            active={activeTab === "보고서"}
            onClick={() => setActiveTab("보고서")}
          >
            보고서
          </TabButton>
        </nav>
      </div>

      {activeTab === "HOME" && (
        <div className="w-full bg-[#162430] grid grid-cols-4 divide-x divide-[#2a3e4d]">
          <DonutTile
            pct={predPct ?? 0}
            ring="#a47dff"
            title="예측 출력제어량"
            value={predVal ?? "0.0"}
            unit="MWh"
          />
          <DonutTile
            pct={peakRiskPct ?? 0}
            ring="#ff6b6b"
            title="예상 제약 시간대"
            value={peakWinStr ?? "-"}
            unit=""
          />
          <DonutTile
            pct={socPct ?? 0}
            ring="#00c2a8"
            title="ESS 운전"
            value={(essPower ?? 0).toString()}
            unit="kW"
          />
          <DonutTile
            pct={vppPct ?? 0}
            ring="#46b0ff"
            title="VPP 가동률"
            value={(vppPct ?? 0).toString()}
            unit="%"
          />
        </div>
      )}

      <div className="w-full">
        {activeTab === "HOME" && (
          <div className="mt-[5px]">
            <HomeContent status={status} />
          </div>
        )}
        {activeTab === "ESS" && <ESSPage />}
        {activeTab === "VPP" && <VPPPage />}
        {activeTab === "보고서" && <ReportPage />}
      </div>
    </div>
  );
}
