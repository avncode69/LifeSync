import { useState, useEffect } from 'react';
import {
  type Section,
  type Task,
  type Habit,
  type Transaction,
  type CalendarEvent,
  type PinnedDoc,
  type UserSettings,
  type User,
} from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import TasksHabits from './components/TasksHabits';
import Finance from './components/Finance';
import AIAssistant from './components/AIAssistant';
import Calendar from './components/Calendar';
import Settings from './components/Settings';
import { StorageService, DEFAULT_USER_SETTINGS, type UserFullData } from './services/storage';
import { ApiService } from './services/api';

export default function App() {
  const [user, setUser] = useState<User | null>(() => StorageService.getCurrentUser());
  const [section, setSection] = useState<Section>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // User-scoped persistent data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [pinnedDocs, setPinnedDocs] = useState<PinnedDoc[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('synced');

  // Load data whenever user changes
  useEffect(() => {
    if (user) {
      const data = StorageService.getUserData(user.id);
      setTasks(data.tasks);
      setHabits(data.habits);
      setTransactions(data.transactions);
      setEvents(data.events);
      setPinnedDocs(data.pinnedDocs);
      setSettings(data.settings);
    }
  }, [user?.id]);

  // Helper to persist updates locally and attempt cloud sync
  const persist = (partial: Partial<UserFullData>) => {
    if (!user) return;
    setSyncStatus('saving');
    StorageService.saveUserData(user.id, partial);
    ApiService.syncToCloudflare(user.id, partial).finally(() => {
      setSyncStatus('synced');
    });
  };

  const handleUpdateTasks = (nextTasks: Task[]) => {
    setTasks(nextTasks);
    persist({ tasks: nextTasks });
  };

  const handleUpdateHabits = (nextHabits: Habit[]) => {
    setHabits(nextHabits);
    persist({ habits: nextHabits });
  };

  const handleUpdateTransactions = (nextTxs: Transaction[]) => {
    setTransactions(nextTxs);
    persist({ transactions: nextTxs });
  };

  const handleUpdateEvents = (nextEvents: any[]) => {
    setEvents(nextEvents);
    persist({ events: nextEvents });
  };

  const handleUpdatePinnedDocs = (nextDocs: PinnedDoc[]) => {
    setPinnedDocs(nextDocs);
    persist({ pinnedDocs: nextDocs });
  };

  const handleSaveSettings = (nextSettings: UserSettings) => {
    setSettings(nextSettings);
    persist({ settings: nextSettings });
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    StorageService.setCurrentUser(updatedUser);
  };

  const handleLogin = (authedUser: User) => {
    setUser(authedUser);
    StorageService.setCurrentUser(authedUser);
  };

  const handleLogout = () => {
    StorageService.clearCurrentUser();
    setUser(null);
    setSettingsOpen(false);
  };

  const handleExportData = () => {
    if (user) {
      StorageService.exportJSON(user.id, user.name);
    }
  };

  const handleDeleteAccount = () => {
    if (user) {
      StorageService.deleteUserData(user.id);
      setUser(null);
      setSettingsOpen(false);
    }
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  // Calculate live financial balance
  const totalBalance = transactions.reduce((acc, t) => {
    const rate = t.rate || settings.exchangeRates[t.currency as keyof typeof settings.exchangeRates] || 1;
    const val = t.amount * (t.currency === 'UAH' ? 1 : rate);
    return t.type === 'income' ? acc + val : acc - val;
  }, 0);

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
      {/* Ambient blobs */}
      <div className="ambient" />

      <Sidebar
        active={section}
        onChange={setSection}
        onOpenSettings={() => setSettingsOpen(true)}
        syncStatus={syncStatus}
      />

      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        <Header
          section={section}
          user={user}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="flex-1 overflow-hidden">
          {section === 'dashboard' && (
            <Dashboard
              tasks={tasks}
              onUpdateTasks={handleUpdateTasks}
              pinnedDocs={pinnedDocs}
              onUpdatePinnedDocs={handleUpdatePinnedDocs}
              balance={totalBalance}
            />
          )}
          {section === 'calendar' && (
            <Calendar
              events={events as any}
              onUpdateEvents={handleUpdateEvents}
            />
          )}
          {section === 'tasks' && (
            <TasksHabits
              tasks={tasks}
              onUpdateTasks={handleUpdateTasks}
              habits={habits}
              onUpdateHabits={handleUpdateHabits}
            />
          )}
          {section === 'finance' && (
            <Finance
              exchangeRates={settings.exchangeRates}
              transactions={transactions}
              onUpdateTransactions={handleUpdateTransactions}
            />
          )}
          {section === 'ai' && (
            <AIAssistant userName={user.name} />
          )}
        </main>
      </div>

      {settingsOpen && (
        <Settings
          settings={settings}
          user={user}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
          onLogout={handleLogout}
          onExportData={handleExportData}
          onDeleteAccount={handleDeleteAccount}
          onUpdateUser={handleUpdateUser}
        />
      )}
    </div>
  );
}
