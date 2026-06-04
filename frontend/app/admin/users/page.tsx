"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { listAdminUsers, updateUserRole, sendNotification, type AdminUser } from "@/lib/api/admin";
import { useAuthStore } from "@/lib/store/authStore";

export default function AdminUsersPage() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const router = useRouter();

  const [notifTarget, setNotifTarget] = useState<string | null>(null); // null = broadcast
  const [notifMsg, setNotifMsg] = useState("");
  const [notifSent, setNotifSent] = useState("");

  const { data: res, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: listAdminUsers,
    enabled: !!accessToken,
  });

  const roleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "user" | "admin" }) =>
      updateUserRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const notifMut = useMutation({
    mutationFn: ({ userIds, message }: { userIds: string[]; message: string }) =>
      sendNotification(userIds, message),
    onSuccess: (data) => {
      if (data.ok) {
        setNotifSent(`✓ ${data.data.sent_to}명에게 발송 완료`);
        setNotifMsg("");
        setTimeout(() => setNotifSent(""), 3000);
      }
    },
  });

  const users: AdminUser[] = res?.ok ? res.data.items : [];

  return (
    <div className="admin-page">
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>사용자 관리</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          {users.length}명 · 역할 변경, 상세 조회, 알림 발송
        </p>
      </header>

      {/* Broadcast notification */}
      <div style={{
        background: "#1a1f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
        padding: "16px 20px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>
          전체 브로드캐스트 알림
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={notifMsg}
            onChange={(e) => setNotifMsg(e.target.value)}
            placeholder="모든 사용자에게 보낼 메시지..."
            style={{
              flex: "1 1 240px", padding: "8px 12px", borderRadius: 7,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", fontSize: 13, outline: "none",
            }}
          />
          <button
            onClick={() => notifMsg.trim() && notifMut.mutate({ userIds: [], message: notifMsg })}
            disabled={notifMut.isPending || !notifMsg.trim()}
            style={{
              padding: "8px 18px", borderRadius: 7,
              background: "#3b82f6", border: "none",
              color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600,
              opacity: notifMut.isPending || !notifMsg.trim() ? 0.5 : 1,
            }}
          >
            전체 발송
          </button>
        </div>
        {notifSent && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#34d399" }}>{notifSent}</div>
        )}
      </div>

      {/* User Table */}
      {isLoading ? (
        <p style={{ color: "rgba(255,255,255,0.4)" }}>로딩 중...</p>
      ) : (
        <div className="admin-table-card" style={{ background: "#1a1f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                {["이메일", "닉네임", "역할", "식물", "봉우리", "AI 세션", "가입일", "액션"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)",
                    letterSpacing: "0.05em", textTransform: "uppercase",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: i < users.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                >
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "#fff" }}>{u.email ?? "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{u.nickname ?? "—"}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 999,
                      fontSize: 11, fontWeight: 600,
                      background: u.role === "admin" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
                      color: u.role === "admin" ? "#f87171" : "rgba(255,255,255,0.5)",
                    }}>
                      {u.role === "admin" ? "관리자" : "일반"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{u.plant_count}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{u.bud_count}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{u.ai_session_count}</td>
                  <td style={{ padding: "11px 14px", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    {u.created_at?.slice(0, 10)}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => router.push(`/admin/users/${u.id}`)}
                        style={{
                          padding: "4px 10px", borderRadius: 5,
                          background: "rgba(255,255,255,0.08)", border: "none",
                          color: "rgba(255,255,255,0.7)", fontSize: 11, cursor: "pointer",
                        }}
                      >
                        상세
                      </button>
                      <button
                        onClick={() => roleMut.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })}
                        style={{
                          padding: "4px 10px", borderRadius: 5,
                          background: u.role === "admin" ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)",
                          border: "none",
                          color: u.role === "admin" ? "#f87171" : "#60a5fa",
                          fontSize: 11, cursor: "pointer",
                        }}
                      >
                        {u.role === "admin" ? "권한 해제" : "관리자 권한"}
                      </button>
                      <button
                        onClick={() => {
                          setNotifTarget(u.id);
                          setNotifMsg(`${u.nickname ?? u.email}님께 보내는 메시지`);
                        }}
                        style={{
                          padding: "4px 10px", borderRadius: 5,
                          background: "rgba(52,211,153,0.1)", border: "none",
                          color: "#34d399", fontSize: 11, cursor: "pointer",
                        }}
                      >
                        알림
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Individual notification modal */}
      {notifTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div style={{
            background: "#1a1f2e", borderRadius: 12, padding: "24px 28px",
            width: 400, maxWidth: "calc(100vw - 32px)", border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
              개별 알림 발송
            </h3>
            <textarea
              value={notifMsg}
              onChange={(e) => setNotifMsg(e.target.value)}
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 7,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 13, resize: "none", outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => { setNotifTarget(null); setNotifMsg(""); }}
                style={{ padding: "8px 16px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13 }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (notifMsg.trim() && notifTarget) {
                    notifMut.mutate({ userIds: [notifTarget], message: notifMsg });
                    setNotifTarget(null);
                    setNotifMsg("");
                  }
                }}
                style={{ padding: "8px 16px", borderRadius: 7, background: "#3b82f6", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                발송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
