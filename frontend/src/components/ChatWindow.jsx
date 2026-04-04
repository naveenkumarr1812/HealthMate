import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Search, Brain, Paperclip, Globe, Database, Loader2 } from "lucide-react";
import { sendChat, getChatHistory } from "../api/medai";

function SourceBadge({ sources }) {
  if (!sources?.length) return null;
  const map = {
    rag: { label: "Your Documents", icon: Database, color: "bg-teal-50 text-teal-700" },
    web: { label: "Web Search", icon: Globe, color: "bg-blue-50 text-blue-700" },
    memory: { label: "Health Memory", icon: Brain, color: "bg-purple-50 text-purple-700" },
  };
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {sources.map((s) => {
        const info = map[s] || { label: s, color: "bg-gray-50 text-gray-600" };
        const Icon = info.icon;
        return (
          <span key={s} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
            {Icon && <Icon size={11} />}
            {info.label}
          </span>
        );
      })}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-teal-400 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">M</span>
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? "order-first" : ""}`}>
        <div
          className={`px-3 py-2.5 md:px-4 md:py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-teal-400 text-white rounded-tr-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
          }`}
        >
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:font-medium prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && msg.sources && <SourceBadge sources={msg.sources} />}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">
          U
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-7 h-7 rounded-full bg-teal-400 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">M</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow({ userId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState(["rag"]);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Load chat history on mount
  useEffect(() => {
    if (!userId) return;
    getChatHistory(userId)
      .then((res) => {
        const history = res.data.history || [];
        setMessages(
          history.map((m) => ({ role: m.role, content: m.content, sources: [] }))
        );
      })
      .catch(() => {
        // Start fresh if history fails
        setMessages([
          {
            role: "assistant",
            content: "Hello! I'm MedAI, your personal health assistant. I can help you understand your medical reports, check symptoms, and answer health questions. How can I help you today?",
            sources: ["memory"],
          },
        ]);
      });
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleTool = (tool) => {
    setActiveTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text, sources: [] };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendChat(userId, text, "chat");
      const aiMsg = {
        role: "assistant",
        content: res.data.response,
        sources: res.data.sources_used || [],
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Memory banner */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2">
        <Brain size={13} className="text-purple-500" />
        <span className="text-xs text-gray-500">Health memory active — responses are personalized to your profile</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 md:px-4 md:py-5 space-y-5">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 px-3 py-2.5 md:px-4 md:py-3">
        {/* Tool toggles */}
        <div className="flex gap-2 mb-3">
          {[
            { id: "rag", label: "My Docs", icon: Database },
            { id: "web", label: "Web Search", icon: Globe },
            { id: "memory", label: "Memory", icon: Brain },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => toggleTool(id)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition font-medium ${
                activeTools.includes(id)
                  ? "bg-teal-50 border-teal-300 text-teal-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your health, reports, medications..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition leading-relaxed max-h-28"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-teal-400 hover:bg-teal-600 disabled:opacity-40 text-white flex items-center justify-center transition flex-shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
