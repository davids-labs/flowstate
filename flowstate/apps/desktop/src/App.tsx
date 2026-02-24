import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Home, Calendar, List, Box, Settings as SettingsIcon } from 'lucide-react';
import { DatabaseProvider } from './components/DatabaseProvider';
import { HomePage } from './pages/Home';
import { TodayPage } from './pages/Today';
import { PlanPage } from './pages/Plan';
import { ModulesPage } from './pages/Modules';
import { DayPage } from './pages/Day';
import { SessionPage } from './pages/Session';
import { WeekPage } from './pages/Week';
import { SettingsPage } from './pages/Settings';
import { CompactTimerPage } from './pages/Compact';
import './App.css';

function App() {
  return (
    <DatabaseProvider>
      <HashRouter>
        <Routes>
          {/* Compact timer — frameless window, no sidebar */}
          <Route path="/compact" element={<CompactTimerPage />} />

          {/* Main app layout */}
          <Route path="*" element={<MainLayout />} />
        </Routes>
      </HashRouter>
    </DatabaseProvider>
  );
}

function MainLayout() {
  return (
    <div className="app-layout">
      {/* Sidebar nav */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-text">FlowState</span>
        </div>

        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Home size={18} /> Home
          </NavLink>
          <NavLink to="/today" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Calendar size={18} /> Today
          </NavLink>
          <NavLink to="/plan" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <List size={18} /> Plan
          </NavLink>
          <NavLink to="/modules" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Box size={18} /> Modules
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <SettingsIcon size={18} /> Settings
          </NavLink>
        </div>
      </nav>

      {/* Main content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/day/:date" element={<DayPage />} />
          <Route path="/session/:id" element={<SessionPage />} />
          <Route path="/week/:weekId" element={<WeekPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
