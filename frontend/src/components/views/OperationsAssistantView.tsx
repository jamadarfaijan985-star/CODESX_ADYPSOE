import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Clock,
  ArrowRight,
  ShieldAlert,
  User,
  RotateCcw,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { AssistantMessage } from '../../types/railway';

export const OperationsAssistantView: React.FC<{ onOpenReplanModal: () => void }> = ({
  onOpenReplanModal,
}) => {
  const {
    selectedStation,
    assistantMessages,
    sendAssistantMessage,
    executeAssistantPayload,
    isLoading,
  } = useRailway();

  const [inputVal, setInputVal] = useState('');
  const [activeActionPayload, setActiveActionPayload] = useState<{
    payload: NonNullable<AssistantMessage['quickActionPayload']>;
    messageId: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantMessages]);

  const quickPrompts = [
    'Show current platform conflicts.',
    'What is affected by train T102 being delayed by 15 minutes?',
    'Show platforms affected by a closure.',
    'Compare the original and candidate schedules.',
    'Show the latest validation results.',
  ];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const text = inputVal;
    setInputVal('');
    await sendAssistantMessage(text);
  };

  const handleSelectQuickPrompt = async (prompt: string) => {
    await sendAssistantMessage(prompt);
  };

  const handleConfirmAction = async () => {
    if (!activeActionPayload) return;
    await executeAssistantPayload(activeActionPayload.payload, activeActionPayload.messageId);
    if (activeActionPayload.payload.type === 'REPLAN') {
      onOpenReplanModal();
    }
    setActiveActionPayload(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Operations Assistant"
        subtitle="Rule-based operations chat assistant for querying conflicts, simulating disruptions, and guiding replan workflows."
        stationCode={selectedStation}
        isDemo={true}
        actions={
          <StatusBadge
            label="DETERMINISTIC RULE ENGINE · NO EXTERNAL AI"
            variant="demo"
            size="sm"
          />
        }
      />

      {/* Main Chat Workspace */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg flex flex-col h-[640px] overflow-hidden shadow-md">
        {/* Chat Header Bar */}
        <div className="p-3.5 bg-[#080E19] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-cyan-950/80 border border-cyan-700/80 flex items-center justify-center text-cyan-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>RailFlow Dispatch Companion</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              </div>
              <span className="text-[10px] text-slate-400">
                Grounded in current local station state ({selectedStation})
              </span>
            </div>
          </div>

          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            Deterministic Railway Regex &amp; State Dispatcher
          </span>
        </div>

        {/* Message Thread Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {assistantMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-2xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-cyan-950 border border-cyan-800 text-cyan-400'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Bubble */}
                <div
                  className={`p-3.5 rounded-lg text-xs leading-relaxed space-y-2 ${
                    isUser
                      ? 'bg-blue-600/90 text-white rounded-tr-none'
                      : 'bg-[#080E19] border border-slate-800 text-slate-200 rounded-tl-none shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-line font-sans">{msg.text}</p>

                  {/* Interactive Quick Action Card if attached */}
                  {msg.quickActionPayload && (
                    <div className="mt-3 p-2.5 rounded bg-[#111D2D] border border-cyan-900/60 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-cyan-300 text-[11px] flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5" />
                          <span>PROPOSED OPERATION</span>
                        </span>
                        {msg.actionCompleted && (
                          <StatusBadge label="EXECUTED" variant="valid" size="sm" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-300">
                        {msg.quickActionPayload.description}
                      </p>

                      {!msg.actionCompleted && (
                        <button
                          onClick={() =>
                            setActiveActionPayload({
                              payload: msg.quickActionPayload!,
                              messageId: msg.id,
                            })
                          }
                          className="w-full py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Review &amp; Apply to Current State</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 text-right font-mono">
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Chips Carousel */}
        <div className="px-4 py-2 bg-[#080E19]/80 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Examples:</span>
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSelectQuickPrompt(prompt)}
              className="text-[11px] font-medium px-2.5 py-1 rounded bg-[#111D2D] hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 whitespace-nowrap transition-colors cursor-pointer shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Text Input Footer */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-[#080E19] border-t border-slate-800 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Type a message or operational request (e.g. Show current platform conflicts)..."
            className="flex-1 bg-[#111D2D] border border-slate-700/80 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isLoading}
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>

      {/* Confirmation Dialog for Assistant Action */}
      <ConfirmationDialog
        isOpen={activeActionPayload !== null}
        title="Confirm Assistant Operational Action"
        description="The Operations Assistant has formulated an operation based on your conversation. Confirming will update the shared local timetable."
        variant="warning"
        confirmLabel="Authorize Action"
        details={
          activeActionPayload && (
            <div className="space-y-1">
              <div>
                Action: <strong className="text-cyan-400">{activeActionPayload.payload.type}</strong>
              </div>
              <div>{activeActionPayload.payload.description}</div>
              <div className="text-slate-400 text-[10px]">
                Params: {JSON.stringify(activeActionPayload.payload.parameters)}
              </div>
            </div>
          )
        }
        onConfirm={handleConfirmAction}
        onCancel={() => setActiveActionPayload(null)}
      />
    </div>
  );
};
