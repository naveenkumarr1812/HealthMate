import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Plus, Trash2, MessageSquare, Loader2, MapPin,
  FileText, Edit2, Check, X, Menu, Paperclip } from "lucide-react";
import { supabase } from "../api/supabaseClient";
import { uploadDocument } from "../api/HealthMate";
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
      user_id: userId, current_memory: currentMemory,
      messages: msgs.slice(-10),
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
  "nearest","nearby","near me","hospital","clinic","doctor near",
  "pharmacy near","best doctor","medical center","emergency near",
  "find doctor","find hospital","specialists near","where to go",
  "which hospital","which doctor","health center","dispensary",
];
const needsLocation = (t) => LOCATION_TRIGGERS.some((k) => t.toLowerCase().includes(k));

// ── Doc picker ───────────────────────────────────────────────
function DocPicker({ userId, onInsert, onClose }) {
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("user_documents")
      .select("id,title,type,note_content,category")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false); });
  }, [userId]);

  return (
    <div className="border border-gray-250 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-lg mb-2 overflow-hidden transition-colors">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-slate-800/80">
        <span className="text-xs font-semibold text-gray-600 dark:text-slate-400 flex items-center gap-1.5">
          <FileText size={12} className="text-teal-500" />
          Pick a saved document to summarize
        </span>
        <button onClick={onClose}><X size={14} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-350" /></button>
      </div>
      <div className="max-h-52 overflow-y-auto">
        {loading && <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">Loading...</p>}
        {!loading && docs.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4 px-3">
            No saved documents yet. Upload in My Documents first.
          </p>
        )}
        {docs.map((d) => (
          <button key={d.id}
            onClick={() => {
              const text = d.type === "note" && d.note_content
                ? `Please summarize this medical document titled "${d.title}":\n\n${d.note_content}`
                : `Please summarize my saved document titled "${d.title}" in simple English with key findings and risks.`;
              onInsert(text); onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition text-left group border-b border-gray-50 dark:border-slate-850/50 last:border-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${d.type === "note" ? "bg-yellow-50 dark:bg-yellow-950/25" : "bg-blue-50 dark:bg-blue-950/25"}`}>
              <FileText size={13} className={d.type === "note" ? "text-yellow-500" : "text-blue-500"} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate group-hover:text-teal-700 dark:group-hover:text-teal-400">{d.title}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">{d.category}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── File Upload Preview ──────────────────────────────────────
function FileUploadPreview({ file, onRemove }) {
  return (
    <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/50 rounded-xl px-3 py-2 mb-2">
      <Paperclip size={14} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
      <span className="text-xs text-teal-700 dark:text-teal-300 font-medium truncate flex-1">{file.name}</span>
      <span className="text-xs text-teal-500 dark:text-teal-400">{(file.size / 1024).toFixed(0)}KB</span>
      <button onClick={onRemove}><X size={13} className="text-teal-400 dark:text-teal-600 hover:text-teal-750 dark:hover:text-teal-300" /></button>
    </div>
  );
}

// ── Avatars ──────────────────────────────────────────────────
function AIAvatar() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
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
        {msg.hasFile && (
          <div className="flex items-center gap-1.5 mb-1 justify-end">
            <Paperclip size={11} className="text-teal-500" />
            <span className="text-xs text-gray-400 dark:text-slate-500">{msg.fileName}</span>
          </div>
        )}
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-tr-sm shadow-sm"
            : "bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-slate-200 rounded-tl-sm shadow-sm"
        }`}>
          {isUser
            ? <p className="whitespace-pre-wrap">{msg.content}</p>
            : (
              <div className="prose prose-sm max-w-none dark:prose-invert
                prose-p:text-gray-700 dark:prose-p:text-slate-300 prose-p:my-1.5 prose-p:leading-relaxed
                prose-li:text-gray-700 dark:prose-li:text-slate-300 prose-li:my-0.5
                prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-slate-100 prose-headings:my-2
                prose-strong:text-gray-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold
                prose-code:text-teal-700 dark:prose-code:text-teal-400 prose-code:bg-teal-50 dark:prose-code:bg-teal-950/40 prose-code:px-1.5 prose-code:rounded prose-code:text-xs
                prose-a:text-teal-600 dark:prose-a:text-teal-400 prose-a:no-underline hover:prose-a:underline
                prose-ul:my-2 prose-ol:my-2">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )
          }
        </div>
        {msg.location_used && (
          <div className="flex items-center gap-1 mt-1 ml-1">
            <MapPin size={10} className="text-teal-500" />
            <span className="text-xs text-gray-400 dark:text-slate-500">Used your GPS location</span>
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
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm transition-colors">
        <div className="flex gap-1.5 items-center">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
              style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Thread Panel ─────────────────────────────────────────────
function ThreadPanel({ userId, activeThreadId, onSelect, onNew, onDeleteThread }) {
  const [threads, setThreads] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState("");

  const fetchThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (!error) setThreads(data || []);
  }, [userId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Refresh on thread update events
  useEffect(() => {
    const h = () => fetchThreads();
    window.addEventListener("HealthMate:thread-updated", h);
    return () => window.removeEventListener("HealthMate:thread-updated", h);
  }, [fetchThreads]);

  const rename = async (id) => {
    if (!editVal.trim()) { setEditing(null); return; }
    const { error } = await supabase
      .from("chat_threads")
      .update({ title: editVal.trim() })
      .eq("id", id);
    if (!error) {
      setEditing(null);
      fetchThreads();
    }
  };

  const deleteThread = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    // Delete messages first (FK constraint)
    await supabase.from("chat_messages").delete().eq("thread_id", id);
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (!error) {
      fetchThreads();
      onDeleteThread(id); // notify parent
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 transition-colors">
      <div className="px-3 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-gray-600 dark:text-slate-400">Conversations</span>
        <button onClick={onNew}
          className="w-6 h-6 rounded-lg bg-teal-400 hover:bg-teal-600 text-white flex items-center justify-center transition">
          <Plus size={13} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {threads.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-5 px-2">
            No conversations yet. Start one!
          </p>
        )}
        {threads.map((t) => (
          <div key={t.id} onClick={() => onSelect(t.id)}
            className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition mb-0.5 ${
              activeThreadId === t.id
                ? "bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40"
                : "hover:bg-gray-50 dark:hover:bg-slate-800/40"
            }`}>
            <MessageSquare size={12} className={`flex-shrink-0 ${activeThreadId === t.id ? "text-teal-500" : "text-gray-300 dark:text-slate-600"}`} />
            {editing === t.id ? (
              <input value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename(t.id);
                  if (e.key === "Escape") setEditing(null);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="flex-1 text-xs border border-teal-400 dark:border-teal-500 bg-white dark:bg-slate-950 text-gray-900 dark:text-slate-100 rounded px-1.5 py-0.5 focus:outline-none min-w-0"
              />
            ) : (
              <span className={`flex-1 text-xs truncate min-w-0 ${activeThreadId === t.id ? "text-teal-700 dark:text-teal-300 font-medium" : "text-gray-600 dark:text-slate-400"}`}>
                {t.title}
              </span>
            )}
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
              {editing === t.id ? (
                <button onClick={(e) => { e.stopPropagation(); rename(t.id); }}
                  className="text-teal-500 hover:text-teal-700"><Check size={11} /></button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setEditing(t.id); setEditVal(t.title); }}
                  className="text-gray-300 dark:text-slate-600 hover:text-gray-600 dark:hover:text-slate-350"><Edit2 size={11} /></button>
              )}
              <button onClick={(e) => deleteThread(t.id, e)}
                className="text-gray-300 hover:text-red-500"><Trash2 size={11} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ChatWindow ──────────────────────────────────────────
export default function ChatWindow({ userId }) {
  const [threadId, setThreadId]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [showThreads, setShowThreads]     = useState(() => window.innerWidth >= 768);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [pendingFile, setPendingFile]     = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [longTermMemory, setLongTermMemory] = useState("");
  const [locStatus, setLocStatus]         = useState("idle");
  const bottomRef    = useRef(null);
  const textareaRef  = useRef(null);
  const fileInputRef = useRef(null);

  // Load long-term memory + user name
  useEffect(() => {
    if (!userId) return;
    loadLongTermMemory(userId).then(setLongTermMemory);
    supabase.auth.getUser().then(({ data }) => {
      const name = data?.user?.user_metadata?.full_name
        || data?.user?.email?.split("@")[0] || "U";
      localStorage.setItem("user_name", name);
    });
  }, [userId]);

  // Clear chat screen and start a transient (unsaved) new chat session
  const createNewThread = useCallback(() => {
    setThreadId(null);
    setMessages([]);
  }, []);

  // Load existing thread messages
  const loadThread = useCallback(async (tid) => {
    setThreadId(tid);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("role, content, location_used")
      .eq("thread_id", tid)
      .order("created_at", { ascending: true });
    if (!error) {
      setMessages((data || []).map((m) => ({
        role: m.role,
        content: m.content,
        location_used: m.location_used,
        sources: [],
      })));
    }
  }, []);

  // Handle deleted thread - load most recent or create new
  const handleThreadDeleted = useCallback(async (deletedId) => {
    if (threadId !== deletedId) return;
    const { data } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) loadThread(data.id);
    else createNewThread();
  }, [threadId, userId, loadThread, createNewThread]);

  // On mount - clear screen to unsaved chat session and cleanup empty threads
  useEffect(() => {
    if (!userId) return;

    const cleanupEmptyThreads = async () => {
      try {
        const { data: threads } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("user_id", userId);
        
        if (!threads || threads.length === 0) return;

        const { data: messages } = await supabase
          .from("chat_messages")
          .select("thread_id")
          .in("thread_id", threads.map((t) => t.id));

        const activeTids = new Set((messages || []).map((m) => m.thread_id));
        const emptyTids = threads.map((t) => t.id).filter((id) => !activeTids.has(id));

        if (emptyTids.length > 0) {
          await supabase.from("chat_threads").delete().in("id", emptyTids);
          window.dispatchEvent(new Event("HealthMate:thread-updated"));
        }
      } catch (e) {
        console.warn("Cleanup empty threads:", e.message);
      }
    };

    cleanupEmptyThreads();
    if (!threadId) createNewThread();
  }, [userId, threadId, createNewThread]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-close threads on mobile
  useEffect(() => {
    const h = () => { if (window.innerWidth < 768) setShowThreads(false); };
    h();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const saveMessage = async (role, content, locationUsed = false, tid = threadId) => {
    const targetTid = tid || threadId;
    if (!targetTid) return;
    await supabase.from("chat_messages").insert({
      thread_id: targetTid, role, content, location_used: locationUsed,
    });
    await supabase.from("chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", targetTid);
    window.dispatchEvent(new Event("HealthMate:thread-updated"));
  };

  const autoName = async (text, tid = threadId) => {
    const targetTid = tid || threadId;
    if (!targetTid) return;
    const title = text.length > 40 ? text.slice(0, 37) + "..." : text;
    await supabase.from("chat_threads").update({ title }).eq("id", targetTid);
    window.dispatchEvent(new Event("HealthMate:thread-updated"));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) { setPendingFile(file); setShowDocPicker(false); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text && !pendingFile) return;

    setInput("");
    setLoading(true);
    setShowDocPicker(false);

    // Lazily create thread in DB on first user message to avoid empty threads clutter
    let activeTid = threadId;
    try {
      if (!activeTid) {
        const titleText = pendingFile ? `[File] ${pendingFile.name}` : text;
        const title = titleText.length > 40 ? titleText.slice(0, 37) + "..." : titleText;
        const { data, error } = await supabase
          .from("chat_threads")
          .insert({ user_id: userId, title, updated_at: new Date().toISOString() })
          .select("id")
          .single();
        if (error) throw error;
        activeTid = data.id;
        setThreadId(data.id);
        window.dispatchEvent(new Event("HealthMate:thread-updated"));
      }
    } catch (err) {
      setMessages((p) => [...p, { role: "assistant", content: `❌ Error starting chat: ${err.message}`, sources: [] }]);
      setLoading(false);
      return;
    }

    // Auto-name thread on first user message
    const isFirstMessage = messages.filter((m) => m.role === "user").length === 0;
    if (isFirstMessage) {
      await autoName(pendingFile ? `[File] ${pendingFile.name}` : text, activeTid);
    }

    // Handle file upload
    let fileContent = "";
    let hasFile = false;
    let fileName = "";
    if (pendingFile) {
      setUploadingFile(true);
      try {
        const res = await uploadDocument(userId, pendingFile);
        fileContent = `\n\n[User uploaded medical document: "${pendingFile.name}". Summary: ${res.data.summary || "Please analyze this document."}]`;
        hasFile = true;
        fileName = pendingFile.name;
        setMessages((p) => [...p, {
          role: "assistant",
          content: `✅ **"${pendingFile.name}"** saved to My Documents (${res.data.chunks_indexed} sections indexed).\n\nI can now answer questions about it. What would you like to know?`,
          sources: [],
        }]);
      } catch (err) {
        setMessages((p) => [...p, {
          role: "assistant",
          content: `❌ Could not upload file: ${err.response?.data?.detail || "Please try again."}`,
          sources: [],
        }]);
        setLoading(false); setUploadingFile(false); setPendingFile(null); return;
      } finally {
        setUploadingFile(false);
        setPendingFile(null);
      }
      if (!text) { setLoading(false); return; }
    }

    // GPS location if needed
    let locationContext = "";
    let locationUsed = false;
    if (needsLocation(text)) {
      setLocStatus("fetching");
      const loc = await getUserLocation();
      if (loc) {
        locationContext = `lat=${loc.lat.toFixed(5)},lng=${loc.lng.toFixed(5)}`;
        locationUsed = true;
        setLocStatus("got");
      } else {
        setLocStatus("denied");
      }
    }

    const fullQuery = text + fileContent;
    const userMsg   = { role: "user", content: text, location_used: false, sources: [], hasFile, fileName };
    setMessages((p) => [...p, userMsg]);
    await saveMessage("user", text + (hasFile ? ` [Attached: ${fileName}]` : ""), false, activeTid);

    // Last 12 messages for conversation history
    const convHistory = messages.slice(-12).map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await API.post("/chat", {
        user_id:              userId,
        query:                fullQuery,
        mode:                 "chat",
        long_term_memory:     longTermMemory,
        location_context:     locationContext,
        conversation_history: convHistory,
      });

      const aiContent = res.data.response;
      const aiMsg     = {
        role: "assistant",
        content: aiContent,
        location_used: locationUsed,
        sources: res.data.sources_used || [],
      };
      setMessages((p) => [...p, aiMsg]);
      await saveMessage("assistant", aiContent, locationUsed, activeTid);

      // Update long-term memory every 8 messages
      const allMsgs = [...messages, userMsg, aiMsg];
      if (allMsgs.length % 8 === 0) {
        const updated = await updateLongTermMemory(userId, longTermMemory, allMsgs);
        setLongTermMemory(updated);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || "Something went wrong. Please try again.";
      setMessages((p) => [...p, { role: "assistant", content: `Sorry - ${detail}`, sources: [] }]);
    } finally {
      setLoading(false);
      setLocStatus("idle");
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
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-slate-950 transition-colors">
      {/* Thread panel */}
      <div className={`flex-shrink-0 border-r border-gray-200 dark:border-slate-800 transition-all duration-200 overflow-hidden ${showThreads ? "w-48 md:w-52" : "w-0"}`}>
        <ThreadPanel
          userId={userId}
          activeThreadId={threadId}
          onSelect={(id) => { loadThread(id); if (window.innerWidth < 768) setShowThreads(false); }}
          onNew={() => { createNewThread(); if (window.innerWidth < 768) setShowThreads(false); }}
          onDeleteThread={handleThreadDeleted}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800/80 px-3 py-2 flex items-center gap-2 flex-shrink-0 transition-colors">
          <button onClick={() => setShowThreads((p) => !p)}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition flex-shrink-0">
            <Menu size={15} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {longTermMemory && (
              <span className="text-xs text-purple-500 dark:text-purple-400 font-semibold flex items-center gap-1">🧠 Memory active</span>
            )}
            {locStatus === "fetching" && (
              <span className="text-xs text-teal-600 dark:text-teal-400 flex items-center gap-1">
                <MapPin size={11} className="animate-pulse" /> Getting location...
              </span>
            )}
            {locStatus === "got" && (
              <span className="text-xs text-teal-600 dark:text-teal-400 flex items-center gap-1 font-semibold">
                <MapPin size={11} /> Location found
              </span>
            )}
            {locStatus === "denied" && (
              <span className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1">
                <MapPin size={11} /> Location unavailable - share your city
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-3.5">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mb-4 shadow-md">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-slate-200 mb-1">How can I help you?</h3>
              <p className="text-sm text-gray-400 dark:text-slate-500 max-w-xs leading-relaxed">
                Ask about symptoms, find hospitals, upload reports, or chat about your health.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-5 w-full max-w-sm">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-gray-600 dark:text-slate-400 hover:border-teal-350 dark:hover:border-teal-700 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition text-left leading-snug shadow-sm">
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
        <div className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800/80 px-3 py-3 flex-shrink-0 transition-colors">
          {showDocPicker && (
            <DocPicker userId={userId}
              onInsert={(text) => {
                setInput(text);
                setShowDocPicker(false);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              onClose={() => setShowDocPicker(false)}
            />
          )}
          {pendingFile && (
            <FileUploadPreview file={pendingFile} onRemove={() => setPendingFile(null)} />
          )}
          <div className="flex gap-2 items-end">
            {/* Saved doc summarize */}
            <button onClick={() => setShowDocPicker((p) => !p)}
              title="Summarize a saved document"
              className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition ${
                showDocPicker
                  ? "bg-teal-50 dark:bg-teal-950/30 border-teal-400 text-teal-650 dark:text-teal-350"
                  : "border-gray-200 dark:border-slate-850 text-gray-400 dark:text-slate-500 hover:border-teal-350 dark:hover:border-teal-700 hover:text-teal-500 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/15"
              }`}>
              <FileText size={15} />
            </button>

            {/* Upload file */}
            <button onClick={() => fileInputRef.current?.click()}
              title="Upload a medical document"
              className="w-9 h-9 rounded-xl border border-gray-200 dark:border-slate-850 text-gray-400 dark:text-slate-500 hover:border-teal-350 dark:hover:border-teal-700 hover:text-teal-500 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/15 flex items-center justify-center flex-shrink-0 transition">
              <Paperclip size={15} />
            </button>
            <input ref={fileInputRef} type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileSelect} className="hidden" />

            <textarea ref={textareaRef} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingFile
                ? "Add a message about this file (optional)..."
                : "Ask anything"}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-205 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 px-3.5 py-2.5 focus:outline-none focus:border-teal-450 dark:focus:border-teal-500 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/15 transition leading-relaxed"
              style={{ minHeight: "42px", maxHeight: "120px" }}
            />
            <button onClick={() => sendMessage()}
              disabled={loading || (!input.trim() && !pendingFile)}
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
