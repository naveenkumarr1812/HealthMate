import { useState, useEffect } from "react";
import { Pill, Plus, X, Trash2, Edit2, Loader2, CheckCircle,
  Clock, AlertTriangle, ChevronDown, Bell, Calendar, Info } from "lucide-react";
import { supabase } from "../api/supabaseClient";

const FREQUENCIES = ["Once daily","Twice daily","Three times daily","Every 8 hours","Every 12 hours","Weekly","As needed","Other"];
const MEAL_TIMES   = ["Before meal","After meal","With meal","Empty stomach","No restriction"];
const CATEGORIES   = ["All","Active","Completed","As needed","Stopped"];
const MED_TYPES    = ["Tablet","Capsule","Syrup","Injection","Inhaler","Drops","Cream/Ointment","Other"];

function statusColor(status) {
  switch (status) {
    case "active":    return "bg-teal-50 text-teal-700 border-teal-200";
    case "completed": return "bg-blue-50 text-blue-700 border-blue-200";
    case "stopped":   return "bg-red-50 text-red-600 border-red-200";
    case "as_needed": return "bg-amber-50 text-amber-700 border-amber-200";
    default:          return "bg-gray-50 text-gray-600 border-gray-200";
  }
}

// ── Add/Edit Modal ────────────────────────────────────────────
function MedModal({ userId, onClose, onSaved, editItem }) {
  const isEdit = Boolean(editItem);
  const [form, setForm] = useState({
    name:         editItem?.name         || "",
    dosage:       editItem?.dosage       || "",
    type:         editItem?.type         || "Tablet",
    frequency:    editItem?.frequency    || "Once daily",
    meal_time:    editItem?.meal_time    || "After meal",
    start_date:   editItem?.start_date   || new Date().toISOString().split("T")[0],
    end_date:     editItem?.end_date     || "",
    status:       editItem?.status       || "active",
    prescribed_by:editItem?.prescribed_by|| "",
    notes:        editItem?.notes        || "",
    reminder:     editItem?.reminder     ?? false,
    reminder_time:editItem?.reminder_time|| "08:00",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Medication name is required."); return; }
    setSaving(true); setError("");
    try {
      const payload = { ...form, user_id: userId, updated_at: new Date().toISOString() };
      if (isEdit) {
        const { error: e } = await supabase.from("medications").update(payload).eq("id", editItem.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("medications").insert(payload);
        if (e) throw e;
      }
      onSaved(); onClose();
    } catch (err) { setError(err.message || "Save failed."); }
    finally { setSaving(false); }
  };

  const Input = ({ label, name, type = "text", ...rest }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={form[name]} onChange={(e) => set(name, e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal-400 transition" {...rest} />
    </div>
  );

  const Select = ({ label, name, options }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        <select value={form[name]} onChange={(e) => set(name, e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal-400 appearance-none bg-white pr-8 transition">
          {options.map((o) => <option key={o.value || o}>{o.label || o}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">{isEdit ? "Edit Medication" : "Add Medication"}</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Name + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Input label="Medication Name *" name="name" placeholder="e.g. Metformin" />
            </div>
            <Select label="Form" name="type" options={MED_TYPES} />
          </div>

          {/* Dosage + Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Dosage" name="dosage" placeholder="e.g. 500mg" />
            <Select label="Frequency" name="frequency" options={FREQUENCIES} />
          </div>

          {/* Meal time + Status */}
          <div className="grid grid-cols-2 gap-3">
            <Select label="When to take" name="meal_time" options={MEAL_TIMES} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <div className="relative">
                <select value={form.status} onChange={(e) => set("status", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal-400 appearance-none bg-white pr-8 transition">
                  <option value="active">Active</option>
                  <option value="as_needed">As needed</option>
                  <option value="completed">Completed</option>
                  <option value="stopped">Stopped</option>
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" name="start_date" type="date" />
            <Input label="End Date (optional)" name="end_date" type="date" />
          </div>

          {/* Prescribed by */}
          <Input label="Prescribed by (optional)" name="prescribed_by" placeholder="Dr. Sharma" />

          {/* Reminder toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-teal-600" />
              <span className="text-sm font-medium text-gray-700">Daily reminder</span>
            </div>
            <div className="flex items-center gap-3">
              {form.reminder && (
                <input type="time" value={form.reminder_time} onChange={(e) => set("reminder_time", e.target.value)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-teal-400" />
              )}
              <button onClick={() => set("reminder", !form.reminder)}
                className={`w-10 h-5 rounded-full transition-colors relative ${form.reminder ? "bg-teal-400" : "bg-gray-200"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.reminder ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              placeholder="Special instructions, side effects to watch, etc."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:border-teal-400 transition" />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>}
        </div>

        <div className="flex gap-3 px-5 pb-5 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Saving..." : isEdit ? "Update" : "Add Medication"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Medication Card ───────────────────────────────────────────
function MedCard({ med, onEdit, onDelete, onToggleStatus }) {
  const [deleting, setDeleting] = useState(false);
  const statusLabel = { active: "Active", completed: "Completed", stopped: "Stopped", as_needed: "As needed" };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${med.name}"?`)) return;
    setDeleting(true);
    const { error } = await supabase.from("medications").delete().eq("id", med.id);
    if (!error) onDelete(med.id);
    else { alert("Delete failed"); setDeleting(false); }
  };

  return (
    <div className={`bg-white border rounded-xl p-4 hover:shadow-sm transition group ${med.status === "stopped" ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
          <Pill size={16} className="text-teal-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{med.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(med.status)}`}>
              {statusLabel[med.status] || med.status}
            </span>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {med.dosage && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Info size={10} className="text-gray-400" />{med.dosage} · {med.type}
              </span>
            )}
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={10} className="text-gray-400" />{med.frequency}
            </span>
            {med.meal_time && (
              <span className="text-xs text-gray-500">{med.meal_time}</span>
            )}
            {med.prescribed_by && (
              <span className="text-xs text-gray-500">Dr. {med.prescribed_by}</span>
            )}
          </div>

          {/* Dates */}
          {(med.start_date || med.end_date) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {med.start_date && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar size={10} />From {new Date(med.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              )}
              {med.end_date && (
                <span className="text-xs text-gray-400">
                  → {new Date(med.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
          )}

          {/* Reminder */}
          {med.reminder && (
            <span className="inline-flex items-center gap-1 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full mt-1.5">
              <Bell size={10} />Reminder at {med.reminder_time}
            </span>
          )}

          {/* Notes */}
          {med.notes && (
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{med.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onEdit(med)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition">
            <Edit2 size={12} />
          </button>
          <button onClick={handleDelete} disabled={deleting} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────
function StatsBar({ meds }) {
  const active    = meds.filter((m) => m.status === "active").length;
  const asNeeded  = meds.filter((m) => m.status === "as_needed").length;
  const completed = meds.filter((m) => m.status === "completed").length;
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[
        { label: "Active",     count: active,    color: "bg-teal-50 text-teal-700 border-teal-100" },
        { label: "As needed",  count: asNeeded,  color: "bg-amber-50 text-amber-700 border-amber-100" },
        { label: "Completed",  count: completed, color: "bg-blue-50 text-blue-700 border-blue-100" },
      ].map((s) => (
        <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
          <p className="text-xl font-bold">{s.count}</p>
          <p className="text-xs font-medium mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function MedicationTracker({ userId }) {
  const [meds, setMeds]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [filter, setFilter]       = useState("All");
  const [search, setSearch]       = useState("");

  const fetchMeds = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("medications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setMeds(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMeds(); }, [userId]);

  const handleDelete   = (id)   => setMeds((p) => p.filter((m) => m.id !== id));
  const openAdd        = ()     => { setEditItem(null);  setShowModal(true); };
  const openEdit       = (item) => { setEditItem(item);  setShowModal(true); };

  const filtered = meds.filter((m) => {
    const matchFilter =
      filter === "All"        ? true :
      filter === "Active"     ? m.status === "active"    :
      filter === "Completed"  ? m.status === "completed" :
      filter === "As needed"  ? m.status === "as_needed" :
      filter === "Stopped"    ? m.status === "stopped"   : true;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
                        m.prescribed_by?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  // Today's medications
  const todayMeds = meds.filter((m) => m.status === "active" || m.status === "as_needed");

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-5 py-3 md:py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Pill size={15} className="text-teal-600" />
            <h2 className="text-sm font-semibold text-gray-900">Medication Tracker</h2>
            <span className="text-xs text-gray-400">{meds.length} total</span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-xs font-medium transition">
            <Plus size={13} />Add
          </button>
        </div>

        {/* Search */}
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medications..."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-teal-400 transition mb-3" />

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition font-medium ${
                filter === c ? "bg-teal-50 border-teal-400 text-teal-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading medications...</span>
          </div>
        ) : meds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center">
            <Pill size={36} className="text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No medications added</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Track your daily medications, dosages, and reminders</p>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition">
              <Plus size={14} />Add first medication
            </button>
          </div>
        ) : (
          <>
            <StatsBar meds={meds} />

            {/* Today's schedule */}
            {todayMeds.length > 0 && filter === "All" && !search && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock size={11} />Today's Schedule
                </p>
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 flex flex-wrap gap-2">
                  {todayMeds.map((m) => (
                    <div key={m.id} className="flex items-center gap-1.5 bg-white border border-teal-100 rounded-lg px-3 py-1.5">
                      <Pill size={12} className="text-teal-500" />
                      <span className="text-xs font-medium text-gray-700">{m.name}</span>
                      {m.dosage && <span className="text-xs text-gray-400">{m.dosage}</span>}
                      <span className="text-xs text-teal-600">{m.frequency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No medications match this filter.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {filter === "All" ? "All Medications" : filter} ({filtered.length})
                </p>
                {filtered.map((med) => (
                  <MedCard key={med.id} med={med} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <MedModal userId={userId} editItem={editItem}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSaved={fetchMeds} />
      )}
    </div>
  );
}