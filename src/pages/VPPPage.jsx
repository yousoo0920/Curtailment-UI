// src/pages/VPPPage.jsx
import React, { useEffect, useMemo, useState } from "react";

/** ===== 유틸 ===== */
const N = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** ===== 백엔드 엔드포인트 (필요시 경로 수정) ===== */
const API_BASE  = "http://127.0.0.1:8000";
const GET_URL   = `${API_BASE}/api/vpp/config`;   // GET: 전체 설정/자원 목록
const PUT_URL   = `${API_BASE}/api/vpp/config`;   // PUT: 저장
const APPLY_URL = `${API_BASE}/api/vpp/apply`;    // POST: 적용

/** ===== 메인 컴포넌트 ===== */
export default function VPPPage() {
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [applying, setApplying]   = useState(false);
  const [error, setError]         = useState("");

  // 상위 VPP 설정 + 자원 배열(resources)
  const [form, setForm] = useState({
    site_name: "산업단지 A",
    auto: true,                 // 자율 제어
    control_horizon_min: 60,    // 제어 계획 지평 (분)
    ramp_limit_kw_per_min: 100, // 전체 램프 한계
    resources: [
      {
        id: "LOAD1",
        name: "항온항습기 #1",
        type: "HVAC",           // HVAC | CHILLER | EVCS | PROCESS | ETC
        enabled: true,
        shed_kw: 120,           // 감축 가능 전력 (kW)
        min_on_min: 10,         // 최소 연속 가동 시간
        min_off_min: 10,        // 최소 연속 정지 시간
        ramp_kw_per_min: 30,    // 램프율
        forbidden_hours: "12-13", // 불가 시간대
        penalty_won_per_kwh: 0, // 생산/품질 패널티 비용 (원/kWh)
        priority: 50,           // 우선순위(0~100)
        mode: "auto",           // auto | manual
      },
    ],
  });

  /** ===== 초기 로드 ===== */
  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(GET_URL);
        if (!r.ok) throw new Error(`GET ${r.status}`);
        const data = await r.json();
        if (stop) return;
        setForm((prev) => ({ ...prev, ...data })); // 동일 키 자동 병합
      } catch (e) {
        console.warn("VPP config GET 실패, 기본값으로 표시:", e);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, []);

  /** ===== 유효성 검사 ===== */
  const issues = useMemo(() => {
    const out = [];
    if (form.control_horizon_min <= 0) out.push("제어 계획 지평(분)은 0보다 커야 합니다.");
    form.resources.forEach((r, idx) => {
      if (!r.name) out.push(`자원 ${idx + 1}의 이름을 입력하세요.`);
      if (N(r.shed_kw) <= 0) out.push(`자원 ${idx + 1}의 감축 가능 전력(kW)을 입력하세요.`);
      if (r.min_on_min < 0 || r.min_off_min < 0) out.push(`자원 ${idx + 1}의 최소 on/off 시간은 0 이상이어야 합니다.`);
      if (r.priority < 0 || r.priority > 100) out.push(`자원 ${idx + 1}의 우선순위는 0~100 범위여야 합니다.`);
    });
    return out;
  }, [form]);

  /** ===== 핸들러 ===== */
  const setField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setNum   = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value === "" ? "" : N(e.target.value, f[key]) }));

  const updateRes = (idx, patch) => {
    setForm((f) => {
      const next = [...f.resources];
      next[idx]  = { ...next[idx], ...patch };
      return { ...f, resources: next };
    });
  };
  const addRes = () => {
    setForm((f) => ({
      ...f,
      resources: [
        ...f.resources,
        {
          id: `RES${f.resources.length + 1}`,
          name: "",
          type: "ETC",
          enabled: true,
          shed_kw: 0,
          min_on_min: 0,
          min_off_min: 0,
          ramp_kw_per_min: 0,
          forbidden_hours: "",
          penalty_won_per_kwh: 0,
          priority: 50,
          mode: "auto",
        },
      ],
    }));
  };
  const removeRes = (idx) => {
    setForm((f) => {
      const next = [...f.resources];
      next.splice(idx, 1);
      return { ...f, resources: next };
    });
  };

  /** ===== 저장 / 적용 ===== */
  const save = async () => {
    try {
      if (issues.length) throw new Error(issues[0]);

      setSaving(true);
      setError("");
      const payload = {
        ...form,
        control_horizon_min: Math.max(1, N(form.control_horizon_min, 60)),
        ramp_limit_kw_per_min: Math.max(0, N(form.ramp_limit_kw_per_min, 100)),
        resources: form.resources.map((r) => ({
          ...r,
          shed_kw: Math.max(0, N(r.shed_kw, 0)),
          min_on_min: Math.max(0, N(r.min_on_min, 0)),
          min_off_min: Math.max(0, N(r.min_off_min, 0)),
          ramp_kw_per_min: Math.max(0, N(r.ramp_kw_per_min, 0)),
          penalty_won_per_kwh: Math.max(0, N(r.penalty_won_per_kwh, 0)),
          priority: clamp(N(r.priority, 50), 0, 100),
        })),
      };

      const r = await fetch(PUT_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`PUT ${r.status}`);
      alert("VPP 설정이 저장되었습니다.");
    } catch (e) {
      console.error(e);
      setError(e.message || "저장 실패");
      alert(`저장 실패: ${e.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    try {
      setApplying(true);
      setError("");
      const r = await fetch(APPLY_URL, { method: "POST" });
      if (!r.ok) throw new Error(`APPLY ${r.status}`);
      alert("VPP 설정이 적용/반영되었습니다.");
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
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-bold text-[#9fd6ff]">VPP 자원 설정</div>
          <div className="text-sm text-slate-400">
            {loading ? "서버에서 설정 불러오는 중…" : error ? <span className="text-rose-300">{error}</span> : "Ready"}
          </div>
        </div>

        {/* 상위 설정 */}
        <Section title="VPP 기본 설정">
          <div className="grid grid-cols-4 gap-4">
            <Field label="사업장 이름">
              <input className="i" value={form.site_name} onChange={setField("site_name")} />
            </Field>
            <Field label="자율 제어">
              <label className="flex items-center gap-2 text-slate-200">
                <input type="checkbox" checked={form.auto} onChange={setField("auto")} />
                사용
              </label>
            </Field>
            <Num label="제어 계획 지평 (분)" value={form.control_horizon_min} onChange={setNum("control_horizon_min")} />
            <Num label="전체 램프 한계 (kW/분)" value={form.ramp_limit_kw_per_min} onChange={setNum("ramp_limit_kw_per_min")} />
          </div>
        </Section>

        {/* 자원 리스트 */}
        <Section title="자원 목록">
          <div className="space-y-3">
            {form.resources.map((r, idx) => (
              <ResourceCard
                key={r.id || idx}
                idx={idx}
                res={r}
                onChange={(patch) => updateRes(idx, patch)}
                onRemove={() => removeRes(idx)}
              />
            ))}
            <div className="mt-2">
              <button
                type="button"
                onClick={addRes}
                className="px-3 py-2 rounded bg-[#1f3949] border border-[#2a3e4d] hover:bg-[#224052]"
              >
                + 자원 추가
              </button>
            </div>
          </div>
        </Section>

        {/* 액션 */}
        <div className="mt-6 flex items-center justify-end gap-2">
          {issues.length > 0 && (
            <div className="text-[12px] text-rose-300 mr-auto">⚠ {issues[0]}</div>
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
            {applying ? "적용 중…" : "적용(스케줄러/장비)"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** ===== 자원 카드 ===== */
function ResourceCard({ idx, res, onChange, onRemove }) {
  const set   = (k) => (e) => onChange({ [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setNum= (k) => (e) => onChange({ [k]: e.target.value === "" ? "" : N(e.target.value, res[k]) });

  return (
    <div className="rounded-md border border-[#2a3e4d] bg-[#162430] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold text-[#cfe7f6]">
          자원 #{idx + 1} {res.name ? `· ${res.name}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-slate-200 text-[13px]">
            <input type="checkbox" checked={!!res.enabled} onChange={set("enabled")} /> 활성
          </label>
          <button
            onClick={onRemove}
            type="button"
            className="px-2 py-1 rounded border border-[#2a3e4d] text-[12px] hover:bg-[#1b2b36]"
          >
            삭제
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Field label="자원 이름">
          <input className="i" value={res.name ?? ""} onChange={set("name")} placeholder="예: 항온항습기 #1" />
        </Field>
        <Field label="자원 유형">
          <select className="i" value={res.type ?? "ETC"} onChange={set("type")}>
            <option value="HVAC">HVAC</option>
            <option value="CHILLER">CHILLER</option>
            <option value="EVCS">EVCS(충전)</option>
            <option value="PROCESS">공정</option>
            <option value="ETC">기타</option>
          </select>
        </Field>
        <Field label="제어 모드">
          <select className="i" value={res.mode ?? "auto"} onChange={set("mode")}>
            <option value="auto">자동</option>
            <option value="manual">수동</option>
          </select>
        </Field>
        <Num label="감축 가능 전력 (kW)" value={res.shed_kw ?? 0} onChange={setNum("shed_kw")} step="10" />
      </div>

      <div className="grid grid-cols-4 gap-4 mt-3">
        <Num label="최소 가동 시간 (분)" value={res.min_on_min ?? 0} onChange={setNum("min_on_min")} />
        <Num label="최소 정지 시간 (분)" value={res.min_off_min ?? 0} onChange={setNum("min_off_min")} />
        <Num label="램프율 (kW/분)" value={res.ramp_kw_per_min ?? 0} onChange={setNum("ramp_kw_per_min")} />
        <Field label="불가 시간대(쉼표 구분)">
          <input className="i" value={res.forbidden_hours ?? ""} onChange={set("forbidden_hours")} placeholder="예: 12-13, 18-19" />
        </Field>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-3">
        <Num label="품질/생산 패널티 (원/kWh)" value={res.penalty_won_per_kwh ?? 0} onChange={setNum("penalty_won_per_kwh")} step="10" />
        <Num label="우선순위 (0~100)" value={res.priority ?? 50} onChange={setNum("priority")} />
      </div>
    </div>
  );
}

/** ===== 공용 폼 컴포넌트 ===== */
function Section({ title, children }) {
  return (
    <div className="mt-2">
      <div className="text-lg font-semibold text-[#cfe7f6] mb-2">{title}</div>
      <div className="rounded-md border border-[#2a3e4d] bg-[#162430] p-4">{children}</div>
    </div>
  );
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

/** ===== 입력 공통 스타일 (간단 class) ===== */
const styleOnce = (() => {
  if (typeof document === "undefined") return;
  const el = document.createElement("style");
  el.innerHTML = `
    .i {
      width: 100%;
      height: 38px;
      padding: 0 12px;
      border-radius: 6px;
      background: #14222c;
      border: 1px solid #22394b;
      color: rgba(255,255,255,0.92);
      outline: none;
    }
    .i:focus { box-shadow: 0 0 0 2px rgba(42,143,211,0.4); }
  `;
  document.head.appendChild(el);
  return true;
})();
