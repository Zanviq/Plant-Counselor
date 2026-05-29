"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminStats, listLogs } from "@/lib/api/admin";
import { useAuthStore } from "@/lib/store/authStore";

function StatCard({ label, value, sub, color }: {
  label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: "#1a1f2e", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "20px 24px",
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: color ?? "#fff", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const { accessToken } = useAuthStore();

  const { data: statsRes, isLoading: loadingStats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: getAdminStats,
    enabled: !!accessToken,
    refetchInterval: 30_000,
  });

  const { data: logsRes, isLoading: loadingLogs } = useQuery({
    queryKey: ["admin", "logs", "recent"],
    queryFn: () => listLogs({ limit: 8 }),
    enabled: !!accessToken,
    refetchInterval: 30_000,
  });

  const stats = statsRes?.ok ? statsRes.data : null;
  const recentLogs = logsRes?.ok ? logsRes.data.items : [];

  return (
    <div style={{ padding: "32px 36px", color: "#fff", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#fff" }}>관리자 대시보드</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          Plant Counselor 서비스 현황
        </p>
      </header>

      {/* Stat Cards */}
      {loadingStats ? (
        <p style={{ color: "rgba(255,255,255,0.4)" }}>로딩 중...</p>
      ) : stats ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 32 }}>
          <StatCard label="총 사용자" value={stats.total_users} sub={`관리자 ${stats.admin_count}명`} color="#60a5fa" />
          <StatCard label="총 식물" value={stats.total_plants} />
          <StatCard label="총 봉우리" value={stats.total_buds} />
          <StatCard label="AI 세션" value={stats.total_ai_sessions} sub={`최근 7일 ${stats.recent_ai_sessions_7d}건`} color="#34d399" />
          <StatCard label="예상 토큰" value={stats.total_token_estimate.toLocaleString()} color="#f59e0b" />
        </div>
      ) : (
        <p style={{ color: "rgba(255,255,255,0.4)" }}>통계를 불러올 수 없습니다.</p>
      )}

      {/* Recent AI Logs */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>최근 AI 채팅 세션</h2>
          <a href="/admin/logs" style={{ fontSize: 12, color: "#60a5fa", textDecoration: "none" }}>
            전체 보기 →
          </a>
        </div>
        {loadingLogs ? (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>로딩 중...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentLogs.length === 0 && (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>로그 없음</p>
            )}
            {recentLogs.map((log) => (
              <a
                key={log.filename}
                href={`/admin/logs?file=${encodeURIComponent(log.filename)}`}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 16px", borderRadius: 8,
                  background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.06)",
                  textDecoration: "none", color: "inherit",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#fff", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {log.user_input || "(입력 없음)"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                    {log.timestamp?.slice(0, 19).replace("T", " ")} · 사용자 {log.user_id?.slice(0, 8)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexShrink: 0, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  <span>LLM {log.llm_call_count}회</span>
                  <span>스킬 {log.skill_call_count}회</span>
                  <span>~{log.token_estimate}tok</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
