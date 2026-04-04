import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Stethoscope, AlertTriangle } from "lucide-react";
import { checkSymptom } from "../api/medai";

const STEPS = [
  "Chief complaint",
  "Symptom selection",
  "Duration & severity",
  "AI analysis",
];

const COMMON_SYMPTOMS = [
  "Fever", "Headache", "Cough", "Fatigue", "Nausea",
  "Body ache", "Dizziness", "Sore throat", "Shortness of breath",
  "Chest pain", "Vomiting", "Loss of appetite",
];

export default function SymptomChecker({ userId }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'll help you assess your symptoms step by step. Please tell me — what's your main concern today? What are you feeling?",
    },
  ]);
  const [step, setStep] = useState(0);
  const [collectedData, setCollectedData] = useState({});
  const [selectedChips, setSelectedChips] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleChip = (symptom) => {
    setSelectedChips((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    );
  };

  const addChipsToInput = () => {
    if (selectedChips.length > 0) {
      setInput(selectedChips.join(", "));
    }
  };

  const sendMessage = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSelectedChips([]);
    setLoading(true);

    const updatedData = { ...collectedData, [`step_${step}`]: text };
    setCollectedData(updatedData);

    try {
      const res = await checkSymptom(userId, text, step, updatedData);
      const { response, next_step, is_complete } = res.data;

      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setStep(next_step);
      setIsComplete(is_complete);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setMessages([
      {
        role: "assistant",
        content: "Let's start fresh. What's your main concern today?",
      },
    ]);
    setStep(0);
    setCollectedData({});
    setSelectedChips([]);
    setInput("");
    setIsComplete(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <Stethoscope size={14} className="text-teal-600" />
          <span className="text-xs font-medium text-gray-600">
            Step {Math.min(step + 1, 4)} of 4 — {STEPS[Math.min(step, 3)]}
          </span>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < step ? "bg-teal-400" : i === step ? "bg-teal-200" : "bg-gray-100"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-teal-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Stethoscope size={13} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-teal-400 text-white rounded-tr-sm"
                  : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
              }`}
            >
              {msg.role === "user" ? (
                <p>{msg.content}</p>
              ) : (
                <div className="prose prose-sm max-w-none prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 prose-headings:font-medium">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold">
                U
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-teal-400 flex items-center justify-center flex-shrink-0">
              <Stethoscope size={13} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
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
        )}
        <div ref={bottomRef} />
      </div>

      {/* Disclaimer */}
      {isComplete && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            This assessment is for informational purposes only. Please consult a qualified doctor for proper diagnosis and treatment.
          </p>
        </div>
      )}

      {/* Symptom chips for step 1 */}
      {step === 1 && !loading && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500 mb-2">Quick select common symptoms:</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {COMMON_SYMPTOMS.map((s) => (
              <button
                key={s}
                onClick={() => toggleChip(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  selectedChips.includes(s)
                    ? "bg-teal-50 border-teal-400 text-teal-700 font-medium"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {selectedChips.length > 0 && (
            <button
              onClick={addChipsToInput}
              className="text-xs text-teal-600 font-medium hover:underline"
            >
              Add {selectedChips.length} selected to input ↓
            </button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        {isComplete ? (
          <button
            onClick={restart}
            className="w-full py-2.5 rounded-xl bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium transition"
          >
            Start New Assessment
          </button>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="Describe your symptoms..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition max-h-28"
              style={{ minHeight: "44px" }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || (!input.trim() && selectedChips.length === 0)}
              className="w-10 h-10 rounded-xl bg-teal-400 hover:bg-teal-600 disabled:opacity-40 text-white flex items-center justify-center transition flex-shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
