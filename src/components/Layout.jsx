import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Leaf, 
  FileText, 
  Landmark, 
  Briefcase, 
  Globe2, 
  Settings 
} from 'lucide-react';
import './Layout.css';

const Layout = () => {
  const tabs = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Events / Projects', path: '/events', icon: Calendar },
    { name: 'Compliance & Reporting', path: '/reporting', icon: FileText },
    { name: 'Corporate Gov.', path: '/governance', icon: Landmark },
    { name: 'SDG Dashboard', path: '/sdg', icon: Globe2 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="app-container">
      <header className="top-nav">
        <div className="nav-brand">
          <div className="brand-logo">GG</div>
          <div className="brand-text">
            <span className="brand-title">Green Generation</span>
            <span className="brand-subtitle">ESG Project Management Tool</span>
          </div>
        </div>
        <nav className="nav-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink 
                key={tab.path} 
                to={tab.path} 
                className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{tab.name}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="user-profile">
          <div className="avatar">A</div>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
