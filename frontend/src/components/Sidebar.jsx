import { useState } from "react";
import { Activity, MessageSquare, Stethoscope, FileText, Newspaper,
  FolderOpen, BarChart2, Pill, LogOut, X, Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Chat",       icon: MessageSquare, id: "chat"      },
  { label: "Symptoms",   icon: Stethoscope,   id: "symptom",  badge: "AI" },
  { label: "Summarizer", icon: FileText,       id: "summarize" },
  { label: "News",       icon: Newspaper,      id: "news"      },
];

const healthItems = [
  { label: "My Documents",  icon: FolderOpen,  id: "documents"  },
  { label: "Health Profile", icon: BarChart2,  id: "profile"    },
  { label: "Medications",    icon: Pill,        id: "medications" },
];

const allItems = [...navItems, ...healthItems];

function NavBtn({ item, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition ${
        active ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}>
      <item.icon size={15} />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">{item.badge}</span>}
    </button>
  );
}

function UserRow({ onLogout }) {
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="border-t border-gray-100 p-3 flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-semibold flex-shrink-0">{initials}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
      </div>
      <button onClick={onLogout} title="Logout" className="text-gray-400 hover:text-gray-600 transition"><LogOut size={13} /></button>
    </div>
  );
}

export default function Sidebar({ activeTab, setActiveTab }) {
  const { logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current = allItems.find((i) => i.id === activeTab);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 lg:w-60 min-h-screen bg-white border-r border-gray-200 flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-400 flex items-center justify-center flex-shrink-0">
            <Activity className="text-white" size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">MedAI</p>
            <p className="text-xs text-gray-400">Health Assistant</p>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-1.5">Workspace</p>
          {navItems.map((item) => <NavBtn key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />)}
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-1.5 mt-4">My Health</p>
          {healthItems.map((item) => <NavBtn key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />)}
        </nav>
        <UserRow onLogout={logout} />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-400 flex items-center justify-center">
            <Activity className="text-white" size={14} />
          </div>
          <span className="text-sm font-semibold text-gray-900">MedAI</span>
        </div>
        <span className="text-xs font-medium text-gray-500">{current?.label}</span>
        <button onClick={() => setDrawerOpen(true)} className="text-gray-600 p-1"><Menu size={20} /></button>
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-64 bg-white h-full flex flex-col shadow-xl">
            <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-400 flex items-center justify-center"><Activity className="text-white" size={16} /></div>
                <span className="text-sm font-semibold text-gray-900">MedAI</span>
              </div>
              <button onClick={() => setDrawerOpen(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <nav className="flex-1 px-2 py-3 overflow-y-auto">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-1.5">Workspace</p>
              {navItems.map((item) => <NavBtn key={item.id} item={item} active={activeTab === item.id} onClick={() => { setActiveTab(item.id); setDrawerOpen(false); }} />)}
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-1.5 mt-4">My Health</p>
              {healthItems.map((item) => <NavBtn key={item.id} item={item} active={activeTab === item.id} onClick={() => { setActiveTab(item.id); setDrawerOpen(false); }} />)}
            </nav>
            <UserRow onLogout={logout} />
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 flex safe-area-pb">
        {[
          { label: "Chat",    icon: MessageSquare, id: "chat"       },
          { label: "Symptom", icon: Stethoscope,   id: "symptom"    },
          { label: "Docs",    icon: FolderOpen,    id: "documents"  },
          { label: "Profile", icon: BarChart2,     id: "profile"    },
          { label: "Meds",    icon: Pill,          id: "medications" },
        ].map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 transition ${activeTab === item.id ? "text-teal-600" : "text-gray-400"}`}>
            {activeTab === item.id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-teal-400 rounded-full" />}
            <item.icon size={18} />
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
