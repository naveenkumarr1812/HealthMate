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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:mt-0 mt-[52px] mb-[56px] md:mb-0">
        {/* Topbar - desktop only */}
        <div className="hidden md:flex bg-white border-b border-gray-200 px-5 py-3 items-center justify-between flex-shrink-0">
          <h1 className="text-sm font-semibold text-gray-900">{TAB_TITLES[activeTab]}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-teal-50  text-teal-700  border border-teal-200  px-2.5 py-1 rounded-full font-medium hidden lg:inline">Corrective RAG</span>
            <span className="text-xs bg-blue-50  text-blue-700  border border-blue-200  px-2.5 py-1 rounded-full font-medium hidden lg:inline">Tavily</span>
            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-medium hidden lg:inline">Groq LLM</span>
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
