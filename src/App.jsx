import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './index.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const IDLE_THRESHOLD = 5000;
const WARNING_IDLE = 30000;
const MAX_WARNINGS = 3;

function App() {
  // ===================== STATE =====================
  const [stats, setStats] = useState({
    keys: 0,
    mouseMoves: 0,
    tabSwitches: 0,
    activeTime: 0,
    idleTime: 0,
    sessionTime: 0,
    currentIdleStreak: 0,
    isIdle: false,
    warningCount: 0,
    activityHistory: new Array(60).fill(0),
  });

  const [logs, setLogs] = useState([]);
  const [popup, setPopup] = useState({ show: false, critical: false });

  // Refs for values accessed in event listeners/intervals to avoid closure staleness
  const lastActivityRef = useRef(Date.now());
  const isIdleRef = useRef(false);
  const warningCountRef = useRef(0);
  const warningTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const mouseThrottleRef = useRef(false);
  const lastTickRef = useRef(Date.now());
  const statsRef = useRef(stats);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // ===================== LOGGING =====================
  const addLog = useCallback((msg, color) => {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    setLogs(prev => [{ msg, color, time, id: Date.now() + Math.random() }, ...prev].slice(0, 20));
  }, []);

  // ===================== STATE PERSISTENCE =====================
  useEffect(() => {
    const saved = localStorage.getItem('fakeEffortData');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setStats(prev => ({
          ...prev,
          keys: d.keys || 0,
          mouseMoves: d.mouseMoves || 0,
          tabSwitches: d.tabSwitches || 0,
          activeTime: d.activeTime || 0,
          idleTime: d.idleTime || 0,
          warningCount: d.warningCount || 0,
        }));
        warningCountRef.current = d.warningCount || 0;
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
    
    // Initial log
    addLog('Detector initialized — session started', '#7c3aed');

    // Request Notification Permission on Start
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, [addLog]);

  useEffect(() => {
    if (stats.sessionTime % 5 === 0 && stats.sessionTime > 0) {
      localStorage.setItem('fakeEffortData', JSON.stringify({
        keys: stats.keys,
        mouseMoves: stats.mouseMoves,
        tabSwitches: stats.tabSwitches,
        activeTime: stats.activeTime,
        idleTime: stats.idleTime,
        warningCount: stats.warningCount,
      }));
    }
  }, [stats.sessionTime, stats.keys, stats.mouseMoves, stats.tabSwitches, stats.activeTime, stats.idleTime, stats.warningCount]);

  // ===================== WARNING LOGIC =====================
  const showWarning = useCallback((critical) => {
    setPopup({ show: true, critical });

    // SYSTEM NOTIFICATION (Triggers outside browser)
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(critical ? "CRITICAL ALERT: FocusGuard" : "FocusGuard Warning", {
          body: critical 
            ? "Multiple inactivity warnings! Your score is dropping rapidly." 
            : "You have been idle for 30 seconds. Resume activity immediately.",
          requireInteraction: true, // Keeps notification on screen until user clicks
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
    
    // Sound alert
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(critical ? 880 : 660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(critical ? 440 : 330, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch(e) {}
  }, []);

  const resetIdleWarningTimer = useCallback(() => {
    clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      if (isIdleRef.current) {
        warningCountRef.current++;
        const newCount = warningCountRef.current;
        setStats(prev => ({ ...prev, warningCount: newCount }));
        
        // Save using current stats Ref + new warning count
        // Note: activeTime/idleTime might be slightly stale if interval hasn't ticked, but better than closure stale.
        localStorage.setItem('fakeEffortData', JSON.stringify({
             ...statsRef.current,
             warningCount: newCount
        }));

        const critical = newCount >= MAX_WARNINGS;
        addLog(critical ? 'CRITICAL: 3 warnings reached!' : `Warning #${newCount} triggered`, '#ef4444');
        showWarning(critical);
      }
    }, WARNING_IDLE);
  }, [addLog, showWarning]); // removed `stats` dependency!

  // ===================== ACTIVITY TRACKING =====================
  const markIdle = useCallback(() => {
    if (!isIdleRef.current) {
      addLog('Went idle (5s no activity)', '#eab308');
      
      // Retroactive correction: Time spent waiting for threshold (5s) was counted as active.
      // Move it to idle time now that we are confirmed idle.
      const correction = Math.floor(IDLE_THRESHOLD / 1000);
      setStats(prev => ({ 
        ...prev, 
        isIdle: true,
        activeTime: Math.max(0, prev.activeTime - correction),
        idleTime: prev.idleTime + correction
      }));
    }
    isIdleRef.current = true;
  }, [addLog]);

  const markActive = useCallback(() => {
    if (isIdleRef.current) {
      addLog('Activity resumed after idle', '#06b6d4');
    }
    isIdleRef.current = false;
    lastActivityRef.current = Date.now();
    setStats(prev => ({ ...prev, isIdle: false }));
    
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(markIdle, IDLE_THRESHOLD);
    resetIdleWarningTimer();
  }, [addLog, markIdle, resetIdleWarningTimer]);

  // ===================== ELECTRON INTEGRATION =====================
  useEffect(() => {
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onSystemIdle((_event, idleSeconds) => {
        // Desktop app logic: Use system idle time as the truth
        // Note: idleSeconds is in SECONDS (from electron powerMonitor API)
        const isSystemIdle = idleSeconds >= (IDLE_THRESHOLD / 1000); // 5s

        if (isSystemIdle) {
          if (!isIdleRef.current) {
            markIdle();
          }
        } else {
          // System says active (user moved mouse/typed outside apps)
          if (isIdleRef.current) {
            markActive();
          }
          // Reset internal timers since system activity happened
          lastActivityRef.current = Date.now(); 
        }
      });
      return cleanup;
    }
  }, [markIdle, markActive]);

  // ===================== EVENT LISTENERS =====================
  useEffect(() => {
    const handleKeyDown = () => {
      setStats(prev => {
        const hist = [...prev.activityHistory];
        hist[59] = Math.min(5, (hist[59] || 0) + 1);
        return { ...prev, keys: prev.keys + 1, activityHistory: hist };
      });
      markActive();
    };

    const handleMouseMove = () => {
      if (mouseThrottleRef.current) return;
      mouseThrottleRef.current = true;
      setTimeout(() => { mouseThrottleRef.current = false; }, 100);
      setStats(prev => ({ ...prev, mouseMoves: prev.mouseMoves + 1 }));
      markActive();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setStats(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
        addLog('Tab switch detected', '#eab308');
      } else {
        markActive();
        addLog('Tab focus returned', '#06b6d4');
      }
    };

    const handleClick = () => markActive();
    const handleScroll = () => markActive();

    let removeElectronListeners = () => {};

    if (window.electronAPI) {
      // Use global hooks if available (Electron app)
      const unsubKey = window.electronAPI.onGlobalKeystroke(handleKeyDown);
      const unsubMouse = window.electronAPI.onGlobalMouseMove(handleMouseMove);
      const unsubClick = window.electronAPI.onGlobalClick(handleClick);
      removeElectronListeners = () => {
        unsubKey();
        unsubMouse();
        unsubClick();
      };
    } else {
      // Fallback to local window events (Browser dev)
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('click', handleClick);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('scroll', handleScroll);

    // Initial trigger
    markActive();

    return () => {
      removeElectronListeners();
      if (!window.electronAPI) {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('click', handleClick);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(idleTimerRef.current);
      clearTimeout(warningTimerRef.current);
    };
  }, [markActive, addLog]);

  // ===================== TICK LOOP =====================
  useEffect(() => {
    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      
      const secondsToAdd = Math.round(delta / 1000);
      if (secondsToAdd < 1) return;

      const timeSinceLast = now - lastActivityRef.current;
      const currentlyIdle = timeSinceLast >= IDLE_THRESHOLD;

      // Check if we just woke up from a long sleep/throttle
      // If delta is large (> 2s) and timeSinceLast is small (< delta), 
      // it means we just reset lastActivityRef via an event, but the loop just caught up.
      // This happens when returning to tab after long idle.
      // In this case, we should credit the bulk of delta to IDLE time.
      const justWokeUp = delta > 2000 && timeSinceLast < delta;
      
      if (currentlyIdle && !isIdleRef.current) {
        markIdle();
      }

      setStats(prev => {
        let newIdleTime = prev.idleTime;
        let newActiveTime = prev.activeTime;

        if (justWokeUp) {
          // Attribute the entire lost period to idle time
          newIdleTime += secondsToAdd;
        } else {
          if (currentlyIdle) newIdleTime += secondsToAdd;
          else newActiveTime += secondsToAdd;
        }

        const nextReq = {
          ...prev,
          sessionTime: prev.sessionTime + secondsToAdd,
          idleTime: newIdleTime,
          activeTime: newActiveTime,
          currentIdleStreak: currentlyIdle ? prev.currentIdleStreak + secondsToAdd : 0,
          // Shift history
          activityHistory: [...prev.activityHistory.slice(1), currentlyIdle ? 0 : 1] 
        };
        return nextReq;
      });

    }, 1000);

    return () => clearInterval(interval);
  }, [markIdle]);

  // ===================== DANGER STATE =====================
  useEffect(() => {
    if (stats.warningCount >= MAX_WARNINGS) {
      document.body.classList.add('danger-state');
    } else {
      document.body.classList.remove('danger-state');
    }
  }, [stats.warningCount]);

  // ===================== ACTIONS =====================
  const resetWarnings = () => {
    setStats(prev => ({ ...prev, warningCount: 0 }));
    warningCountRef.current = 0;
    addLog('Warnings reset by user', '#7c3aed');
    // Save state handled by effect or next interval
  };

  const dismissPopup = () => {
    setPopup({ show: false, critical: false });
    lastActivityRef.current = Date.now();
    resetIdleWarningTimer();
    addLog('Popup dismissed — activity resumed', '#22c55e');
  };

  // ===================== HELPER =====================
  const fmt = (s) => {
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + 'm ' + sec + 's';
  };

  // ===================== SCORE CALC =====================
  const calcScore = () => {
    const total = stats.activeTime + stats.idleTime;
    if (total === 0) return 100;
    
    // Logic: Start at 100 (active ratio). 
    // If distracted (idle), ratio drops -> score reduces.
    // If active (working more), ratio increases -> score increases.
    const activeRatio = stats.activeTime / total;
    const baseScore = activeRatio * 100;

    // Penalties for specific non-time distractions
    const warningPenalty = stats.warningCount * 10;
    const tabPenalty = stats.tabSwitches * 2;

    // Calculate final
    let computed = baseScore - warningPenalty - tabPenalty;
    
    return Math.max(0, Math.min(100, Math.round(computed)));
  };

  const score = calcScore();
  
  const getScoreInfo = (s) => {
    if (s >= 70) return { label: 'HIGHLY PRODUCTIVE', color: '#22c55e' };
    if (s >= 40) return { label: 'MODERATE EFFORT', color: '#eab308' };
    return { label: 'DISTRACTED', color: '#ef4444' };
  };

  const scoreInfo = getScoreInfo(score);

  // Chart Config
  const chartData = {
    labels: Array.from({length: 60}, (_, i) => i === 0 ? '60s ago' : i === 59 ? 'now' : ''),
    datasets: [{
      data: stats.activityHistory,
      borderColor: score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444',
      backgroundColor: (score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444').replace('#', 'rgba(').replace(')', ',0.08)').replace('rgba(', 'rgba').match(/rgba\((\d+),(\d+),(\d+)/) 
        ? `rgba(${parseInt(scoreInfo.color.slice(1,3),16)}, ${parseInt(scoreInfo.color.slice(3,5),16)}, ${parseInt(scoreInfo.color.slice(5,7),16)}, 0.08)` 
        : 'rgba(124,58,237,0.08)', // Fallback if simple replace fails, using explicit hex parse below better
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.4,
      fill: true,
    }]
  };
  
  // Fix background color properly
  const hex = scoreInfo.color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  chartData.datasets[0].backgroundColor = `rgba(${r}, ${g}, ${b}, 0.08)`;
  chartData.datasets[0].borderColor = scoreInfo.color;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: {
        grid: { color: 'rgba(30,30,46,0.8)', borderColor: 'transparent' },
        ticks: { color: '#6b6b80', font: { family: 'Space Mono', size: 9 }, maxRotation: 0 }
      },
      y: {
        min: 0, max: 5,
        grid: { color: 'rgba(30,30,46,0.8)' },
        ticks: { color: '#6b6b80', font: { family: 'Space Mono', size: 9 }, stepSize: 1 }
      }
    }
  };

  return (
    <>
      <div className="scanline"></div>

      <div className="app">
        {/* HEADER */}
        <div className="header">
          <div className="logo">
            <div className="logo-icon">🔍</div>
            <div>
              <div className="logo-text">FAKE EFFORT DETECTOR</div>
              <div className="logo-sub">REAL-TIME ACTIVITY MONITOR v1.0</div>
            </div>
          </div>
          <div className={`status-pill ${stats.warningCount >= MAX_WARNINGS ? 'danger' : ''}`}>
            <div className="dot"></div>
            <span>{stats.warningCount >= MAX_WARNINGS ? 'DANGER' : 'MONITORING'}</span>
          </div>
        </div>

        {/* LIVE TICKER */}
        <div className="ticker">
          <div className="ticker-item"><span className="ticker-key">SESSION</span><span>{fmt(stats.sessionTime)}</span></div>
          <div className="ticker-item"><span className="ticker-key">KEYS</span><span>{stats.keys}</span></div>
          <div className="ticker-item"><span className="ticker-key">MOUSE EVENTS</span><span>{stats.mouseMoves}</span></div>
          <div className="ticker-item"><span className="ticker-key">TAB SWITCHES</span><span>{stats.tabSwitches}</span></div>
          <div className="ticker-item">
            <span className="ticker-key">STATE</span>
            <span className={`mode-badge ${stats.isIdle ? 'yellow' : 'green'}`}>
              {stats.isIdle ? 'IDLE' : 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* SCORE + STATS */}
        <div className="score-section">
          <div className="score-card">
            <div className="score-ring">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle className="track" cx="70" cy="70" r="56" />
                <circle 
                  className="fill" 
                  cx="70" cy="70" r="56"
                  stroke={scoreInfo.color}
                  strokeDasharray="351.86"
                  strokeDashoffset={351.86 - (score / 100) * 351.86}
                />
              </svg>
              <div className="score-center">
                <div className="score-number" style={{ color: scoreInfo.color }}>{score}</div>
                <div className="score-pct">/ 100</div>
              </div>
            </div>
            <div className="score-label" style={{ color: scoreInfo.color }}>{scoreInfo.label}</div>
            <div className="progress-bar-track" style={{ width: 160 }}>
              <div 
                className="progress-bar-fill" 
                style={{ width: `${score}%`, background: scoreInfo.color }}
              ></div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label"><span className="stat-icon">⌨️</span> Keystrokes</div>
              <div className="stat-value">{stats.keys}</div>
              <div className="stat-sub">
                {stats.sessionTime > 0 ? Math.round(stats.keys / (stats.sessionTime / 60)) : 0} keys/min
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><span className="stat-icon">⏱️</span> Active Time</div>
              <div className="stat-value">{fmt(stats.activeTime)}</div>
              <div className="stat-sub">
                {(stats.activeTime + stats.idleTime) > 0 
                  ? Math.round((stats.activeTime / (stats.activeTime + stats.idleTime)) * 100) 
                  : 0}% of session
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><span className="stat-icon">💤</span> Idle Time</div>
              <div className="stat-value">{fmt(stats.idleTime)}</div>
              <div className="stat-sub">Current streak: {fmt(stats.currentIdleStreak)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label"><span className="stat-icon">🖱️</span> Mouse Moves</div>
              <div className="stat-value">{stats.mouseMoves}</div>
              <div className="stat-sub">Tab switches: {stats.tabSwitches}</div>
            </div>
          </div>
        </div>

        {/* CHART */}
        <div className="chart-section">
          <div className="section-title">Activity Timeline (last 60s)</div>
          <div style={{ width: '100%', height: '120px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="bottom-row">
          <div className={`warning-card ${stats.warningCount >= MAX_WARNINGS ? 'danger' : ''}`}>
            <div className="section-title">Warning System</div>
            <div className="warning-count-display">
              <div className={`warning-big ${stats.warningCount >= MAX_WARNINGS ? 'danger' : ''}`}>
                {stats.warningCount}
              </div>
              <div className="warning-of">/ 3 warnings</div>
            </div>
            <div className="warning-bar">
              {[1, 2, 3].map(i => (
                <div 
                  key={i} 
                  className={`warning-pip ${i <= stats.warningCount ? (stats.warningCount >= MAX_WARNINGS ? 'danger' : 'active') : ''}`}
                ></div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, fontFamily: "'Space Mono', monospace" }}>
              {stats.warningCount >= MAX_WARNINGS 
                ? '🚨 Maximum warnings reached!' 
                : `Warning ${stats.warningCount}/3 — idle 30s triggers next`}
            </div>
            <button className="reset-btn" onClick={resetWarnings}>[ RESET WARNINGS ]</button>
          </div>

          <div className="activity-card">
            <div className="section-title">Activity Log</div>
            <div className="activity-feed">
              {logs.map(log => (
                <div key={log.id} className="activity-item">
                  <div className="activity-dot" style={{ background: log.color }}></div>
                  <span style={{ color: log.color }}>{log.msg}</span>
                  <span className="activity-time">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* WARNING POPUP */}
      <div className={`popup-overlay ${popup.show ? 'show' : ''}`}>
        <div className="popup-box">
          <span className="popup-icon" style={{ animation: popup.show ? 'shake 0.5s ease 0.3s' : 'none' }}>
            {popup.critical ? '🚨' : '⚠️'}
          </span>
          <div className="popup-title" style={{ color: '#ef4444' }}>
            {popup.critical ? 'CRITICAL INACTIVITY' : 'INACTIVITY DETECTED'}
          </div>
          <div className="popup-msg">
            {popup.critical 
              ? '⚠️ You are consistently inactive. Your productivity is very low! This has been noted.' 
              : 'You have been inactive. Please focus on your work!'}
          </div>
          <button className="popup-btn" onClick={dismissPopup}>I'M BACK — DISMISS</button>
        </div>
      </div>
    </>
  );
}

export default App;