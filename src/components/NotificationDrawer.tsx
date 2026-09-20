import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { EmailNotification } from '../types';
import {
  X,
  Mail,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Calendar,
  Send,
} from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSetPassword?: (token: string, email: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onOpenSetPassword,
}) => {
  const { user } = useAuth();
  const [emails, setEmails] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [automationLog, setAutomationLog] = useState<{
    timestamp: string;
    cancelledPendingCount: number;
    remindersSentCount: number;
    details: string[];
  } | null>(null);

  const fetchEmails = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getEmails();
      setEmails(data);
    } catch (err) {
      console.error('Failed to load emails', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen, user]);

  const handleRunAutomation = async () => {
    setRunningAutomation(true);
    try {
      const res = await api.runAutomations();
      setAutomationLog(res);
      await fetchEmails();
    } catch (err) {
      console.error('Failed to run automations', err);
    } finally {
      setRunningAutomation(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Email & Notification Center</h2>
              <p className="text-xs text-slate-500">
                {user?.role === 'admin' ? 'Clinic-wide email dispatch log' : `Inbox for ${user?.email}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Automation Runner Action Bar */}
        <div className="p-4 bg-indigo-50/70 border-b border-indigo-100 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-indigo-900">Automated Background Engine</span>
              <p className="text-[11px] text-indigo-700">
                Sweeps expired pending bookings & dispatches 24-hr reminders automatically.
              </p>
            </div>
            <button
              id="run-automations-now-btn"
              onClick={handleRunAutomation}
              disabled={runningAutomation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${runningAutomation ? 'animate-spin' : ''}`} />
              Run Now
            </button>
          </div>

          {automationLog && (
            <div className="mt-2 p-2.5 bg-white rounded-lg border border-indigo-200 text-xs text-indigo-950">
              <div className="font-semibold flex items-center gap-1.5 text-indigo-900 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                Automation Sweep Executed
              </div>
              <p className="text-[11px] text-slate-600">
                • Expired unconfirmed bookings cancelled: <strong className="text-slate-900">{automationLog.cancelledPendingCount}</strong>
              </p>
              <p className="text-[11px] text-slate-600">
                • 24-hour visit reminders dispatched: <strong className="text-slate-900">{automationLog.remindersSentCount}</strong>
              </p>
              {automationLog.details.length > 0 && (
                <div className="mt-1 text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200 max-h-24 overflow-y-auto">
                  {automationLog.details.map((d, i) => (
                    <div key={i}>&gt; {d}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Email Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Delivered Emails ({emails.length})
            </span>
            <button
              onClick={fetchEmails}
              disabled={loading}
              className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {emails.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">No emails yet</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                Emails for confirmations, cancellations, reminders, and welcome links will appear here automatically.
              </p>
            </div>
          ) : (
            emails.map((email) => {
              const isWelcome = email.type === 'doctor_welcome_set_password';
              const isConfirmed = email.type === 'appointment_confirmed';
              const isCancelled = email.type === 'appointment_cancelled';
              const isReminder = email.type === 'appointment_reminder';

              return (
                <div
                  key={email.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isConfirmed
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : isCancelled
                      ? 'bg-rose-50/50 border-rose-200'
                      : isWelcome
                      ? 'bg-purple-50/50 border-purple-200'
                      : isReminder
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {isConfirmed && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {isCancelled && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                      {isWelcome && <KeyRound className="w-4 h-4 text-purple-600 shrink-0" />}
                      {isReminder && <Calendar className="w-4 h-4 text-amber-600 shrink-0" />}
                      {!isConfirmed && !isCancelled && !isWelcome && !isReminder && (
                        <Send className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                      <h3 className="text-xs font-bold text-slate-900 leading-snug">{email.subject}</h3>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2 border-b border-slate-200/60 pb-1.5">
                    <span>
                      To: <strong className="text-slate-700">{email.recipientName}</strong> ({email.recipientEmail})
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans bg-white/70 p-2.5 rounded-lg border border-slate-100">
                    {email.body}
                  </div>

                  {isWelcome && onOpenSetPassword && (
                    <div className="mt-2.5 pt-2 border-t border-purple-200 flex justify-end">
                      <button
                        onClick={() => {
                          const tokenMatch = email.body.match(/Token:\s*([a-zA-Z0-9_]+)/);
                          const token = tokenMatch ? tokenMatch[1] : '';
                          onOpenSetPassword(token, email.recipientEmail);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Set Doctor Password Now
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
