import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const DATA_BASE_URL = "https://nrpelberg.github.io/cortina_medals_count/data";

const LINE_COLORS = ["#60c8ff", "#f0c040", "#c084fc", "#f97316", "#34d399", "#f43f5e", "#a3e635", "#38bdf8", "#fb923c", "#e879f9"];

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const normalized = text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const [headerLine, ...lines] = normalized.split("\n");
  const headers = headerLine.split(",").map(h => h.trim());
  return lines
    .filter(l => l.trim())
    .map(line => {
      const values = line.split(",").map(v => v.trim());
      return Object.fromEntries(
        headers.map((h, i) => {
          const val = values[i] ?? "";
          const num = Number(val);
          return [h, isNaN(num) || val === "" ? val : num];
        })
      );
    });
}

// ─── Transform history CSV rows into recharts-friendly shape ──────────────────
function buildHistoryChartData(rows) {
  const byDate = {};
  for (const row of rows) {
    const d = new Date(row.Scrape_Date);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    if (!byDate[label]) byDate[label] = { date: label };
    byDate[label][row.Country] = row.Gold;
  }
  return Object.values(byDate);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const MedalIcon = ({ type, size = 20 }) => {
  const colors = { gold: "#f0c040", silver: "#b0bec5", bronze: "#cd7f32" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle at 35% 35%, ${colors[type]}dd, ${colors[type]}88)`,
      boxShadow: `0 2px 6px ${colors[type]}66`,
      fontSize: size * 0.5, fontWeight: 900, color: "#1a1a2e", flexShrink: 0,
    }}>
      {type === "gold" ? "G" : type === "silver" ? "S" : "B"}
    </span>
  );
};

const CountryFlag = ({ country }) => {
  const flags = {
    "Norway": "🇳🇴", "United States": "🇺🇸", "Germany": "🇩🇪", "Austria": "🇦🇹",
    "Switzerland": "🇨🇭", "Canada": "🇨🇦", "Sweden": "🇸🇪", "France": "🇫🇷",
    "Netherlands": "🇳🇱", "South Korea": "🇰🇷", "Italy": "🇮🇹", "Japan": "🇯🇵",
    "China": "🇨🇳", "Australia": "🇦🇺", "Great Britain": "🇬🇧", "Finland": "🇫🇮",
    "Czech Republic": "🇨🇿", "Slovenia": "🇸🇮", "Poland": "🇵🇱", "Spain": "🇪🇸",
  };
  return <span style={{ fontSize: 20, marginRight: 8 }}>{flags[country] || "🏳️"}</span>;
};

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10,15,40,0.95)", border: "1px solid rgba(96,200,255,0.3)",
      borderRadius: 10, padding: "10px 16px", backdropFilter: "blur(12px)",
    }}>
      <div style={{ color: "#60c8ff", fontFamily: "'Space Mono', monospace", fontSize: 12, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 20 }}>
          <span>{p.name}</span><strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── SNOWFLAKE BACKGROUND ─────────────────────────────────────────────────────
const Snowflakes = () => {
  const flakes = Array.from({ length: 18 }, (_, i) => ({
    id: i, x: Math.random() * 100, size: Math.random() * 6 + 4,
    delay: Math.random() * 8, dur: Math.random() * 6 + 8, opacity: Math.random() * 0.15 + 0.05,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      <style>{`
        @keyframes snowfall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; } 90% { opacity: 0.5; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
      {flakes.map(f => (
        <div key={f.id} style={{
          position: "absolute", left: `${f.x}%`, top: "-20px",
          fontSize: f.size, opacity: f.opacity, color: "#a8d8f0",
          animation: `snowfall ${f.dur}s ${f.delay}s infinite linear`,
        }}>❄</div>
      ))}
    </div>
  );
};

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function OlympicsDashboard() {
  const [view, setView] = useState("table");
  const [medalType, setMedalType] = useState("Gold");
  const [hoveredRow, setHoveredRow] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // ── Data state ──
  const [latestData, setLatestData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Fetch CSVs on mount ──
  useEffect(() => {
    async function loadData() {
      try {
        console.log("Fetching from:", DATA_BASE_URL);

        const [latestRes, historyRes] = await Promise.all([
          fetch(`${DATA_BASE_URL}/medal_table_latest.csv`),
          fetch(`${DATA_BASE_URL}/medal_table_history.csv`),
        ]);

        console.log("latest status:", latestRes.status);
        console.log("history status:", historyRes.status);

        if (!latestRes.ok) throw new Error(`latest CSV: ${latestRes.status}`);
        if (!historyRes.ok) throw new Error(`history CSV: ${historyRes.status}`);

        const [latestText, historyText] = await Promise.all([
          latestRes.text(),
          historyRes.text(),
        ]);

        console.log("latestText preview:", latestText.slice(0, 200));

        const latest = parseCSV(latestText);
        const history = parseCSV(historyText);
        const chartHistory = buildHistoryChartData(history);

        console.log("parsed latest rows:", latest.length, latest[0]);
        console.log("parsed history rows:", history.length);

        const top5 = [...latest]
          .sort((a, b) => b.Gold - a.Gold)
          .slice(0, 5)
          .map(r => r.Country);

        console.log("top5 countries:", top5);

        setLatestData(latest);
        setHistoryData(chartHistory);
        setCountries(top5);
        setSelectedCountries(top5.slice(0, 3));
        setLastUpdated(latest[0]?.Scrape_Date ?? null);
      } catch (err) {
        console.error("Failed to load medal data:", err);
        setFetchError(err.message);
      } finally {
        setLoaded(true); // ← removed setTimeout, set immediately
      }
    }
    loadData();
  }, []);

  const toggleCountry = (c) => {
    setSelectedCountries(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : prev.length < 5 ? [...prev, c] : prev
    );
  };

  const totalGold   = latestData.reduce((s, r) => s + r.Gold, 0);
  const totalSilver = latestData.reduce((s, r) => s + r.Silver, 0);
  const totalBronze = latestData.reduce((s, r) => s + r.Bronze, 0);

  // ── Loading state ──
  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #04091e 0%, #0a1535 40%, #081428 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Snowflakes />
      <div style={{ fontSize: 32, animation: "pulse 1.5s infinite" }}>❄️</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#60c8ff", letterSpacing: 3 }}>
        LOADING MEDAL DATA...
      </div>
    </div>
  );

  // ── Error state ──
  if (fetchError) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #04091e 0%, #0a1535 40%, #081428 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 40 }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#f97316", letterSpacing: 2 }}>FAILED TO LOAD DATA</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#7ab3d4", textAlign: "center", maxWidth: 420 }}>
        {fetchError}<br /><br />
        Check the browser console for more details.
      </div>
    </div>
  );

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    root: {
      minHeight: "100vh", background: "linear-gradient(160deg, #04091e 0%, #0a1535 40%, #081428 100%)",
      fontFamily: "'Barlow Condensed', sans-serif", color: "#e8f4ff", position: "relative",
      padding: "0 0 60px",
    },
    header: {
      padding: "40px 40px 0", display: "flex", alignItems: "flex-start",
      justifyContent: "space-between", flexWrap: "wrap", gap: 20,
      animation: "fadeIn 0.6s ease both",
    },
    titleBlock: { display: "flex", flexDirection: "column", gap: 4 },
    eyebrow: {
      fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 4,
      color: "#60c8ff", textTransform: "uppercase", opacity: 0.8,
    },
    title: {
      fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 800, lineHeight: 1,
      background: "linear-gradient(135deg, #ffffff 30%, #60c8ff 100%)",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      letterSpacing: -1,
    },
    subtitle: { fontSize: 16, color: "#7ab3d4", fontWeight: 300, marginTop: 4 },
    liveChip: {
      display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px",
      background: "rgba(96,200,255,0.08)", border: "1px solid rgba(96,200,255,0.25)",
      borderRadius: 999, fontSize: 12, fontFamily: "'Space Mono', monospace",
      color: "#60c8ff", letterSpacing: 1,
    },
    liveDot: {
      width: 7, height: 7, borderRadius: "50%", background: "#4ade80",
      animation: "pulse 1.5s infinite",
    },
    statsRow: {
      display: "flex", gap: 16, padding: "28px 40px 0", flexWrap: "wrap",
      animation: "fadeIn 0.7s 0.1s ease both",
    },
    statCard: (accent) => ({
      flex: "1 1 140px", background: "rgba(255,255,255,0.03)",
      border: `1px solid ${accent}33`, borderRadius: 14,
      padding: "18px 22px", display: "flex", flexDirection: "column", gap: 4,
      backdropFilter: "blur(8px)",
    }),
    statLabel: { fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: 0.5, fontFamily: "'Space Mono', monospace" },
    statValue: (accent) => ({ fontSize: 36, fontWeight: 800, color: accent, lineHeight: 1 }),
    tabs: {
      display: "flex", gap: 4, padding: "28px 40px 0",
      animation: "fadeIn 0.7s 0.2s ease both",
    },
    tab: (active) => ({
      padding: "9px 22px", borderRadius: 999, border: "1px solid rgba(96,200,255,0.2)",
      background: active ? "rgba(96,200,255,0.15)" : "transparent",
      color: active ? "#60c8ff" : "#7ab3d4", cursor: "pointer",
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 600,
      letterSpacing: 1, transition: "all 0.2s", outline: "none",
    }),
    panel: {
      margin: "24px 40px 0",
      animation: "fadeIn 0.5s 0.3s ease both",
    },
    card: {
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(96,200,255,0.1)",
      borderRadius: 18, backdropFilter: "blur(8px)", overflow: "hidden",
    },
    tableHead: {
      display: "grid", gridTemplateColumns: "48px 1fr 80px 80px 80px 80px",
      padding: "14px 20px", borderBottom: "1px solid rgba(96,200,255,0.1)",
      fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 2,
      color: "#60c8ff", textTransform: "uppercase",
    },
    tableRow: (hovered, rank) => ({
      display: "grid", gridTemplateColumns: "48px 1fr 80px 80px 80px 80px",
      padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)",
      alignItems: "center", cursor: "pointer",
      background: hovered ? "rgba(96,200,255,0.06)" : rank <= 3 ? "rgba(96,200,255,0.02)" : "transparent",
      transition: "background 0.15s",
      animation: `slideIn 0.4s ${0.05 * rank}s ease both`,
    }),
    rankBadge: (rank) => ({
      width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 13, fontWeight: 700,
      fontFamily: "'Space Mono', monospace",
      background: rank === 1 ? "rgba(240,192,64,0.2)" : rank === 2 ? "rgba(176,190,197,0.2)" : rank === 3 ? "rgba(205,127,50,0.2)" : "rgba(255,255,255,0.06)",
      color: rank === 1 ? "#f0c040" : rank === 2 ? "#b0bec5" : rank === 3 ? "#cd7f32" : "#7ab3d4",
      border: `1px solid ${rank === 1 ? "#f0c04044" : rank === 2 ? "#b0bec544" : rank === 3 ? "#cd7f3244" : "transparent"}`,
    }),
    countryCell: { display: "flex", alignItems: "center", gap: 4, fontSize: 17, fontWeight: 600 },
    medalCount: (type) => {
      const c = { Gold: "#f0c040", Silver: "#b0bec5", Bronze: "#cd7f32" };
      return { fontSize: 17, fontWeight: 700, color: c[type], textAlign: "center" };
    },
    totalCount: { fontSize: 17, fontWeight: 700, color: "#e8f4ff", textAlign: "center" },
  };

  return (
    <div style={S.root}>
      <Snowflakes />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div style={S.titleBlock}>
            <span style={S.eyebrow}>Milano Cortina 2026</span>
            <h1 style={S.title}>Winter Olympics<br />Medal Tracker</h1>
            <p style={S.subtitle}>Live standings · Updated daily</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, paddingTop: 8 }}>
            <div style={S.liveChip}><span style={S.liveDot} /> LIVE DATA</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#7ab3d4", textAlign: "right" }}>
              Last updated<br />{lastUpdated
                ? new Date(lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—"}
            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div style={S.statsRow}>
          {[
            { label: "Gold Medals Awarded",   value: totalGold,         accent: "#f0c040" },
            { label: "Silver Medals Awarded",  value: totalSilver,       accent: "#b0bec5" },
            { label: "Bronze Medals Awarded",  value: totalBronze,       accent: "#cd7f32" },
            { label: "Nations on Board",       value: latestData.length, accent: "#60c8ff" },
          ].map(({ label, value, accent }) => (
            <div key={label} style={S.statCard(accent)}>
              <span style={S.statLabel}>{label}</span>
              <span style={S.statValue(accent)}>{value}</span>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={S.tabs}>
          {["table", "bar", "timeseries"].map(v => (
            <button key={v} style={S.tab(view === v)} onClick={() => setView(v)}>
              {{ table: "🏅 Medal Table", bar: "📊 Bar Chart", timeseries: "📈 Time Series" }[v]}
            </button>
          ))}
        </div>

        {/* ── Panel ── */}
        <div style={S.panel}>

          {/* TABLE VIEW */}
          {view === "table" && (
            <div style={S.card}>
              <div style={S.tableHead}>
                <span>#</span><span>Country</span>
                <span style={{ textAlign: "center" }}>Gold</span>
                <span style={{ textAlign: "center" }}>Silver</span>
                <span style={{ textAlign: "center" }}>Bronze</span>
                <span style={{ textAlign: "center" }}>Total</span>
              </div>
              {latestData.map((row) => (
                <div key={row.Country}
                  style={S.tableRow(hoveredRow === row.Country, row.Rank)}
                  onMouseEnter={() => setHoveredRow(row.Country)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={S.rankBadge(row.Rank)}>{row.Rank}</div>
                  </div>
                  <div style={S.countryCell}>
                    <CountryFlag country={row.Country} />
                    {row.Country}
                  </div>
                  <div style={S.medalCount("Gold")}>{row.Gold}</div>
                  <div style={S.medalCount("Silver")}>{row.Silver}</div>
                  <div style={S.medalCount("Bronze")}>{row.Bronze}</div>
                  <div style={S.totalCount}>{row.Total}</div>
                </div>
              ))}
            </div>
          )}

          {/* BAR CHART VIEW */}
          {view === "bar" && (
            <div style={S.card}>
              <div style={{ padding: "20px 24px 8px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#60c8ff", letterSpacing: 2, textTransform: "uppercase" }}>Medal Type:</span>
                {["Gold", "Silver", "Bronze", "Total"].map(t => (
                  <button key={t} onClick={() => setMedalType(t)} style={{
                    padding: "5px 14px", borderRadius: 999, border: "1px solid rgba(96,200,255,0.2)",
                    background: medalType === t ? "rgba(96,200,255,0.15)" : "transparent",
                    color: medalType === t ? "#60c8ff" : "#7ab3d4", cursor: "pointer",
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600,
                  }}>{t}</button>
                ))}
              </div>
              <div style={{ padding: "10px 10px 24px" }}>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={latestData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <XAxis dataKey="Country" tick={{ fill: "#7ab3d4", fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#7ab3d4", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(96,200,255,0.05)" }} />
                    <Bar dataKey={medalType} radius={[6, 6, 0, 0]}>
                      {latestData.map((_, i) => (
                        <Cell key={i} fill={
                          medalType === "Gold" ? "#f0c040" :
                          medalType === "Silver" ? "#b0bec5" :
                          medalType === "Bronze" ? "#cd7f32" :
                          `hsl(${200 + i * 12}, 70%, 60%)`
                        } fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TIME SERIES VIEW */}
          {view === "timeseries" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#60c8ff", letterSpacing: 2, textTransform: "uppercase" }}>Countries:</span>
                {countries.map((c, i) => (
                  <button key={c} onClick={() => toggleCountry(c)} style={{
                    padding: "5px 14px", borderRadius: 999,
                    border: `1px solid ${selectedCountries.includes(c) ? LINE_COLORS[i] + "88" : "rgba(96,200,255,0.15)"}`,
                    background: selectedCountries.includes(c) ? `${LINE_COLORS[i]}18` : "transparent",
                    color: selectedCountries.includes(c) ? LINE_COLORS[i] : "#7ab3d4",
                    cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14, fontWeight: 600, transition: "all 0.2s",
                  }}>{c}</button>
                ))}
              </div>

              <div style={S.card}>
                <div style={{ padding: "20px 24px 8px" }}>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#60c8ff", letterSpacing: 3, textTransform: "uppercase" }}>
                    Gold Medal Progression · {historyData[0]?.date ?? ""} – {historyData[historyData.length - 1]?.date ?? ""}
                  </div>
                </div>
                <div style={{ padding: "0 10px 24px" }}>
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fill: "#7ab3d4", fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#7ab3d4", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      {countries.map((c, i) =>
                        selectedCountries.includes(c) && (
                          <Line key={c} type="monotone" dataKey={c} stroke={LINE_COLORS[i]}
                            strokeWidth={2.5} dot={{ fill: LINE_COLORS[i], r: 4, strokeWidth: 0 }}
                            activeDot={{ r: 6, strokeWidth: 0 }} />
                        )
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Mini country cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                {countries.filter(c => selectedCountries.includes(c)).map((c) => {
                  const ci = countries.indexOf(c);
                  const row = latestData.find(r => r.Country === c);
                  const latest = historyData[historyData.length - 1]?.[c] ?? 0;
                  const prev   = historyData[historyData.length - 2]?.[c] ?? 0;
                  const delta  = latest - prev;
                  return (
                    <div key={c} style={{
                      background: `${LINE_COLORS[ci]}08`, border: `1px solid ${LINE_COLORS[ci]}30`,
                      borderRadius: 14, padding: "16px 20px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <CountryFlag country={c} />
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{c}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        {["Gold", "Silver", "Bronze"].map(t => (
                          <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <MedalIcon type={t.toLowerCase()} size={18} />
                            <span style={{ fontSize: 18, fontWeight: 800, color: LINE_COLORS[ci] }}>{row?.[t] ?? 0}</span>
                          </div>
                        ))}
                      </div>
                      {delta > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#4ade80", fontFamily: "'Space Mono', monospace" }}>
                          +{delta} gold today
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          margin: "40px 40px 0", paddingTop: 20, borderTop: "1px solid rgba(96,200,255,0.1)",
          fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#7ab3d4",
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
        }}>
          <span>Data scraped from Wikipedia · 2026 Winter Olympics</span>
          <span>Powered by GitHub Actions · Updates daily at 8am UTC</span>
        </div>

      </div>
    </div>
  );
}
