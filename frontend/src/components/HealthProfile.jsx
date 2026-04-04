import { useState, useEffect } from "react";
import { User, Plus, X, Save, Loader2, CheckCircle } from "lucide-react";
import { getProfile, updateProfile } from "../api/medai";

const COMMON_CONDITIONS = [
  "Type 2 Diabetes", "Hypertension", "Asthma", "Heart Disease",
  "Thyroid Disorder", "Anemia", "Arthritis", "Depression",
  "PCOS", "High Cholesterol",
];

const COMMON_ALLERGIES = [
  "Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen",
  "Latex", "Nuts", "Shellfish", "Eggs", "Dairy",
];

function TagInput({ label, values, setValues, suggestions, placeholder }) {
  const [inputVal, setInputVal] = useState("");

  const add = (val) => {
    const trimmed = val.trim();
    if (trimmed && !values.includes(trimmed)) {
      setValues([...values, trimmed]);
    }
    setInputVal("");
  };

  const remove = (v) => setValues(values.filter((x) => x !== v));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-medium">
            {v}
            <button onClick={() => remove(v)} className="hover:text-teal-900 transition">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(inputVal); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition"
        />
        <button
          onClick={() => add(inputVal)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.filter((s) => !values.includes(s)).map((s) => (
          <button
            key={s}
            onClick={() => add(s)}
            className="text-xs px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HealthProfile({ userId }) {
  const [conditions, setConditions] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({});

  useEffect(() => {
    getProfile(userId)
      .then((res) => {
        const data = res.data || {};
        setProfile(data);
        setConditions(data.conditions || []);
        setAllergies(data.allergies || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile(userId, conditions, allergies);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
            <User size={18} className="text-teal-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Health Profile</h2>
            <p className="text-xs text-gray-500">This data personalizes all your AI responses</p>
          </div>
        </div>

        {/* Read-only context from reports */}
        {profile.recent_reports_summary && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Auto-detected from your reports</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium">Sugar Trend</p>
                <p className="text-sm text-amber-800 font-semibold capitalize mt-0.5">{profile.sugar_trend || "Unknown"}</p>
              </div>
              <div className="bg-coral-50 rounded-lg p-3" style={{ backgroundColor: "#FAECE7" }}>
                <p className="text-xs font-medium" style={{ color: "#993C1D" }}>BP Trend</p>
                <p className="text-sm font-semibold capitalize mt-0.5" style={{ color: "#D85A30" }}>{profile.bp_trend || "Unknown"}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{profile.recent_reports_summary}</p>
          </div>
        )}

        {/* Conditions */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <TagInput
            label="Known Medical Conditions"
            values={conditions}
            setValues={setConditions}
            suggestions={COMMON_CONDITIONS}
            placeholder="Type a condition and press Enter..."
          />
        </div>

        {/* Allergies */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <TagInput
            label="Allergies & Sensitivities"
            values={allergies}
            setValues={setAllergies}
            suggestions={COMMON_ALLERGIES}
            placeholder="Type an allergy and press Enter..."
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <><Loader2 size={15} className="animate-spin" /> Saving...</>
          ) : saved ? (
            <><CheckCircle size={15} /> Profile saved!</>
          ) : (
            <><Save size={15} /> Save Profile</>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Your health data is securely stored and never shared. Stored in Supabase with end-to-end encryption.
        </p>
      </div>
    </div>
  );
}
