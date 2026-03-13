import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Settings, Menu, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Dashboard from './pages/Dashboard';
import Socios from './pages/Socios';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Socios', href: '/socios', icon: Users },
    { name: 'Nuevo Socio', href: '/socios/nuevo', icon: UserPlus },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar dark:bg-dark-800">
      <div className="flex flex-col items-center justify-center py-8 px-4 border-b border-border dark:border-dark-700 relative">
        {onClose && (
          <button 
            onClick={onClose}
            className="md:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        )}
        <img 
          src="/fondologo.jpg" 
          alt="AACM Logo" 
          className="w-28 h-28 object-contain rounded-full shadow-md border-2 border-white dark:border-dark-700 mt-2"
        />
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-dark-700 dark:hover:text-slate-200'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 flex-shrink-0 h-5 w-5 transition-colors duration-200',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300'
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border dark:border-dark-700">
        <button className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-dark-700 dark:hover:text-slate-200 transition-colors duration-200">
          <Settings className="mr-3 h-5 w-5 text-slate-400" />
          Configuración
        </button>
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Prevent background scrolling when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMobileMenuOpen]);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background dark:bg-dark-900">
      
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-dark-800 border-b border-border dark:border-dark-700 shadow-sm z-30 relative">
        <div className="flex items-center gap-3 relative z-30">
          <img src="/fondologo.jpg" alt="Logo" className="w-10 h-10 object-contain rounded-full shadow-sm" />
          <span className="font-bold text-slate-800 dark:text-slate-200">AACM</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -mr-2 text-slate-600 hover:text-primary-600 transition-colors active:scale-95 relative z-30"
          aria-label="Toggle menu"
        >
          <Menu className="w-7 h-7" />
        </button>
      </div>

      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden md:flex flex-col w-64 border-r border-border dark:border-dark-700 h-screen shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile Menu Overlay */}
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden",
          isMobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />
      
      {/* Sliding Panel */}
      <div 
        className={cn(
          "fixed top-0 right-0 bottom-0 w-[80%] max-w-sm bg-white dark:bg-dark-800 z-50 shadow-2xl transition-transform duration-300 ease-in-out transform md:hidden",
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <SidebarContent onClose={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/socios" element={<Socios />} />
          <Route path="/socios/nuevo" element={<Socios />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
