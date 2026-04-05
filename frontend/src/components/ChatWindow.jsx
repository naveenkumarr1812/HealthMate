import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Plus, Trash2, MessageSquare, Loader2, MapPin,
  FileText, ChevronLeft, Edit2, Check, X, Menu,
  Paperclip, Image, FileUp } from "lucide-react";
import { supabase } from "../api/supabaseClient";
import { uploadDocument } from "../api/medai";
import axios from "axios";

const API = axios.create({ baseURL: "/api" });
API.interceptors.request.use((c) => {
  const t = localStorage.getItem("access_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// ── Long-term memory ─────────────────────────────────────────
async function loadLongTermMemory(userId) {
  const { data } = await supabase.from("user_long_term_memory")
    .select("memory_text").eq("user_id", userId).maybeSingle();
  return data?.memory_text || "";
}
async function updateLongTermMemory(userId, currentMemory, msgs) {
  try {
    const res = await API.post("/chat/update-memory", {
      user_id: userId, current_memory: currentMemory, messages: msgs.slice(-10),
    });
    if (res.data?.memory) {
      await supabase.from("user_long_term_memory").upsert(
        { user_id: userId, memory_text: res.data.memory, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      return res.data.memory;
    }
  } catch (e) { console.warn("Memory update:", e.message); }
  return currentMemory;
}

// ── GPS ──────────────────────────────────────────────────────
function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null), { timeout: 8000 }
    );
  });
}
const LOCATION_TRIGGERS = [
  "nearest","nearby","near me","hospital","clinic","doctor near","pharmacy near",
  "best doctor","medical center","emergency near","find doctor","find hospital",
  "specialists near","cancer doctor","where to go","which hospital","which doctor",
  "health center","nursing home","dispensary",
];
const needsLocation = (t) => LOCATION_TRIGGERS.some((k) => t.toLowerCase().includes(k));

// ── Doc picker ───────────────────────────────────────────────
function DocPicker({ userId, onInsert, onClose }) {
  const [docs, setDocs]   = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("user_documents").select("id,title,type,note_content,category")
      .eq("user_id", userId).order("created_at", { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false); });
  }, [userId]);
  return (
    <div className="border border-gray-200 rounded-2xl bg-white shadow-lg mb-2 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <FileText size={12} className="text-teal-500" /> Pick a saved document to summarize
        </span>
        <button onClick={onClose}><X size={14} className="text-gray-400 hover:text-gray-600" /></button>
      </div>
      <div className="max-h-52 overflow-y-auto">
        {loading && <p className="text-xs text-gray-400 text-center py-4">Loading...</p>}
        {!loading && docs.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No saved documents yet.</p>
        )}
        {docs.map((d) => (
          <button key={d.id} onClick={() => {
            const text = d.type === "note" && d.note_content
              ? `Please summarize this medical document titled "${d.title}":\n\n${d.note_content}`
              : `Please summarize my saved document titled "${d.title}" in simple English with key findings and risks.`;
            onInsert(text); onClose();
          }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-teal-50 transition text-left group border-b border-gray-50 last:border-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${d.type==="note"?"bg-yellow-50":"bg-blue-50"}`}>
              <FileText size={13} className={d.type==="note"?"text-yellow-500":"text-blue-500"} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 truncate group-hover:text-teal-700">{d.title}</p>
              <p className="text-xs text-gray-400">{d.category}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── File Upload in Chat ──────────────────────────────────────
function FileUploadPreview({ file, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 mb-2">
      <FileUp size={14} className="text-teal-600 flex-shrink-0" />
      <span className="text-xs text-teal-700 font-medium truncate flex-1">{file.name}</span>
      <span className="text-xs text-teal-500">{(file.size/1024).toFixed(0)}KB</span>
      <button onClick={onRemove}><X size={13} className="text-teal-400 hover:text-teal-700" /></button>
    </div>
  );
}

// ── Avatars ──────────────────────────────────────────────────
function AIAvatar() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    </div>
  );
}
function UserAvatar() {
  const name    = localStorage.getItem("user_name") || "U";
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-gradient-to-br from-violet-400 to-purple-600 shadow-sm text-white text-xs font-semibold">
      {initials}
    </div>
  );
}

// ── Message ──────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <AIAvatar />}
      <div className="max-w-[80%] md:max-w-[72%]">
        {/* File attachment indicator */}
        {msg.hasFile && (
          <div className="flex items-center gap-1.5 mb-1.5 justify-end">
            <Paperclip size={11} className="text-teal-500" />
            <span className="text-xs text-gray-400">{msg.fileName}</span>
          </div>
        )}
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-tr-sm shadow-sm"
            : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none
              prose-p:text-gray-700 prose-p:my-1.5 prose-p:leading-relaxed
              prose-li:text-gray-700 prose-li:my-0.5
              prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:my-2
              prose-strong:text-gray-900 prose-strong:font-semibold
              prose-code:text-teal-700 prose-code:bg-teal-50 prose-code:px-1.5 prose-code:rounded prose-code:text-xs
              prose-a:text-teal-600 prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-teal-300 prose-blockquote:text-gray-600
              prose-ul:my-2 prose-ol:my-2">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {msg.location_used && (
          <div className="flex items-center gap-1 mt-1 ml-1">
            <MapPin size={10} className="text-teal-500" />
            <span className="text-xs text-gray-400">Used your GPS location</span>
          </div>
        )}
      </div>
      {isUser && <UserAvatar />}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <AIAvatar />
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center">
          {[0,1,2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
              style={{ animationDelay: `${i*0.18}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Thread Panel ─────────────────────────────────────────────
function ThreadPanel({ userId, activeThreadId, onSelect, onNew }) {
  const [threads, setThreads] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState("");

  const fetchThreads = useCallback(async () => {
    const { data } = await supabase.from("chat_threads")
      .select("id,title,updated_at").eq("user_id", userId)
      .order("updated_at", { ascending: false });
    setThreads(data || []);
  }, [userId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);
  useEffect(() => {
    const h = () => fetchThreads();
    window.addEventListener("medai:thread-updated", h);
    return () => window.removeEventListener("medai:thread-updated", h);
  }, [fetchThreads]);

  const rename = async (id) => {
    if (!editVal.trim()) return;
    await supabase.from("chat_threads").update({ title: editVal.trim() }).eq("id", id);
    setEditing(null); fetchThreads();
  };
  const deleteThread = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    await supabase.from("chat_messages").delete().eq("thread_id", id);
    await supabase.from("chat_threads").delete().eq("id", id);
    fetchThreads();
    if (activeThreadId === id) onNew();
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-gray-600">Conversations</span>
        <button onClick={onNew} className="w-6 h-6 rounded-lg bg-teal-400 hover:bg-teal-600 text-white flex items-center justify-center transition">
          <Plus size={13} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {threads.length === 0 && <p className="text-xs text-gray-400 text-center py-5 px-2">Start a new conversation!</p>}
        {threads.map((t) => (
          <div key={t.id} onClick={() => onSelect(t.id)}
            className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition mb-0.5 ${
              activeThreadId === t.id ? "bg-teal-50 border border-teal-100" : "hover:bg-gray-50"
            }`}>
            <MessageSquare size={12} className={`flex-shrink-0 ${activeThreadId===t.id?"text-teal-500":"text-gray-300"}`} />
            {editing === t.id ? (
              <input value={editVal} onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => { if(e.key==="Enter") rename(t.id); if(e.key==="Escape") setEditing(null); }}
                onClick={(e) => e.stopPropagation()} autoFocus
                className="flex-1 text-xs border border-teal-400 rounded px-1.5 py-0.5 focus:outline-none min-w-0" />
            ) : (
              <span className={`flex-1 text-xs truncate min-w-0 ${activeThreadId===t.id?"text-teal-700 font-medium":"text-gray-600"}`}>
                {t.title}
              </span>
            )}
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
              {editing === t.id
                ? <button onClick={(e)=>{e.stopPropagation();rename(t.id);}} className="text-teal-500"><Check size={11}/></button>
                : <button onClick={(e)=>{e.stopPropagation();setEditing(t.id);setEditVal(t.title);}} className="text-gray-300 hover:text-gray-600"><Edit2 size={11}/></button>
              }
              <button onClick={(e)=>deleteThread(t.id,e)} className="text-gray-300 hover:text-red-500"><Trash2 size={11}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ChatWindow ──────────────────────────────────────────
export default function ChatWindow({ userId }) {
  const [threadId, setThreadId]         = useState(null);
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [showThreads, setShowThreads]   = useState(() => window.innerWidth >= 768);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [pendingFile, setPendingFile]   = useState(null);  // file attached in chat
  const [uploadingFile, setUploadingFile] = useState(false);
  const [longTermMemory, setLongTermMemory] = useState("");
  const [locStatus, setLocStatus]       = useState("idle");
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load long-term memory
  useEffect(() => {
    if (userId) {
      loadLongTermMemory(userId).then(setLongTermMemory);
      supabase.auth.getUser().then(({ data }) => {
        const name = data?.user?.user_metadata?.full_name || data?.user?.email?.split("@")[0] || "U";
        localStorage.setItem("user_name", name);
      });
    }
  }, [userId]);

  const createNewThread = useCallback(async () => {
    const { data } = await supabase.from("chat_threads").insert({
      user_id: userId, title: "New chat", updated_at: new Date().toISOString(),
    }).select("id").single();
    if (data) { setThreadId(data.id); setMessages([]); }
  }, [userId]);

  const loadThread = useCallback(async (tid) => {
    setThreadId(tid);
    const { data } = await supabase.from("chat_messages")
      .select("role,content,location_used").eq("thread_id", tid)
      .order("created_at", { ascending: true });
    setMessages(data?.map((m) => ({
      role: m.role, content: m.content, location_used: m.location_used, sources: []
    })) || []);
  }, []);

  useEffect(() => {
    if (!userId || threadId) return;
    supabase.from("chat_threads").select("id").eq("user_id", userId)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) loadThread(data.id); else createNewThread(); });
  }, [userId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    const h = () => { if (window.innerWidth < 768) setShowThreads(false); };
    h();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const saveMessage = async (role, content, locationUsed = false) => {
    if (!threadId) return;
    await supabase.from("chat_messages").insert({ thread_id: threadId, role, content, location_used: locationUsed });
    await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
    window.dispatchEvent(new Event("medai:thread-updated"));
  };

  const autoName = async (text) => {
    const title = text.length > 40 ? text.slice(0, 37) + "..." : text;
    await supabase.from("chat_threads").update({ title }).eq("id", threadId);
    window.dispatchEvent(new Event("medai:thread-updated"));
  };

  // Handle file attachment in chat
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) { setPendingFile(file); setShowDocPicker(false); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async (overrideText) => {
    const text = (overrideText || input).trim();
    if ((!text && !pendingFile) || loading) return;
    setInput(""); setLoading(true); setShowDocPicker(false);

    // Auto-name on first message
    const userCount = messages.filter((m) => m.role === "user").length;
    if (userCount === 0) autoName(pendingFile ? `[File] ${pendingFile.name}` : text);

    // Handle file upload
    let fileContent = "";
    let hasFile = false;
    let fileName = "";
    if (pendingFile) {
      setUploadingFile(true);
      try {
        const res = await uploadDocument(userId, pendingFile);
        fileContent = `\n\n[User uploaded a medical document: "${pendingFile.name}". ${res.data.summary || "Please analyze this document."}]`;
        hasFile = true;
        fileName = pendingFile.name;
        // Show success
        setMessages((p) => [...p, {
          role: "assistant",
          content: `✅ **${pendingFile.name}** saved to My Documents (${res.data.chunks_indexed} sections indexed).\n\nI can now answer questions about it. What would you like to know?`,
          sources: []
        }]);
      } catch (err) {
        setMessages((p) => [...p, { role: "assistant", content: `❌ Could not upload file: ${err.response?.data?.detail || "Please try again."}`, sources: [] }]);
        setLoading(false); setUploadingFile(false); setPendingFile(null); return;
      }
      setUploadingFile(false); setPendingFile(null);
      if (!text) { setLoading(false); return; } // file only, no text
    }

    // GPS if needed
    let locationContext = "";
    let locationUsed = false;
    if (needsLocation(text)) {
      setLocStatus("fetching");
      const loc = await getUserLocation();
      if (loc) {
        locationContext = `lat=${loc.lat.toFixed(5)},lng=${loc.lng.toFixed(5)}`;
        locationUsed = true; setLocStatus("got");
      } else { setLocStatus("denied"); }
    }

    const fullQuery = text + fileContent;
    const userMsg   = { role: "user", content: text, location_used: false, sources: [], hasFile, fileName };
    setMessages((p) => [...p, userMsg]);
    await saveMessage("user", text + (hasFile ? ` [Attached: ${fileName}]` : ""), false);

    // Build conversation history for context (last 10 exchanges)
    const convHistory = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await API.post("/chat", {
        user_id: userId, query: fullQuery, mode: "chat",
        long_term_memory: longTermMemory,
        location_context: locationContext,
        conversation_history: convHistory,
      });
      const aiContent = res.data.response;
      const aiMsg     = { role: "assistant", content: aiContent, location_used: locationUsed, sources: res.data.sources_used || [] };
      setMessages((p) => [...p, aiMsg]);
      await saveMessage("assistant", aiContent, locationUsed);

      // Update long-term memory every 8 messages
      const allMsgs = [...messages, userMsg, aiMsg];
      if (allMsgs.length > 0 && allMsgs.length % 8 === 0) {
        const updated = await updateLongTermMemory(userId, longTermMemory, allMsgs);
        setLongTermMemory(updated);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || "Something went wrong.";
      setMessages((p) => [...p, { role: "assistant", content: `Sorry, ${detail}`, sources: [] }]);
    } finally {
      setLoading(false); setLocStatus("idle");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const SUGGESTIONS = [
    "I have a headache since 2 days",
    "Find nearest hospital",
    "What is HbA1c?",
    "Summarize my blood report",
  ];

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">
      {/* Thread panel */}
      <div className={`flex-shrink-0 border-r border-gray-200 transition-all duration-200 overflow-hidden ${showThreads ? "w-48 md:w-52" : "w-0"}`}>
        <ThreadPanel userId={userId} activeThreadId={threadId}
          onSelect={(id) => { loadThread(id); if (window.innerWidth < 768) setShowThreads(false); }}
          onNew={() => { createNewThread(); if (window.innerWidth < 768) setShowThreads(false); }} />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-3 py-2 flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowThreads((p) => !p)}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition flex-shrink-0">
            <Menu size={15} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {longTermMemory && <span className="text-xs text-purple-500 hidden sm:inline">🧠 Memory active</span>}
            {locStatus === "fetching" && <span className="text-xs text-teal-600 flex items-center gap-1"><MapPin size={11} className="animate-pulse"/>Getting location...</span>}
            {locStatus === "got"      && <span className="text-xs text-teal-600 flex items-center gap-1"><MapPin size={11}/>Location found</span>}
            {locStatus === "denied"   && <span className="text-xs text-amber-500 flex items-center gap-1"><MapPin size={11}/>Location unavailable — share your city</span>}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-3.5">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mb-4 shadow-md">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-800 mb-1">How can I help you?</h3>
              <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                Ask about symptoms, find hospitals, upload reports, or chat about your health.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-5 w-full max-w-sm">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-xs bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 transition text-left leading-snug shadow-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
          {(loading || uploadingFile) && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-gray-100 px-3 py-3 flex-shrink-0">
          {showDocPicker && (
            <DocPicker userId={userId}
              onInsert={(text) => { setInput(text); setShowDocPicker(false); setTimeout(() => textareaRef.current?.focus(), 50); }}
              onClose={() => setShowDocPicker(false)} />
          )}
          {pendingFile && (
            <FileUploadPreview file={pendingFile} onRemove={() => setPendingFile(null)} />
          )}
          <div className="flex gap-2 items-end">
            {/* Saved doc summarize */}
            <button onClick={() => setShowDocPicker((p) => !p)} title="Summarize a saved document"
              className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition ${
                showDocPicker ? "bg-teal-50 border-teal-400 text-teal-600" : "border-gray-200 text-gray-400 hover:border-teal-300 hover:text-teal-500 hover:bg-teal-50"
              }`}>
              <FileText size={15} />
            </button>

            {/* Upload file */}
            <button onClick={() => fileInputRef.current?.click()} title="Upload a medical document"
              className="w-9 h-9 rounded-xl border border-gray-200 text-gray-400 hover:border-teal-300 hover:text-teal-500 hover:bg-teal-50 flex items-center justify-center flex-shrink-0 transition">
              <Paperclip size={15} />
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileSelect} className="hidden" />

            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingFile ? "Add a message about this file (optional)..." : "Ask anything — symptoms, reports, hospitals, medications..."}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition leading-relaxed bg-gray-50"
              style={{ minHeight: "42px", maxHeight: "120px" }}
            />
            <button onClick={() => sendMessage()} disabled={loading || (!input.trim() && !pendingFile)}
              className="w-9 h-9 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white flex items-center justify-center transition flex-shrink-0 shadow-sm">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-xs text-gray-300 mt-1.5 px-1">
            📍 Auto GPS for hospitals · 📄 Saved docs · 📎 Upload report
          </p>
        </div>
      </div>
    </div>
  );
}
