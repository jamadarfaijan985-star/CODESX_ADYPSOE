import React, { useState } from 'react';
import { RailwayProvider, useRailway } from './context/RailwayContext';
import { Header } from './components/Header';
import { Sidebar, NavigationTab } from './components/Sidebar';
import { OverviewView } from './components/views/OverviewView';
import { TimetableTableView } from './components/views/TimetableTableView';
import { PlatformOperationsView } from './components/views/PlatformOperationsView';
import { ConflictsValidationView } from './components/views/ConflictsValidationView';
import { DisruptionManagementView } from './components/views/DisruptionManagementView';
import { DelayForecastView } from './components/views/DelayForecastView';
import { OperationsAssistantView } from './components/views/OperationsAssistantView';
import { ScheduleHistoryView } from './components/views/ScheduleHistoryView';
import { SettingsDiagnosticsView } from './components/views/SettingsDiagnosticsView';
import { ScheduleComparisonModal } from './components/views/ScheduleComparisonModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { AlertCircle, WifiOff } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const { health, error } = useRailway();

  return (
    <div className="min-h-screen bg-[#080E19] text-[#F8FAFC] flex flex-col font-sans select-none antialiased">
      {/* Top Header */}
      <Header onOpenResetConfirm={() => setIsResetConfirmOpen(true)} />

      {/* Backend Offline Diagnostic Banner if connection fails */}
      {!health.isOnline && (
        <div className="bg-red-950/80 border-b border-red-700/80 px-4 py-2 text-xs text-red-200 flex items-center justify-between z-40">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>Backend Disconnected:</strong> Cannot reach API server (
              {health.error || 'Server unreachable at localhost:3000/api'}). Operating in degraded offline state.
            </span>
          </div>
          <span className="font-mono text-[11px] text-red-400">STATUS: OFFLINE</span>
        </div>
      )}

      {/* Main Workspace Frame: Sidebar + Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#0B1322]">
          <div className="max-w-7xl mx-auto">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {currentTab === 'overview' && (
              <OverviewView
                onNavigate={setCurrentTab}
                onOpenReplanModal={() => setIsComparisonOpen(true)}
              />
            )}
            {currentTab === 'timetable' && <TimetableTableView />}
            {currentTab === 'platforms' && <PlatformOperationsView />}
            {currentTab === 'conflicts' && <ConflictsValidationView />}
            {currentTab === 'disruptions' && (
              <DisruptionManagementView onOpenReplanModal={() => setIsComparisonOpen(true)} />
            )}
            {currentTab === 'forecast' && <DelayForecastView />}
            {currentTab === 'assistant' && (
              <OperationsAssistantView onOpenReplanModal={() => setIsComparisonOpen(true)} />
            )}
            {currentTab === 'history' && <ScheduleHistoryView />}
            {currentTab === 'settings' && <SettingsDiagnosticsView />}
          </div>
        </main>
      </div>

      {/* Comparison Modal */}
      <ScheduleComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
      />

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <RailwayProvider>
      <DashboardContent />
    </RailwayProvider>
  );
}
