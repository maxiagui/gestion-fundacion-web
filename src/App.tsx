import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Dashboard from './pages/Dashboard';
import Socios from './pages/Socios';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function Sidebar() {
  const location = useLocation();
  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Socios', href: '/socios', icon: Users },
    { name: 'Nuevo Socio', href: '/socios/nuevo', icon: UserPlus },
  ];

  return (
    <div className="flex flex-col w-64 bg-sidebar dark:bg-dark-800 border-r border-border dark:border-dark-700 h-screen transition-colors duration-200">
      <div className="flex flex-col items-center justify-center py-8 px-4 border-b border-border dark:border-dark-700">
        <img 
          src="/fondologo.jpg" 
          alt="AACM Logo" 
          className="w-28 h-28 object-contain rounded-full shadow-md border-2 border-white dark:border-dark-700"
        />
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
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
  return (
    <div className="flex h-screen overflow-hidden bg-background dark:bg-dark-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-8 px-8 pb-12">
        {children}
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
