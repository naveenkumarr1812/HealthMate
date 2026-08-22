import { useState } from "react";
import { Activity, MessageSquare, Stethoscope, FileText, Newspaper,
  FolderOpen, BarChart2, Pill, LogOut, X, Menu, Sun, Moon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const navItems = [
  { label: "Chat",       icon: MessageSquare, id: "chat"      },
  { label: "Symptoms",   icon: Stethoscope,   id: "symptom",  badge: "AI" },
  
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
        active 
          ? "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-medium" 
          : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-slate-100"
      }`}>
      <item.icon size={15} />
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && <span className="text-xs bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded-full font-medium">{item.badge}</span>}
    </button>
  );
}

function UserRow({ onLogout }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="border-t border-gray-100 dark:border-slate-800/80 p-3 flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">{initials}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{name}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user?.email}</p>
      </div>
      <button onClick={toggleTheme} title="Toggle Theme" className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-gray-300 transition flex items-center p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg">
        {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
      </button>
      <button onClick={onLogout} title="Logout" className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-gray-300 transition flex items-center p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg"><LogOut size={13} /></button>
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
      <aside className="hidden md:flex w-56 lg:w-60 min-h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex-col flex-shrink-0 transition-colors">
        <div className="px-4 py-4 border-b border-gray-100 dark:border-slate-800/80 flex items-center gap-3">
          <div className="w-8 h-8 flex-shrink-0">
            <img src="./icons/icon-96.png" className="w-full h-full object-cover rounded-lg shadow-sm" alt="Logo" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">HealthMate</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">Health Assistant</p>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1.5">Workspace</p>
          {navItems.map((item) => <NavBtn key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />)}
          <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1.5 mt-4">My Health</p>
          {healthItems.map((item) => <NavBtn key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />)}
        </nav>
        <UserRow onLogout={logout} />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800/80 px-4 py-3 flex items-center justify-between flex-shrink-0 fixed top-0 left-0 right-0 z-30 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex-shrink-0">
            <img src="./icons/icon-96.png" className="w-full h-full object-cover rounded-md shadow-sm" alt="Logo" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">HealthMate</span>
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{current?.label}</span>
        <button onClick={() => setDrawerOpen(true)} className="text-gray-600 dark:text-slate-400 p-1 hover:text-gray-900 dark:hover:text-slate-100"><Menu size={20} /></button>
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-64 bg-white dark:bg-slate-900 h-full flex flex-col shadow-xl border-r border-gray-100 dark:border-slate-800 transition-colors">
            <div className="px-4 py-4 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex-shrink-0">
                  <img src="./icons/icon-96.png" className="w-full h-full object-cover rounded-lg shadow-sm" alt="Logo" />
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">HealthMate</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
            </div>
            <nav className="flex-1 px-2 py-3 overflow-y-auto">
              <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1.5">Workspace</p>
              {navItems.map((item) => <NavBtn key={item.id} item={item} active={activeTab === item.id} onClick={() => { setActiveTab(item.id); setDrawerOpen(false); }} />)}
              <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1.5 mt-4">My Health</p>
              {healthItems.map((item) => <NavBtn key={item.id} item={item} active={activeTab === item.id} onClick={() => { setActiveTab(item.id); setDrawerOpen(false); }} />)}
            </nav>
            <UserRow onLogout={logout} />
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800/80 z-30 flex safe-area-pb transition-colors">
        {[
          { label: "Chat",    icon: MessageSquare, id: "chat"       },
          { label: "Symptom", icon: Stethoscope,   id: "symptom"    },
          { label: "Docs",    icon: FolderOpen,    id: "documents"  },
          { label: "Profile", icon: BarChart2,     id: "profile"    },
          { label: "Meds",    icon: Pill,          id: "medications" },
        ].map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 transition ${activeTab === item.id ? "text-teal-600 dark:text-teal-400" : "text-gray-400 dark:text-slate-500"}`}>
            {activeTab === item.id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-teal-400 rounded-full" />}
            <item.icon size={18} />
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
