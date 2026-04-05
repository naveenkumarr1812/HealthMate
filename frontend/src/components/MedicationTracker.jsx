import { useState, useEffect, useRef, useCallback } from "react";
import { Pill, Plus, X, Trash2, Edit2, Loader2,
  Clock, ChevronDown, Bell, Calendar, Info, Check } from "lucide-react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import GmailAuthButton from "./GmailAuthButton";

const FREQUENCIES = ["Once daily","Twice daily","Three times daily","Every 8 hours","Every 12 hours","Weekly","As needed","Other"];
const MEAL_TIMES  = ["Before meal","After meal","With meal","Empty stomach","No restriction"];
const MED_TYPES   = ["Tablet","Capsule","Syrup","Injection","Inhaler","Drops","Cream/Ointment","Other"];
const STATUS_OPTS = [
  { value: "active",    label: "Active"     },
  { value: "as_needed", label: "As needed"  },
  { value: "completed", label: "Completed"  },
  { value: "stopped",   label: "Stopped"    },
];
const FILTER_TABS = ["All","Active","As needed","Completed","Stopped"];

function statusStyle(s) {
  return s==="active"    ? "bg-teal-50 text-teal-700 border-teal-200"
       : s==="completed" ? "bg-blue-50 text-blue-700 border-blue-200"
       : s==="stopped"   ? "bg-red-50 text-red-600 border-red-200"
       : s==="as_needed" ? "bg-amber-50 text-amber-700 border-amber-200"
       : "bg-gray-50 text-gray-600 border-gray-200";
}

// ── Alarm sound using Web Audio API ─────────────────────────
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.4);
    });
  } catch (e) { console.warn("Audio error:", e); }
}

// ── Reminder checker — runs every minute ────────────────────
function useReminderChecker(userId, meds, userEmail) {
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!meds.length) return;

    const check = async () => {
      const now   = new Date();
      const hh    = String(now.getHours()).padStart(2, "0");
      const mm    = String(now.getMinutes()).padStart(2, "0");
      const timeNow = `${hh}:${mm}`;

      for (const med of meds) {
        if (med.status !== "active") continue;
        const key = `${med.id}-${timeNow}`;
        if (notifiedRef.current.has(key)) continue;

        // Ring alert
        if (med.reminder && med.reminder_time === timeNow) {
          notifiedRef.current.add(key);
          playAlarm();
          if (Notification.permission === "granted") {
            new Notification(`💊 Time for ${med.name}`, {
              body: `${med.dosage || ""} · ${med.frequency} · ${med.meal_time}`,
              icon: "/favicon.ico",
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((p) => {
              if (p === "granted") new Notification(`💊 Time for ${med.name}`, { body: med.dosage || med.frequency });
            });
          }
        }

        // Gmail alert (separate toggle)
        if (med.gmail_reminder && med.reminder_time === timeNow && userEmail) {
          const gmailKey = `gmail-${med.id}-${timeNow}`;
          if (!notifiedRef.current.has(gmailKey)) {
            notifiedRef.current.add(gmailKey);
            try {
              await fetch("/api/medications/remind", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                },
                body: JSON.stringify({
                  user_id: userId,
                  email: userEmail,
                  medication_name: med.name,
                  dosage: med.dosage,
                  frequency: med.frequency,
                  meal_time: med.meal_time,
                }),
              });
            } catch (e) { console.warn("Email reminder failed:", e); }
          }
        }
      }
    };

    check(); // run immediately
    const interval = setInterval(check, 60000); // every minute
    return () => clearInterval(interval);
  }, [meds, userId, userEmail]);
}

// ── Add/Edit Modal ────────────────────────────────────────────
function MedModal({ userId, onClose, onSaved, editItem }) {
  const isEdit = Boolean(editItem);
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
    reminder_time: editItem?.reminder_time || "08:00",
    gmail_reminder: editItem?.gmail_reminder ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Medication name is required."); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...form, user_id: userId, updated_at: new Date().toISOString() };
      // Remove empty end_date
      if (!payload.end_date) delete payload.end_date;
      const { error: e } = isEdit
        ? await supabase.from("medications").update(payload).eq("id", editItem.id)
        : await supabase.from("medications").insert(payload);
      if (e) throw e;
      onSaved();
      onClose();
    } catch (err) { setError(err.message || "Save failed."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">{isEdit ? "Edit Medication" : "Add Medication"}</h3>
          <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
            className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Medication Name *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Metformin" autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition" />
          </div>

          {/* Dosage + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Dosage</label>
              <input value={form.dosage} onChange={(e) => set("dosage", e.target.value)} placeholder="500mg"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Form</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition bg-white">
                {MED_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Frequency + Meal time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Frequency</label>
              <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition bg-white">
                {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">When to take</label>
              <select value={form.meal_time} onChange={(e) => set("meal_time", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition bg-white">
                {MEAL_TIMES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition bg-white">
              {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">End Date (optional)</label>
              <input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition" />
            </div>
          </div>

          {/* Prescribed by */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Prescribed by (optional)</label>
            <input value={form.prescribed_by} onChange={(e) => set("prescribed_by", e.target.value)} placeholder="Dr. Sharma"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition" />
          </div>

          {/* Reminder — two separate toggles */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reminders</p>

            {/* Ring alert toggle */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-base">🔔</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Ring alert</p>
                  <p className="text-xs text-gray-400 mt-0.5">Sound + browser notification at set time</p>
                  <p className="text-xs text-amber-600 mt-0.5 font-medium">⚠️ Only works when website is open</p>
                </div>
              </div>
              <button type="button" onClick={() => set("reminder", !form.reminder)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-1 ${form.reminder ? "bg-teal-400" : "bg-gray-200"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${form.reminder ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {/* Time picker — shown when ring is ON */}
            {form.reminder && (
              <div className="flex items-center gap-2 ml-10">
                <Clock size={13} className="text-gray-400" />
                <input type="time" value={form.reminder_time}
                  onChange={(e) => set("reminder_time", e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition" />
                <span className="text-xs text-gray-400">alert time</span>
              </div>
            )}

            <div className="border-t border-gray-200" />

            {/* Gmail alert toggle */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-base">📧</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Gmail alert</p>
                  <p className="text-xs text-gray-400 mt-0.5">Email reminder to your Gmail inbox</p>
                  <p className="text-xs text-green-600 mt-0.5 font-medium">✅ Works even when website is closed</p>
                </div>
              </div>
              <button type="button" onClick={() => set("gmail_reminder", !form.gmail_reminder)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-1 ${form.gmail_reminder ? "bg-teal-400" : "bg-gray-200"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${form.gmail_reminder ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {/* Gmail connect — shown when gmail toggle is ON */}
            {form.gmail_reminder && (
              <div className="ml-10">
                <GmailAuthButton userId={userId} />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              placeholder="Side effects to watch, special instructions..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-teal-400 transition" />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition font-medium">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <><Loader2 size={14} className="animate-spin"/>Saving...</> : isEdit ? "Update" : "Add Medication"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Med Card ─────────────────────────────────────────────────
function MedCard({ med, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const labelMap = { active:"Active", completed:"Completed", stopped:"Stopped", as_needed:"As needed" };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${med.name}"?`)) return;
    setDeleting(true);
    const { error } = await supabase.from("medications").delete().eq("id", med.id);
    if (!error) onDelete(med.id);
    else { alert("Delete failed"); setDeleting(false); }
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 transition group hover:shadow-sm hover:border-teal-100 ${med.status==="stopped"?"opacity-55":""}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Pill size={16} className="text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{med.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusStyle(med.status)}`}>
              {labelMap[med.status]||med.status}
            </span>
            {med.reminder && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">
                <Bell size={9}/>  {med.reminder_time}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {med.dosage && <span className="text-xs text-gray-500 flex items-center gap-1"><Info size={10} className="text-gray-300"/>{med.dosage} · {med.type}</span>}
            <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={10} className="text-gray-300"/>{med.frequency}</span>
            {med.meal_time && <span className="text-xs text-gray-500">{med.meal_time}</span>}
            {med.prescribed_by && <span className="text-xs text-gray-500">Dr. {med.prescribed_by}</span>}
          </div>

          {(med.start_date||med.end_date) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {med.start_date && <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={10}/>From {new Date(med.start_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span>}
              {med.end_date   && <span className="text-xs text-gray-400">→ {new Date(med.end_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span>}
            </div>
          )}
          {med.notes && <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{med.notes}</p>}
        </div>

        {/* Actions — always visible on mobile, hover on desktop */}
        <div className="flex flex-col gap-1 md:opacity-0 md:group-hover:opacity-100 transition">
          <button onClick={() => onEdit(med)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition">
            <Edit2 size={13}/>
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
            {deleting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function MedicationTracker({ userId }) {
  const { user } = useAuth();
  const [meds, setMeds]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [filter, setFilter]       = useState("All");
  const [search, setSearch]       = useState("");

  useReminderChecker(userId, meds, user?.email);

  const fetchMeds = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("medications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setMeds(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchMeds(); }, [fetchMeds]);

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === "default") Notification.requestPermission();
  }, []);

  const handleDelete = (id)   => setMeds((p) => p.filter((m) => m.id !== id));
  const openAdd      = ()     => { setEditItem(null);  setShowModal(true); };
  const openEdit     = (item) => { setEditItem(item);  setShowModal(true); };
  const closeModal   = ()     => { setShowModal(false); setEditItem(null); };

  const filtered = meds.filter((m) => {
    const matchF =
      filter==="All"       ? true :
      filter==="Active"    ? m.status==="active"    :
      filter==="As needed" ? m.status==="as_needed" :
      filter==="Completed" ? m.status==="completed" :
      filter==="Stopped"   ? m.status==="stopped"   : true;
    const matchS = !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.prescribed_by||"").toLowerCase().includes(search.toLowerCase());
    return matchF && matchS;
  });

  const activeMeds = meds.filter((m) => m.status==="active"||m.status==="as_needed");

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Pill size={15} className="text-teal-600"/>
            <h2 className="text-sm font-semibold text-gray-900">Medication Tracker</h2>
            <span className="text-xs text-gray-400">{meds.length} total</span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-xs font-medium transition">
            <Plus size={13}/>Add
          </button>
        </div>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search medications..."
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-teal-400 transition mb-3"/>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTER_TABS.map((f) => (
            <button key={f} onClick={()=>setFilter(f)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition font-medium ${filter===f?"bg-teal-50 border-teal-400 text-teal-700":"bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin"/><span className="text-sm">Loading...</span>
          </div>
        ) : meds.length===0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center">
            <Pill size={36} className="text-gray-200 mb-3"/>
            <p className="text-sm font-medium text-gray-500">No medications yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Track your daily medicines with reminders</p>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition">
              <Plus size={14}/>Add medication
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
              {[
                { label:"Active",    count:meds.filter(m=>m.status==="active").length,    cls:"bg-teal-50 text-teal-700 border-teal-100" },
                { label:"As needed", count:meds.filter(m=>m.status==="as_needed").length, cls:"bg-amber-50 text-amber-700 border-amber-100" },
                { label:"Completed", count:meds.filter(m=>m.status==="completed").length, cls:"bg-blue-50 text-blue-700 border-blue-100" },
              ].map((s)=>(
                <div key={s.label} className={`rounded-xl border p-3 text-center ${s.cls}`}>
                  <p className="text-xl font-bold">{s.count}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Today's schedule */}
            {activeMeds.length>0 && filter==="All" && !search && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Clock size={11}/>Today's Schedule</p>
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 flex flex-wrap gap-2">
                  {activeMeds.map((m)=>(
                    <div key={m.id} className="flex items-center gap-1.5 bg-white border border-teal-100 rounded-lg px-2.5 py-1.5">
                      <Pill size={11} className="text-teal-500"/>
                      <span className="text-xs font-medium text-gray-700">{m.name}</span>
                      {m.dosage && <span className="text-xs text-gray-400">{m.dosage}</span>}
                      {m.reminder && <Bell size={9} className="text-amber-500"/>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filtered.length===0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No medications match this filter.</p>
            ) : (
              <div className="space-y-2.5">
                {filtered.map((med)=>(
                  <MedCard key={med.id} med={med} onEdit={openEdit} onDelete={handleDelete}/>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showModal && <MedModal userId={userId} editItem={editItem} onClose={closeModal} onSaved={fetchMeds}/>}
    </div>
  );
}
