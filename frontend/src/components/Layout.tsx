import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import logo from '../assets/GG Logo Transparent.png';
import './Layout.css';

const Layout = () => {
  const { user, signOut, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { name: 'Dashboard', path: '/' },
    { name: 'Events', path: '/events' },
    { name: 'Governance', path: '/governance' },
    { name: 'SDG', path: '/sdg' },
    ...(isAdmin ? [{ name: 'Admin', path: '/admin' }] : []),
  ];

  // Get initial character from user email
  const userEmail = user?.email || '';
  const avatarChar = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="app-container">
      <header className="top-nav">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <div className="nav-brand">
          <img src={logo} alt="Green Generation Logo" className="brand-logo-img" />
          <div className="brand-text">
            <span className="brand-subtitle">ESG Project Management Tool</span>
          </div>
        </div>
        <nav className="nav-tabs">
          {tabs.map((tab) => {
            return (
              <NavLink 
                key={tab.path} 
                to={tab.path} 
                className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
              >
                <span>{tab.name}</span>
              </NavLink>
            );
          })}
        </nav>
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="user-profile" ref={dropdownRef}>
          <button 
            type="button"
            className="avatar-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <div className="avatar">{avatarChar}</div>
          </button>
          
          {dropdownOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-user-info">
                <span className="dropdown-label">Signed in as</span>
                <span className="dropdown-email" title={userEmail}>
                  {userEmail}
                </span>
              </div>
              <button 
                type="button" 
                className="logout-btn" 
                onClick={() => {
                  setDropdownOpen(false);
                  signOut();
                }}
              >
                <svg 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile slide-out drawer menu */}
      {menuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-brand">
                <img src={logo} alt="Green Generation Logo" className="brand-logo-img" />
                <span className="drawer-subtitle">ESG Project Tool</span>
              </div>
              <button
                type="button"
                className="close-drawer-btn"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="drawer-nav">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={({ isActive }) => `drawer-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <span>{tab.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
