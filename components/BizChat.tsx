"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, X, Loader2, ArrowDown, Paperclip } from "lucide-react";

interface ChatMessage {
  id: number;
  message_id: number | null;
  direction: "inbound" | "outbound";
  sender_name: string | null;
  text: string | null;
  reply_to_message_id: number | null;
  reply_to_text: string | null;
  timestamp: string;
  image_url: string | null;
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

const TABS = [
  { id: "Douglas", label: "Douglas", telegramId: 8684069023 },
  { id: "Morris", label: "Morris", telegramId: null },
] as const;

type TabId = "Douglas" | "Morris";

export function BizChat() {
  const [activeTab, setActiveTab] = useState<TabId>("Douglas");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ msg: ChatMessage; x: number; y: number } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastIdRef = useRef<number>(0);
  const userScrolledUpRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[] };
      const incoming = data.messages ?? [];

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = incoming.filter((m) => !existingIds.has(m.id));
        if (newOnes.length === 0 && !initial) return prev;

        const merged = [...prev, ...newOnes].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const newestId = merged[merged.length - 1]?.id ?? 0;
        const hadNew = newestId !== lastIdRef.current;
        lastIdRef.current = newestId;

        if (hadNew && !userScrolledUpRef.current) {
          setTimeout(() => scrollToBottom(), 50);
        } else if (hadNew && userScrolledUpRef.current) {
          setShowScrollButton(true);
        }

        return merged;
      });

      if (initial) {
        setLoading(false);
        setTimeout(() => scrollToBottom(false), 80);
      }
    } catch (e) {
      console.error("BizChat fetch error:", e);
      if (initial) setLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    fetchMessages(true);
  }, [fetchMessages]);

  useEffect(() => {
    pollIntervalRef.current = setInterval(() => fetchMessages(false), 5000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchMessages]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const near = isNearBottom();
      userScrolledUpRef.current = !near;
      if (near) setShowScrollButton(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isNearBottom]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  // Reset scroll position when switching tabs
  useEffect(() => {
    userScrolledUpRef.current = false;
    setShowScrollButton(false);
    setTimeout(() => scrollToBottom(false), 50);
  }, [activeTab, scrollToBottom]);

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleImageFile(file);
          return;
        }
      }
    }
  }, [handleImageFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const hasImage = Array.from(e.dataTransfer.types).includes("Files");
    if (hasImage) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleImageFile(files[0]);
    }
  }, [handleImageFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = "";
  }, [handleImageFile]);

  const sendMessage = async () => {
    if (activeTab === "Morris") return; // Morris tab is read-only placeholder
    const text = inputText.trim();
    if (!text && !imagePreview || sending) return;

    setSending(true);
    setInputText("");
    const replyToMessageId = replyTarget?.message_id ?? null;
    setReplyTarget(null);
    const currentImagePreview = imagePreview;
    setImagePreview(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text || undefined,
          replyToMessageId: replyToMessageId ?? undefined,
          imageUrl: currentImagePreview ?? undefined,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { message: ChatMessage };
        const newMsg = data.message;
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        lastIdRef.current = newMsg.id;
        setTimeout(() => scrollToBottom(), 50);
      }
    } catch (e) {
      console.error("send error:", e);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleMessageClick = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX;
    const y = e.clientY;
    setContextMenu({ msg, x, y });
  };

  const canSend = !sending && !!(inputText.trim() || imagePreview) && activeTab !== "Morris";

  // Filter messages for the active tab
  // For Douglas: show messages where sender_name = "Douglas" or direction = "outbound" (agent replies)
  // For Morris: show messages where sender_name = "Morris" or direction = "outbound" (agent replies to Morris)
  // We show ALL outbound (agent) messages in BOTH tabs — each tab shows the user's inbound + all agent outbound
  // Actually: filter inbound by tab user name, always show outbound (agent) messages in both
  const filteredMessages = messages.filter((msg) => {
    if (msg.direction === "outbound") {
      // Agent message — only show in the relevant tab based on surrounding context
      // Simpler: show all agent messages in Douglas tab, none in Morris (placeholder anyway)
      return activeTab === "Douglas";
    }
    // Inbound — filter by sender name matching active tab
    if (activeTab === "Douglas") {
      return msg.sender_name === "Douglas" || (!msg.sender_name && msg.direction === "inbound");
    }
    if (activeTab === "Morris") {
      return msg.sender_name === "Morris";
    }
    return false;
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        borderTop: "1px solid var(--border-subtle)",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Drag overlay */}
      {isDragOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            background: "rgba(59,130,246,0.15)",
            border: "2px dashed #3b82f6",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "#3b82f6", fontSize: "13px", fontWeight: 600 }}>
            Drop image here
          </span>
        </div>
      )}

      {/* Header with tab switcher */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          background: "var(--bg-secondary)",
        }}
      >
        {/* Tab switcher — TOP */}
        <div
          style={{
            display: "flex",
            gap: "0",
            padding: "10px 10px 0",
          }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  fontSize: "12px",
                  fontWeight: active ? 600 : 500,
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: active ? "#3b82f6" : "var(--bg-elevated)",
                  color: active ? "#fff" : "var(--text-secondary)",
                  transition: "all 0.15s",
                  margin: "0 2px",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Paul title row — below tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "6px 14px 8px",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
            💬 Paul
          </span>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#22c55e",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          minHeight: 0,
          position: "relative",
        }}
      >
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "16px", color: "var(--text-tertiary)" }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {/* Morris placeholder */}
        {!loading && activeTab === "Morris" && filteredMessages.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: "8px",
              padding: "20px",
              color: "var(--text-tertiary)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "24px" }}>🔌</span>
            <span style={{ fontSize: "12px" }}>Morris hasn&apos;t connected yet</span>
            <span style={{ fontSize: "11px", opacity: 0.7 }}>When Morris messages Paul on Telegram, his conversation will appear here.</span>
          </div>
        )}

        {!loading && activeTab === "Douglas" && filteredMessages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "11px", padding: "12px" }}>
            No messages yet 👋
          </div>
        )}

        {filteredMessages.map((msg) => {
          const isFromUser = msg.sender_name === "Douglas" || msg.sender_name === "Morris";
          const outbound = isFromUser; // user = right/blue, agent = left/dark
          return (
            <div
              key={msg.id}
              onClick={(e) => handleMessageClick(e, msg)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: outbound ? "flex-end" : "flex-start",
                cursor: "pointer",
              }}
            >
              {/* Bubble */}
              <div
                style={{
                  maxWidth: "88%",
                  borderRadius: outbound ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                  background: outbound ? "#3b82f6" : "var(--bg-elevated)",
                  color: outbound ? "#fff" : "var(--text-primary)",
                  padding: msg.image_url ? "4px" : "6px 10px",
                  wordBreak: "break-word",
                  fontSize: "12px",
                  lineHeight: "1.4",
                  overflow: "hidden",
                }}
              >
                {/* Reply preview */}
                {msg.reply_to_text && (
                  <div
                    style={{
                      borderLeft: outbound ? "2px solid rgba(255,255,255,0.5)" : "2px solid #3b82f6",
                      paddingLeft: "6px",
                      marginBottom: "4px",
                      marginTop: msg.image_url ? "2px" : undefined,
                      marginLeft: msg.image_url ? "6px" : undefined,
                      marginRight: msg.image_url ? "6px" : undefined,
                      fontSize: "10px",
                      color: outbound ? "rgba(255,255,255,0.7)" : "var(--text-tertiary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {msg.reply_to_text}
                  </div>
                )}

                {/* Image */}
                {msg.image_url && (
                  <img
                    src={msg.image_url}
                    alt="Attached image"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxSrc(msg.image_url);
                    }}
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      width: "100%",
                      borderRadius: "8px",
                      cursor: "pointer",
                      objectFit: "contain",
                    }}
                  />
                )}

                {/* Text */}
                {msg.text && (
                  <div style={{ padding: msg.image_url ? "4px 6px 2px" : undefined }}>
                    {msg.text}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  marginTop: "1px",
                  paddingLeft: outbound ? 0 : "2px",
                  paddingRight: outbound ? "2px" : 0,
                }}
              >
                {formatTime(msg.timestamp)}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* New message scroll button */}
      {showScrollButton && (
        <div style={{ display: "flex", justifyContent: "center", padding: "4px" }}>
          <button
            onClick={() => {
              userScrolledUpRef.current = false;
              setShowScrollButton(false);
              scrollToBottom();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              borderRadius: "12px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <ArrowDown size={11} />
            New
          </button>
        </div>
      )}

      {/* Reply bar */}
      {replyTarget && activeTab !== "Morris" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 10px",
            background: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              borderLeft: "2px solid #3b82f6",
              paddingLeft: "6px",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: "10px", color: "#3b82f6", fontWeight: 600, marginBottom: "1px" }}>
              {replyTarget.sender_name ?? (replyTarget.direction === "outbound" ? "Paul" : activeTab)}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {replyTarget.text ?? ""}
            </div>
          </div>
          <button
            onClick={() => setReplyTarget(null)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "var(--bg-hover)",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* Image preview strip */}
      {imagePreview && activeTab !== "Morris" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 10px",
            background: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img
              src={imagePreview}
              alt="Preview"
              style={{
                width: "52px",
                height: "52px",
                objectFit: "cover",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle)",
              }}
            />
            <button
              onClick={() => setImagePreview(null)}
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: "#ef4444",
                border: "none",
                color: "#fff",
                fontSize: "9px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <X size={9} />
            </button>
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
            Image ready to send
          </span>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 10px",
          background: "var(--bg-secondary)",
          borderTop: (replyTarget || imagePreview) ? "none" : "1px solid var(--border-subtle)",
          flexShrink: 0,
          opacity: activeTab === "Morris" ? 0.4 : 1,
          pointerEvents: activeTab === "Morris" ? "none" : "auto",
        }}
      >
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || activeTab === "Morris"}
          title="Attach image"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: imagePreview ? "#3b82f620" : "var(--bg-elevated)",
            border: imagePreview ? "1px solid #3b82f6" : "1px solid var(--border-subtle)",
            color: imagePreview ? "#3b82f6" : "var(--text-tertiary)",
            cursor: sending ? "not-allowed" : "pointer",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          <Paperclip size={13} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={activeTab === "Morris" ? "Morris's conversation (read-only)" : (imagePreview ? "Add a caption…" : "Message…")}
          disabled={sending || activeTab === "Morris"}
          style={{
            flex: 1,
            background: "var(--bg-primary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "14px",
            padding: "6px 12px",
            color: "var(--text-primary)",
            fontSize: "12px",
            outline: "none",
            height: "32px",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!canSend}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: canSend ? "#3b82f6" : "var(--bg-elevated)",
            border: "none",
            color: canSend ? "#fff" : "var(--text-tertiary)",
            cursor: canSend ? "pointer" : "not-allowed",
            flexShrink: 0,
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {sending ? (
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Send size={13} />
          )}
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: Math.min(contextMenu.y, window.innerHeight - 80),
            left: Math.min(contextMenu.x, window.innerWidth - 120),
            zIndex: 9999,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            overflow: "hidden",
            minWidth: "110px",
          }}
        >
          <button
            onClick={() => {
              setReplyTarget(contextMenu.msg);
              setContextMenu(null);
              inputRef.current?.focus();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              color: "var(--text-primary)",
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ↩ Reply
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              zIndex: 10001,
            }}
          >
            <X size={18} />
          </button>
          <img
            src={lightboxSrc}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: "8px",
              cursor: "default",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
