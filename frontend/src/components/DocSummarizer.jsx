import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Upload, FileText, Trash2, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { uploadDocument, listDocuments, summarizeText } from "../api/medai";

function DocCard({ doc }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-teal-200 transition">
      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
        <FileText size={16} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{doc.summary}</p>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(doc.uploaded_at).toLocaleDateString()} · {doc.chunk_count} chunks indexed
        </p>
      </div>
    </div>
  );
}

export default function DocSummarizer({ userId }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [tab, setTab] = useState("upload"); // "upload" | "paste"
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDocs();
  }, [userId]);

  const fetchDocs = async () => {
    try {
      const res = await listDocuments(userId);
      setDocs(res.data.documents || []);
    } catch {
      setDocs([]);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    setError("");
    setUploading(true);
    setUploadSuccess("");
    try {
      const res = await uploadDocument(userId, file);
      setUploadSuccess(`✅ "${file.name}" uploaded and indexed (${res.data.chunks_indexed} chunks). You can now ask questions about it in the chat!`);
      setSummary(res.data.summary || "");
      fetchDocs();
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSummarizePaste = async () => {
    if (!pastedText.trim()) return;
    setSummarizing(true);
    setSummary("");
    setError("");
    try {
      const res = await summarizeText(userId, pastedText);
      setSummary(res.data.summary);
    } catch {
      setError("Summarization failed. Please try again.");
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Upload panel */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Medical Documents</h2>
          <p className="text-xs text-gray-500 mt-0.5">Upload PDFs — instantly indexed for AI queries</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {["upload", "paste"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition ${
                tab === t
                  ? "text-teal-700 border-b-2 border-teal-400"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "upload" ? "Upload PDF" : "Paste Text"}
            </button>
          ))}
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {tab === "upload" ? (
            <>
              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50 transition mb-4"
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={24} className="text-teal-400 animate-spin" />
                    <p className="text-xs text-teal-600 font-medium">Embedding & indexing...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={22} className="text-gray-400" />
                    <p className="text-xs font-medium text-gray-600">Click to upload PDF</p>
                    <p className="text-xs text-gray-400">Medical reports, prescriptions, lab results</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          ) : (
            <>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your medical report text here..."
                className="w-full h-36 rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-700 resize-none focus:outline-none focus:border-teal-400 mb-3"
              />
              <button
                onClick={handleSummarizePaste}
                disabled={summarizing || !pastedText.trim()}
                className="w-full py-2 rounded-lg bg-teal-400 hover:bg-teal-600 text-white text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {summarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {summarizing ? "Summarizing..." : "Summarize"}
              </button>
            </>
          )}

          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-100 mt-3">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
          {uploadSuccess && (
            <div className="p-3 rounded-lg bg-teal-50 border border-teal-100 mt-3">
              <p className="text-xs text-teal-700">{uploadSuccess}</p>
            </div>
          )}

          {/* Document list */}
          {docs.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-gray-500 mb-2">Your Documents ({docs.length})</p>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Summary display */}
      <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
        {summary ? (
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-teal-500" />
              <h3 className="text-sm font-semibold text-gray-900">Document Summary</h3>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-xs">
              <FileText size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No summary yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Upload a PDF or paste medical text on the left to get a simplified summary with key risks highlighted.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
