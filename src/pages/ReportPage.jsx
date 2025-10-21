import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import exportPdf from "../utils/exportPdf";
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const pad = (n) => String(n).padStart(2, "0");
const nowStr = () => {
  const d = new Date();
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const nf = (v, d = 1) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : "-";
};

const buildDummyCurtail = () =>
  Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    curtail: Math.max(0, Math.round((Math.sin(h / 3) * 2 + 5) * 10) / 10),
  }));
const buildDummyESS = () =>
  Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    charge: Math.max(0, Math.round((Math.max(0, Math.cos(h / 2.6) * 8 + 10)) * 10) / 10),
    discharge: Math.max(0, Math.round((Math.max(0, Math.sin(h / 2.2) * 7 + 6)) * 10) / 10),
  }));

function ChartBox({ height = 260, forPdf = false, children }) {
  const hostRef = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const raw = el.clientWidth || el.getBoundingClientRect().width || 0;
      const w = Math.max(0, Math.floor(raw * (forPdf ? 0.97 : 1)) - (forPdf ? 12 : 0));
      if (w && w !== width) setWidth(w);
    };
    measure();
    if (forPdf) return;
    let rid = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rid);
      rid = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(rid);
      ro.disconnect();
    };
  }, [forPdf, width]);
  return <div ref={hostRef} style={{ height, width: "100%", overflow: "visible" }}>{width > 0 ? children(width, height) : null}</div>;
}

export default function ReportPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [pdfMode, setPdfMode] = useState(false);
  const [pdfKey, setPdfKey] = useState(0);

  const [selected, setSelected] = useState({
    meta: true,
    exec: true,
    kpi: true,
    graphs: true,
    curtail: true,
    pv: true,
    ess: true,
    vpp: true,
    econ: true,
    alarms: true,
    avail: true,
    energy: true,
    concl: true,
    log: true,
  });
  const toggle = (k) => setSelected((p) => ({ ...p, [k]: !p[k] }));

  const plant = {
    name: status?.site?.name ?? "예시 태양광·ESS 플랜트",
    location: status?.site?.location ?? "KOR",
    capacity_pv_kwp: Number(status?.site?.pv_kwp ?? 800),
    capacity_ess_kwh: Number(status?.site?.ess_kwh ?? 2660),
    operator: status?.site?.operator ?? "운영사 미지정",
  };

  const kpi = {
    predMWh: Number(status?.curtailment?.pred_today ?? 3.2),
    cumMWh: Number(status?.curtailment?.actual_cum_today ?? 4.8),
    soc: Math.max(0, Math.min(100, Math.round(Number(status?.ess?.soc ?? 78)))),
    vppPct: (() => {
      const a = Number(status?.vpp?.active_nodes ?? 19);
      const t = Number(status?.vpp?.total_nodes ?? 20);
      return t ? Math.round((a / t) * 100) : 95;
    })(),
  };

  const peakWin = (() => {
    const arr = status?.curtailment?.peak_windows;
    if (Array.isArray(arr) && arr.length) return `${arr[0].start ?? ""}~${arr[0].end ?? ""}`;
    return "-";
  })();
  const peakRisk = Math.round(Number(status?.curtailment?.peak_risk_pct ?? 42));

  const pv = {
    energyMWh: Number(status?.energy?.generation_today_kwh ?? 305) / 1000,
    specificYield: Number(status?.pv?.specific_yield_kWh_kWp ?? 3.2),
    pr: Number(status?.pv?.performance_ratio ?? 0.83),
    tempC: Number(status?.pv?.module_temp ?? 48),
    ambC: Number(status?.pv?.ambient_temp ?? 32),
  };
  const ess = {
    powerKw: Number(status?.ess?.power_kw ?? 35),
    throughput_kWh: Number(status?.ess?.throughput_today_kwh ?? 420),
    cycles: Number(status?.ess?.cycles_today ?? 0.6),
    soh: Math.round(Number(status?.ess?.soh ?? 100)),
    tempC: Number(status?.ess?.tempC ?? 25),
    state: status?.ess?.state ?? "정상",
  };
  const vpp = {
    active: Number(status?.vpp?.active_nodes ?? 19),
    total: Number(status?.vpp?.total_nodes ?? 20),
    availabilityPct: Number(status?.vpp?.availability_pct ?? 98.5),
  };
  const smpNow = Number(status?.economics?.smp_now ?? 143.7);
  const smpAvg = Number(status?.economics?.smp_avg ?? 139.5);
  const recNow = Number(status?.economics?.rec_now ?? 58.2);
  const recAvg = Number(status?.economics?.rec_avg ?? 59.0);
  const estRevenueKRW = Math.max(0, pv.energyMWh * 1000 * (smpNow + recNow));

  const energy = {
    generation_kWh: Number(status?.energy?.generation_today_kwh ?? 305),
    ess_charge_kWh: Number(status?.energy?.ess_charge_today_kwh ?? 120),
    ess_discharge_kWh: Number(status?.energy?.ess_discharge_today_kwh ?? 95),
    vpp_shed_kWh: Number(status?.energy?.vpp_shed_today_kwh ?? 22),
    curtail_kWh: Math.round(Number(status?.curtailment?.actual_cum_today ?? 0) * 1000),
  };

  const dummyCurtailRef = useRef(buildDummyCurtail());
  const dummyESSRef = useRef(buildDummyESS());
  const [chartCurtail, setChartCurtail] = useState(dummyCurtailRef.current);
  const [chartESS, setChartESS] = useState(dummyESSRef.current);

  useEffect(() => {
    const hourly = status?.curtailment?.hourly;
    if (hourly && Array.isArray(hourly) && hourly.length >= 24) {
      const next = hourly.slice(0, 24).map((v, h) => ({
        hour: `${h}:00`,
        curtail: Number.isFinite(+v) ? Math.max(0, Math.round(+v * 10) / 10) : 0,
      }));
      if (JSON.stringify(next) !== JSON.stringify(chartCurtail)) setChartCurtail(next);
    }
  }, [status?.curtailment?.hourly, chartCurtail]);

  useEffect(() => {
    const ch = status?.ess?.charge_kw_series;
    const dis = status?.ess?.discharge_kw_series;
    if (Array.isArray(ch) && Array.isArray(dis) && ch.length >= 24 && dis.length >= 24) {
      const next = Array.from({ length: 24 }, (_, h) => ({
        hour: `${h}:00`,
        charge: Number.isFinite(+ch[h]) ? Math.max(0, Math.round(+ch[h] * 10) / 10) : 0,
        discharge: Number.isFinite(+dis[h]) ? Math.max(0, Math.round(+dis[h] * 10) / 10) : 0,
      }));
      if (JSON.stringify(next) !== JSON.stringify(chartESS)) setChartESS(next);
    }
  }, [status?.ess?.charge_kw_series, status?.ess?.discharge_kw_series, chartESS]);

  const sections = useMemo(() => {
    const list = [
      selected.meta && { id: "meta", title: "플랜트 개요" },
      selected.exec && { id: "exec", title: "요약(Executive Summary)" },
      selected.kpi && { id: "kpi", title: "주요 지표(KPI)" },
      selected.graphs && { id: "graphs", title: "그래프: 출력제어 / ESS 충·방전" },
      selected.curtail && { id: "curtail", title: "출력제어 상세(KPX)" },
      selected.pv && { id: "pv", title: "PV 성능지표" },
      selected.ess && { id: "ess", title: "ESS 성능지표" },
      selected.vpp && { id: "vpp", title: "VPP 현황" },
      selected.econ && { id: "econ", title: "경제성: SMP·REC 및 수익 추정" },
      selected.alarms && { id: "alarms", title: "알람 요약" },
      selected.avail && { id: "avail", title: "가용률/가동률" },
      selected.energy && { id: "energy", title: "에너지 밸런스" },
      selected.concl && { id: "concl", title: "결론 및 권고" },
      selected.log && { id: "log", title: "상세 로그" },
    ].filter(Boolean);
    return list.map((s, i) => ({ ...s, no: i + 1 }));
  }, [selected]);

  const handleExport = async () => {
    if (loading) return;
    setLoading(true);
    setPdfMode(true);
    setTheme("light");
    setPdfKey((k) => k + 1);
    const root = document.getElementById("report-root");
    const prev = { bg: root.style.background, color: root.style.color };
    root.style.background = "#ffffff";
    root.style.color = "#000000";
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const d = new Date();
    const fileName = `report_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.pdf`;
    await exportPdf(root, fileName);
    root.style.background = prev.bg;
    root.style.color = prev.color;
    setTheme("dark");
    setPdfMode(false);
    setLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/status");
        const data = await res.json();
        setStatus(data);
      } catch (_) {}
    };
    load();
  }, []);

  const color = theme === "dark" ? "#dfeaf1" : "#1a1a1a";
  const sub = theme === "dark" ? "rgba(97,138,164,0.95)" : "#616a73";
  const border = theme === "dark" ? "#2a3e4d" : "#dfe6ee";
  const cardBg = theme === "dark" ? "#14222c" : "#fff";
  const gridColor = theme === "dark" ? "rgba(255,255,255,0.12)" : "#e6eef5";

  const sectionStyle = {
    marginBottom: 26,
    padding: pdfMode ? 16 : 12,
    background: cardBg,
    border: `1px solid ${border}`,
    borderRadius: 10,
    breakInside: "avoid",
    pageBreakInside: "avoid",
    WebkitRegionBreakInside: "avoid",
  };

  const rootFixed = pdfMode
    ? {
        width: 790,
        maxWidth: 790,
        margin: "0 auto",
        padding: 20,
      }
    : {};

  const graphsGridCols = pdfMode ? "1fr" : "1fr 1fr";

  return (
    <div className="w-full px-2 mt-1 pb-4">
      <div
        id="report-root"
        style={{
          background: theme === "dark" ? "#162430" : "#ffffff",
          color,
          padding: 28,
          borderRadius: 10,
          lineHeight: 1.7,
          ...rootFixed,
        }}
      >
        <header style={{ position: "relative", marginBottom: 22, paddingRight: 480 }}>
          <div style={{ fontSize: 18, color: sub, marginBottom: 6 }}>일일 운영 리포트</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, whiteSpace: "nowrap", wordBreak: "keep-all" }}>
            {"Curtailment\u00A0/\u00A0ESS\u00B7VPP"}
          </h1>
          <div style={{ fontSize: 13, color: sub, marginTop: 4 }}>생성일시: {nowStr()}</div>
          <div
            data-html2canvas-ignore="true"
            style={{ position: "absolute", right: 0, top: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, maxWidth: 520 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, max-content)", columnGap: 14, rowGap: 6, justifyContent: "end" }}>
              {[
                ["meta", "개요"],
                ["exec", "요약"],
                ["kpi", "KPI"],
                ["graphs", "그래프"],
                ["curtail", "KPX"],
                ["pv", "PV"],
                ["ess", "ESS"],
                ["vpp", "VPP"],
                ["econ", "가격/수익"],
                ["alarms", "알람"],
                ["avail", "가용률"],
                ["energy", "밸런스"],
                ["concl", "결론"],
                ["log", "로그"],
              ].map(([key, label]) => (
                <label key={key} style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={selected[key]} onChange={() => toggle(key)} /> {label}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="px-3 py-2 rounded border border-[#2a3e4d] bg-[#15222b] text-[#cfe7f6]"
              style={{ width: 120, textAlign: "center" }}
            >
              {loading ? "생성 중..." : "PDF 출력"}
            </button>
          </div>
        </header>

        {sections.map((s) => {
          if (s.id === "meta") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>
                  {s.no}. {s.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 10, borderBottom: `1px solid ${border}`, width: 140, color: sub }}>플랜트명</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${border}` }}>{plant.name}</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${border}`, width: 140, color: sub }}>위치</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${border}` }}>{plant.location}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 10, borderBottom: `1px solid ${border}`, color: sub }}>PV 용량</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${border}` }}>{plant.capacity_pv_kwp.toLocaleString()} kWp</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${border}`, color: sub }}>ESS 용량</td>
                      <td style={{ padding: 10, borderBottom: `1px solid ${border}` }}>{plant.capacity_ess_kwh.toLocaleString()} kWh</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 10, color: sub }}>운영사</td>
                      <td style={{ padding: 10 }}>{plant.operator}</td>
                      <td style={{ padding: 10, color: sub }}>보고 기준일</td>
                      <td style={{ padding: 10 }}>{nowStr().slice(0, 10)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            );
          }

          if (s.id === "exec") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li>예측 출력제어량 {nf(kpi.predMWh)} MWh, 금일 누적 {nf(kpi.cumMWh)} MWh.</li>
                  <li>ESS SOC {kpi.soc}% (상태: {ess.state}), 일일 처리량 {nf(ess.throughput_kWh, 0)} kWh, SOH {ess.soh}%.</li>
                  <li>VPP 가동률 {kpi.vppPct}% (활성 {vpp.active}/{vpp.total}), 가용률 {nf(vpp.availabilityPct)}%.</li>
                  <li>SMP {smpNow.toLocaleString()} 원/kWh, REC {recNow.toLocaleString()} 원/kWh, 추정 매출 {estRevenueKRW.toLocaleString()} 원.</li>
                </ul>
              </section>
            );
          }

          if (s.id === "kpi") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>
                  {s.no}. {s.title}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                  {[
                    ["예측 출력제어량", nf(kpi.predMWh), "MWh"],
                    ["누적 출력제어량", nf(kpi.cumMWh), "MWh"],
                    ["ESS SOC", `${kpi.soc}`, "%"],
                    ["VPP 가동률", `${kpi.vppPct}`, "%"],
                  ].map(([k, v, u], i) => (
                    <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 14, overflow: "visible" }}>
                      <div style={{ fontSize: 12, color: sub, marginBottom: 6 }}>{k}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={{ fontSize: 26, fontWeight: 800 }}>{v}</div>
                        <div style={{ fontSize: 12, color: sub }}>{u}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (s.id === "graphs") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px", whiteSpace: "nowrap", wordBreak: "keep-all" }}>
                  {s.no}. {"그래프: 출력제어 / ESS\u00A0\u00B7\u00A0방전"}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: graphsGridCols, gap: 12 }}>
                  <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 12, overflow: "visible", breakInside: "avoid", pageBreakInside: "avoid" }}>
                    <ChartBox height={260} forPdf={pdfMode}>
                      {(w, h) => (
                        <RLineChart key={`curtail-${pdfKey}-${pdfMode ? "pdf" : "screen"}`} width={w} height={h} data={chartCurtail} margin={{ top: 6, right: 18, left: 10, bottom: 12 }}>
                          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tick={{ fill: color, fontSize: 11 }} preserveStartEnd />
                          <YAxis tick={{ fill: color, fontSize: 11 }} />
                          <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ color: "#666" }} />
                          <Legend wrapperStyle={{ fontSize: 12, color }} />
                          <Line type="monotone" dataKey="curtail" name="출력제어(MWh)" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </RLineChart>
                      )}
                    </ChartBox>
                  </div>
                  <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 12, overflow: "visible", breakInside: "avoid", pageBreakInside: "avoid" }}>
                    <ChartBox height={260} forPdf={pdfMode}>
                      {(w, h) => (
                        <RLineChart key={`ess-${pdfKey}-${pdfMode ? "pdf" : "screen"}`} width={w} height={h} data={chartESS} margin={{ top: 6, right: 18, left: 10, bottom: 10 }}>
                          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tick={{ fill: color, fontSize: 11 }} preserveStartEnd />
                          <YAxis tick={{ fill: color, fontSize: 11 }} />
                          <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ color: "#666" }} />
                          <Legend wrapperStyle={{ fontSize: 12, color }} />
                          <Line type="monotone" dataKey="charge" name="충전(kW)" stroke="#16a34a" strokeWidth={2} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="discharge" name="방전(kW)" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </RLineChart>
                      )}
                    </ChartBox>
                  </div>
                </div>
              </section>
            );
          }

          if (s.id === "curtail") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, width: 180, color: sub }}>금일 예측 총량</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{nf(kpi.predMWh)} MWh</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, width: 180, color: sub }}>금일 누적 실측</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{nf(kpi.cumMWh)} MWh</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, color: sub }}>집중 시간대</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{peakWin}</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, color: sub }}>위험도</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{peakRisk}%</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 8, fontSize: 12, color: sub }}>* KPX 제약 통지/예측모델 결과 기반. 실제 운영/수동 개입에 따라 편차 발생 가능.</div>
              </section>
            );
          }

          if (s.id === "pv") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, width: 180, color: sub }}>발전량</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{nf(pv.energyMWh)} MWh</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, width: 180, color: sub }}>특정발전량(SY)</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{nf(pv.specificYield)} kWh/kWp</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, color: sub }}>PR(성능비)</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{nf(pv.pr * 100, 0)} %</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, color: sub }}>모듈/외기 온도</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>
                        {nf(pv.tempC, 0)} ℃ / {nf(pv.ambC, 0)} ℃
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            );
          }

          if (s.id === "ess") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, width: 180, color: sub }}>현재 전력</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{nf(ess.powerKw, 1)} kW</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, width: 180, color: sub }}>일일 처리량</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{nf(ess.throughput_kWh, 0)} kWh</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, color: sub }}>사이클</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{nf(ess.cycles, 2)} cycle</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, color: sub }}>SOH/온도</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>
                        {nf(ess.soh, 0)} % / {nf(ess.tempC, 0)} ℃
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: 12, color: sub }}>상태</td>
                      <td style={{ padding: 12 }}>{ess.state}</td>
                      <td style={{ padding: 12, color: sub }}>SOC</td>
                      <td style={{ padding: 12 }}>{kpi.soc} %</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            );
          }

          if (s.id === "vpp") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, width: 180, color: sub }}>활성/전체 노드</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>
                        {vpp.active} / {vpp.total}
                      </td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}`, width: 180, color: sub }}>가동률</td>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{kpi.vppPct} %</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 12, color: sub }}>가용률</td>
                      <td style={{ padding: 12 }}>{nf(vpp.availabilityPct)} %</td>
                      <td style={{ padding: 12 }}></td>
                      <td style={{ padding: 12 }}></td>
                    </tr>
                  </tbody>
                </table>
              </section>
            );
          }

          if (s.id === "econ") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: theme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f6fa" }}>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: `1px solid ${border}` }}>항목</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: `1px solid ${border}` }}>현재가</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: `1px solid ${border}` }}>평균가</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: `1px solid ${border}` }}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>SMP (원/kWh)</td>
                      <td style={{ padding: 12, textAlign: "right", borderBottom: `1px solid ${border}` }}>{smpNow.toLocaleString()}</td>
                      <td style={{ padding: 12, textAlign: "right", borderBottom: `1px solid ${border}` }}>{smpAvg.toLocaleString()}</td>
                      <td style={{ padding: 12, textAlign: "right", borderBottom: `1px solid ${border}` }}>{(smpNow - smpAvg >= 0 ? "+" : "") + nf(((smpNow - smpAvg) / smpAvg) * 100)}%</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 12 }}>REC (원/kWh)</td>
                      <td style={{ padding: 12, textAlign: "right" }}>{recNow.toLocaleString()}</td>
                      <td style={{ padding: 12, textAlign: "right" }}>{recAvg.toLocaleString()}</td>
                      <td style={{ padding: 12, textAlign: "right" }}>{(recNow - recAvg >= 0 ? "+" : "") + nf(((recNow - recAvg) / recAvg) * 100)}%</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 10, fontSize: 14 }}>
                  <b>추정 매출(금일):</b> {estRevenueKRW.toLocaleString()} 원
                  <span style={{ color: sub }}>  (단순계산: 발전량×(SMP+REC))</span>
                </div>
              </section>
            );
          }

          if (s.id === "alarms") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                  <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px" }}>INFO: {Number(status?.alarms?.info ?? 6)}</div>
                  <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px" }}>WARN: {Number(status?.alarms?.warn ?? 2)}</div>
                  <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px" }}>ERROR: {Number(status?.alarms?.error ?? 0)}</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: theme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f6fa" }}>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: `1px solid ${border}` }}>시간</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: `1px solid ${border}` }}>영역</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: `1px solid ${border}` }}>메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(status?.alarms?.last3 ??
                      [
                        { time: "2025-10-21 10:01", scope: "BMS", msg: "NPS Normal" },
                        { time: "2025-10-21 09:57", scope: "PCS", msg: "INV RUN" },
                        { time: "2025-10-21 09:40", scope: "VPP", msg: "연계 정상" },
                      ]).map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{r.time}</td>
                        <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{r.scope}</td>
                        <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{r.msg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          }

          if (s.id === "avail") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: theme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f6fa" }}>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: `1px solid ${border}` }}>지표</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: `1px solid ${border}` }}>값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["플랜트 가용률", Number(status?.availability?.plant_pct ?? 99.2)],
                      ["PV 가용률", Number(status?.availability?.pv_pct ?? 99.5)],
                      ["ESS 가용률", Number(status?.availability?.ess_pct ?? 98.9)],
                      ["가동률(설비 이용률)", Number(status?.availability?.util_pct ?? 67.4)],
                    ].map(([k, v], i) => (
                      <tr key={i}>
                        <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{k}</td>
                        <td style={{ padding: 12, textAlign: "right", borderBottom: `1px solid ${border}` }}>{nf(v)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          }

          if (s.id === "energy") {
            return (
              <section key={s.id} style={sectionStyle}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: theme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f6fa" }}>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: `1px solid ${border}` }}>항목</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: `1px solid ${border}` }}>kWh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["발전량(PV)", energy.generation_kWh],
                      ["ESS 충전", energy.ess_charge_kWh],
                      ["ESS 방전", energy.ess_discharge_kWh],
                      ["VPP 감축", energy.vpp_shed_kWh],
                      ["출력제어(실측)", energy.curtail_kWh],
                    ].map(([k, v], i) => (
                      <tr key={i}>
                        <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{k}</td>
                        <td style={{ padding: 12, textAlign: "right", borderBottom: `1px solid ${border}` }}>{Number(v).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          }

          if (s.id === "concl") {
            return (
              <section key={s.id} style={{ ...sectionStyle, marginBottom: 6 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li>제약 집중 시간({peakWin}) 전·후 ESS 충/방전 스케줄 최적화로 제약 대응 강화 권고.</li>
                  <li>PR/특정발전량 저하 시(모듈온도↑) 청소/냉각 주기 점검 필요.</li>
                  <li>REC 약세 시 SMP 편중 전략 및 장기계약/헤지 병행 고려.</li>
                </ul>
              </section>
            );
          }

          if (s.id === "log") {
            return (
              <section key={s.id} style={{ ...sectionStyle, marginBottom: 6 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
                  {s.no}. {s.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: theme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f6fa" }}>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: `1px solid ${border}` }}>시간</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: `1px solid ${border}` }}>영역</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: `1px solid ${border}` }}>메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(status?.logs ??
                      [
                        { time: "2025-10-21 10:01", scope: "BMS", msg: "NPS Normal" },
                        { time: "2025-10-21 09:57", scope: "PCS", msg: "INV RUN" },
                        { time: "2025-10-21 09:40", scope: "VPP", msg: "연계 정상" },
                      ]).slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{r.time}</td>
                        <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{r.scope}</td>
                        <td style={{ padding: 12, borderBottom: `1px solid ${border}` }}>{r.msg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
