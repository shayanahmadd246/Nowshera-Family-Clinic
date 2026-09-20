import React, { useState, useEffect } from 'react';
import {
  Database,
  Terminal,
  Table as TableIcon,
  Download,
  FileCode,
  Sparkles,
  Play,
  RotateCcw,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  FileSpreadsheet,
  Copy,
  ChevronRight,
} from 'lucide-react';
import {
  SqliteDatabaseStats,
  SqliteQueryResult,
  SqliteTableInfo,
} from '../types';

interface SqliteDatabaseManagerProps {
  token: string;
}

export const SqliteDatabaseManager: React.FC<SqliteDatabaseManagerProps> = ({ token }) => {
  const [stats, setStats] = useState<SqliteDatabaseStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [selectedTable, setSelectedTable] = useState<string>('users');
  const [tableData, setTableData] = useState<SqliteQueryResult | null>(null);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>('');

  // SQL Console state
  const [sqlQuery, setSqlQuery] = useState<string>(
    'SELECT doctor_name, doctor_specialty, status, COUNT(*) AS total_count FROM appointments GROUP BY doctor_name, status ORDER BY doctor_name;'
  );
  const [queryResult, setQueryResult] = useState<SqliteQueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState<boolean>(false);

  // AI SQL Assistant state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  // General state
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedQuery, setCopiedQuery] = useState<boolean>(false);

  // Load database stats
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await fetch('/api/admin/sqlite/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: SqliteDatabaseStats = await res.json();
        setStats(data);
        if (data.tables.length > 0 && !data.tables.some((t) => t.name === selectedTable)) {
          setSelectedTable(data.tables[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load SQLite stats', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Load table data
  const fetchTableData = async (tableName: string) => {
    try {
      setTableLoading(true);
      const res = await fetch(`/api/admin/sqlite/table/${encodeURIComponent(tableName)}?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: SqliteQueryResult = await res.json();
        setTableData(data);
      }
    } catch (err) {
      console.error('Failed to load table rows', err);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable]);

  // Execute custom SQL
  const handleExecuteSql = async (overrideQuery?: string) => {
    const q = overrideQuery || sqlQuery;
    if (!q.trim()) return;

    try {
      setQueryLoading(true);
      setStatusMessage(null);
      const res = await fetch('/api/admin/sqlite/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: q }),
      });

      const data: SqliteQueryResult = await res.json();
      setQueryResult(data);

      if (data.error) {
        setStatusMessage({ type: 'error', text: `SQL Error: ${data.error}` });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Query executed successfully in ${data.executionTimeMs}ms (${data.rowCount} rows returned)`,
        });
        // Refresh stats & active table if modified
        fetchStats();
        if (selectedTable) fetchTableData(selectedTable);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Execution failed' });
    } finally {
      setQueryLoading(false);
    }
  };

  // AI SQL Generator
  const handleAiGenerateQuery = async () => {
    if (!aiPrompt.trim()) return;

    try {
      setAiLoading(true);
      setAiExplanation(null);
      const res = await fetch('/api/admin/sqlite/ai-generate-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: aiPrompt }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sql) {
          setSqlQuery(data.sql);
          setAiExplanation(data.explanation);
          handleExecuteSql(data.sql);
        }
      }
    } catch (err) {
      console.error('Failed to generate SQL with AI', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Download SQLite File
  const handleDownloadDatabase = async () => {
    try {
      const res = await fetch('/api/admin/sqlite/download', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clinic_database_${new Date().toISOString().slice(0, 10)}.sqlite`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  // Export JSON
  const handleExportJson = async () => {
    try {
      const res = await fetch('/api/admin/sqlite/export-json', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clinic_database_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('JSON export failed', err);
    }
  };

  // Reset Database
  const handleResetDatabase = async () => {
    if (!window.confirm('Are you sure you want to reset the SQLite database to factory defaults? All appointments and logs will be restored to initial seed data.')) {
      return;
    }

    try {
      const res = await fetch('/api/admin/sqlite/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'SQLite database successfully reset to clean defaults' });
        fetchStats();
        fetchTableData(selectedTable);
      }
    } catch (err) {
      console.error('Reset failed', err);
    }
  };

  const sampleQueries = [
    {
      label: 'All Patients',
      sql: "SELECT id, name, email, phone, role, created_at FROM users WHERE role='patient';",
    },
    {
      label: 'Doctor Workloads',
      sql: 'SELECT doctor_name, doctor_specialty, status, COUNT(*) as count FROM appointments GROUP BY doctor_name, status ORDER BY doctor_name;',
    },
    {
      label: 'Confirmed Appointments',
      sql: "SELECT id, patient_name, doctor_name, date, start_time, status FROM appointments WHERE status='Confirmed' ORDER BY date ASC;",
    },
    {
      label: 'Weekly Doctor Schedules',
      sql: 'SELECT u.name, u.specialty, s.day_name, s.start_time, s.end_time FROM doctor_schedules s JOIN users u ON s.doctor_id = u.id ORDER BY u.name, s.day_of_week;',
    },
    {
      label: 'System Notification Logs',
      sql: 'SELECT id, recipient_name, recipient_email, type, subject, sent_at FROM notifications ORDER BY sent_at DESC LIMIT 20;',
    },
    {
      label: 'AI Automation Logs',
      sql: 'SELECT id, feature, input_prompt, created_at FROM ai_logs ORDER BY created_at DESC LIMIT 20;',
    },
  ];

  const currentTableInfo: SqliteTableInfo | undefined = stats?.tables.find((t) => t.name === selectedTable);

  const filteredRows = tableData?.rows.filter((row) => {
    if (!tableSearch.trim()) return true;
    const s = tableSearch.toLowerCase();
    return row.some((val) => String(val).toLowerCase().includes(s));
  });

  return (
    <div className="space-y-6" id="sqlite-database-manager">
      {/* 1. Header & Engine Metrics Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-rose-950 to-stone-900 text-white rounded-2xl p-6 shadow-xl border border-rose-900/40">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-stone-100 tracking-tight">SQLite Database Engine</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/80 text-emerald-300 border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active & Persistent
                </span>
              </div>
              <p className="text-sm text-stone-300 mt-1">
                Relational SQL backend for Nowshera Family Clinic with live ACID compliance and binary persistence.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="sqlite-download-btn"
              onClick={handleDownloadDatabase}
              className="px-3.5 py-2 rounded-lg bg-rose-900 hover:bg-rose-800 text-amber-300 text-xs font-semibold flex items-center gap-2 border border-rose-700/50 shadow transition"
              title="Download raw .sqlite database file"
            >
              <Download className="w-4 h-4 text-amber-400" />
              Download .sqlite
            </button>
            <button
              id="sqlite-export-json-btn"
              onClick={handleExportJson}
              className="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-2 border border-stone-700 shadow transition"
              title="Export database contents to JSON"
            >
              <FileSpreadsheet className="w-4 h-4 text-sky-400" />
              Export JSON
            </button>
            <button
              id="sqlite-refresh-btn"
              onClick={() => {
                fetchStats();
                if (selectedTable) fetchTableData(selectedTable);
              }}
              disabled={loadingStats}
              className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition"
              title="Refresh database statistics"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="sqlite-reset-btn"
              onClick={handleResetDatabase}
              className="p-2 rounded-lg bg-stone-800 hover:bg-red-900/60 text-stone-400 hover:text-red-200 border border-stone-700 transition"
              title="Reset SQLite database to defaults"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Database Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-stone-800/80">
          <div className="bg-stone-900/60 rounded-xl p-3 border border-stone-800">
            <div className="text-xs text-stone-400 font-medium">Database File</div>
            <div className="text-sm font-semibold text-amber-300 truncate font-mono mt-0.5">/data/clinic.sqlite</div>
          </div>
          <div className="bg-stone-900/60 rounded-xl p-3 border border-stone-800">
            <div className="text-xs text-stone-400 font-medium">Storage Size</div>
            <div className="text-sm font-semibold text-stone-200 mt-0.5">
              {stats ? `${(stats.fileSizeBytes / 1024).toFixed(1)} KB` : '...'}
            </div>
          </div>
          <div className="bg-stone-900/60 rounded-xl p-3 border border-stone-800">
            <div className="text-xs text-stone-400 font-medium">Relational Tables</div>
            <div className="text-sm font-semibold text-stone-200 mt-0.5">
              {stats ? `${stats.tableCount} Tables` : '...'}
            </div>
          </div>
          <div className="bg-stone-900/60 rounded-xl p-3 border border-stone-800">
            <div className="text-xs text-stone-400 font-medium">Total Records</div>
            <div className="text-sm font-semibold text-emerald-400 mt-0.5">
              {stats ? `${stats.totalRows} Rows` : '...'}
            </div>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
              : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 2. AI SQL Query Generator Assistant */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-stone-900">AI SQL Query Assistant</h3>
            <p className="text-xs text-stone-500">
              Ask AI in plain English to automatically construct and execute optimized SQLite queries.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="ai-sql-input"
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiGenerateQuery()}
            placeholder="e.g., Show me all appointments with Dr. Ayesha, or list total visits per department"
            className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-800/30 focus:border-rose-900 text-stone-900 placeholder:text-stone-400"
          />
          <button
            id="ai-sql-generate-btn"
            onClick={handleAiGenerateQuery}
            disabled={aiLoading || !aiPrompt.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-900 to-rose-950 hover:from-rose-800 hover:to-rose-900 text-amber-300 font-semibold text-sm flex items-center justify-center gap-2 shadow transition disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
            {aiLoading ? 'Generating...' : 'Auto-Generate SQL'}
          </button>
        </div>

        {aiExplanation && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-950">AI Rationale: </span>
              {aiExplanation}
            </div>
          </div>
        )}
      </div>

      {/* 3. SQL Interactive Console */}
      <div className="bg-stone-900 rounded-2xl p-6 shadow-xl border border-stone-800 text-stone-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-stone-100">Interactive SQL Console</h3>
          </div>

          {/* Preset queries pill bar */}
          <div className="flex flex-wrap gap-1.5">
            {sampleQueries.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSqlQuery(item.sql);
                  handleExecuteSql(item.sql);
                }}
                className="px-2.5 py-1 rounded-md text-xs bg-stone-800 hover:bg-rose-950 hover:text-amber-300 text-stone-300 border border-stone-700 transition"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* SQL Code Editor Area */}
        <div className="relative">
          <textarea
            id="sqlite-query-textarea"
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            rows={4}
            className="w-full bg-stone-950 text-emerald-400 font-mono text-sm p-4 rounded-xl border border-stone-700 focus:outline-none focus:border-amber-400 shadow-inner resize-y"
            placeholder="SELECT * FROM appointments;"
          />
          <div className="absolute right-3 bottom-4 flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(sqlQuery);
                setCopiedQuery(true);
                setTimeout(() => setCopiedQuery(false), 2000);
              }}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-600 text-xs transition"
              title="Copy SQL Query"
            >
              {copiedQuery ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              id="sqlite-run-query-btn"
              onClick={() => handleExecuteSql()}
              disabled={queryLoading || !sqlQuery.trim()}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${queryLoading ? 'animate-spin' : ''}`} />
              {queryLoading ? 'Running...' : 'Execute SQL'}
            </button>
          </div>
        </div>

        {/* Query Output View */}
        {queryResult && (
          <div className="mt-5 pt-5 border-t border-stone-800">
            <div className="flex items-center justify-between text-xs text-stone-400 mb-3">
              <span>
                Results: <strong className="text-amber-300">{queryResult.rowCount} rows</strong> (
                {queryResult.executionTimeMs}ms)
              </span>
              <span>{queryResult.columns.length} columns</span>
            </div>

            {queryResult.error ? (
              <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 font-mono text-xs">
                {queryResult.error}
              </div>
            ) : queryResult.rows.length === 0 ? (
              <div className="p-6 rounded-xl bg-stone-950/50 border border-stone-800 text-center text-stone-400 text-xs">
                Query executed successfully. 0 rows returned.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80 border border-stone-800 rounded-xl bg-stone-950">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-stone-800 text-stone-300 sticky top-0">
                    <tr>
                      {queryResult.columns.map((col, idx) => (
                        <th key={idx} className="p-2.5 border-b border-stone-700 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/80 text-stone-300">
                    {queryResult.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-stone-800/50 transition">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="p-2.5 whitespace-nowrap">
                            {cell === null ? (
                              <span className="text-stone-600 italic">NULL</span>
                            ) : typeof cell === 'object' ? (
                              JSON.stringify(cell)
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Visual Table Browser & Schema Inspector */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        {/* Table selector tabs */}
        <div className="bg-stone-50 p-4 border-b border-stone-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-rose-900" />
            <h3 className="text-base font-bold text-stone-900">Database Schema & Tables</h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search table rows..."
                className="pl-9 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-rose-900/30 text-stone-900"
              />
            </div>
          </div>
        </div>

        {/* Table Selector Pills */}
        <div className="p-4 border-b border-stone-100 flex flex-wrap gap-2 bg-stone-50/50">
          {stats?.tables.map((tbl) => (
            <button
              key={tbl.name}
              onClick={() => setSelectedTable(tbl.name)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                selectedTable === tbl.name
                  ? 'bg-rose-950 text-amber-300 shadow-sm'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{tbl.name}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  selectedTable === tbl.name ? 'bg-rose-800 text-amber-200' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {tbl.rowCount}
              </span>
            </button>
          ))}
        </div>

        {/* Schema Columns Details */}
        {currentTableInfo && (
          <div className="px-6 py-3 bg-stone-100/60 border-b border-stone-200 text-xs flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-600">Schema for `{currentTableInfo.name}`:</span>
            {currentTableInfo.columns.map((col) => (
              <span
                key={col.name}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-stone-300 text-stone-800 font-mono text-[11px]"
              >
                <strong>{col.name}</strong>
                <span className="text-stone-400">({col.type})</span>
                {col.pk === 1 && (
                  <span className="text-[9px] font-bold px-1 bg-amber-100 text-amber-800 rounded">PK</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Table Rows Grid */}
        <div className="overflow-x-auto max-h-96">
          {tableLoading ? (
            <div className="p-12 text-center text-stone-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-rose-900" />
              Loading records from SQLite...
            </div>
          ) : !filteredRows || filteredRows.length === 0 ? (
            <div className="p-12 text-center text-stone-400 text-xs">
              No records found in table `{selectedTable}`.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-stone-50 text-stone-700 sticky top-0 border-b border-stone-200">
                <tr>
                  {tableData?.columns.map((col, idx) => (
                    <th key={idx} className="p-3 font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700 font-mono text-[11px]">
                {filteredRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-amber-50/40 transition">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="p-3 whitespace-nowrap max-w-xs truncate">
                        {cell === null ? (
                          <span className="text-stone-300 italic">null</span>
                        ) : String(cell).startsWith('{') || String(cell).startsWith('[') ? (
                          <span className="text-sky-800">{String(cell)}</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
