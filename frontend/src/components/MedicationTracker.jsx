import { useState, useEffect, useRef, useCallback } from "react";
import { Pill, Plus, X, Trash2, Edit2, Loader2,
  Clock, Bell, Calendar, Info, Check, AlertCircle } from "lucide-react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import GmailAuthButton from "./GmailAuthButton";

const FREQUENCIES = ["Once daily","Twice daily","Three times daily","Every 8 hours","Every 12 hours","Weekly","As needed","Other"];
const MEAL_TIMES  = ["Before meal","After meal","With meal","Empty stomach","No restriction"];
const MED_TYPES   = ["Tablet","Capsule","Syrup","Injection","Inhaler","Drops","Cream/Ointment","Other"];
const FILTER_TABS = ["All","Active","As needed","Completed","Stopped"];

// Timezone conversion helpers (stores UTC in DB, displays Local in UI)
function localToUtcTime(localTime) {
  if (!localTime) return "08:00";
  const [hours, minutes] = localTime.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function utcToLocalTime(utcTime) {
  if (!utcTime) return "08:00";
  const [hours, minutes] = utcTime.split(":").map(Number);
  const date = new Date();
  date.setUTCHours(hours, minutes, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function statusStyle(s) {
  return s === "active"    ? "bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-900/30"
       : s === "completed" ? "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/30"
       : s === "stopped"   ? "bg-red-50 dark:bg-red-950/20 text-red-655 dark:text-red-400 border-red-200 dark:border-red-900/30"
       : s === "as_needed" ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30"
       : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-450 border-gray-200 dark:border-slate-700";
}

const STATUS_LABEL = { active:"Active", completed:"Completed", stopped:"Stopped", as_needed:"As needed" };

// Alarm sound function
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((delay) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.5, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.5);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.5);
    });
  } catch (e) { console.warn("Audio error:", e); }
}

// Local reminder alarm listener
function useReminderChecker(userId, meds) {
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!meds.length) return;

    const check = async () => {
      const now     = new Date();
      const timeNow = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const dateKey = now.toISOString().split("T")[0];

      for (const med of meds) {
        if (med.status !== "active") continue;
        if (med.reminder_time !== timeNow) continue;

        if (med.reminder) {
          const key = `ring-${med.id}-${dateKey}-${timeNow}`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            playAlarm();
            if (Notification.permission === "granted") {
              new Notification(`💊 Time for ${med.name}`, {
                body: `${med.dosage || ""} · ${med.frequency} · ${med.meal_time}`,
                icon: "/icons/icon-96.png",
              });
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then((p) => {
                if (p === "granted") {
                  new Notification(`💊 Time for ${med.name}`, {
                    body: med.dosage || med.frequency,
                  });
                }
              });
            }
          }
        }
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [meds, userId]);
}

// Add/Edit Medication Modal
function MedModal({ userId, onClose, onSaved, editItem }) {
  const isEdit = Boolean(editItem);
  const { addToast } = useToast();
  const [form, setForm] = useState({
    name:          editItem?.name          || "",
    dosage:        editItem?.dosage        || "",
    type:          editItem?.type          || "Tablet",
    frequency:     editItem?.frequency     || "Once daily",
    meal_time:     editItem?.meal_time     || "After meal",
    start_date:    editItem?.start_date    || new Date().toISOString().split("T")[0],
    end_date:      editItem?.end_date      || "",
    status:        editItem?.status        || "active",
    prescribed_by: editItem?.prescribed_by || "",
    notes:         editItem?.notes         || "",
    reminder:      editItem?.reminder      ?? false,
    gmail_reminder: editItem?.gmail_reminder ?? false,
    reminder_time: editItem?.reminder_time || "08:00",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Medication name is required."); return; }
    setSaving(true);
    setError("");

    const payload = { ...form, user_id: userId, updated_at: new Date().toISOString() };
    if (!payload.end_date) delete payload.end_date;

    // Convert reminder_time to UTC for background scheduling
    if (payload.reminder_time) {
      try {
        payload.reminder_time = localToUtcTime(payload.reminder_time);
      } catch (e) { console.warn("Failed to convert time to UTC:", e); }
    }

    const { error: dbErr } = isEdit
      ? await supabase.from("medications").update(payload).eq("id", editItem.id)
      : await supabase.from("medications").insert(payload);

    if (dbErr) {
      setError(dbErr.message || "Save failed. Please try again.");
      setSaving(false);
      addToast(dbErr.message || "Failed to save medication", "error");
      return;
    }

    addToast(isEdit ? "Medication updated!" : "Medication added!", "success");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800/80 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">{isEdit ? "Edit Medication" : "Add Medication"}</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-650 dark:hover:text-slate-350 transition"><X size={18} /></button>
        </div>

        {/* Scrollable Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Medication Name</label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} required
              placeholder="e.g. Paracetamol"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/20 transition" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Dosage */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Dosage</label>
              <input type="text" value={form.dosage} onChange={(e) => set("dosage", e.target.value)}
                placeholder="e.g. 500mg or 1 pill"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/20 transition" />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Type</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition">
                {MED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Frequency */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Frequency</label>
              <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition">
                {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Meal Time */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">When to take</label>
              <select value={form.meal_time} onChange={(e) => set("meal_time", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition">
                {MEAL_TIMES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition" />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">End Date (optional)</label>
              <input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Prescribed By */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Doctor (optional)</label>
              <input type="text" value={form.prescribed_by} onChange={(e) => set("prescribed_by", e.target.value)}
                placeholder="Dr. Smith"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/20 transition" />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition">
                <option value="active">Active</option>
                <option value="as_needed">As needed</option>
                <option value="completed">Completed</option>
                <option value="stopped">Stopped</option>
              </select>
            </div>
          </div>

          {/* Alarm / Reminders Section */}
          <div className="border-t border-gray-100 dark:border-slate-800/80 pt-4 space-y-3">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">REMINIDER SETTINGS</p>
            
            {/* Local Ringing Alarm */}
            <div className="flex items-start justify-between bg-gray-50 dark:bg-slate-950 p-3 rounded-xl border border-gray-150 dark:border-slate-800/50">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0 text-amber-500">
                  <Bell size={15} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Browser Ring Alert</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Rings alarm audio in active browser tabs</p>
                </div>
              </div>
              <button type="button" onClick={() => set("reminder", !form.reminder)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-1 ${form.reminder ? "bg-teal-400" : "bg-gray-200 dark:bg-slate-800"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${form.reminder ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {/* Local time picker - shared with ring time */}
            {form.reminder && (
              <div className="flex items-center gap-2 ml-10">
                <Clock size={13} className="text-gray-400 dark:text-slate-500" />
                <input type="time" value={form.reminder_time}
                  onChange={(e) => set("reminder_time", e.target.value)}
                  className="px-3.5 py-1.5 rounded-lg border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition" />
                <span className="text-xs text-gray-400 dark:text-slate-500">alert time</span>
              </div>
            )}

            {/* Gmail Backend Reminder */}
            <div className="space-y-3">
              <div className="flex items-start justify-between bg-gray-50 dark:bg-slate-950 p-3 rounded-xl border border-gray-150 dark:border-slate-800/50">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-base">📧</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Gmail alert</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Email to your Gmail inbox</p>
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">✅ Works even when website is closed</p>
                  </div>
                </div>
                <button type="button" onClick={() => set("gmail_reminder", !form.gmail_reminder)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-1 ${form.gmail_reminder ? "bg-teal-400" : "bg-gray-200 dark:bg-slate-800"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${form.gmail_reminder ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Gmail time picker - shared with ring time */}
              {form.gmail_reminder && !form.reminder && (
                <div className="flex items-center gap-2 ml-10">
                  <Clock size={13} className="text-gray-400 dark:text-slate-500" />
                  <input type="time" value={form.reminder_time}
                    onChange={(e) => set("reminder_time", e.target.value)}
                    className="px-3.5 py-1.5 rounded-lg border border-gray-250 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition" />
                  <span className="text-xs text-gray-400 dark:text-slate-500">alert time</span>
                </div>
              )}

              {form.gmail_reminder && (
                <div className="ml-10">
                  <GmailAuthButton userId={userId} />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              placeholder="Side effects to watch, special instructions..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 resize-none focus:outline-none focus:border-teal-400 transition" />
          </div>

          {error && (
            <div className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-slate-800/80 flex-shrink-0 bg-gray-50/50 dark:bg-slate-900/50">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-sm text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-850 transition font-semibold">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving...</> : isEdit ? "Update" : "Add Medication"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Medication Card Component
function MedCard({ med, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const { addToast } = useToast();

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${med.name}"?`)) return;
    setDeleting(true);
    const { error } = await supabase.from("medications").delete().eq("id", med.id);
    if (!error) {
      onDelete(med.id);
      addToast(`Deleted "${med.name}"`, "success");
    } else {
      addToast("Failed to delete medication: " + error.message, "error");
      setDeleting(false);
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-xl p-4 hover:shadow-xs hover:border-teal-100 dark:hover:border-teal-950 transition group ${med.status === "stopped" ? "opacity-55" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Pill size={16} className="text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{med.name}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusStyle(med.status)}`}>
              {STATUS_LABEL[med.status] || med.status}
            </span>
            {(med.reminder || med.gmail_reminder) && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 px-2 py-0.5 rounded-full font-bold">
                <Bell size={9} /> {med.reminder_time}
                {med.gmail_reminder && " 📧"}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
            {med.dosage && (
              <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                <Info size={10} className="text-gray-300 dark:text-slate-600" />{med.dosage} · {med.type}
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
              <Clock size={10} className="text-gray-300 dark:text-slate-600" />{med.frequency}
            </span>
            {med.meal_time && <span className="text-xs text-gray-500 dark:text-slate-400">{med.meal_time}</span>}
            {med.prescribed_by && <span className="text-xs text-gray-500 dark:text-slate-400">Dr. {med.prescribed_by}</span>}
          </div>

          {(med.start_date || med.end_date) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {med.start_date && (
                <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1 font-medium">
                  <Calendar size={10} />
                  From {new Date(med.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              )}
              {med.end_date && (
                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                  → {new Date(med.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
          )}

          {med.notes && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 line-clamp-2 leading-relaxed bg-gray-50 dark:bg-slate-950 p-2 rounded-lg border border-gray-150 dark:border-slate-850/50">{med.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 md:opacity-0 md:group-hover:opacity-100 transition flex-shrink-0">
          <button onClick={() => onEdit(med)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition">
            <Edit2 size={13} />
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Medication Tracker Component
export default function MedicationTracker({ userId }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [meds, setMeds]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [filter, setFilter]       = useState("All");
  const [search, setSearch]       = useState("");

  // Daily Adherence State
  const todayKey = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
  const [adherence, setAdherence] = useState({});

  useReminderChecker(userId, meds);

  const fetchMeds = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("medications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const formattedMeds = data.map((m) => {
        if (m.reminder_time) {
          try {
            m.reminder_time = utcToLocalTime(m.reminder_time);
          } catch (e) { console.warn("Failed to convert time:", e); }
        }
        return m;
      });
      setMeds(formattedMeds);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchMeds(); }, [fetchMeds]);

  // Load Adherence log
  useEffect(() => {
    const stored = localStorage.getItem(`healthmate_med_adherence_${userId}`);
    if (stored) {
      try {
        setAdherence(JSON.parse(stored));
      } catch (e) { console.warn("Failed to load adherence:", e); }
    }
  }, [userId]);

  // Request notifications
  useEffect(() => {
    if (Notification.permission === "default") Notification.requestPermission();
  }, []);

  const toggleAdherence = (medId, status) => {
    const todayLogs = adherence[todayKey] || {};
    const currentStatus = todayLogs[medId];
    
    const newStatus = currentStatus === status ? null : status;
    const updated = {
      ...adherence,
      [todayKey]: {
        ...todayLogs,
        [medId]: newStatus
      }
    };
    
    setAdherence(updated);
    localStorage.setItem(`healthmate_med_adherence_${userId}`, JSON.stringify(updated));

    if (newStatus === "taken") {
      addToast(`Logged "${meds.find(m => m.id === medId)?.name}" as taken! 💊`, "success");
    } else if (newStatus === "missed") {
      addToast(`Logged "${meds.find(m => m.id === medId)?.name}" as missed`, "info");
    }
  };

  const handleDelete = (id)   => setMeds((p) => p.filter((m) => m.id !== id));
  const openAdd      = ()     => { setEditItem(null);  setShowModal(true); };
  const openEdit     = (item) => { setEditItem(item);  setShowModal(true); };
  const closeModal   = ()     => { setShowModal(false); setEditItem(null); };

  const filtered = meds.filter((m) => {
    const matchF =
      filter === "All"       ? true :
      filter === "Active"    ? m.status === "active"    :
      filter === "As needed" ? m.status === "as_needed" :
      filter === "Completed" ? m.status === "completed" :
      filter === "Stopped"   ? m.status === "stopped"   : true;
    const matchS = !search
      || m.name.toLowerCase().includes(search.toLowerCase())
      || (m.prescribed_by || "").toLowerCase().includes(search.toLowerCase());
    return matchF && matchS;
  });

  const activeMeds = meds.filter((m) => m.status === "active" || m.status === "as_needed");
  const totalDue = activeMeds.length;
  const takenCount = activeMeds.filter(m => adherence[todayKey]?.[m.id] === "taken").length;
  const compliancePct = totalDue > 0 ? Math.round((takenCount / totalDue) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 md:px-5 py-3 flex-shrink-0 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Pill size={15} className="text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Medication Tracker</h2>
            <span className="text-xs text-gray-400 dark:text-slate-500">{meds.length} total</span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-xs font-semibold transition">
            <Plus size={13} /> Add
          </button>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medications..."
          className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-850 bg-gray-50 dark:bg-slate-950 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition mb-3" />
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
          {FILTER_TABS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition font-semibold ${
                filter === f
                  ? "bg-teal-50 dark:bg-teal-950/30 border-teal-400 text-teal-700 dark:text-teal-300"
                  : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-850 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700"
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-gray-400 dark:text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading medications...</span>
          </div>
        ) : meds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center">
            <Pill size={36} className="text-gray-250 dark:text-slate-800 mb-3" />
            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No medications added yet</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 mb-4">Track your daily medicines with automated reminders</p>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-teal-400 hover:bg-teal-600 text-white rounded-xl text-sm font-medium transition shadow-sm">
              <Plus size={14} /> Add first medication
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            
            {/* Adherence Compliance Tracker */}
            {activeMeds.length > 0 && filter === "All" && !search && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">DAILY COMPLIANCE</h3>
                    <p className="text-sm font-bold text-gray-800 dark:text-slate-200 mt-0.5">
                      {takenCount} of {totalDue} taken · <span className="text-teal-500">{compliancePct}%</span>
                    </p>
                  </div>
                  <span className="text-2xl">📈</span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-100 dark:bg-slate-950 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-teal-400 transition-all duration-500" style={{ width: `${compliancePct}%` }} />
                </div>

                {/* Intake Checklist */}
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock size={11} /> Interactive Daily Schedule
                </p>
                <div className="divide-y divide-gray-100 dark:divide-slate-850/60 max-h-48 overflow-y-auto">
                  {activeMeds.map((m) => {
                    const status = adherence[todayKey]?.[m.id];
                    return (
                      <div key={m.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Pill size={12} className={status === "taken" ? "text-teal-500" : "text-gray-400 dark:text-slate-600"} />
                          <div className="truncate">
                            <span className={`font-semibold text-gray-800 dark:text-slate-200 ${status === "taken" ? "line-through opacity-50" : ""}`}>{m.name}</span>
                            {m.dosage && <span className="text-gray-400 dark:text-slate-500 ml-1.5">{m.dosage}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleAdherence(m.id, "taken")}
                            className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                              status === "taken"
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-250 dark:border-emerald-900/50"
                                : "bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-450 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
                            }`}>
                            Taken
                          </button>
                          <button
                            onClick={() => toggleAdherence(m.id, "missed")}
                            className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                              status === "missed"
                                ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-250 dark:border-red-900/50"
                                : "bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-450 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
                            }`}>
                            Missed
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* List */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={11} /> All Medications
              </p>
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8 italic bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-2xl">No medications match this filter.</p>
              ) : (
                filtered.map((med) => (
                  <MedCard key={med.id} med={med} onEdit={openEdit} onDelete={handleDelete} />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <MedModal userId={userId} editItem={editItem} onClose={closeModal} onSaved={fetchMeds} />
      )}
    </div>
  );
}
