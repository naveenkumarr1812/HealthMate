import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Stethoscope, AlertTriangle, RotateCcw } from "lucide-react";
import axios from "axios";

const API = axios.create({ baseURL: "/api" });
API.interceptors.request.use((c) => {
  const t = localStorage.getItem("access_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

const SYMPTOM_CHIPS = [
  "Fever", "Headache", "Cough", "Fatigue", "Nausea",
  "Body ache", "Dizziness", "Sore throat", "Chest pain",
  "Shortness of breath", "Vomiting", "Loss of appetite",
  "Stomach pain", "Back pain", "Rash", "Cold & flu",
];

const STEPS = ["Chief complaint", "Location & onset", "Duration & severity", "Analysis"];

function AIAvatar() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm">
      <Stethoscope size={13} className="text-white" />
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

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <AIAvatar />}
      <div className="max-w-[80%] md:max-w-[72%]">
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-tr-sm shadow-sm"
            : "bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-slate-200 rounded-tl-sm shadow-sm"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert
              prose-p:text-gray-700 dark:prose-p:text-slate-300 prose-p:my-1.5
              prose-li:text-gray-700 dark:prose-li:text-slate-300 prose-li:my-0.5
              prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-slate-100 prose-headings:my-2
              prose-strong:text-gray-900 dark:prose-strong:text-slate-100
              prose-a:text-teal-600 dark:prose-a:text-teal-400 prose-a:no-underline hover:prose-a:underline">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
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
          {[0,1,2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
              style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SymptomChecker({ userId }) {
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [step, setStep]                   = useState(0);
  const [collectedData, setCollectedData] = useState({});
  const [selectedChips, setSelectedChips] = useState([]);
  const [isComplete, setIsComplete]       = useState(false);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  // Initial greeting message
  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: "Hi! I'll help you understand your symptoms step by step. 🩺\n\nPlease tell me - **what's your main concern today?** What are you feeling?\n\nYou can type it or pick from the quick options below.",
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleChip = (chip) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const addChipsToInput = () => {
    if (selectedChips.length > 0) {
      setInput(selectedChips.join(", "));
      setSelectedChips([]);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const sendMessage = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;

    setInput("");
    setSelectedChips([]);
    setLoading(true);

    // Update collected data
    const updatedData = { ...collectedData, [`step_${step}`]: text };
    setCollectedData(updatedData);

    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await API.post("/symptoms/check", {
        user_id:        userId,
        message:        text,
        step:           step,
        collected_data: updatedData,
      });

      const { response, next_step, is_complete } = res.data;

      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setStep(next_step);
      setIsComplete(is_complete);
    } catch (err) {
      const detail = err.response?.data?.detail || "Something went wrong. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: `Sorry - ${detail}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const reset = () => {
    setMessages([{
      role: "assistant",
      content: "Let's start fresh. 🩺 What symptom are you experiencing today?",
    }]);
    setStep(0);
    setCollectedData({});
    setSelectedChips([]);
    setInput("");
    setIsComplete(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 transition-colors">

      {/* Header with progress */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 py-3 flex-shrink-0 transition-colors">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Stethoscope size={15} className="text-teal-600 dark:text-teal-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">Symptom Checker</span>
            <span className="text-xs bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/50 px-2 py-0.5 rounded-full font-medium">AI Guided</span>
          </div>
          <button onClick={reset}
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
            <RotateCcw size={12} /> New assessment
          </button>
        </div>

        {/* Step progress bar */}
        <div className="flex gap-1.5 mb-1.5">
          {STEPS.map((s, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < step ? "bg-teal-400" : i === step ? "bg-teal-200 dark:bg-teal-900/50" : "bg-gray-100 dark:bg-slate-800"
            }`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Step {Math.min(step + 1, 4)} of 4 - <span className="text-teal-600 dark:text-teal-400 font-medium">{STEPS[Math.min(step, 3)]}</span>
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30 px-4 py-2 flex items-start gap-2 flex-shrink-0">
        <AlertTriangle size={13} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-450 leading-relaxed">
          This is for guidance only - not a medical diagnosis. Always consult a qualified doctor.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-3.5">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Symptom chips - shown on step 0 only */}
      {step === 0 && !loading && (
        <div className="px-4 pb-2 flex-shrink-0">
          <p className="text-xs text-gray-400 dark:text-slate-550 mb-2">Quick select:</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SYMPTOM_CHIPS.map((chip) => (
              <button key={chip} onClick={() => toggleChip(chip)}
                className={`text-xs px-3 py-1.5 rounded-full border transition font-semibold ${
                  selectedChips.includes(chip)
                    ? "bg-teal-50 dark:bg-teal-950/30 border-teal-400 text-teal-700 dark:text-teal-350"
                    : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-850 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700"
                }`}>
                {chip}
              </button>
            ))}
          </div>
          {selectedChips.length > 0 && (
            <button onClick={addChipsToInput}
              className="text-xs text-teal-600 dark:text-teal-400 font-medium hover:underline">
              Add {selectedChips.length} selected → input ↓
            </button>
          )}
        </div>
      )}

      {/* Completion buttons */}
      {isComplete && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-xl p-3 mb-3">
            <p className="text-xs text-teal-750 dark:text-teal-450 font-bold mb-1">Assessment complete ✅</p>
            <p className="text-xs text-teal-650 dark:text-teal-500 font-semibold">Please share this with your doctor for proper diagnosis.</p>
          </div>
          <button onClick={reset}
            className="w-full py-2.5 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
            <RotateCcw size={14} /> Start New Assessment
          </button>
        </div>
      )}

      {/* Input */}
      {!isComplete && (
        <div className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800/80 px-3 py-3 flex-shrink-0 transition-colors">
          <div className="flex gap-2 items-end">
            <textarea ref={textareaRef} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                step === 0 ? "Describe your main symptom..." :
                step === 1 ? "Where is the pain/symptom located?" :
                step === 2 ? "How long and how severe (1-10)?" :
                "Describe any other symptoms..."
              }
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-205 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-sm text-gray-900 dark:text-slate-100 px-3.5 py-2.5 focus:outline-none focus:border-teal-450 dark:focus:border-teal-500 focus:ring-1 focus:ring-teal-50 dark:focus:ring-teal-950/15 transition leading-relaxed"
              style={{ minHeight: "42px", maxHeight: "100px" }}
            />
            <button onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white flex items-center justify-center transition flex-shrink-0 shadow-sm">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
