import { useState, useEffect, useRef, useCallback } from "react";
import {
  FolderOpen, Upload, FileText, Trash2, Download, Plus,
  X, Loader2, StickyNote, File, AlertCircle, Eye, Search,
  ChevronDown, Image,
} from "lucide-react";
import { supabase } from "../api/supabaseClient";
import { useToast } from "../context/ToastContext";

const BUCKET = "medical-documents";

const FILE_CATEGORIES = [
  "All","Lab Reports","Prescriptions","X-Ray / Scan",
  "Discharge Summary","Insurance","Notes","Other",
];

function fileIcon(type = "") {
  if (type.startsWith("image/")) return <Image size={16} className="text-blue-500" />;
  if (type === "application/pdf") return <FileText size={16} className="text-red-500" />;
  return <File size={16} className="text-gray-400 dark:text-slate-500" />;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Document Shimmer Skeleton Loader ───────────────────────────
function DocumentSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-150 dark:bg-slate-800 flex-shrink-0 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-150 dark:bg-slate-850 rounded w-3/4 animate-pulse" />
              <div className="flex gap-2">
                <div className="h-2 bg-gray-150 dark:bg-slate-850 rounded w-12 animate-pulse" />
                <div className="h-2 bg-gray-150 dark:bg-slate-850 rounded w-16 animate-pulse" />
              </div>
            </div>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-slate-850 rounded w-4/5 mt-4 ml-12 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ── Add/Edit Modal ────────────────────────────────────────────
function AddModal({ userId, onClose, onSaved, editItem }) {
  const fileInputRef = useRef();
  const isEdit = Boolean(editItem);
  const { addToast } = useToast();
  const [mode, setMode]         = useState(editItem?.type === "note" ? "note" : "file");
  const [title, setTitle]       = useState(editItem?.title || "");
  const [note, setNote]         = useState(editItem?.note_content || "");
  const [category, setCategory] = useState(editItem?.category || "Other");
  const [file, setFile]         = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [progress, setProgress] = useState(0);

  const handleSave = async () => {
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (mode === "file" && !file && !isEdit) { setError("Please select a file."); return; }

    setSaving(true); setError(""); setProgress(0);

    try {
      let file_path = editItem?.file_path || null;
      let file_name = editItem?.file_name || null;
      let file_size = editItem?.file_size || 0;
      let file_type = editItem?.file_type || null;

      if (mode === "file" && file) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated. Please log in again.");

        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const path     = `${userId}/${safeName}`;

        setProgress(30);

        if (isEdit && editItem.file_path) {
          await supabase.storage.from(BUCKET).remove([editItem.file_path]);
        }

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert:       false,
            contentType:  file.type || "application/octet-stream",
          });

        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

        setProgress(70);
        file_path = path;
        file_name = file.name;
        file_size = file.size;
        file_type = file.type;
      }

      setProgress(85);

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

      let dbErr;
      if (isEdit) {
        ({ error: dbErr } = await supabase
          .from("user_documents")
          .update(payload)
          .eq("id", editItem.id));
      } else {
        ({ error: dbErr } = await supabase
          .from("user_documents")
          .insert(payload));
      }

      if (dbErr) throw new Error(dbErr.message);

      setProgress(100);
      addToast(isEdit ? "Item updated successfully!" : "Document saved successfully!", "success");
      onSaved();
      onClose();
    } catch (err) {
      console.error("[MyDocuments] Save error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      addToast(err.message || "Failed to save document", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-xs"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xl w-full max-w-md transition-colors"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800/80">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {isEdit ? "Edit item" : "Add new item"}
          </h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-350">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          {!isEdit && (
            <div className="flex gap-2">
              {["file", "note"].map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold transition ${
                    mode === m
                      ? "border-teal-400 bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-355"
                      : "border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700"
                  }`}>
                  {m === "file" ? <Upload size={14} /> : <StickyNote size={14} />}
                  {m === "file" ? "Upload file" : "Write note"}
                </button>
              ))}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === "file" ? "e.g. CBC Report March 2025" : "e.g. Doctor visit notes"}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-205 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/20 transition" />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Category</label>
            <div className="relative">
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-205 dark:border-slate-800 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 appearance-none bg-white dark:bg-slate-950 pr-8 transition">
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
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">
                File {isEdit && "(leave blank to keep current)"}
              </label>
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 rounded-xl p-4 text-center cursor-pointer hover:border-teal-300 dark:hover:border-teal-800 hover:bg-teal-50/40 dark:hover:bg-teal-950/10 transition">
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-teal-700 dark:text-teal-400 font-medium">
                    {fileIcon(file.type)}
                    <span className="truncate max-w-xs">{file.name}</span>
                    <span className="text-gray-400 font-normal">({formatBytes(file.size)})</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 dark:text-slate-500">
                    <Upload size={18} className="mx-auto mb-1 text-gray-300 dark:text-slate-700" />
                    Click to choose - PDF, images, Word docs, any format
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0] || null)} />
            </div>
          )}

          {/* Note textarea */}
          {mode === "note" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1.5">Note content</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Write anything - symptoms, doctor instructions, medication notes..."
                rows={5}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-205 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 resize-none focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/20 transition" />
            </div>
          )}

          {/* Progress bar */}
          {saving && progress > 0 && (
            <div className="w-full bg-gray-100 dark:bg-slate-950 rounded-full h-1.5">
              <div className="bg-teal-400 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
          )}

          {error && (
            <div className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-sm text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-850 transition font-semibold">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saving
              ? <><Loader2 size={13} className="animate-spin" />Saving...</>
              : isEdit ? "Update" : "Save"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Document card ─────────────────────────────────────────────
function DocCard({ item, onDelete, onEdit }) {
  const [deleting,    setDeleting]    = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { addToast } = useToast();

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setDeleting(true);
    try {
      if (item.file_path) {
        await supabase.storage.from(BUCKET).remove([item.file_path]);
      }
      const { error } = await supabase.from("user_documents").delete().eq("id", item.id);
      if (error) throw error;
      onDelete(item.id);
      addToast(`Deleted "${item.title}"`, "success");
    } catch (err) {
      addToast("Failed to delete document: " + err.message, "error");
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!item.file_path) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(item.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a   = document.createElement("a");
      a.href = url;
      a.download = item.file_name || "download";
      a.click();
      URL.revokeObjectURL(url);
      addToast("Download started!", "success");
    } catch (err) {
      addToast("Download failed: " + err.message, "error");
    } finally {
      setDownloading(false);
    }
  };

  const handleView = async () => {
    if (!item.file_path) return;
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(item.file_path, 120); // 2 min signed URL
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      addToast("Could not open file: " + err.message, "error");
    }
  };

  const isNote = item.type === "note";

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800/80 rounded-xl p-4 hover:border-teal-200 dark:hover:border-teal-950 hover:shadow-xs transition group flex flex-col justify-between min-h-[140px] transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isNote ? "bg-yellow-50 dark:bg-yellow-950/20" : "bg-blue-50 dark:bg-blue-950/20"}`}>
          {isNote
            ? <StickyNote size={16} className="text-yellow-500" />
            : fileIcon(item.file_type)
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-teal-705 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 border border-teal-100/50 dark:border-teal-900/30 px-2 py-0.5 rounded-full font-bold">
              {item.category}
            </span>
            {item.file_size > 0 && (
              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">{formatBytes(item.file_size)}</span>
            )}
            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">{formatDate(item.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition flex-shrink-0">
          {!isNote && (
            <>
              <button onClick={handleView} title="View"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition">
                <Eye size={13} />
              </button>
              <button onClick={handleDownload} disabled={downloading} title="Download"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-teal-650 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition">
                {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              </button>
            </>
          )}
          <button onClick={() => onEdit(item)} title="Edit"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition">
            <FileText size={13} />
          </button>
          <button onClick={handleDelete} disabled={deleting} title="Delete"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      {isNote && item.note_content && (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400 leading-relaxed line-clamp-3 pl-12 bg-gray-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-100 dark:border-slate-850/50 font-medium">
          {item.note_content}
        </p>
      )}
      {!isNote && item.file_name && (
        <p className="mt-2 text-xs text-gray-450 dark:text-slate-500 pl-12 truncate font-medium">{item.file_name}</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function MyDocuments({ userId }) {
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [search, setSearch]             = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [error, setError]               = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchErr } = await supabase
      .from("user_documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fetchErr) {
      console.error("[MyDocuments] Fetch error:", fetchErr);
      setError(fetchErr.message);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const openAdd  = ()     => { setEditItem(null);  setShowModal(true); };
  const openEdit = (item) => { setEditItem(item);  setShowModal(true); };

  const filtered = items.filter((item) => {
    const matchCat    = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase())
      || (item.note_content || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const fileCount = items.filter((i) => i.type === "file").length;
  const noteCount = items.filter((i) => i.type === "note").length;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 md:px-5 py-4 flex-shrink-0 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">My Documents</h2>
            <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
              {fileCount} files · {noteCount} notes
            </span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-xs font-semibold transition shadow-xs">
            <Plus size={13} /> Add new
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-405 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or content..."
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-850 bg-gray-55 dark:bg-slate-950 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 transition" />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-0.5 scrollbar-none">
          {FILE_CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-full border transition font-semibold ${
                activeCategory === cat
                  ? "bg-teal-50 dark:bg-teal-950/30 border-teal-400 text-teal-700 dark:text-teal-300"
                  : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-850 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700"
              }`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-100 flex gap-2 flex-shrink-0">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-red-600 font-bold">Database error</p>
            <p className="text-xs text-red-500 font-medium">{error}</p>
            <p className="text-xs text-red-400 mt-1 font-semibold">
              Make sure you've run supabase_complete_fix.sql in Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {loading ? (
          <DocumentSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center">
            <FolderOpen size={36} className="text-gray-200 dark:text-slate-800 mb-3" />
            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">
              {items.length === 0 ? "No documents yet" : "No results found"}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 mb-4">
              {items.length === 0
                ? "Upload files or write notes - prescriptions, lab reports, doctor notes..."
                : "Try a different search or category"}
            </p>
            {items.length === 0 && (
              <button onClick={openAdd}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition shadow-xs">
                <Plus size={14} /> Add your first item
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((item) => (
              <DocCard key={item.id} item={item}
                onDelete={handleDelete} onEdit={openEdit} />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AddModal userId={userId} editItem={editItem}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSaved={fetchItems} />
      )}
    </div>
  );
}
