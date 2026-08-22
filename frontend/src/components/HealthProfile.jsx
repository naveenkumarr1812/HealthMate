import { useState, useEffect, useCallback } from "react";
import { User, Plus, X, Save, Loader2, CheckCircle, AlertCircle, Heart, Activity, TrendingUp, Trash2, Calendar } from "lucide-react";
import { supabase } from "../api/supabaseClient";

const COMMON_CONDITIONS = [
  "Type 2 Diabetes","Hypertension","Asthma","Heart Disease",
  "Thyroid Disorder","Anemia","Arthritis","Depression",
  "PCOS","High Cholesterol","Kidney Disease","Liver Disease",
  "Migraine","Obesity","Sleep Apnea",
];
const COMMON_ALLERGIES = [
  "Penicillin","Sulfa drugs","Aspirin","Ibuprofen",
  "Latex","Nuts","Shellfish","Eggs","Dairy","Codeine","Pollen","Dust",
];

function TagInput({ label, values, setValues, suggestions, placeholder }) {
  const [val, setVal] = useState("");

  const add = (v) => {
    const t = v.trim();
    if (t && !values.includes(t)) setValues([...values, t]);
    setVal("");
  };
  const remove = (v) => setValues(values.filter((x) => x !== v));

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">{label}</label>

      {/* Current tags */}
      <div className="flex flex-wrap gap-2 mb-3 min-h-[34px]">
        {values.length === 0 && (
          <span className="text-xs text-gray-400 dark:text-slate-500 py-1 italic">None added yet</span>
        )}
        {values.map((v) => (
          <span key={v}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900/50 font-medium">
            {v}
            <button onClick={() => remove(v)} className="hover:text-red-500 transition">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <input value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(val); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 dark:focus:ring-teal-950/30 transition"
        />
        <button onClick={() => add(val)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-teal-300 dark:hover:border-teal-750 transition">
          <Plus size={15} />
        </button>
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {suggestions.filter((s) => !values.includes(s)).map((s) => (
          <button key={s} onClick={() => add(s)}
            className="text-xs px-2.5 py-1 rounded-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-850 text-gray-500 dark:text-slate-400 hover:border-teal-300 dark:hover:border-teal-700 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition">
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function SVGLineChart({ data, type }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl text-xs text-gray-400 dark:text-slate-500 italic bg-gray-50/50 dark:bg-slate-900/30">
        No log data to chart yet. Log your first vitals below!
      </div>
    );
  }

  const width = 500;
  const height = 180;
  const paddingX = 40;
  const paddingY = 30;

  // Filter out null entries
  const validData = data.filter(d => type === "sugar" ? d.sugar !== null : d.bp_systolic !== null);

  if (validData.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl text-xs text-gray-400 dark:text-slate-500 italic bg-gray-50/50 dark:bg-slate-900/30">
        No log data to chart yet. Log your first vitals below!
      </div>
    );
  }

  // Determine scale
  const values = validData.map(d => type === "sugar" ? Number(d.sugar) : Number(d.bp_systolic));
  if (type === "bp") values.push(...validData.map(d => Number(d.bp_diastolic)));
  
  const defaultMin = type === "sugar" ? 60 : 50;
  const defaultMax = type === "sugar" ? 180 : 150;
  
  const max = Math.max(...values, defaultMax);
  const min = Math.min(...values, defaultMin);
  const minVal = Math.max(0, min - 15);
  const maxVal = max + 15;

  // Map to points
  const points = validData.map((d, index) => {
    const val = type === "sugar" ? Number(d.sugar) : Number(d.bp_systolic);
    const val2 = type === "bp" ? Number(d.bp_diastolic) : null;
    return {
      x: paddingX + (index / Math.max(1, validData.length - 1)) * (width - paddingX * 2),
      y: height - paddingY - ((val - minVal) / Math.max(1, maxVal - minVal)) * (height - paddingY * 2),
      y2: val2 !== null ? height - paddingY - ((val2 - minVal) / Math.max(1, maxVal - minVal)) * (height - paddingY * 2) : null,
      date: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      val,
      val2
    };
  });

  let path1 = "";
  let path2 = "";
  points.forEach((p, idx) => {
    if (idx === 0) {
      path1 = `M ${p.x} ${p.y}`;
      if (p.y2 !== null) path2 = `M ${p.x} ${p.y2}`;
    } else {
      path1 += ` L ${p.x} ${p.y}`;
      if (p.y2 !== null) path2 += ` L ${p.x} ${p.y2}`;
    }
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm transition-colors">
      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
        <Activity size={12} className={type === "sugar" ? "text-teal-500" : "text-indigo-500"} />
        {type === "sugar" ? "Blood Sugar Trend (mg/dL)" : "Blood Pressure Trend (mmHg)"}
      </p>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} className="stroke-gray-100 dark:stroke-slate-800/60" strokeDasharray="3" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} className="stroke-gray-100 dark:stroke-slate-800/60" strokeDasharray="3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} className="stroke-gray-200 dark:stroke-slate-700/80" />

          {/* Area under Sugar Curve */}
          {type === "sugar" && points.length > 1 && (
            <path
              d={`${path1} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`}
              fill="url(#sugar-grad)"
              opacity="0.1"
            />
          )}
          {type === "sugar" && (
            <defs>
              <linearGradient id="sugar-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
              </linearGradient>
            </defs>
          )}

          {/* Lines */}
          {path1 && <path d={path1} fill="none" className={type === "sugar" ? "stroke-teal-500" : "stroke-red-400"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {path2 && <path d={path2} fill="none" className="stroke-indigo-500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

          {/* Data Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" className={`fill-white cursor-pointer stroke-2 ${type === "sugar" ? "stroke-teal-500" : "stroke-red-400"}`} />
              <text x={p.x} y={p.y - 8} textAnchor="middle" className={`text-[9px] font-bold ${type === "sugar" ? "fill-teal-600 dark:fill-teal-400" : "fill-red-500 dark:fill-red-400"}`}>{p.val}</text>

              {p.y2 !== null && (
                <>
                  <circle cx={p.x} cy={p.y2} r="4" className="fill-white stroke-indigo-500 cursor-pointer stroke-2" />
                  <text x={p.x} y={p.y2 + 13} textAnchor="middle" className="text-[9px] font-bold fill-indigo-600 dark:fill-indigo-400">{p.val2}</text>
                </>
              )}

              <text x={p.x} y={height - 10} textAnchor="middle" className="text-[8px] font-medium fill-gray-400 dark:fill-slate-500">{p.date}</text>
            </g>
          ))}

          {/* Y Axis Values */}
          <text x={10} y={paddingY + 3} className="text-[9px] font-medium fill-gray-400 dark:fill-slate-500">{Math.round(maxVal)}</text>
          <text x={10} y={height - paddingY + 3} className="text-[9px] font-medium fill-gray-400 dark:fill-slate-500">{Math.round(minVal)}</text>
        </svg>
      </div>
    </div>
  );
}

export default function HealthProfile({ userId }) {
  const [activeSubTab, setActiveSubTab] = useState("profile"); // 'profile' | 'vitals'
  const [conditions, setConditions] = useState([]);
  const [allergies, setAllergies]   = useState([]);
  const [profile, setProfile]       = useState({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState("");

  // Vitals State
  const [vitalsLogs, setVitalsLogs] = useState([]);
  const [sugarInput, setSugarInput] = useState("");
  const [sysInput, setSysInput]     = useState("");
  const [diaInput, setDiaInput]     = useState("");
  const [dateInput, setDateInput]   = useState(() => new Date().toISOString().slice(0, 16));

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("user_health_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (err) {
      console.error("[HealthProfile] Load error:", err.message);
      setError("Could not load profile. Please try again.");
    } else if (data) {
      setProfile(data);
      setConditions(data.conditions || []);
      setAllergies(data.allergies || []);
    }

    // Load vitals from LocalStorage
    const localLogs = localStorage.getItem(`healthmate_vitals_${userId}`);
    if (localLogs) {
      try {
        setVitalsLogs(JSON.parse(localLogs));
      } catch (e) {
        console.warn("Failed to parse vitals:", e);
      }
    } else {
      // Seed initial dummy records for visual preview
      const dummyLogs = [
        { id: 1, date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(), sugar: 110, bp_systolic: 120, bp_diastolic: 80 },
        { id: 2, date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), sugar: 125, bp_systolic: 118, bp_diastolic: 78 },
        { id: 3, date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), sugar: 98,  bp_systolic: 124, bp_diastolic: 82 },
        { id: 4, date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), sugar: 130, bp_systolic: 122, bp_diastolic: 80 },
      ];
      setVitalsLogs(dummyLogs);
      localStorage.setItem(`healthmate_vitals_${userId}`, JSON.stringify(dummyLogs));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setSaved(false);
    setError("");

    const payload = {
      user_id:    userId,
      conditions: conditions,
      allergies:  allergies,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from("user_health_profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("[HealthProfile] Save error:", upsertErr.message);
      setError(upsertErr.message || "Save failed. Please try again.");
    } else {
      setSaved(true);
      setProfile((p) => ({ ...p, conditions, allergies }));
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const handleLogVitals = (e) => {
    e.preventDefault();
    if (!sugarInput && (!sysInput || !diaInput)) {
      setError("Please input Blood Sugar or Blood Pressure values to log.");
      return;
    }
    setError("");

    const newLog = {
      id: Date.now(),
      date: dateInput || new Date().toISOString(),
      sugar: sugarInput ? Number(sugarInput) : null,
      bp_systolic: sysInput ? Number(sysInput) : null,
      bp_diastolic: diaInput ? Number(diaInput) : null,
    };

    const updated = [...vitalsLogs, newLog].sort((a, b) => new Date(a.date) - new Date(b.date));
    setVitalsLogs(updated);
    localStorage.setItem(`healthmate_vitals_${userId}`, JSON.stringify(updated));

    // Reset inputs
    setSugarInput("");
    setSysInput("");
    setDiaInput("");
    setDateInput(new Date().toISOString().slice(0, 16));
  };

  const handleDeleteLog = (id) => {
    const updated = vitalsLogs.filter(v => v.id !== id);
    setVitalsLogs(updated);
    localStorage.setItem(`healthmate_vitals_${userId}`, JSON.stringify(updated));
  };

  // Get current status alerts
  const latestSugar = [...vitalsLogs].reverse().find(v => v.sugar !== null)?.sugar;
  const latestBP = [...vitalsLogs].reverse().find(v => v.bp_systolic !== null);

  const getSugarTrendText = (latest) => {
    if (!latest) return { text: "No logs", color: "text-gray-500", bg: "bg-gray-100 dark:bg-slate-800" };
    if (latest < 100) return { text: "Normal", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/30" };
    if (latest >= 100 && latest < 126) return { text: "Prediabetes", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/30" };
    return { text: "High", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/30" };
  };

  const getBpTrendText = (sys, dia) => {
    if (!sys || !dia) return { text: "No logs", color: "text-gray-500", bg: "bg-gray-100 dark:bg-slate-800" };
    if (sys < 120 && dia < 80) return { text: "Normal", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/30" };
    if (sys >= 120 && sys < 130 && dia < 80) return { text: "Elevated", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/30" };
    return { text: "Hypertension", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/30" };
  };

  const sugarStatus = getSugarTrendText(latestSugar);
  const bpStatus = latestBP ? getBpTrendText(latestBP.bp_systolic, latestBP.bp_diastolic) : getBpTrendText(null, null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400 dark:text-slate-500">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-950 p-4 md:p-6 transition-colors">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-900/50 flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Health Profile & Vitals</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Saved securely · Customizes AI assistant analysis & reports
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-gray-200/60 dark:bg-slate-900 p-1 rounded-xl">
          <button onClick={() => setActiveSubTab("profile")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeSubTab === "profile" ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-950 dark:hover:text-slate-200"}`}>
            General Profile
          </button>
          <button onClick={() => setActiveSubTab("vitals")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeSubTab === "vitals" ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-950 dark:hover:text-slate-200"}`}>
            Vitals Logs & Trends
          </button>
        </div>

        {activeSubTab === "profile" ? (
          <div className="space-y-6">
            {/* Auto-detected info from reports */}
            {profile.recent_reports_summary && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-xl p-4 transition-colors">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                  Auto-detected from uploaded reports
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Sugar Trend</p>
                    <p className="text-sm text-amber-800 dark:text-amber-300 font-semibold capitalize mt-0.5">
                      {profile.sugar_trend || "Unknown"}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-3">
                    <p className="text-xs text-red-500 dark:text-red-400 font-medium">BP Trend</p>
                    <p className="text-sm text-red-700 dark:text-red-300 font-semibold capitalize mt-0.5">
                      {profile.bp_trend || "Unknown"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{profile.recent_reports_summary}</p>
              </div>
            )}

            {/* Conditions */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-xl p-4 md:p-5 transition-colors">
              <TagInput
                label="Known Medical Conditions"
                values={conditions}
                setValues={setConditions}
                suggestions={COMMON_CONDITIONS}
                placeholder="Type a condition and press Enter..."
              />
            </div>

            {/* Allergies */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-xl p-4 md:p-5 transition-colors">
              <TagInput
                label="Allergies & Sensitivities"
                values={allergies}
                setValues={setAllergies}
                suggestions={COMMON_ALLERGIES}
                placeholder="Type an allergy and press Enter..."
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Save button */}
            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
              {saving
                ? <><Loader2 size={15} className="animate-spin" />Saving...</>
                : saved
                ? <><CheckCircle size={15} />Profile saved! ✅</>
                : <><Save size={15} />Save Profile</>
              }
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">LATEST SUGAR</span>
                    <Heart size={14} className="text-teal-500" />
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">
                    {latestSugar ? `${latestSugar} mg/dL` : "—"}
                  </p>
                </div>
                <div className={`mt-3 inline-block self-start text-[10px] font-bold px-2 py-0.5 rounded-md border ${sugarStatus.bg} ${sugarStatus.color}`}>
                  {sugarStatus.text}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">LATEST BP</span>
                    <Heart size={14} className="text-indigo-500" />
                  </div>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">
                    {latestBP ? `${latestBP.bp_systolic}/${latestBP.bp_diastolic}` : "—"}{" "}
                    <span className="text-xs font-normal text-gray-400">mmHg</span>
                  </p>
                </div>
                <div className={`mt-3 inline-block self-start text-[10px] font-bold px-2 py-0.5 rounded-md border ${bpStatus.bg} ${bpStatus.color}`}>
                  {bpStatus.text}
                </div>
              </div>
            </div>

            {/* SVG Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SVGLineChart data={vitalsLogs} type="sugar" />
              <SVGLineChart data={vitalsLogs} type="bp" />
            </div>

            {/* Log Vitals Form */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-2xl p-4 md:p-5 shadow-sm transition-colors">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-1.5">
                <TrendingUp size={15} className="text-teal-500" />
                Log Daily Vitals
              </p>
              <form onSubmit={handleLogVitals} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">SUGAR (mg/dL)</label>
                    <input
                      type="number"
                      placeholder="e.g. 104"
                      value={sugarInput}
                      onChange={(e) => setSugarInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">SYS BP (mmHg)</label>
                    <input
                      type="number"
                      placeholder="e.g. 120"
                      value={sysInput}
                      onChange={(e) => setSysInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">DIA BP (mmHg)</label>
                    <input
                      type="number"
                      placeholder="e.g. 80"
                      value={diaInput}
                      onChange={(e) => setDiaInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">DATE & TIME</label>
                  <input
                    type="datetime-local"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/20"
                  />
                </div>

                {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                <button type="submit"
                  className="w-full py-2.5 bg-teal-400 hover:bg-teal-600 text-white rounded-xl font-medium text-xs transition flex items-center justify-center gap-1.5">
                  <Plus size={14} /> Log Vitals
                </button>
              </form>
            </div>

            {/* Log History */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm transition-colors">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Vitals History Log</p>
              {vitalsLogs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4 italic">No logged data</p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 pr-1.5">
                  {vitalsLogs.slice().reverse().map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-gray-400" />
                        <span className="font-semibold text-gray-700 dark:text-slate-300">
                          {new Date(log.date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {log.sugar && (
                          <span className="bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded font-medium border border-teal-100 dark:border-teal-900/30">
                            Sugar: {log.sugar}
                          </span>
                        )}
                        {log.bp_systolic && (
                          <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded font-medium border border-indigo-100 dark:border-indigo-900/30">
                            BP: {log.bp_systolic}/{log.bp_diastolic}
                          </span>
                        )}
                        <button onClick={() => handleDeleteLog(log.id)}
                          className="text-gray-400 hover:text-red-500 transition p-1 hover:bg-gray-50 dark:hover:bg-slate-850 rounded">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-4">
          All data synced securely · Health trends update instantly
        </p>
      </div>
    </div>
  );
}
