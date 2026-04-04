import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import SymptomChecker from "../components/SymptomChecker";
import DocSummarizer from "../components/DocSummarizer";
import MyDocuments from "../components/MyDocuments";
import MedicalNews from "../components/MedicalNews";
import HealthProfile from "../components/HealthProfile";
import HealthPanel from "../components/HealthPanel";

const TAB_TITLES = {
  chat: "AI Medical Assistant",
  symptom: "Symptom Checker",
  summarize: "Document Summarizer",
  news: "Medical News",
  documents: "My Documents",
  profile: "Health Profile",
  medications: "Medications",
};

export default function Dashboard() {
  const { user } = useAuth();
  const userId = user?.id || localStorage.getItem("user_id");
  const [activeTab, setActiveTab] = useState("chat");

  const renderContent = () => {
    switch (activeTab) {
      case "chat":
        return (
          <div className="flex h-full">
            <div className="flex-1 min-w-0"><ChatWindow userId={userId} /></div>
            <HealthPanel userId={userId} />
          </div>
        );
      case "symptom":     return <SymptomChecker userId={userId} />;
      case "summarize":   return <DocSummarizer userId={userId} />;
      case "documents":   return <MyDocuments userId={userId} />;
      case "news":        return <MedicalNews userId={userId} />;
      case "profile":     return <HealthProfile userId={userId} />;
      case "medications":
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Medications tracker — coming soon</p>
          </div>
        );
      default: return <ChatWindow userId={userId} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <h1 className="text-sm font-semibold text-gray-900">{TAB_TITLES[activeTab]}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-full font-medium">
              Corrective RAG
            </span>
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              Tavily Search
            </span>
            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-medium">
              Groq LLM
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
