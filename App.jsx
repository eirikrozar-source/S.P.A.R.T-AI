import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { ChatInterface } from './components/chat/ChatInterface';
import { DashboardView } from './components/dashboard/DashboardView';
import { ExpenseTracker } from './components/expenses/ExpenseTracker';
import { FinancialDashboard } from './components/financial/FinancialDashboard';
import { GoalsView } from './components/goals/GoalsView';
import { ProfileMemoryView } from './components/memory/ProfileMemoryView';
import { SettingsView } from './components/settings/SettingsView';
import { AddExpenseModal } from './components/expenses/AddExpenseModal';
import { NamePromptModal } from './components/auth/NamePromptModal';

const MainLayout = () => {
  const { activeTab, isNameModalOpen, initializeSpartWithName } = useApp();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Active page renderer
  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatInterface />;
      case 'dashboard':
        return <DashboardView onOpenAddExpense={() => setIsAddExpenseOpen(true)} />;
      case 'expenses':
        return <ExpenseTracker onOpenAddExpense={() => setIsAddExpenseOpen(true)} />;
      case 'financial':
        return <FinancialDashboard />;
      case 'goals':
        return <GoalsView />;
      case 'memory':
        return <ProfileMemoryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Off-canvas Sidebar Drawer (Closed by default, opens only on menu icon click) */}
      <Sidebar />

      {/* Topbar with Menu Icon on Left */}
      <Topbar onOpenAddExpense={() => setIsAddExpenseOpen(true)} />

      {/* Main Full-width Screen (No permanent left margin) */}
      <main className="flex-1 flex flex-col w-full overflow-hidden">
        {renderContent()}
      </main>

      {/* Name Alone Onboarding Modal on Webpage Open */}
      <NamePromptModal
        isOpen={isNameModalOpen}
        onSubmitName={initializeSpartWithName}
      />

      {/* Global Add Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </AuthProvider>
  );
}
