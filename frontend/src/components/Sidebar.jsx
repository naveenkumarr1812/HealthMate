import { Activity, MessageSquare, Stethoscope, FileText, Newspaper, FolderOpen, BarChart2, Pill, LogOut, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Chat Assistant", icon: MessageSquare, id: "chat" },
  { label: "Symptom Checker", icon: Stethoscope, id: "symptom", badge: "AI" },
  { label: "Doc Summarizer", icon: FileText, id: "summarize" },
  { label: "Medical News", icon: Newspaper, id: "news" },
];

const healthItems = [
  { label: "My Documents", icon: FolderOpen, id: "documents" },
  { label: "Health Profile", icon: BarChart2, id: "profile" },
  { label: "Medications", icon: Pill, id: "medications" },
];

export default function Sidebar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-400 flex items-center justify-center flex-shrink-0">
          <Activity className="text-white" size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">MedAI</p>
          <p className="text-xs text-gray-400">Health Assistant</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-2">Workspace</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition ${
              activeTab === item.id
                ? "bg-teal-50 text-teal-700 font-medium"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <item.icon size={15} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-2 mt-5">My Health</p>
        {healthItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition ${
              activeTab === item.id
                ? "bg-teal-50 text-teal-700 font-medium"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <item.icon size={15} />
            <span className="flex-1 text-left">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 p-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 truncate">{name}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        </div>
        <button onClick={logout} title="Logout" className="text-gray-400 hover:text-gray-600 transition">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}
