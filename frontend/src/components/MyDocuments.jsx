import { useState, useEffect, useRef } from "react";
import {
  FolderOpen, Upload, FileText, Trash2, Download, Plus,
  X, Loader2, StickyNote, Image, File, AlertCircle,
  Eye, Search, ChevronDown,
} from "lucide-react";
import { supabase } from "../api/supabaseClient";

// ─── helpers ────────────────────────────────────────────────
const BUCKET = "medical-documents";

const FILE_CATEGORIES = [
  "All",
  "Lab Reports",
  "Prescriptions",
  "X-Ray / Scan",
  "Discharge Summary",
  "Insurance",
  "Notes",
  "Other",
];

function fileIcon(type = "") {
  if (type.startsWith("image/")) return <Image size={16} className="text-blue-500" />;
  if (type === "application/pdf")  return <FileText size={16} className="text-red-500" />;
  return <File size={16} className="text-gray-400" />;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Add / Edit modal ────────────────────────────────────────
function AddModal({ userId, onClose, onSaved, editItem }) {
  const fileInputRef = useRef();
  const [mode, setMode]         = useState(editItem?.type === "note" ? "note" : "file");
  const [title, setTitle]       = useState(editItem?.title || "");
  const [note, setNote]         = useState(editItem?.note_content || "");
  const [category, setCategory] = useState(editItem?.category || "Other");
  const [file, setFile]         = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const isEdit = Boolean(editItem);

  const handleSave = async () => {
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (mode === "file" && !file && !isEdit) { setError("Please select a file."); return; }

    setSaving(true);
    setError("");

    try {
      let file_path = editItem?.file_path || null;
      let file_name = editItem?.file_name || null;
      let file_size = editItem?.file_size || 0;
      let file_type = editItem?.file_type || null;

      // Upload file to Supabase Storage
      if (mode === "file" && file) {
        const ext      = file.name.split(".").pop();
        const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
        const path     = `${userId}/${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });

        if (uploadErr) throw uploadErr;

        // Delete old file if replacing
        if (isEdit && editItem.file_path) {
          await supabase.storage.from(BUCKET).remove([editItem.file_path]);
        }

        file_path = path;
        file_name = file.name;
        file_size = file.size;
        file_type = file.type;
      }

      const payload = {
        user_id:      userId,
        title:        title.trim(),
        category,
        type:         mode,
        note_content: mode === "note" ? note : null,
        file_path,
        file_name,
        file_size,
        file_type,
        updated_at:   new Date().toISOString(),
      };

      if (isEdit) {
        const { error: dbErr } = await supabase
          .from("user_documents")
          .update(payload)
          .eq("id", editItem.id);
        if (dbErr) throw dbErr;
      } else {
        const { error: dbErr } = await supabase
          .from("user_documents")
          .insert(payload);
        if (dbErr) throw dbErr;
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            {isEdit ? "Edit item" : "Add new item"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode toggle (only on create) */}
          {!isEdit && (
            <div className="flex gap-2">
              {["file", "note"].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition ${
                    mode === m
                      ? "border-teal-400 bg-teal-50 text-teal-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {m === "file" ? <Upload size={14} /> : <StickyNote size={14} />}
                  {m === "file" ? "Upload file" : "Write note"}
                </button>
              ))}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === "file" ? "e.g. CBC Report March 2025" : "e.g. Doctor visit notes"}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal-400 appearance-none bg-white pr-8 transition"
              >
                {FILE_CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* File picker */}
          {mode === "file" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                File {isEdit && "(leave blank to keep current)"}
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50 transition"
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-teal-700 font-medium">
                    {fileIcon(file.type)}
                    <span className="truncate max-w-xs">{file.name}</span>
                    <span className="text-gray-400 font-normal">({formatBytes(file.size)})</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    <Upload size={18} className="mx-auto mb-1 text-gray-300" />
                    Click to choose — PDF, images, docs, any format
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </div>
          )}

          {/* Note textarea */}
          {mode === "note" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Note content</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write anything — symptoms, doctor instructions, medication notes..."
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition"
              />
            </div>
          )}

          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Saving..." : isEdit ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Document card ───────────────────────────────────────────
function DocCard({ item, onDelete, onEdit, userId }) {
  const [deleting, setDeleting]   = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      // Remove file from Storage if exists
      if (item.file_path) {
        await supabase.storage.from(BUCKET).remove([item.file_path]);
      }
      await supabase.from("user_documents").delete().eq("id", item.id);
      onDelete(item.id);
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!item.file_path) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(item.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a   = document.createElement("a");
      a.href    = url;
      a.download = item.file_name || "download";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleView = async () => {
    if (!item.file_path) return;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(item.file_path);
    // For signed URL (private bucket):
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(item.file_path, 60);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  };

  const isNote = item.type === "note";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-200 hover:shadow-sm transition group">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isNote ? "bg-yellow-50" : "bg-blue-50"
        }`}>
          {isNote
            ? <StickyNote size={16} className="text-yellow-500" />
            : fileIcon(item.file_type)
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-medium">
              {item.category}
            </span>
            {item.file_size > 0 && (
              <span className="text-xs text-gray-400">{formatBytes(item.file_size)}</span>
            )}
            <span className="text-xs text-gray-400">{formatDate(item.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          {!isNote && (
            <>
              <button
                onClick={handleView}
                title="View"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
              >
                <Eye size={13} />
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                title="Download"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition"
              >
                {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              </button>
            </>
          )}
          <button
            onClick={() => onEdit(item)}
            title="Edit"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition"
          >
            <FileText size={13} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      {/* Note preview */}
      {isNote && item.note_content && (
        <p className="mt-2.5 text-xs text-gray-500 leading-relaxed line-clamp-3 pl-12">
          {item.note_content}
        </p>
      )}

      {/* File name */}
      {!isNote && item.file_name && (
        <p className="mt-1.5 text-xs text-gray-400 pl-12 truncate">{item.file_name}</p>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────
export default function MyDocuments({ userId }) {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [search, setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_documents")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error("Fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [userId]);

  const handleDelete = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const openAdd  = ()     => { setEditItem(null); setShowModal(true); };
  const openEdit = (item) => { setEditItem(item);  setShowModal(true); };

  // Filter
  const filtered = items.filter((item) => {
    const matchCat    = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
                        item.note_content?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const fileCount = items.filter((i) => i.type === "file").length;
  const noteCount = items.filter((i) => i.type === "note").length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-teal-600" />
            <h2 className="text-sm font-semibold text-gray-900">My Documents</h2>
            <span className="text-xs text-gray-400 font-normal ml-1">
              {fileCount} files · {noteCount} notes
            </span>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-xs font-medium transition"
          >
            <Plus size={13} />
            Add new
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or content..."
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {FILE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${
                activeCategory === cat
                  ? "bg-teal-50 border-teal-400 text-teal-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading your documents...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center">
            <FolderOpen size={36} className="text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">
              {items.length === 0 ? "No documents yet" : "No results found"}
            </p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              {items.length === 0
                ? "Upload files or write notes — prescriptions, lab reports, doctor instructions..."
                : "Try a different search or category"}
            </p>
            {items.length === 0 && (
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition"
              >
                <Plus size={14} />
                Add your first item
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((item) => (
              <DocCard
                key={item.id}
                item={item}
                userId={userId}
                onDelete={handleDelete}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <AddModal
          userId={userId}
          editItem={editItem}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSaved={fetchItems}
        />
      )}
    </div>
  );
}
