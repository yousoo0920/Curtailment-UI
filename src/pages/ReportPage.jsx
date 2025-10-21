// src/pages/ReportPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import exportPdf from "../utils/exportPdf";
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const pad = (n) => String(n).padStart(2, "0");
const nowStr = () => {
  const d = new Date();
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};

export default function ReportPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // 차트 애니메이션/테마 (UI=dark, PDF=light)
  const [chartAnim, setChartAnim] = useState(true);
  const [theme, setTheme] = useState("dark"); // "dark" | "light"

  // 표시할 섹션 토글
  const [selected, setSelected] = useState({
    kpi: true,
    graph: true,
    economics: true,
    summary: true,
    log: true,
  });
  const toggle = (k) => setSelected((p) => ({ ...p, [k]: !p[k] }));

  // 동적 섹션 정의 + 번호 재부여
  const sections = useMemo(() => {
    const list = [
      selected.kpi && { id: "kpi", title: "주요 지표 요약 (KPI)" },
      selected.graph && { id: "graph", title: "발전량 및 충·방전 그래프" },
      selected.economics && { id: "economics", title: "SMP · REC 시세 현황" },
      selected.summary && { id: "summary", title: "운영 요약" },
      selected.log && { id: "log", title: "알림 로그" },
    ].filter(Boolean);
    return list.map((s, i) => ({ ...s, no: i + 1 }));
  }, [selected]);

  // 샘플 KPI (원하면 status에서 매핑해서 사용)
  const kpiData = {
    pred: Number(status?.curtailment?.pred_today ?? 3.2),
    cum: Number(status?.curtailment?.actual_cum_today ?? 4.8),
    soc: Math.round(Number(status?.ess?.soc ?? 78)),
    vpp: (() => {
      const a = Number(status?.vpp?.active_nodes ?? 19);
      const t = Number(status?.vpp?.total_nodes ?? 20);
      return t ? Math.round((a / t) * 100) : 95;
    })(),
  };

  // 시간대 축 0~23
  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => `${h}:00`), []);

  // 출력제어/ESS 시리즈 (status 있으면 반영, 없으면 더미)
  const seriesCurtail = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${h}:00`,
      curtail: Math.max(
        0,
        Math.round(((status?.curtailment?.hourly?.[h] ?? Math.sin(h / 3) * 2 + 5 + (Math.random() * 1 - 0.5))) * 10) /
          10
      ),
    }));
  }, [status]);

  const seriesESS = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${h}:00`,
      charge: Math.max(
        0,
        Math.round(((status?.ess?.charge_kw_series?.[h] ?? Math.max(0, Math.cos(h / 2.6) * 8 + 10))) * 10) / 10
      ),
      discharge: Math.max(
        0,
        Math.round(((status?.ess?.discharge_kw_series?.[h] ?? Math.max(0, Math.sin(h / 2.2) * 7 + 6))) * 10) / 10
      ),
    }));
  }, [status]);

  // 가격 파트(샘플 + status 반영)
  const smpNow = Number(status?.economics?.smp_now ?? 143.7);
  const smpAvg = Number(status?.economics?.smp_avg ?? 139.5);
  const recNow = Number(status?.economics?.rec_now ?? 58.2);
  const recAvg = Number(status?.economics?.rec_avg ?? 59.0);

  const handleExport = async () => {
    if (loading) return;
    setLoading(true);

    // 1) PDF 전용 테마로 전환 & 애니메이션 OFF
    setChartAnim(false);
    setTheme("light");

    const root = document.getElementById("report-root");
    const prev = { bg: root.style.background, color: root.style.color };
    root.style.background = "#ffffff";
    root.style.color = "#000000";

    // 2) 한 프레임 기다렸다가 캡처(차트/폰트 적용 보장)
    await new Promise((r) => setTimeout(r, 50));

    // 3) 저장
    const d = new Date();
    const fileName = `report_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
      d.getHours()
    )}-${pad(d.getMinutes())}.pdf`;
    await exportPdf(root, fileName);

    // 4) 복원
    root.style.background = prev.bg;
    root.style.color = prev.color;
    setTheme("dark");
    setChartAnim(true);
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

  // 테마 색상
  const color = theme === "dark" ? "#cfe7f6" : "#111";
  const sub = theme === "dark" ? "rgba(207,231,246,0.7)" : "#555";
  const cardBorder = theme === "dark" ? "#2a3e4d" : "#e4e9ef";
  const gridColor = theme === "dark" ? "rgba(255,255,255,0.12)" : "#e6eef5";

  return (
    <div className="w-full px-2 mt-1 pb-4">
      <div
        id="report-root"
        style={{
          borderRadius: 8,
          padding: 24,
          background: theme === "dark" ? "#162430" : "#ffffff",
          color,
        }}
      >
        {/* 헤더 */}
        <header style={{ position: "relative", marginBottom: 24, paddingRight: 320 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>일일 운영 리포트</h1>
          <p style={{ fontSize: 14, color: sub }}>생성일시: {nowStr()}</p>

          {/* 오른쪽 상단 컨트롤(체크박스 → 한 줄, 버튼은 우측 끝) */}
          <div
            data-html2canvas-ignore="true"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
              maxWidth: 300,
            }}
          >
            {/* 체크박스 한 줄 */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={selected.kpi} onChange={() => toggle("kpi")} /> KPI
              </label>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={selected.graph} onChange={() => toggle("graph")} /> 그래프
              </label>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={selected.economics} onChange={() => toggle("economics")} /> 가격표
              </label>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={selected.summary} onChange={() => toggle("summary")} /> 요약
              </label>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={selected.log} onChange={() => toggle("log")} /> 로그
              </label>
            </div>

            {/* PDF 버튼 */}
            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="px-3 py-2 rounded border border-[#2a3e4d] bg-[#15222b] text-[#cfe7f6]"
              style={{ width: 96, textAlign: "center" }}
            >
              {loading ? "생성 중..." : "PDF 출력"}
            </button>
          </div>
        </header>

        {/* 섹션 렌더 */}
        {sections.map((sec) => {
          if (sec.id === "kpi") {
            return (
              <section key={sec.id} style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                  {sec.no}. {sec.title}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                  {[
                    ["예측 출력제어량", `${kpiData.pred}`, "MWh"],
                    ["누적 출력제어량", `${kpiData.cum}`, "MWh"],
                    ["ESS SOC", `${kpiData.soc}`, "%"],
                    ["VPP 가동률", `${kpiData.vpp}`, "%"],
                  ].map(([k, v, u], i) => (
                    <div key={i} style={{ border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 16 }}>
                      <div style={{ fontSize: 13, color: sub, marginBottom: 6 }}>{k}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div style={{ fontSize: 30, fontWeight: 800 }}>{v}</div>
                        <div style={{ fontSize: 12, color: sub }}>{u}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (sec.id === "graph") {
            return (
              <section key={sec.id} style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                  {sec.no}. {sec.title}
                </h2>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* 1) 출력제어 추이 */}
                  <div style={{ border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RLineChart data={seriesCurtail} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tick={{ fill: color, fontSize: 11 }} />
                          <YAxis tick={{ fill: color, fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ fontSize: 12 }}
                            labelStyle={{ color: "#666" }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12, color }} />
                          <Line
                            type="monotone"
                            dataKey="curtail"
                            name="출력제어(MWh)"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={chartAnim}
                          />
                        </RLineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 2) ESS 충/방전 */}
                  <div style={{ border: `1px solid ${cardBorder}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RLineChart data={seriesESS} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                          <XAxis dataKey="hour" tick={{ fill: color, fontSize: 11 }} />
                          <YAxis tick={{ fill: color, fontSize: 11 }} />
                          <Tooltip contentStyle={{ fontSize: 12 }} labelStyle={{ color: "#666" }} />
                          <Legend wrapperStyle={{ fontSize: 12, color }} />
                          <Line
                            type="monotone"
                            dataKey="charge"
                            name="충전(kW)"
                            stroke="#16a34a"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={chartAnim}
                          />
                          <Line
                            type="monotone"
                            dataKey="discharge"
                            name="방전(kW)"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={chartAnim}
                          />
                        </RLineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </section>
            );
          }

          if (sec.id === "economics") {
            return (
              <section key={sec.id} style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                  {sec.no}. {sec.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: theme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f6fa" }}>
                      <th style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${cardBorder}` }}>구분</th>
                      <th style={{ textAlign: "right", padding: 10, borderBottom: `1px solid ${cardBorder}` }}>현재가</th>
                      <th style={{ textAlign: "right", padding: 10, borderBottom: `1px solid ${cardBorder}` }}>평균가</th>
                      <th style={{ textAlign: "center", padding: 10, borderBottom: `1px solid ${cardBorder}` }}>변동률</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: 10, borderBottom: `1px solid ${cardBorder}` }}>SMP (원/kWh)</td>
                      <td style={{ padding: 10, textAlign: "right", borderBottom: `1px solid ${cardBorder}` }}>
                        {smpNow.toLocaleString()}
                      </td>
                      <td style={{ padding: 10, textAlign: "right", borderBottom: `1px solid ${cardBorder}` }}>
                        {smpAvg.toLocaleString()}
                      </td>
                      <td style={{ padding: 10, textAlign: "center", color: "#22c55e", borderBottom: `1px solid ${cardBorder}` }}>
                        {((smpNow - smpAvg) / smpAvg * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: 10 }}>REC (원/kWh)</td>
                      <td style={{ padding: 10, textAlign: "right" }}>{recNow.toLocaleString()}</td>
                      <td style={{ padding: 10, textAlign: "right" }}>{recAvg.toLocaleString()}</td>
                      <td style={{ padding: 10, textAlign: "center", color: "#ef4444" }}>
                        {((recNow - recAvg) / recAvg * 100).toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            );
          }

          if (sec.id === "summary") {
            return (
              <section key={sec.id} style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                  {sec.no}. {sec.title}
                </h2>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: color }}>
                  금일 예측 출력제어량은 {kpiData.pred} MWh, 누적 {kpiData.cum} MWh로 집계. ESS는 평균 SOC {kpiData.soc}%를 유지.
                  SMP는 {smpNow} 원/kWh, REC는 {recNow} 원/kWh 수준. 전체 출력제어는 안정적이며, ESS 운전은 계획대로 수행됨.
                </p>
              </section>
            );
          }

          if (sec.id === "log") {
            return (
              <section key={sec.id} style={{ marginBottom: 6 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                  {sec.no}. {sec.title}
                </h2>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: theme === "dark" ? "rgba(255,255,255,0.06)" : "#f3f6fa" }}>
                      <th style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${cardBorder}` }}>시간</th>
                      <th style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${cardBorder}` }}>영역</th>
                      <th style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${cardBorder}` }}>메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { time: "2025-10-21 10:01", scope: "BMS", msg: "NPS Normal" },
                      { time: "2025-10-21 09:57", scope: "PCS", msg: "INV RUN" },
                      { time: "2025-10-21 09:40", scope: "VPP", msg: "연계 정상" },
                    ].map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: 10, borderBottom: `1px solid ${cardBorder}` }}>{r.time}</td>
                        <td style={{ padding: 10, borderBottom: `1px solid ${cardBorder}` }}>{r.scope}</td>
                        <td style={{ padding: 10, borderBottom: `1px solid ${cardBorder}` }}>{r.msg}</td>
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
