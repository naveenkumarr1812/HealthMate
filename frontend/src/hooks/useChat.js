import { useState, useCallback, useRef, useEffect } from "react";
import { sendChat, getChatHistory } from "../api/medai";

/**
 * useChat — manages all chat state for ChatWindow
 * Handles: history loading, sending messages, mode switching
 */
export function useChat(userId, mode = "chat") {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [symptomStep, setSymptomStep] = useState(0);
  const [symptomData, setSymptomData] = useState({});
  const bottomRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load history on mount
  useEffect(() => {
    if (!userId) return;
    getChatHistory(userId)
      .then((res) => {
        const history = (res.data.history || []).map((m) => ({
          role: m.role,
          content: m.content,
          sources: [],
        }));
        if (history.length > 0) {
          setMessages(history);
        } else {
          setMessages([
            {
              role: "assistant",
              content:
                "Hello! I'm **MedAI**, your personal health assistant.\n\nI can help you:\n- Understand your medical reports\n- Check your symptoms step by step\n- Answer health questions with your history in mind\n\nHow can I help you today?",
              sources: ["memory"],
            },
          ]);
        }
      })
      .catch(() => {
        setMessages([
          {
            role: "assistant",
            content: "Hello! I'm MedAI. How can I help you today?",
            sources: ["memory"],
          },
        ]);
      });
  }, [userId]);

  const sendMessage = useCallback(
    async (text, overrideMode) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg = { role: "user", content: trimmed, sources: [] };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      const activeMode = overrideMode || mode;

      try {
        const res = await sendChat(
          userId,
          trimmed,
          activeMode,
          symptomData,
          symptomStep
        );

        const { response, sources_used, next_step, is_complete } = res.data;

        // Update symptom flow state if in symptom mode
        if (activeMode === "symptom" && next_step !== undefined) {
          setSymptomStep(next_step);
          setSymptomData((prev) => ({
            ...prev,
            [`step_${symptomStep}`]: trimmed,
          }));
        }

        const aiMsg = {
          role: "assistant",
          content: response,
          sources: sources_used || [],
          isComplete: is_complete,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const msg = err.response?.data?.detail || "Something went wrong. Please try again.";
        setError(msg);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: msg, sources: [] },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [userId, loading, mode, symptomStep, symptomData]
  );

  const clearChat = useCallback(() => {
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared. How can I help you?",
        sources: ["memory"],
      },
    ]);
    setSymptomStep(0);
    setSymptomData({});
  }, []);

  return {
    messages,
    loading,
    error,
    bottomRef,
    sendMessage,
    clearChat,
    symptomStep,
  };
}
