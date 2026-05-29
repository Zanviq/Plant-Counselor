"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAdminUsers, sendNotification, getNotificationHistory, type AdminUser } from "@/lib/api/admin";
import { useAuthStore } from "@/lib/store/authStore";

type NotifKind = "admin_message" | "announcement" | "warning";

const KIND_LABELS: Record<NotifKind, { label: string; color: string }> = {
  admin_message: { label: "일반 메시지", color: "#60a5fa" },
  announcement: { label: "공지사항", color: "#34d399" },
  warning: { label: "경고", color: "#f59e0b" },
};

export default function AdminNotificationsPage() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();

  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<NotifKind>("admin_message");
  const [targetMode, setTargetMode] = useState<"all" | "select">("all");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");

  const { data: usersRes } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: listAdminUsers,
    enabled: !!accessToken,
  });

  const { data: histRes, isLoading: histLoading } = useQuery({
    queryKey: ["admin", "notif-history"],
    queryFn: getNotificationHistory,
    enabled: !!accessToken,
  });

  const sendMut = useMutation({
    mutationFn: () => {
      const userIds = targetMode === "all" ? [] : selectedUsers;
      return sendNotification(userIds, message, kind);
    },
    onSuccess: (data) => {
      if (data.ok) {
        setFeedback(`✓ ${data.data.sent_to}명에게 발송 완료`);
        setMessage("");
        setSelectedUsers([]);
        qc.invalidateQueries({ queryKey: ["admin", "notif-history"] });
        setTimeout(() => setFeedback(""), 3000);
      }
    },
  });

  const users: AdminUser[] = usersRes?.ok ? usersRes.data.items : [];
  const history: { id: string; user_id: string; kind: string; payload: { message?: string; from_admin?: boolean }; created_at: string }[] =
    histRes?.ok ? (histRes.data.items as typeof history) : [];

  function toggleUser(uid: string) {
    setSelectedUsers((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  }

  return (
    <div style={{ padding: "32px 36px", color: "#fff", maxWidth: 900, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>알림 발송</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
          개별 또는 전체 사용자에게 알림을 보냅니다.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Compose */}
        <div style={{ background: "#1a1f2e", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: "22px 24px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 18 }}>알림 작성</div>

          {/* Kind selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>유형</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(Object.entries(KIND_LABELS) as [NotifKind, typeof KIND_LABELS[NotifKind]][]).map(([k, { label, color }]) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  style={{
                    padding: "6px 12px", borderRadius: 6,
                    background: kind === k ? `${color}20` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${kind === k ? color : "rgba(255,255,255,0.08)"}`,
                    color: kind === k ? color : "rgba(255,255,255,0.5)",
                    fontSize: 12, cursor: "pointer", fontWeight: kind === k ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>수신 대상</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {(["all", "select"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTargetMode(m)}
                  style={{
                    padding: "6px 12px", borderRadius: 6,
                    background: targetMode === m ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${targetMode === m ? "#60a5fa" : "rgba(255,255,255,0.08)"}`,
                    color: targetMode === m ? "#60a5fa" : "rgba(255,255,255,0.5)",
                    fontSize: 12, cursor: "pointer", fontWeight: targetMode === m ? 600 : 400,
                  }}
                >
                  {m === "all" ? "전체 사용자" : "사용자 선택"}
                </button>
              ))}
            </div>

            {targetMode === "select" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflow: "auto", padding: "2px 0" }}>
                {users.map((u) => (
                  <label
                    key={u.id}
                    style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      style={{ accentColor: "#60a5fa" }}
                    />
                    <span style={{ fontSize: 13, color: "#fff" }}>{u.nickname ?? u.email}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: "auto" }}>{u.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>메시지</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="발송할 메시지 내용..."
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 7,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 13, resize: "vertical", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Submit */}
          {feedback && (
            <div style={{ marginBottom: 12, fontSize: 13, color: "#34d399" }}>{feedback}</div>
          )}
          <button
            onClick={() => sendMut.mutate()}
            disabled={sendMut.isPending || !message.trim() || (targetMode === "select" && selectedUsers.length === 0)}
            style={{
              width: "100%", padding: "10px 16px", borderRadius: 8,
              background: "#3b82f6", border: "none",
              color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
              opacity: sendMut.isPending || !message.trim() || (targetMode === "select" && selectedUsers.length === 0) ? 0.5 : 1,
            }}
          >
            {sendMut.isPending ? "발송 중..." : targetMode === "all" ? "전체 발송" : `${selectedUsers.length}명에게 발송`}
          </button>
        </div>

        {/* History */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 14 }}>발송 내역</div>
          {histLoading ? (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>로딩 중...</p>
          ) : history.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>발송 내역 없음</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.slice(0, 20).map((n) => {
                const kindInfo = KIND_LABELS[n.kind as NotifKind] ?? { label: n.kind, color: "#fff" };
                return (
                  <div key={n.id} style={{ background: "#1a1f2e", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: kindInfo.color }}>
                        {kindInfo.label}
                      </span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>
                        {n.created_at?.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                      {n.payload?.message ?? "(메시지 없음)"}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                      → {n.user_id?.slice(0, 8)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600,
  color: "rgba(255,255,255,0.4)", marginBottom: 6,
  letterSpacing: "0.05em", textTransform: "uppercase",
};
