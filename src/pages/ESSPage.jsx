 // src/pages/ESSPage.jsx
import React, { useEffect, useMemo, useState } from "react";

/** 공통 유틸 */
const N = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** 백엔드 엔드포인트 (필요시 경로만 바꾸세요) */
const API_BASE = "http://127.0.0.1:8000";
const GET_URL  = `${API_BASE}/api/ess/config`;
const PUT_URL  = `${API_BASE}/api/ess/config`;
const APPLY_URL= `${API_BASE}/api/ess/apply`;

export default function ESSPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError]     = useState("");

  // 폼 상태
  const [form, setForm] = useState({
    name: "ESS #1",
    mode: "simulate",            // "simulate" | "mqtt"
    mqtt_topic: "essvpp/ess1",   // mode=mqtt 일 때 사용
    auto: true,                  // 자율제어 on/off

    capacity_kwh: 500,
    rated_kw: 250,

    soc_min: 15,
    soc_max: 90,

    c_rate_chg: 0.5,
    c_rate_dis: 0.5,

    eff_chg: 95,    // %
    eff_dis: 95,    // %

    temp_min_c: 0,
    temp_max_c: 45,

    forbid_hours: "12-13, 18-19", // 불가 시간대 문자열
  });

  // 초기 로드: 기존 설정 불러오기
  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(GET_URL);
        if (!res.ok) throw new Error(`GET ${res.status}`);
        const data = await res.json();
        if (stop) return;

        // 백엔드 응답 키와 매핑 (없으면 기존 기본값 유지)
        setForm((prev) => ({
          ...prev,
          ...data, // 동일 키는 자동 치환
        }));
      } catch (e) {
        console.warn("ESS config GET 실패, 기본값으로 표시:", e);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, []);

  // 유효성 검사
  const issues = useMemo(() => {
    const out = [];
    if (!(form.soc_min < form.soc_max)) out.push("SOC 최소 < SOC 최대 이어야 합니다.");
    if (form.capacity_kwh <= 0) out.push("정격용량(kWh)은 0보다 커야 합니다.");
    if (form.rated_kw <= 0) out.push("정격전력(kW)은 0보다 커야 합니다.");
    if (form.eff_chg <= 0 || form.eff_chg > 100) out.push("충전 효율은 0~100% 범위여야 합니다.");
    if (form.eff_dis <= 0 || form.eff_dis > 100) out.push("방전 효율은 0~100% 범위여야 합니다.");
    if (form.temp_min_c >= form.temp_max_c) out.push("온도 최소 < 최대 이어야 합니다.");
    if (form.mode === "mqtt" && !form.mqtt_topic) out.push("MQTT 토픽을 입력하세요.");
    return out;
  }, [form]);

  const handleNum = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value === "" ? "" : N(e.target.value, f[key]) }));
  const handleStr = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const handleBool = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.checked }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      // 숫자/범위 보정
      const payload = {
        ...form,
        soc_min: clamp(N(form.soc_min, 15), 0, 100),
        soc_max: clamp(N(form.soc_max, 90), 0, 100),
        eff_chg: clamp(N(form.eff_chg, 95), 1, 100),
        eff_dis: clamp(N(form.eff_dis, 95), 1, 100),
        c_rate_chg: Math.max(0, N(form.c_rate_chg, 0.5)),
        c_rate_dis: Math.max(0, N(form.c_rate_dis, 0.5)),
        capacity_kwh: Math.max(0.1, N(form.capacity_kwh, 500)),
        rated_kw: Math.max(0.1, N(form.rated_kw, 250)),
        temp_min_c: N(form.temp_min_c, 0),
        temp_max_c: N(form.temp_max_c, 45),
      };

      if (issues.length) throw new Error(issues[0]);
      const res = await fetch(PUT_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`PUT ${res.status}`);
      alert("설정이 저장되었습니다.");
    } catch (e) {
      console.error(e);
      setError(e.message || "저장 실패");
      alert(`저장 실패: ${e.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    setError("");
    try {
      const res = await fetch(APPLY_URL, { method: "POST" });
      if (!res.ok) throw new Error(`APPLY ${res.status}`);
      alert("설정이 적용/반영되었습니다.");
    } catch (e) {
      console.error(e);
      setError(e.message || "적용 실패");
      alert(`적용 실패: ${e.message || ""}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="w-full px-2 mt-1 pb-4">
      <div className="rounded-lg border border-[#2a3e4d] bg-[#15222b] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-bold text-[#9fd6ff]">ESS 운영 설정</div>
          <div className="text-sm text-slate-400">
            {loading ? "서버에서 설정 불러오는 중…" : error ? <span className="text-rose-300">{error}</span> : "Ready"}
          </div>
        </div>

        {/* 1. 기본 정보 */}
        <Section title="기본 정보">
          <Grid2>
            <Field label="ESS 이름">
              <input className="i" value={form.name} onChange={handleStr("name")} />
            </Field>
            <Field label="운영 모드">
              <select className="i" value={form.mode} onChange={handleStr("mode")}>
                <option value="simulate">시뮬레이션</option>
                <option value="mqtt">MQTT</option>
              </select>
            </Field>
            {form.mode === "mqtt" && (
              <Field label="MQTT 토픽">
                <input className="i" value={form.mqtt_topic} onChange={handleStr("mqtt_topic")} placeholder="essvpp/ess1" />
              </Field>
            )}
            <Field label="자율 제어">
              <label className="flex items-center gap-2 text-slate-200">
                <input type="checkbox" checked={form.auto} onChange={handleBool("auto")} />
                사용
              </label>
            </Field>
          </Grid2>
        </Section>

        {/* 2. 정격/제약 */}
        <Section title="정격 및 제약">
          <Grid4>
            <Num label="정격용량 (kWh)" value={form.capacity_kwh} onChange={handleNum("capacity_kwh")} step="10" />
            <Num label="정격전력 (kW)" value={form.rated_kw} onChange={handleNum("rated_kw")} step="10" />
            <Num label="충전 C-rate" value={form.c_rate_chg} onChange={handleNum("c_rate_chg")} step="0.1" />
            <Num label="방전 C-rate" value={form.c_rate_dis} onChange={handleNum("c_rate_dis")} step="0.1" />
          </Grid4>
          <Grid4 className="mt-3">
            <Num label="SOC 최소 (%)" value={form.soc_min} onChange={handleNum("soc_min")} />
            <Num label="SOC 최대 (%)" value={form.soc_max} onChange={handleNum("soc_max")} />
            <Num label="충전 효율 (%)" value={form.eff_chg} onChange={handleNum("eff_chg")} />
            <Num label="방전 효율 (%)" value={form.eff_dis} onChange={handleNum("eff_dis")} />
          </Grid4>
        </Section>

        {/* 3. 안전/온도 */}
        <Section title="안전/온도 한계">
          <Grid4>
            <Num label="온도 최소 (℃)" value={form.temp_min_c} onChange={handleNum("temp_min_c")} />
            <Num label="온도 최대 (℃)" value={form.temp_max_c} onChange={handleNum("temp_max_c")} />
            <Field label="운전 불가 시간대(쉼표 구분)">
              <input
                className="i"
                value={form.forbid_hours}
                onChange={handleStr("forbid_hours")}
                placeholder="예: 12-13, 18-19"
              />
            </Field>
          </Grid4>
        </Section>

        {/* 4. 액션 */}
        <div className="mt-6 flex items-center justify-end gap-2">
          {issues.length > 0 && (
            <div className="text-[12px] text-rose-300 mr-auto">
              ⚠ {issues[0]}
            </div>
          )}
          <button
            className="px-4 py-2 rounded border border-[#2a3e4d] hover:bg-[#1b2b36]"
            onClick={() => window.location.reload()}
            type="button"
          >
            초기화
          </button>
          <button
            className="px-4 py-2 rounded bg-[#1f3949] border border-[#2a3e4d] hover:bg-[#224052] disabled:opacity-50"
            onClick={save}
            disabled={saving || loading || issues.length > 0}
            type="button"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
          <button
            className="px-4 py-2 rounded bg-[#1e4c41] border border-[#26544b] hover:bg-[#1f5b4a] disabled:opacity-50"
            onClick={apply}
            disabled={applying || loading}
            type="button"
          >
            {applying ? "적용 중…" : "적용(시뮬레이터/장비)"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 작고 재사용 가능한 서브 컴포넌트들 */
function Section({ title, children }) {
  return (
    <div className="mt-2">
      <div className="text-lg font-semibold text-[#cfe7f6] mb-2">{title}</div>
      <div className="rounded-md border border-[#2a3e4d] bg-[#162430] p-4">{children}</div>
    </div>
  );
}
function Grid2({ children, className = "" }) {
  return <div className={`grid grid-cols-2 gap-4 ${className}`}>{children}</div>;
}
function Grid4({ children, className = "" }) {
  return <div className={`grid grid-cols-4 gap-4 ${className}`}>{children}</div>;
}
function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-[12px] text-slate-300">{label}</div>
      {children}
    </label>
  );
}
function Num({ label, value, onChange, step = "1" }) {
  return (
    <Field label={label}>
      <input type="number" className="i" value={value} onChange={onChange} step={step} />
    </Field>
  );
}

/** 공통 인풋 스타일 */
const inputBase =
  "w-full h-[38px] px-3 rounded bg-[#14222c] border border-[#22394b] text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2a8fd3]/40";
const style = document?.createElement?.("style");
if (style) {
  style.innerHTML = `.i { ${toCss({
    width: "100%",
    height: "38px",
    padding: "0 12px",
    borderRadius: "6px",
    background: "#14222c",
    border: "1px solid #22394b",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
  })} } .i:focus { box-shadow: 0 0 0 2px rgba(42, 143, 211, 0.4); }`;
  document.head.appendChild(style);
}
function toCss(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v}`)
    .join(";");
}
