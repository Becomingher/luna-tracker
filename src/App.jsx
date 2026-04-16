import { useState, useEffect } from "react";

const STORAGE_KEY = "cycle-tracker-data";

const CYCLE_COLORS = {
  period: "#E8526A",
  fertile: "#7EC8A4",
  ovulation: "#F4A261",
  luteal: "#A78BCA",
  follicular: "#64B5D9",
};

function getDaysBetween(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function predictCycles(periods, cycleLength = 28) {
  if (periods.length === 0) return null;
  const sorted = [...periods].sort((a, b) => new Date(a.start) - new Date(b.start));
  
  // Calculate average cycle from history
  if (sorted.length >= 2) {
    let totalDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalDays += getDaysBetween(sorted[i - 1].start, sorted[i].start);
    }
    cycleLength = Math.round(totalDays / (sorted.length - 1));
  }

  const lastPeriod = sorted[sorted.length - 1];
  const nextPeriodStart = addDays(lastPeriod.start, cycleLength);
  const ovulationDay = addDays(nextPeriodStart, -14);
  const fertileStart = addDays(ovulationDay, -5);
  const fertileEnd = addDays(ovulationDay, 1);

  return {
    cycleLength,
    nextPeriodStart,
    ovulationDay,
    fertileStart,
    fertileEnd,
    lastPeriodStart: lastPeriod.start,
  };
}

function getPhaseForDate(date, prediction, periods) {
  if (!prediction) return null;
  const d = date;
  
  // Check if it's a logged period
  for (const p of periods) {
    const end = p.end || addDays(p.start, (p.duration || 5) - 1);
    if (d >= p.start && d <= end) return "period";
  }
  
  if (d === prediction.ovulationDay) return "ovulation";
  if (d >= prediction.fertileStart && d <= prediction.fertileEnd) return "fertile";
  if (d >= prediction.nextPeriodStart && d <= addDays(prediction.nextPeriodStart, 4)) return "period";
  if (d > prediction.ovulationDay && d < prediction.nextPeriodStart) return "luteal";
  if (d > addDays(prediction.lastPeriodStart, 4) && d < prediction.fertileStart) return "follicular";
  return null;
}

function MonthCalendar({ year, month, periods, prediction, onDayClick, selectedRange }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, date: dateStr });
  }

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  return (
    <div style={{ fontFamily: "'Playfair Display', serif" }}>
      <div style={{ textAlign: "center", marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#2D1B2E", letterSpacing: "0.05em" }}>
        {monthNames[month]} {year}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
        {dayNames.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#9B7FA6", padding: "4px 0", fontFamily: "'DM Sans', sans-serif" }}>{d}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const phase = getPhaseForDate(cell.date, prediction, periods);
          const isToday = cell.date === today;
          const isSelected = selectedRange && cell.date >= selectedRange[0] && (selectedRange[1] ? cell.date <= selectedRange[1] : cell.date === selectedRange[0]);
          const isPast = cell.date < today;
          
          let bg = "transparent";
          let textColor = isPast ? "#6B4F6F" : "#3D2040";
          let border = "none";
          
          if (phase === "period") bg = CYCLE_COLORS.period;
          else if (phase === "ovulation") bg = CYCLE_COLORS.ovulation;
          else if (phase === "fertile") bg = CYCLE_COLORS.fertile;
          else if (phase === "luteal") bg = CYCLE_COLORS.luteal + "55";
          else if (phase === "follicular") bg = CYCLE_COLORS.follicular + "44";

          if (isToday) border = "2px solid #2D1B2E";
          if (isSelected) { bg = "#E8526A"; textColor = "#fff"; }
          if (phase === "period" || phase === "ovulation") textColor = "#fff";

          return (
            <div
              key={cell.date}
              onClick={() => onDayClick(cell.date)}
              style={{
                textAlign: "center",
                padding: "6px 2px",
                borderRadius: 8,
                background: bg,
                color: textColor,
                fontSize: 13,
                fontWeight: isToday ? 800 : 500,
                cursor: "pointer",
                border,
                transition: "transform 0.1s",
                position: "relative",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CycleTracker() {
  const [periods, setPeriods] = useState([]);
  const [view, setView] = useState("calendar"); // calendar | log | insights
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectStart, setSelectStart] = useState(null);
  const [selectEnd, setSelectEnd] = useState(null);
  const [logStep, setLogStep] = useState(0); // 0=idle 1=picking start 2=picking end
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setPeriods(JSON.parse(saved)); } catch {}
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (periods.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(periods));
  }, [periods, loaded]);

  const prediction = predictCycles(periods);

  const handleDayClick = (date) => {
    if (logStep === 1) {
      setSelectStart(date);
      setSelectEnd(null);
      setLogStep(2);
    } else if (logStep === 2) {
      if (date < selectStart) {
        setSelectEnd(selectStart);
        setSelectStart(date);
      } else {
        setSelectEnd(date);
      }
      setLogStep(3);
    }
  };

  const confirmLog = () => {
    if (!selectStart) return;
    const end = selectEnd || selectStart;
    const duration = getDaysBetween(selectStart, end) + 1;
    const newPeriod = { start: selectStart, end, duration, note, id: Date.now() };
    setPeriods(prev => [...prev, newPeriod].sort((a, b) => new Date(a.start) - new Date(b.start)));
    setSelectStart(null);
    setSelectEnd(null);
    setLogStep(0);
    setNote("");
    setView("calendar");
  };

  const deletePeriod = (id) => {
    setPeriods(prev => prev.filter(p => p.id !== id));
  };

  const sortedPeriods = [...periods].sort((a, b) => new Date(b.start) - new Date(a.start));

  const avgCycle = prediction?.cycleLength || 28;
  const daysUntilNext = prediction ? getDaysBetween(new Date().toISOString().split("T")[0], prediction.nextPeriodStart) : null;
  const today = new Date().toISOString().split("T")[0];
  const todayPhase = prediction ? getPhaseForDate(today, prediction, periods) : null;

  const phaseLabels = {
    period: "Menstruation",
    fertile: "Fertile Window",
    ovulation: "Ovulation Day",
    luteal: "Luteal Phase",
    follicular: "Follicular Phase",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #FDF6FD 0%, #F5ECF8 50%, #FDF0F4 100%)",
      fontFamily: "'DM Sans', sans-serif",
      padding: "0 0 40px 0",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #2D1B2E 0%, #4A2050 100%)",
        padding: "28px 24px 20px",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(232,82,106,0.2)" }} />
        <div style={{ position: "absolute", bottom: -20, left: 60, width: 80, height: 80, borderRadius: "50%", background: "rgba(167,139,202,0.2)" }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, letterSpacing: "0.02em", position: "relative" }}>
          🌸 Luna
        </div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2, position: "relative" }}>Cycle & Ovulation Tracker</div>

        {todayPhase && (
          <div style={{
            marginTop: 16,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: "10px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            position: "relative",
          }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: CYCLE_COLORS[todayPhase] }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Today: {phaseLabels[todayPhase]}</span>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {prediction && (
        <div style={{ display: "flex", gap: 10, padding: "16px 16px 0", overflowX: "auto" }}>
          {[
            { label: "Avg Cycle", value: `${avgCycle}d`, color: "#A78BCA" },
            { label: "Next Period", value: daysUntilNext !== null ? (daysUntilNext === 0 ? "Today" : daysUntilNext < 0 ? "Overdue" : `${daysUntilNext}d`) : "—", color: "#E8526A" },
            { label: "Ovulation", value: prediction.ovulationDay.slice(5).replace("-", "/"), color: "#F4A261" },
            { label: "Fertile", value: `${prediction.fertileStart.slice(5).replace("-","/")}–${prediction.fertileEnd.slice(5).replace("-","/")}`, color: "#7EC8A4" },
          ].map(s => (
            <div key={s.label} style={{
              flex: "0 0 auto",
              background: "#fff",
              borderRadius: 14,
              padding: "10px 16px",
              boxShadow: "0 2px 10px rgba(45,27,46,0.08)",
              minWidth: 90,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "'Playfair Display', serif" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#9B7FA6", marginTop: 2, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Nav */}
      <div style={{ display: "flex", margin: "16px 16px 0", background: "#fff", borderRadius: 14, padding: 4, boxShadow: "0 2px 8px rgba(45,27,46,0.07)" }}>
        {[["calendar","📅 Calendar"],["log","📋 History"],["insights","✨ Insights"]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1,
            padding: "8px 4px",
            borderRadius: 10,
            border: "none",
            background: view === v ? "linear-gradient(135deg, #2D1B2E, #4A2050)" : "transparent",
            color: view === v ? "#fff" : "#9B7FA6",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.2s",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* CALENDAR VIEW */}
        {view === "calendar" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px rgba(45,27,46,0.07)" }}>
              {/* Month nav */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <button onClick={() => {
                  if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
                  else setCurrentMonth(m => m - 1);
                }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#4A2050" }}>‹</button>
                <button onClick={() => {
                  if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
                  else setCurrentMonth(m => m + 1);
                }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#4A2050" }}>›</button>
              </div>
              <MonthCalendar
                year={currentYear}
                month={currentMonth}
                periods={periods}
                prediction={prediction}
                onDayClick={handleDayClick}
                selectedRange={selectStart ? [selectStart, selectEnd] : null}
              />
            </div>

            {/* Legend */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "12px 16px", marginTop: 12, boxShadow: "0 2px 8px rgba(45,27,46,0.06)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(phaseLabels).map(([k, label]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: CYCLE_COLORS[k] }} />
                    <span style={{ fontSize: 11, color: "#6B4F6F", fontWeight: 600 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Log Button */}
            {logStep === 0 && (
              <button onClick={() => setLogStep(1)} style={{
                width: "100%",
                marginTop: 14,
                padding: "14px",
                borderRadius: 16,
                border: "none",
                background: "linear-gradient(135deg, #E8526A, #C94470)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.03em",
                boxShadow: "0 4px 16px rgba(232,82,106,0.35)",
                fontFamily: "'DM Sans', sans-serif",
              }}>+ Log Period</button>
            )}

            {logStep === 1 && (
              <div style={{ background: "#FFF0F3", borderRadius: 14, padding: 16, marginTop: 12, border: "2px dashed #E8526A", textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "#C94470", fontWeight: 700 }}>Tap the start day of your period</div>
                <button onClick={() => { setLogStep(0); setSelectStart(null); setSelectEnd(null); }} style={{ marginTop: 8, background: "none", border: "none", color: "#9B7FA6", cursor: "pointer", fontSize: 12 }}>Cancel</button>
              </div>
            )}

            {logStep === 2 && (
              <div style={{ background: "#FFF0F3", borderRadius: 14, padding: 16, marginTop: 12, border: "2px dashed #E8526A", textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "#C94470", fontWeight: 700 }}>Now tap the last day (or same day for 1-day)</div>
                <div style={{ fontSize: 12, color: "#9B7FA6", marginTop: 4 }}>Start: {selectStart}</div>
                <button onClick={() => { setLogStep(0); setSelectStart(null); setSelectEnd(null); }} style={{ marginTop: 8, background: "none", border: "none", color: "#9B7FA6", cursor: "pointer", fontSize: 12 }}>Cancel</button>
              </div>
            )}

            {logStep === 3 && (
              <div style={{ background: "#FFF0F3", borderRadius: 16, padding: 16, marginTop: 12, border: "2px solid #E8526A" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#2D1B2E", marginBottom: 10 }}>
                  📍 {selectStart} → {selectEnd || selectStart} ({getDaysBetween(selectStart, selectEnd || selectStart) + 1} days)
                </div>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note (optional)..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #EDCDD4", fontSize: 13, background: "#fff", color: "#2D1B2E", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={confirmLog} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: "#E8526A", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Save</button>
                  <button onClick={() => { setLogStep(0); setSelectStart(null); setSelectEnd(null); setNote(""); }} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: "#F0E4F2", color: "#6B4F6F", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOG / HISTORY */}
        {view === "log" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2D1B2E", fontFamily: "'Playfair Display', serif", marginBottom: 12 }}>Period History</div>
            {sortedPeriods.length === 0 ? (
              <div style={{ textAlign: "center", color: "#C4A8C8", padding: 40, fontSize: 14 }}>No periods logged yet.<br />Go to Calendar to add one.</div>
            ) : sortedPeriods.map((p, i) => (
              <div key={p.id} style={{
                background: "#fff",
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 10,
                boxShadow: "0 2px 8px rgba(45,27,46,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2D1B2E" }}>
                    {p.start}{p.end && p.end !== p.start ? ` → ${p.end}` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#9B7FA6", marginTop: 2 }}>{p.duration} day{p.duration !== 1 ? "s" : ""}{p.note ? ` · ${p.note}` : ""}</div>
                  {i < sortedPeriods.length - 1 && (
                    <div style={{ fontSize: 11, color: "#C4A8C8", marginTop: 2 }}>
                      Cycle: {getDaysBetween(sortedPeriods[i + 1].start, p.start)}d from previous
                    </div>
                  )}
                </div>
                <button onClick={() => deletePeriod(p.id)} style={{ background: "none", border: "none", color: "#E8A0AB", cursor: "pointer", fontSize: 18 }}>🗑</button>
              </div>
            ))}
          </div>
        )}

        {/* INSIGHTS */}
        {view === "insights" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2D1B2E", fontFamily: "'Playfair Display', serif", marginBottom: 12 }}>Cycle Insights</div>
            {!prediction || periods.length === 0 ? (
              <div style={{ textAlign: "center", color: "#C4A8C8", padding: 40, fontSize: 14 }}>Log at least one period to see insights.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Average Cycle Length", value: `${avgCycle} days`, icon: "🔄", color: "#A78BCA", desc: avgCycle < 21 ? "Shorter than average" : avgCycle > 35 ? "Longer than average" : "Within normal range (21–35 days)" },
                  { label: "Next Period Expected", value: prediction.nextPeriodStart, icon: "📅", color: "#E8526A", desc: daysUntilNext !== null ? (daysUntilNext > 0 ? `In ${daysUntilNext} days` : daysUntilNext === 0 ? "Expected today" : `${Math.abs(daysUntilNext)} days late`) : "" },
                  { label: "Ovulation Day", value: prediction.ovulationDay, icon: "🥚", color: "#F4A261", desc: "Based on 14 days before next period" },
                  { label: "Fertile Window", value: `${prediction.fertileStart} to ${prediction.fertileEnd}`, icon: "🌿", color: "#7EC8A4", desc: "Highest chance of conception" },
                  { label: "Periods Logged", value: `${periods.length}`, icon: "📊", color: "#64B5D9", desc: periods.length >= 3 ? "Good sample for predictions" : "Log 3+ periods for better accuracy" },
                ].map(item => (
                  <div key={item.label} style={{ background: "#fff", borderRadius: 16, padding: "16px 18px", boxShadow: "0 2px 10px rgba(45,27,46,0.08)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 24, lineHeight: 1 }}>{item.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: item.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#2D1B2E", fontFamily: "'Playfair Display', serif", margin: "2px 0" }}>{item.value}</div>
                      <div style={{ fontSize: 12, color: "#9B7FA6" }}>{item.desc}</div>
                    </div>
                  </div>
                ))}

                {periods.length >= 2 && (() => {
                  const sorted = [...periods].sort((a, b) => new Date(a.start) - new Date(b.start));
                  const cycleLengths = [];
                  for (let i = 1; i < sorted.length; i++) {
                    cycleLengths.push(getDaysBetween(sorted[i-1].start, sorted[i].start));
                  }
                  const min = Math.min(...cycleLengths);
                  const max = Math.max(...cycleLengths);
                  return (
                    <div style={{ background: "#fff", borderRadius: 16, padding: "16px 18px", boxShadow: "0 2px 10px rgba(45,27,46,0.08)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#A78BCA", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Cycle Length History</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 60 }}>
                        {cycleLengths.map((cl, i) => (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <div style={{ fontSize: 9, color: "#9B7FA6", fontWeight: 600 }}>{cl}d</div>
                            <div style={{ width: "100%", background: `hsl(${280 - (cl - 20) * 3}, 50%, 65%)`, borderRadius: 4, height: `${Math.max(8, (cl / max) * 44)}px` }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "#9B7FA6", marginTop: 8 }}>Range: {min}–{max} days</div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
    </div>
  );
}
