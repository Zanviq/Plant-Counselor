"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { getAdminUserDetail, updateUserRole, sendNotification, overrideUserSettings } from "@/lib/api/admin";
import { useAuthStore } from "@/lib/store/authStore";

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();

  const [notifMsg, setNotifMsg] = useState("");
  const [feedback, setFeedback] = useState("");

  const { data: res, isLoading } = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => getAdminUserDetail(id),
    enabled: !!accessToken && !!id,
  });

  const roleMut = useMutation({
    mutationFn: (role: "user" | "admin") => updateUserRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user", id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setFeedback("역할이 변경됐습니다.");
      setTimeout(() => setFeedback(""), 2000);
    },
  });

  const notifMut = useMutation({
    mutationFn: (msg: string) => sendNotification([id], msg),
    onSuccess: () => {
      setFeedback("알림 발송 완료");
      setNotifMsg("");
      setTimeout(() => setFeedback(""), 2000);
    },
  });

  if (isLoading) return <div style={{ color: "rgba(255,255,255,0.4)", padding: 40 }}>로딩 중...</div>;
  if (!res?.ok) return <div style={{ color: "#f87171", padding: 40 }}>사용자를 찾을 수 없습니다.</div>;

  const { profile, plants, buds, conversation_count, ai_session_count, token_estimate } = res.data;

  return (
    <div style={{ padding: "32px 36px", color: "#fff", maxWidth: 900, margin: "0 auto" }}>
      <Link href="/admin/users" style={{ fontSize: 13, color: "#60a5fa", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
        ← 사용자 목록
      </Link>

      {feedback && (
        <div style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 7, padding: "8px 14px", marginBottom: 16, fontSize: 13, color: "#34d399" }}>
          {feedback}
        </div>
      )}

      {/* Profile card */}
      <div style={{ background: "#1a1f2e", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              {profile.nickname ?? "(닉네임 없음)"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{profile.email}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "역할", value: profile.role === "admin" ? "관리자" : "일반" },
                { label: "AI 모델", value: profile.ai_model },
                { label: "가입", value: profile.created_at?.slice(0, 10) },
              ].map(({ label, value }) => (
                <span key={label} style={{ fontSize: 12, background: "rgba(255,255,255,0.06)", padding: "2px 10px", borderRadius: 999, color: "rgba(255,255,255,0.6)" }}>
                  {label}: {value}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => roleMut.mutate(profile.role === "admin" ? "user" : "admin")}
              style={{
                padding: "7px 14px", borderRadius: 7,
                background: profile.role === "admin" ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)",
                border: "none",
                color: profile.role === "admin" ? "#f87171" : "#60a5fa",
                fontSize: 12, cursor: "pointer", fontWeight: 600,
              }}
            >
              {profile.role === "admin" ? "관리자 권한 해제" : "관리자 권한 부여"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "식물", value: (plants as unknown[]).length },
          { label: "봉우리", value: (buds as unknown[]).length },
          { label: "대화", value: conversation_count },
          { label: "AI 세션", value: ai_session_count },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "#1a1f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "14px 18px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Token estimate */}
      <div style={{ background: "#1a1f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "12px 18px", marginBottom: 20, fontSize: 13 }}>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>예상 토큰 사용량: </span>
        <span style={{ color: "#f59e0b", fontWeight: 600 }}>{token_estimate.toLocaleString()} tokens</span>
      </div>

      {/* Send notification */}
      <div style={{ background: "#1a1f2e", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>알림 발송</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={notifMsg}
            onChange={(e) => setNotifMsg(e.target.value)}
            placeholder="이 사용자에게 보낼 메시지..."
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 7,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", fontSize: 13, outline: "none",
            }}
          />
          <button
            onClick={() => notifMsg.trim() && notifMut.mutate(notifMsg)}
            style={{ padding: "8px 16px", borderRadius: 7, background: "#3b82f6", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
          >
            발송
          </button>
        </div>
      </div>

      {/* Plants list */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>식물 ({(plants as unknown[]).length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(plants as { id: string; name: string; status: string; created_at: string }[]).map((p) => (
            <div key={p.id} style={{ background: "#1a1f2e", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12, fontSize: 13 }}>
              <span style={{ color: "#fff", fontWeight: 500 }}>{p.name}</span>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>{p.status}</span>
              <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{p.created_at?.slice(0, 10)}</span>
            </div>
          ))}
          {(plants as unknown[]).length === 0 && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>식물 없음</p>}
        </div>
      </div>

      {/* View AI logs button */}
      <Link
        href={`/admin/logs?user_id=${id}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 18px", borderRadius: 8,
          background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)",
          color: "#60a5fa", fontSize: 13, textDecoration: "none", fontWeight: 500,
        }}
      >
        이 사용자의 AI 로그 보기 →
      </Link>
    </div>
  );
}
