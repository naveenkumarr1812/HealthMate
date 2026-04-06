import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Upload, FileText, Loader2, Sparkles, AlertCircle,
  StickyNote, ChevronRight, X, FolderOpen } from "lucide-react";
import { uploadDocument, summarizeText } from "../api/HealthMate";
import { supabase } from "../api/supabaseClient";

const BUCKET = "medical-documents";

// ── Small saved-doc picker ───────────────────────────────────
function SavedDocPicker({ userId, onSelect }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("user_documents").select("id,title,type,note_content,file_path,file_name,category")
      .eq("user_id", userId).order("created_at", { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, [userId]);

  const handleSelect = async (item) => {
    if (item.type === "note") {
      onSelect(item.note_content || "", item.title);
      return;
    }
    // File - download and extract text via summarizeText endpoint
    if (!item.file_path) return;
    try {
      const { data: fileBlob } = await supabase.storage.from(BUCKET).download(item.file_path);
      // For PDFs the backend handles extraction; pass a note to user
      onSelect(`[File: ${item.file_name}]\nPlease summarize this document titled "${item.title}".`, item.title);
    } catch {
      onSelect(`Please summarize my document titled: "${item.title}"`, item.title);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
      <Loader2 size={14} className="animate-spin" /><span className="text-xs">Loading...</span>
    </div>
  );

  if (items.length === 0) return (
    <div className="flex flex-col items-center py-6 text-center px-4">
      <FolderOpen size={24} className="text-gray-200 mb-2" />
      <p className="text-xs text-gray-400">No saved documents yet.</p>
      <p className="text-xs text-gray-400">Upload files in My Documents first.</p>
    </div>
  );

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button key={item.id} onClick={() => handleSelect(item)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-teal-50 transition text-left group">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${item.type === "note" ? "bg-yellow-50" : "bg-blue-50"}`}>
            {item.type === "note"
              ? <StickyNote size={13} className="text-yellow-500" />
              : <FileText size={13} className="text-blue-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{item.title}</p>
            <p className="text-xs text-gray-400">{item.category}</p>
          </div>
          <ChevronRight size={13} className="text-gray-300 group-hover:text-teal-500 transition flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ── Main DocSummarizer ───────────────────────────────────────
export default function DocSummarizer({ userId }) {
  const [pastedText, setPastedText]   = useState("");
  const [activeTitle, setActiveTitle] = useState("");
  const [uploading, setUploading]     = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary]         = useState("");
  const [error, setError]             = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [inputTab, setInputTab]       = useState("paste"); // "paste" | "upload" | "saved"
  const fileInputRef = useRef();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".pdf")) { setError("Only PDF files supported for embedding."); return; }
    setError(""); setUploading(true); setUploadSuccess("");
    try {
      const res = await uploadDocument(userId, file);
      setUploadSuccess(`"${file.name}" uploaded (${res.data.chunks_indexed} chunks). Now summarizing...`);
      // Auto-fill text area with instruction to summarize
      setPastedText(`Summarize the document: ${file.name}\n\n${res.data.summary || ""}`);
      setSummary(res.data.summary || "");
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSummarize = async () => {
    if (!pastedText.trim()) return;
    setSummarizing(true); setSummary(""); setError("");
    try {
      const res = await summarizeText(userId, pastedText);
      setSummary(res.data.summary);
    } catch { setError("Summarization failed. Please try again."); }
    finally { setSummarizing(false); }
  };

  const handleSelectSaved = (text, title) => {
    setPastedText(text);
    setActiveTitle(title);
    setInputTab("paste"); // switch to paste tab to show the text
  };

  const clearAll = () => { setPastedText(""); setSummary(""); setError(""); setActiveTitle(""); };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">

      {/* ── Left panel ── */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-gray-200 bg-white flex flex-col flex-shrink-0 max-h-72 md:max-h-none">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Document Summarizer</h2>
          <p className="text-xs text-gray-500 mt-0.5">Paste text, upload PDF, or pick from your saved docs</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { id: "paste",  label: "Paste text" },
            { id: "upload", label: "Upload PDF" },
            { id: "saved",  label: "My Docs" },
          ].map((t) => (
            <button key={t.id} onClick={() => setInputTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-medium transition border-b-2 ${
                inputTab === t.id ? "text-teal-700 border-teal-400" : "text-gray-500 border-transparent hover:text-gray-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {inputTab === "paste" && (
            <>
              {activeTitle && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-1 rounded-full truncate max-w-[80%]">{activeTitle}</span>
                  <button onClick={clearAll}><X size={13} className="text-gray-400 hover:text-gray-600" /></button>
                </div>
              )}
              <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your medical report, prescription, discharge summary, or any health document here..."
                className="w-full h-36 md:h-48 rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-700 resize-none focus:outline-none focus:border-teal-400 transition"
              />
              <button onClick={handleSummarize} disabled={summarizing || !pastedText.trim()}
                className="w-full mt-3 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50">
                {summarizing ? <><Loader2 size={14} className="animate-spin" />Summarizing...</> : <><Sparkles size={14} />Summarize</>}
              </button>
            </>
          )}

          {inputTab === "upload" && (
            <>
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50 transition">
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={22} className="text-teal-400 animate-spin" />
                    <p className="text-xs text-teal-600 font-medium">Uploading & indexing...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={22} className="text-gray-300" />
                    <p className="text-xs font-medium text-gray-600">Click to upload PDF</p>
                    <p className="text-xs text-gray-400">Lab reports, prescriptions, scans</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              {uploadSuccess && <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-lg p-3 mt-3">{uploadSuccess}</p>}
            </>
          )}

          {inputTab === "saved" && (
            <SavedDocPicker userId={userId} onSelect={handleSelectSaved} />
          )}

          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-100 mt-3">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Summary display ── */}
      <div className="flex-1 bg-gray-50 overflow-y-auto p-4 md:p-6">
        {summarizing ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <Loader2 size={28} className="animate-spin text-teal-400" />
            <p className="text-sm">Analyzing your document...</p>
          </div>
        ) : summary ? (
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={15} className="text-teal-500" />
              <h3 className="text-sm font-semibold text-gray-900">Summary</h3>
              {activeTitle && <span className="text-xs text-gray-400">- {activeTitle}</span>}
              <button onClick={clearAll} className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <X size={12} />Clear
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 prose-h2:text-base prose-h3:text-sm">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FileText size={40} className="text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No summary yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Paste medical text, upload a PDF, or pick from your saved documents to get a simplified summary with key risks highlighted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
