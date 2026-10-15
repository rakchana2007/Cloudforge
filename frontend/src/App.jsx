import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownToLine, CheckCircle2, Clock3,
  Cloud, LoaderCircle, Plus, RefreshCw, Search, Send, ShieldCheck,
  Terminal, Zap
} from 'lucide-react';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function statusClass(status = '') {
  return status.toLowerCase().replaceAll('_', '-');
}
function prettyStatus(status = '') {
  return status.replaceAll('_', ' ');
}
function time(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ submitted: 0, completed: 0, retried: 0, permanentlyFailed: 0, queued: 0, processing: 0 });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    if (!API) throw new Error('API URL is not configured. Copy .env.example to .env and set VITE_API_BASE_URL.');
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [taskData, statsData] = await Promise.all([request('/tasks'), request('/stats')]);
      setTasks(taskData.tasks || []);
      setStats(statsData);
      setLastUpdated(new Date());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(true), 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function runAction(key, action) {
    setBusy(key);
    setError('');
    try {
      await action();
      await refresh(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  const filtered = useMemo(() => tasks.filter(task =>
    `${task.taskId} ${task.taskType} ${task.status} ${task.lastError}`.toLowerCase().includes(query.toLowerCase())
  ), [tasks, query]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Cloud size={22}/></div><div><b>CloudFlow</b><span>QUEUE OPERATIONS</span></div></div>
        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active"><Activity size={17}/> Overview</div>
        <div className="nav-item"><Terminal size={17}/> Task monitor</div>
        <div className="nav-item"><ShieldCheck size={17}/> Reliability</div>
        <div className="sidebar-bottom"><div className="cloud-status"><span className="pulse-dot"/> Cloud pipeline <b>Monitor</b></div><p>Cloud-native task processing demo</p></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">OPERATIONS / OVERVIEW</div><h1>Task operations</h1><p className="subhead">Monitor asynchronous jobs across your cloud pipeline.</p></div>
          <button className="btn secondary" onClick={() => refresh()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''}/> Refresh</button>
        </header>

        {!API && <div className="notice"><AlertTriangle size={18}/><div><b>Backend URL required</b><span>Set VITE_API_BASE_URL in frontend/.env after deploying the backend.</span></div></div>}
        {error && <div className="error-banner"><AlertTriangle size={17}/>{error}</div>}

        <section className="status-strip">
          <div className="live-label"><span className="pulse-dot"/> AUTO-REFRESH · 5 SEC</div>
          <div className="updated">Last synced: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Waiting for connection'}</div>
        </section>

        <section className="metrics-grid">
          <Metric icon={<ArrowDownToLine/>} label="Submitted tasks" value={stats.submitted} tone="blue" hint="Unique task records"/>
          <Metric icon={<CheckCircle2/>} label="Completed" value={stats.completed} tone="green" hint="Successfully processed"/>
          <Metric icon={<RefreshCw/>} label="Retried" value={stats.retried} tone="amber" hint="Attempt count above one"/>
          <Metric icon={<AlertTriangle/>} label="Permanently failed" value={stats.permanentlyFailed} tone="red" hint="Requires inspection"/>
        </section>

        <section className="content-grid">
          <div className="panel task-panel">
            <div className="panel-header"><div><h2>Task queue</h2><p>Unique tasks and their latest durable status</p></div><span className="count-chip">{filtered.length} tasks</span></div>
            <div className="toolbar">
              <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search task ID or status..."/></div>
              <button className="btn secondary small" onClick={() => refresh()}><RefreshCw size={14}/> Sync</button>
            </div>
            <div className="table-wrap">
              <table><thead><tr><th>TASK</th><th>STATUS</th><th>ATTEMPTS</th><th>UPDATED</th></tr></thead>
                <tbody>
                  {filtered.map(task => <tr key={task.taskId}>
                    <td><div className="task-id">{task.taskId}</div><div className="task-type">{task.taskType || 'demo'}</div>{task.lastError && <div className="error-detail" title={task.lastError}>{task.lastError}</div>}</td>
                    <td><span className={`status-badge ${statusClass(task.status)}`}><span className="status-dot"/>{prettyStatus(task.status)}</span></td>
                    <td className="attempts">{task.attempts ?? 0}</td>
                    <td className="date-cell">{time(task.updatedAt)}</td>
                  </tr>)}
                  {!filtered.length && <tr><td colSpan="4" className="empty">{loading ? 'Loading tasks…' : 'No tasks found. Submit a task to get started.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="right-column">
            <div className="panel actions-panel">
              <div className="panel-header"><div><h2>Run a demo</h2><p>Exercise the real cloud pipeline</p></div><Zap size={19} className="panel-icon"/></div>
              <button className="action-card primary-action" disabled={!!busy || !API} onClick={() => runAction('batch', () => request('/tasks/batch', { method: 'POST', body: JSON.stringify({ count: 10 }) }))}>
                <span className="action-icon"><Plus size={19}/></span><span><b>Submit 10 demo tasks</b><small>Generate unique task IDs</small></span>{busy === 'batch' ? <LoaderCircle className="spin"/> : <Send size={17}/>}
              </button>
              <button className="action-card failure-action" disabled={!!busy || !API} onClick={() => runAction('failure', () => request('/tasks', { method: 'POST', body: JSON.stringify({ taskType: 'failure-demo', payload: { source: 'dashboard' }, forceFailure: true }) }))}>
                <span className="action-icon"><AlertTriangle size={19}/></span><span><b>Submit failure demo</b><small>Fails to demonstrate retries + DLQ</small></span>{busy === 'failure' ? <LoaderCircle className="spin"/> : <Send size={17}/>}
              </button>
              <div className="hint-box"><Clock3 size={16}/><span>Retry and DLQ status updates may take a little time. The dashboard refreshes automatically every 5 seconds.</span></div>
            </div>

            <div className="panel pipeline-panel">
              <div className="panel-header"><div><h2>Pipeline health</h2><p>Expected message path</p></div></div>
              <PipelineStep number="01" title="API / Producer" detail="Accepts task and sends SQS message" />
              <PipelineStep number="02" title="Amazon SQS" detail={`${stats.queued} queued · ${stats.processing} processing`} />
              <PipelineStep number="03" title="Worker Lambda" detail="Processes and records result" />
              <PipelineStep number="04" title="DynamoDB + DLQ" detail="Durable status and failure history" last />
            </div>
          </div>
        </section>

        <footer><span><span className="pulse-dot"/> CloudFlow demo workspace</span><span>Built for CloudForge · AWS services</span></footer>
      </main>
    </div>
  );
}

function Metric({ icon, label, value, tone, hint }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-label">{label}</div><div className="metric-value">{value ?? 0}</div><div className="metric-hint">{hint}</div></div>;
}
function PipelineStep({ number, title, detail, last }) {
  return <div className={`pipeline-step ${last ? 'last' : ''}`}><div className="step-number">{number}</div><div><b>{title}</b><span>{detail}</span></div><span className="step-check"><CheckCircle2 size={15}/></span></div>;
}
