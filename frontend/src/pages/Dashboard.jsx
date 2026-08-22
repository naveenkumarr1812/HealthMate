import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import SymptomChecker from "../components/SymptomChecker";
import MyDocuments from "../components/MyDocuments";
import MedicalNews from "../components/MedicalNews";
import HealthProfile from "../components/HealthProfile";
import MedicationTracker from "../components/MedicationTracker";

const TAB_TITLES = {
  chat:        "AI Medical Assistant",
  symptom:     "Symptom Checker",
  news:        "Medical News",
  documents:   "My Documents",
  profile:     "Health Profile",
  medications: "Medication Tracker",
};

export default function Dashboard() {
  const { user }  = useAuth();
  const userId    = user?.id || localStorage.getItem("user_id");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "chat";

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-950 transition-colors">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:mt-0 mt-[52px] mb-[56px] md:mb-0">
        {/* Topbar - desktop only */}
        <div className="hidden md:flex bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-5 py-3 items-center justify-between flex-shrink-0 transition-colors">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{TAB_TITLES[activeTab]}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900/50 px-2.5 py-1 rounded-full font-medium hidden lg:inline">Corrective RAG</span>
            <span className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 px-2.5 py-1 rounded-full font-medium hidden lg:inline">Tavily</span>
            <span className="text-xs bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 px-2.5 py-1 rounded-full font-medium hidden lg:inline">Groq LLM</span>
          </div>
        </div>
        
        {/* Persistent tab views to prevent unmounting and state loss */}
        <div className="flex-1 overflow-hidden relative">
          <div className={activeTab === "chat" ? "h-full w-full" : "hidden"}>
            <ChatWindow userId={userId} />
          </div>
          <div className={activeTab === "symptom" ? "h-full w-full" : "hidden"}>
            <SymptomChecker userId={userId} />
          </div>
          <div className={activeTab === "documents" ? "h-full w-full" : "hidden"}>
            <MyDocuments userId={userId} />
          </div>
          <div className={activeTab === "news" ? "h-full w-full" : "hidden"}>
            <MedicalNews userId={userId} />
          </div>
          <div className={activeTab === "profile" ? "h-full w-full" : "hidden"}>
            <HealthProfile userId={userId} />
          </div>
          <div className={activeTab === "medications" ? "h-full w-full" : "hidden"}>
            <MedicationTracker userId={userId} />
          </div>
        </div>
      </div>
    </div>
  );
}
