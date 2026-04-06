"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Pencil, DollarSign, TrendingUp, Tag, Ticket, Search, Filter, ExternalLink, Eye, ChevronDown, MoreHorizontal, Bell, BellOff, Trash2, History } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlipStatus = "active" | "sold" | "at-risk" | "loss";

interface PlatformListing {
  platform: string;
  code: string;       // SH, VS, SG, TP
  price: number;
  status: "listed" | "pending" | "sold" | "delisted";
  listedAt?: string;
  delistedAt?: string;
  soldAt?: string;
}

interface Flip {
  id: string;
  eventName: string;
  eventDate: string;
  venue: string;
  section: string;
  row: string;
  quantity: number;
  buyPlatform: string;
  buyPrice: number;
  buyerFee: number;
  deliveryFee: number;
  buyAllIn: number;
  listPrice: number;
  sellerFee: number;
  status: FlipStatus;
  purchasedAt: string;
  soldAt: string | null;
  soldPrice: number | null;
  profit: number | null;
  roi: number | null;
  notes: string;
  listings?: PlatformListing[];
  competitor_floor?: number | null;
  competitor_listing_id?: string | null;
  competitor_checkout_url?: string | null;
  own_listing_id?: string | null;
  last_competitor_check?: string | null;
}

const PLATFORM_COLORS: Record<string, string> = {
  SH: "#26c97a",
  VS: "#4d7cfe",
  SG: "#f0b429",
  TP: "#a78bfa",
};

const BUY_PLATFORMS = ["StubHub", "Gametime", "TickPick", "SeatGeek", "Other"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const event = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function computeStatus(flip: Flip): FlipStatus {
  if (flip.soldAt && flip.soldAt !== "null") return flip.status; // already set by API
  const days = daysUntil(flip.eventDate);
  if (days < 7) return "at-risk";
  return "active";
}

function estimatedProfit(flip: Flip): number {
  const qty = flip.quantity;
  if (flip.soldPrice !== null && flip.profit !== null) return flip.profit;
  // buyAllIn is already the TOTAL cost for all tickets, not per-ticket
  return flip.listPrice * (1 - flip.sellerFee) * qty - flip.buyAllIn;
}

function estimatedROI(flip: Flip): number {
  // buyAllIn is already total cost
  const totalCost = flip.buyAllIn;
  if (totalCost === 0) return 0;
  return (estimatedProfit(flip) / totalCost) * 100;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FlipStatus }) {
  const cfg: Record<FlipStatus, { label: string; color: string; bg: string }> = {
    active: { label: "Active", color: "#4d7cfe", bg: "#4d7cfe18" },
    sold: { label: "Sold", color: "#26c97a", bg: "#26c97a18" },
    "at-risk": { label: "At Risk", color: "#f0b429", bg: "#f0b42918" },
    loss: { label: "Loss", color: "#f05b5b", bg: "#f05b5b18" },
  };
  const { label, color, bg } = cfg[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  );
}

// ─── Days Left Cell ───────────────────────────────────────────────────────────

function DaysLeft({ dateStr }: { dateStr: string }) {
  const days = daysUntil(dateStr);
  const color = days >= 30 ? "#26c97a" : days >= 7 ? "#f0b429" : "#f05b5b";
  if (days < 0) return <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Passed</span>;
  return (
    <span className="font-medium text-xs" style={{ color }}>
      {days}d
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-elevated)",
        flex: "1 1 120px",
        minWidth: 110,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} style={{ color: "var(--text-tertiary)" }} />
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: valueColor ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface FlipFormData {
  eventName: string;
  eventDate: string;
  venue: string;
  section: string;
  row: string;
  quantity: number;
  buyPlatform: string;
  buyPrice: number;
  buyerFee: number;
  deliveryFee: number;
  listPrice: number;
  notes: string;
}

const defaultForm: FlipFormData = {
  eventName: "",
  eventDate: "",
  venue: "",
  section: "",
  row: "",
  quantity: 1,
  buyPlatform: "StubHub",
  buyPrice: 0,
  buyerFee: 0.3,
  deliveryFee: 3.5,
  listPrice: 0,
  notes: "",
};

function FlipModal({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void;
  onSave: (data: FlipFormData) => void;
  initial?: Flip | null;
}) {
  const [form, setForm] = useState<FlipFormData>(
    initial
      ? {
          eventName: initial.eventName,
          eventDate: initial.eventDate,
          venue: initial.venue,
          section: initial.section,
          row: initial.row,
          quantity: initial.quantity,
          buyPlatform: initial.buyPlatform,
          buyPrice: initial.buyPrice,
          buyerFee: initial.buyerFee,
          deliveryFee: initial.deliveryFee,
          listPrice: initial.listPrice,
          notes: initial.notes,
        }
      : defaultForm
  );

  const set = (field: keyof FlipFormData, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const buyAllIn =
    form.buyPrice * (1 + form.buyerFee) + form.deliveryFee;

  const estProfit =
    form.listPrice * (1 - 0.15) * form.quantity - buyAllIn * form.quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.eventName.trim() || !form.eventDate) return;
    onSave(form);
    onClose();
  };

  const inputStyle = {
    background: "var(--bg-tertiary)",
    borderColor: "var(--border-default)",
    color: "var(--text-primary)",
    outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border p-6 overflow-y-auto"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border-default)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {initial ? "Edit Flip" : "Add Flip"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Event Name *
              </label>
              <input
                autoFocus
                required
                value={form.eventName}
                onChange={(e) => set("eventName", e.target.value)}
                placeholder="Taylor Swift · Eras Tour"
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Event Date *
              </label>
              <input
                required
                type="date"
                value={form.eventDate}
                onChange={(e) => set("eventDate", e.target.value)}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={{ ...inputStyle, colorScheme: "dark" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Venue
              </label>
              <input
                value={form.venue}
                onChange={(e) => set("venue", e.target.value)}
                placeholder="Madison Square Garden"
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Seats */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Section
              </label>
              <input
                value={form.section}
                onChange={(e) => set("section", e.target.value)}
                placeholder="107"
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Row
              </label>
              <input
                value={form.row}
                onChange={(e) => set("row", e.target.value)}
                placeholder="C"
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Qty
              </label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => set("quantity", parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Purchase details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Buy Platform
              </label>
              <select
                value={form.buyPlatform}
                onChange={(e) => set("buyPlatform", e.target.value)}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={{ ...inputStyle, colorScheme: "dark" }}
              >
                {BUY_PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Buy Price (per ticket)
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.buyPrice}
                onChange={(e) => set("buyPrice", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Buyer Fee (e.g. 0.30 = 30%)
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.buyerFee}
                onChange={(e) => set("buyerFee", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Delivery Fee
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.deliveryFee}
                onChange={(e) => set("deliveryFee", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          {/* List price */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              List Price (per ticket, what you plan to sell for)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.listPrice}
              onChange={(e) => set("listPrice", parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={inputStyle}
            />
          </div>

          {/* Live preview */}
          {form.buyPrice > 0 && (
            <div
              className="rounded-lg px-4 py-3 border text-sm"
              style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-subtle)" }}
            >
              <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                <span>All-in cost (per ticket)</span>
                <span style={{ color: "var(--text-primary)" }}>{fmt$(buyAllIn)}</span>
              </div>
              <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                <span>Total invested ({form.quantity}x)</span>
                <span style={{ color: "var(--text-primary)" }}>{fmt$(buyAllIn * form.quantity)}</span>
              </div>
              {form.listPrice > 0 && (
                <div className="flex justify-between text-xs font-medium mt-1 pt-1" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                  <span>Est. profit</span>
                  <span style={{ color: estProfit >= 0 ? "#26c97a" : "#f05b5b" }}>
                    {fmt$(estProfit)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Aisle seats, great view..."
              rows={2}
              className="w-full px-3 py-2 rounded-md border text-sm resize-none"
              style={inputStyle}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                background: "transparent",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium"
              style={{ background: "var(--accent-purple)", color: "white" }}
            >
              {initial ? "Save Changes" : "Add Flip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Mark Sold Modal ──────────────────────────────────────────────────────────

function MarkSoldModal({
  flip,
  onClose,
  onConfirm,
}: {
  flip: Flip;
  onClose: () => void;
  onConfirm: (soldPrice: number) => void;
}) {
  const [soldPrice, setSoldPrice] = useState<number>(flip.listPrice);

  const qty = flip.quantity;
  const revenue = soldPrice * (1 - flip.sellerFee) * qty;
  const cost = flip.buyAllIn * qty;
  const profit = revenue - cost;
  const roi = cost > 0 ? (profit / cost) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-6"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border-default)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Mark Sold
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }}>
            <X size={16} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{flip.eventName}</span>
          {" · "}Sec {flip.section} · Row {flip.row} · {qty}x
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Sold price (per ticket)
          </label>
          <input
            autoFocus
            type="number"
            min={0}
            step={0.01}
            value={soldPrice}
            onChange={(e) => setSoldPrice(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{
              background: "var(--bg-tertiary)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>

        {/* P&L preview */}
        <div
          className="rounded-lg px-4 py-3 mb-4 border text-xs space-y-1"
          style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-subtle)" }}
        >
          <div className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
            <span>Net revenue (after {(flip.sellerFee * 100).toFixed(0)}% fee)</span>
            <span style={{ color: "var(--text-primary)" }}>{fmt$(revenue)}</span>
          </div>
          <div className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
            <span>Total cost ({qty}x @ {fmt$(flip.buyAllIn)})</span>
            <span style={{ color: "var(--text-primary)" }}>{fmt$(cost)}</span>
          </div>
          <div
            className="flex justify-between font-semibold pt-1"
            style={{ borderTop: "1px solid var(--border-subtle)", color: profit >= 0 ? "#26c97a" : "#f05b5b" }}
          >
            <span>Profit</span>
            <span>{fmt$(profit)} ({roi.toFixed(1)}% ROI)</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              background: "transparent",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(soldPrice); onClose(); }}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium"
            style={{ background: "#26c97a", color: "#0f0f10" }}
          >
            Confirm Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Flip Card ─────────────────────────────────────────────────────────

function MobileFlipCard({
  flip,
  onEdit,
  onSell,
  onDelete,
}: {
  flip: Flip;
  onEdit: () => void;
  onSell: () => void;
  onDelete: () => void;
}) {
  const status = computeStatus(flip);
  const profit = estimatedProfit(flip);
  const roi = estimatedROI(flip);

  const statusCfg: Record<FlipStatus, { label: string; color: string; bg: string }> = {
    active: { label: "Active", color: "#4d7cfe", bg: "#4d7cfe18" },
    sold: { label: "Sold", color: "#26c97a", bg: "#26c97a18" },
    "at-risk": { label: "At Risk", color: "#f0b429", bg: "#f0b42918" },
    loss: { label: "Loss", color: "#f05b5b", bg: "#f05b5b18" },
  };
  const sc = statusCfg[status];
  const days = flip.soldAt ? null : daysUntil(flip.eventDate);
  const daysColor = days === null ? "#888" : days >= 30 ? "#26c97a" : days >= 7 ? "#f0b429" : "#f05b5b";

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 12,
      }}
    >
      {/* Top row: event name + status */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>
            {flip.eventName}
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
            {new Date(flip.eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {flip.venue ? ` · ${flip.venue}` : ""}
          </div>
        </div>
        <span style={{ color: sc.color, background: sc.bg, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
          {sc.label}
        </span>
      </div>

      {/* Grid of details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 12 }}>
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Section / Row</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, fontFamily: "monospace" }}>
            {[flip.section, flip.row].filter(Boolean).join(" · ") || "—"} × {flip.quantity}
          </div>
        </div>
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Bought</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            {flip.buyPlatform} · {fmt$(flip.buyAllIn)}
          </div>
        </div>
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Profit</div>
          <div style={{ color: profit >= 0 ? "#26c97a" : "#f05b5b", fontSize: 14, fontWeight: 700 }}>
            {fmt$(profit)}{flip.soldAt === null && <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 400 }}> est.</span>}
          </div>
        </div>
        <div>
          <div style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>ROI</div>
          <div style={{ color: roi >= 0 ? "#26c97a" : "#f05b5b", fontSize: 14, fontWeight: 700 }}>
            {roi.toFixed(1)}%
          </div>
        </div>
        {days !== null && (
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Days Left</div>
            <div style={{ color: daysColor, fontSize: 13, fontWeight: 600 }}>{days < 0 ? "Passed" : `${days}d`}</div>
          </div>
        )}
        {flip.listings && flip.listings.length > 0 && (
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Listed On</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {flip.listings.map((l, li) => {
                const col = PLATFORM_COLORS[l.code] || "#888";
                return <span key={li} style={{ color: col, fontSize: 11, fontWeight: 700, background: col + "18", padding: "2px 6px", borderRadius: 3 }}>{l.code} {fmt$(l.price)}</span>;
              })}
            </div>
          </div>
        )}
        {flip.competitor_floor != null && (
          <div>
            <div style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Competitor Floor</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              {(() => {
                const ourBuyer = (flip.listPrice || 0) * 1.10;
                const isCompetitive = ourBuyer <= Number(flip.competitor_floor);
                return (
                  <>
                    <span>{isCompetitive ? "✅" : "⚠️"}</span>
                    {flip.competitor_checkout_url ? (
                      <a href={flip.competitor_checkout_url} target="_blank" rel="noopener noreferrer" style={{ color: isCompetitive ? "#26c97a" : "#f0b429", fontWeight: 700, textDecoration: "none" }}>
                        {fmt$(Number(flip.competitor_floor))}
                      </a>
                    ) : (
                      <span style={{ color: isCompetitive ? "#26c97a" : "#f0b429", fontWeight: 700 }}>{fmt$(Number(flip.competitor_floor))}</span>
                    )}
                    <span style={{ color: "var(--text-muted)", fontSize: 10 }}>buyer-visible</span>
                  </>
                );
              })()}
            </div>
            {flip.last_competitor_check && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                Checked {timeAgo(flip.last_competitor_check)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
        <button onClick={onEdit} style={{ flex: 1, padding: "7px 0", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <Pencil size={13} /> Edit
        </button>
        {!flip.soldAt && (
          <button onClick={onSell} style={{ flex: 1, padding: "7px 0", background: "#26c97a18", border: "1px solid #26c97a40", borderRadius: 6, color: "#26c97a", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Mark Sold
          </button>
        )}
        <button onClick={onDelete} style={{ padding: "7px 12px", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "#f05b5b", fontSize: 13, cursor: "pointer" }}>
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Ticket Watch Types ───────────────────────────────────────────────────────

interface TicketWatch {
  id: number;
  event_name: string;
  venue: string | null;
  event_date: string | null;
  section_filter: string;
  quantity: number;
  max_price_per_ticket: number | null;
  alert_email: string | null;
  alert_telegram: boolean;
  status: string;
  notes: string | null;
  last_checked_at: string | null;
  last_cheapest_price: number | null;
  last_cheapest_platform: string | null;
  last_cheapest_url: string | null;
  event_url: string | null;
  price_history: Array<{ price: number; platform: string; checked_at: string }>;
  created_at: string;
  updated_at: string;
}

interface WatchFormData {
  event_name: string;
  venue: string;
  event_date: string;
  section_filter: string;
  quantity: number;
  max_price_per_ticket: string;
  alert_email: string;
  event_url: string;
  notes: string;
}

const defaultWatchForm: WatchFormData = {
  event_name: "",
  venue: "",
  event_date: "",
  section_filter: "Floor GA",
  quantity: 2,
  max_price_per_ticket: "",
  alert_email: "",
  event_url: "",
  notes: "",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function WatchModal({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void;
  onSave: (data: WatchFormData) => void;
  initial?: TicketWatch | null;
}) {
  const [form, setForm] = useState<WatchFormData>(
    initial
      ? {
          event_name: initial.event_name,
          venue: initial.venue ?? "",
          event_date: initial.event_date ?? "",
          section_filter: initial.section_filter,
          quantity: initial.quantity,
          max_price_per_ticket: initial.max_price_per_ticket != null ? String(initial.max_price_per_ticket) : "",
          alert_email: initial.alert_email ?? "",
          event_url: initial.event_url ?? "",
          notes: initial.notes ?? "",
        }
      : defaultWatchForm
  );

  const set = (field: keyof WatchFormData, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.event_name.trim()) return;
    onSave(form);
    onClose();
  };

  const inputStyle = {
    background: "var(--bg-tertiary)",
    borderColor: "var(--border-default)",
    color: "var(--text-primary)",
    outline: "none",
  };

  const maxBudgetTotal =
    form.max_price_per_ticket && form.quantity
      ? parseFloat(form.max_price_per_ticket) * form.quantity
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border p-6 overflow-y-auto"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border-default)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {initial ? "Edit Watch" : "Add Ticket Watch"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Event Name *
            </label>
            <input
              autoFocus
              required
              value={form.event_name}
              onChange={(e) => set("event_name", e.target.value)}
              placeholder="Bruce Springsteen & The E Street Band"
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Venue
              </label>
              <input
                value={form.venue}
                onChange={(e) => set("venue", e.target.value)}
                placeholder="Madison Square Garden"
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Event Date
              </label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => set("event_date", e.target.value)}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={{ ...inputStyle, colorScheme: "dark" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Section / Zone
              </label>
              <input
                value={form.section_filter}
                onChange={(e) => set("section_filter", e.target.value)}
                placeholder="Floor GA"
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Quantity
              </label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => set("quantity", parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Max Price Per Ticket ($)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.max_price_per_ticket}
              onChange={(e) => set("max_price_per_ticket", e.target.value)}
              placeholder="700"
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={inputStyle}
            />
            {maxBudgetTotal && (
              <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                Total budget: ${maxBudgetTotal.toLocaleString()}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Alert Email
            </label>
            <input
              type="email"
              value={form.alert_email}
              onChange={(e) => set("alert_email", e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Event Page URL
            </label>
            <input
              type="url"
              value={form.event_url}
              onChange={(e) => set("event_url", e.target.value)}
              placeholder="https://www.stubhub.com/event/..."
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Alert only — do NOT auto-buy..."
              rows={2}
              className="w-full px-3 py-2 rounded-md border text-sm resize-none"
              style={inputStyle}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium border"
              style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)", background: "transparent" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-md text-sm font-medium"
              style={{ background: "var(--accent-purple)", color: "white" }}
            >
              {initial ? "Save Changes" : "Add Watch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ticket Watch Card ────────────────────────────────────────────────────────

function TicketWatchCard({
  watch,
  onEdit,
  onDelete,
  onPause,
  onResume,
}: {
  watch: TicketWatch;
  onEdit: () => void;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const maxPrice = watch.max_price_per_ticket != null ? Number(watch.max_price_per_ticket) : null;
  const cheapest = watch.last_cheapest_price != null ? Number(watch.last_cheapest_price) : null;
  const totalBudget = maxPrice != null ? maxPrice * watch.quantity : null;

  const isUnderBudget = cheapest != null && maxPrice != null && cheapest <= maxPrice;
  const isPaused = watch.status === "paused";

  let statusDot = "🟡";
  let statusLabel = "Watching";
  let statusColor = "#f0b429";

  if (isPaused) {
    statusDot = "⏸";
    statusLabel = "Paused";
    statusColor = "var(--text-muted)";
  } else if (cheapest === null) {
    statusDot = "🟡";
    statusLabel = "Watching";
    statusColor = "#f0b429";
  } else if (isUnderBudget) {
    statusDot = "🟢";
    statusLabel = "Under budget!";
    statusColor = "#26c97a";
  } else {
    statusDot = "🟡";
    statusLabel = "Above budget";
    statusColor = "#f0b429";
  }

  const history = Array.isArray(watch.price_history) ? watch.price_history.slice(-5) : [];

  const eventDate = watch.event_date
    ? new Date(watch.event_date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      style={{
        position: "relative",
        background: "var(--bg-elevated)",
        border: `1px solid ${isPaused ? "var(--border-subtle)" : isUnderBudget ? "#26c97a30" : "var(--border-subtle)"}`,
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        opacity: isPaused ? 0.65 : 1,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {watch.event_url ? (
            <a
              href={watch.event_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "#3b82f6",
                lineHeight: 1.3,
                marginBottom: 4,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {watch.event_name}
              <ExternalLink size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
            </a>
          ) : (
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.3,
                marginBottom: 4,
              }}
            >
              {watch.event_name}
            </div>
          )}
          {(watch.venue || eventDate) && (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {[watch.venue, eventDate].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>

        {/* ••• menu */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: 34,
                right: 0,
                zIndex: 50,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 10,
                padding: 4,
                minWidth: 140,
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              }}
            >
              <button
                onClick={() => { setMenuOpen(false); onEdit(); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 12, textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: "var(--text-primary)", borderRadius: 6 }}
              >
                <Pencil size={12} /> Edit
              </button>
              {isPaused ? (
                <button
                  onClick={() => { setMenuOpen(false); onResume(); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 12, textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: "#26c97a", borderRadius: 6 }}
                >
                  <Bell size={12} /> Resume
                </button>
              ) : (
                <button
                  onClick={() => { setMenuOpen(false); onPause(); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 12, textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: "#f0b429", borderRadius: 6 }}
                >
                  <BellOff size={12} /> Pause
                </button>
              )}
              <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", fontSize: 12, textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: "#f05b5b", borderRadius: 6 }}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>
            What you want
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {watch.quantity}x {watch.section_filter}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>
            Max budget
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {maxPrice != null ? (
              <>
                ${maxPrice.toLocaleString()}/ticket
                {totalBudget != null && (
                  <span style={{ color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 4 }}>
                    (${totalBudget.toLocaleString()} total)
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: "var(--text-tertiary)" }}>—</span>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>
            Current cheapest
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {cheapest != null ? (
              watch.last_cheapest_url ? (
                <a
                  href={watch.last_cheapest_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: isUnderBudget ? "#26c97a" : "#3b82f6", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  ${cheapest.toLocaleString()}
                  {watch.last_cheapest_platform && (
                    <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
                      · {watch.last_cheapest_platform}
                    </span>
                  )}
                  <ExternalLink size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
                </a>
              ) : (
                <span style={{ color: isUnderBudget ? "#26c97a" : "var(--text-primary)" }}>
                  ${cheapest.toLocaleString()}
                  {watch.last_cheapest_platform && (
                    <span style={{ color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 4 }}>
                      · {watch.last_cheapest_platform}
                    </span>
                  )}
                </span>
              )
            ) : (
              <span style={{ color: "var(--text-muted)" }}>Not checked yet</span>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>
            Status
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>
            {statusDot} {statusLabel}
          </div>
        </div>
      </div>

      {/* Last checked */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Last checked: {timeAgo(watch.last_checked_at)}
        </div>
        {watch.alert_email && (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4, overflow: "hidden", maxWidth: "55%" }}>
            <Bell size={10} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{watch.alert_email}</span>
          </div>
        )}
      </div>

      {/* Price history */}
      {history.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 6 }}>
            Recent prices
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {history.map((h, i) => (
              <div
                key={i}
                style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                }}
              >
                ${Number(h.price).toLocaleString()}
                {h.platform && <span style={{ color: "var(--text-muted)", marginLeft: 3 }}>{h.platform}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {watch.notes && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            background: "var(--bg-tertiary)",
            borderRadius: 8,
            padding: "8px 10px",
            borderLeft: "3px solid var(--accent-purple)",
          }}
        >
          {watch.notes}
        </div>
      )}
    </div>
  );
}

// ─── Deal Log Types ───────────────────────────────────────────────────────────

type DealStatus = "presented" | "bought" | "passed" | "sold" | "expired" | "missed";

interface DealLogEntry {
  id: number;
  deal_id: string;
  event_name: string;
  event_date: string | null;
  event_time: string | null;
  venue: string | null;
  zone: string | null;
  section: string | null;
  row: string | null;
  quantity: number | null;
  buy_price: number | null;
  buy_platform: string | null;
  buy_all_in: number | null;
  sell_benchmark: number | null;
  sell_benchmark_source: string | null;
  roi_pct: number | null;
  profit_est: number | null;
  source: string | null;
  status: DealStatus;
  action_taken: string | null;
  buy_actual: number | null;
  sell_price: number | null;
  sell_platform: string | null;
  sell_date: string | null;
  profit_actual: number | null;
  notes: string | null;
  found_at: string;
  updated_at: string;
}

const DEAL_STATUS_CONFIG: Record<DealStatus, { label: string; color: string; bg: string }> = {
  presented: { label: "New", color: "#3b82f6", bg: "#3b82f618" },
  bought: { label: "Bought", color: "#8b5cf6", bg: "#8b5cf618" },
  passed: { label: "Passed", color: "#6b7280", bg: "#6b728018" },
  sold: { label: "Sold", color: "#26c97a", bg: "#26c97a18" },
  expired: { label: "Expired", color: "#f0b429", bg: "#f0b42918" },
  missed: { label: "Missed", color: "#f05b5b", bg: "#f05b5b18" },
};

function DealStatusBadge({ status }: { status: DealStatus }) {
  const cfg = DEAL_STATUS_CONFIG[status] || DEAL_STATUS_CONFIG.presented;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

// ─── Price History Modal ──────────────────────────────────────────────────────

interface PriceHistoryEntry {
  id: number;
  flip_id: string;
  platform: string;
  our_price: number | null;
  competitor_floor: number | null;
  competitor_listing_id: string | null;
  action: string;
  old_price: number | null;
  new_price: number | null;
  reason: string | null;
  checked_at: string;
}

function PriceHistoryModal({
  flipId,
  flipName,
  platform,
  onClose,
}: {
  flipId: string;
  flipName: string;
  platform: string;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/listing-history?flip_id=${flipId}&platform=${platform}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history ?? []);
        }
      } catch (e) {
        console.error("fetch price history error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [flipId, platform]);

  const actionColors: Record<string, string> = {
    adjusted: "#f0b429",
    check: "var(--text-tertiary)",
    no_change: "#26c97a",
    error: "#f05b5b",
  };

  const actionLabels: Record<string, string> = {
    adjusted: "⚡ Adjusted",
    check: "👁 Checked",
    no_change: "✅ No change",
    error: "❌ Error",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border-default)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                <History size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                Price History — {platform}
              </h2>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{flipName}</div>
            </div>
            <button onClick={onClose} style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: 13 }}>Loading...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>
              No price checks yet — monitor will start logging here
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((h) => {
                const actionColor = actionColors[h.action] ?? "var(--text-tertiary)";
                const actionLabel = actionLabels[h.action] ?? h.action;
                const ts = new Date(h.checked_at).toLocaleString("en-US", {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
                });
                return (
                  <div
                    key={h.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: h.action === "adjusted" ? "#f0b42908" : "var(--bg-primary)",
                      border: h.action === "adjusted" ? "1px solid #f0b42925" : "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: actionColor }}>{actionLabel}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ts}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                      {h.our_price != null && (
                        <div>
                          <span style={{ color: "var(--text-tertiary)" }}>Our price: </span>
                          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt$(Number(h.our_price))}</span>
                        </div>
                      )}
                      {h.competitor_floor != null && (
                        <div>
                          <span style={{ color: "var(--text-tertiary)" }}>Floor: </span>
                          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt$(Number(h.competitor_floor))}</span>
                        </div>
                      )}
                    </div>
                    {h.action === "adjusted" && h.old_price != null && h.new_price != null && (
                      <div style={{ fontSize: 12, marginTop: 4, color: "#f0b429", fontWeight: 600 }}>
                        {fmt$(Number(h.old_price))} → {fmt$(Number(h.new_price))}
                      </div>
                    )}
                    {h.reason && (
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>{h.reason}</div>
                    )}
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

export default function FlipsPage() {
  const [activeTab, setActiveTab] = useState<"flips" | "deals" | "rules" | "watch">("flips");
  const [flips, setFlips] = useState<Flip[]>([]);
  const [deals, setDeals] = useState<DealLogEntry[]>([]);
  const [watches, setWatches] = useState<TicketWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [watchesLoading, setWatchesLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddWatch, setShowAddWatch] = useState(false);
  const [editWatch, setEditWatch] = useState<TicketWatch | null>(null);
  const [editFlip, setEditFlip] = useState<Flip | null>(null);
  const [sellFlip, setSellFlip] = useState<Flip | null>(null);
  const [priceHistoryTarget, setPriceHistoryTarget] = useState<{ flipId: string; flipName: string; platform: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [dealFilter, setDealFilter] = useState<"all" | DealStatus>("all");
  const [editingDeal, setEditingDeal] = useState<DealLogEntry | null>(null);
  const [dealActionMenu, setDealActionMenu] = useState<number | null>(null);
  const [dealSort, setDealSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "found_at", dir: "desc" });
  const [selectedDeals, setSelectedDeals] = useState<Set<number>>(new Set());
  const [rules, setRules] = useState<Record<string, unknown> | null>(null);
  const [savingRule, setSavingRule] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchFlips = useCallback(async () => {
    const res = await fetch("/api/flips");
    const data = await res.json();
    setFlips(data);
    setLoading(false);
  }, []);

  const fetchDeals = useCallback(async () => {
    setDealsLoading(true);
    try {
      const res = await fetch("/api/deals");
      if (res.ok) {
        const data = await res.json();
        setDeals(data.deals ?? []);
      }
    } catch (e) {
      console.error("fetch deals error:", e);
    } finally {
      setDealsLoading(false);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/scanner-rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
      }
    } catch (e) {
      console.error("fetch rules error:", e);
    }
  }, []);

  const fetchWatches = useCallback(async () => {
    setWatchesLoading(true);
    try {
      const res = await fetch("/api/ticket-watch");
      if (res.ok) {
        const data = await res.json();
        setWatches(data);
      }
    } catch (e) {
      console.error("fetch watches error:", e);
    } finally {
      setWatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlips();
    fetchDeals();
    fetchRules();
    fetchWatches();
  }, [fetchFlips, fetchDeals, fetchRules, fetchWatches]);

  // ── Watch CRUD ─────────────────────────────────────────────────────────────

  const handleAddWatch = async (data: WatchFormData) => {
    const res = await fetch("/api/ticket-watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: data.event_name,
        venue: data.venue || null,
        event_date: data.event_date || null,
        section_filter: data.section_filter,
        quantity: data.quantity,
        max_price_per_ticket: data.max_price_per_ticket ? parseFloat(data.max_price_per_ticket) : null,
        alert_email: data.alert_email || null,
        event_url: data.event_url || null,
        notes: data.notes || null,
      }),
    });
    if (res.ok) {
      const w = await res.json();
      setWatches((prev) => [w, ...prev]);
    }
  };

  const handleEditWatch = async (data: WatchFormData) => {
    if (!editWatch) return;
    const res = await fetch("/api/ticket-watch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editWatch.id,
        event_name: data.event_name,
        venue: data.venue || null,
        event_date: data.event_date || null,
        section_filter: data.section_filter,
        quantity: data.quantity,
        max_price_per_ticket: data.max_price_per_ticket ? parseFloat(data.max_price_per_ticket) : null,
        alert_email: data.alert_email || null,
        event_url: data.event_url || null,
        notes: data.notes || null,
      }),
    });
    if (res.ok) {
      const w = await res.json();
      setWatches((prev) => prev.map((x) => (x.id === editWatch.id ? w : x)));
    }
  };

  const handleDeleteWatch = async (id: number) => {
    if (!confirm("Delete this watch?")) return;
    await fetch(`/api/ticket-watch?id=${id}`, { method: "DELETE" });
    setWatches((prev) => prev.filter((w) => w.id !== id));
  };

  const handlePauseWatch = async (id: number) => {
    const res = await fetch("/api/ticket-watch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "paused" }),
    });
    if (res.ok) {
      const w = await res.json();
      setWatches((prev) => prev.map((x) => (x.id === id ? w : x)));
    }
  };

  const handleResumeWatch = async (id: number) => {
    const res = await fetch("/api/ticket-watch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "watching" }),
    });
    if (res.ok) {
      const w = await res.json();
      setWatches((prev) => prev.map((x) => (x.id === id ? w : x)));
    }
  };

  const updateRule = async (field: string, value: unknown) => {
    setSavingRule(field);
    try {
      const res = await fetch("/api/scanner-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
      }
    } catch (e) {
      console.error("update rule error:", e);
    } finally {
      setSavingRule(null);
    }
  };

  const updateDealStatus = async (dealId: number, status: DealStatus, actionTaken?: string) => {
    try {
      await fetch("/api/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dealId, status, action_taken: actionTaken }),
      });
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, status, action_taken: actionTaken !== undefined ? actionTaken : d.action_taken } : d));
    } catch (e) {
      console.error("update deal error:", e);
    }
    setDealActionMenu(null);
  };

  const updateDealNotes = async (dealId: number, notes: string) => {
    try {
      await fetch("/api/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dealId, notes }),
      });
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, notes } : d));
    } catch (e) {
      console.error("update deal notes error:", e);
    }
    setEditingDeal(null);
  };

  const bulkDeleteDeals = async () => {
    if (selectedDeals.size === 0) return;
    if (!confirm(`Delete ${selectedDeals.size} deal${selectedDeals.size > 1 ? "s" : ""}?`)) return;
    try {
      await Promise.all(Array.from(selectedDeals).map(id => fetch(`/api/deals?id=${id}`, { method: "DELETE" })));
      setDeals((prev) => prev.filter((d) => !selectedDeals.has(d.id)));
      setSelectedDeals(new Set());
    } catch (e) {
      console.error("bulk delete error:", e);
    }
  };

  const toggleSelectDeal = (id: number) => {
    setSelectedDeals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDeals.size === filteredDeals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(filteredDeals.map(d => d.id)));
    }
  };

  const deleteDeal = async (dealId: number) => {
    if (!confirm("Delete this deal?")) return;
    try {
      await fetch(`/api/deals?id=${dealId}`, { method: "DELETE" });
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
    } catch (e) {
      console.error("delete deal error:", e);
    }
  };

  const toggleDealSort = (field: string) => {
    setDealSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "desc" ? "asc" : "desc",
    }));
  };

  // Auto-delete deals where event date has passed and status is still "presented"
  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const toDelete = deals.filter(d => {
      if (d.status !== "presented" || !d.event_date) return false;
      const eventDate = new Date(d.event_date + "T23:59:59");
      return eventDate < now;
    });
    if (toDelete.length > 0) {
      toDelete.forEach(d => {
        fetch(`/api/deals?id=${d.id}`, { method: "DELETE" }).catch(() => {});
      });
      setDeals(prev => prev.filter(d => !toDelete.find(td => td.id === d.id)));
    }
  }, [deals]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedFilteredDeals = (() => {
    const filtered = dealFilter === "all" ? deals : deals.filter((d) => d.status === dealFilter);
    return [...filtered].sort((a, b) => {
      const { field, dir } = dealSort;
      let aVal: number | string = 0, bVal: number | string = 0;
      if (field === "roi_pct") { aVal = Number(a.roi_pct) || 0; bVal = Number(b.roi_pct) || 0; }
      else if (field === "profit_est") { aVal = Number(a.profit_est) || 0; bVal = Number(b.profit_est) || 0; }
      else if (field === "buy_all_in") { aVal = Number(a.buy_all_in) || 0; bVal = Number(b.buy_all_in) || 0; }
      else if (field === "sell_benchmark") { aVal = Number(a.sell_benchmark) || 0; bVal = Number(b.sell_benchmark) || 0; }
      else if (field === "found_at") { aVal = new Date(a.found_at).getTime(); bVal = new Date(b.found_at).getTime(); }
      else if (field === "event_date") { aVal = a.event_date || ""; bVal = b.event_date || ""; }
      else if (field === "event_name") { aVal = a.event_name.toLowerCase(); bVal = b.event_name.toLowerCase(); }
      else if (field === "quantity") { aVal = a.quantity || 0; bVal = b.quantity || 0; }
      if (typeof aVal === "string") return dir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return dir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  })();

  const filteredDeals = sortedFilteredDeals;

  // ── Stats ──────────────────────────────────────────────────────────────────

  const activeFlips = flips.filter((f) => f.status === "active" || f.status === "at-risk");
  const soldFlips = flips.filter((f) => f.status === "sold" || f.status === "loss");

  const totalInvested = activeFlips.reduce(
    (sum, f) => sum + f.buyAllIn * f.quantity, 0
  );
  const lockedProfit = soldFlips.reduce((sum, f) => sum + (f.profit ?? 0), 0);
  const avgROI =
    soldFlips.length > 0
      ? soldFlips.reduce((sum, f) => sum + (f.roi ?? 0), 0) / soldFlips.length
      : 0;

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleAdd = async (data: FlipFormData) => {
    const res = await fetch("/api/flips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const flip = await res.json();
    setFlips((prev) => [...prev, flip].sort(
      (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    ));
  };

  const handleEdit = async (data: FlipFormData) => {
    if (!editFlip) return;
    const res = await fetch(`/api/flips/${editFlip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    setFlips((prev) => prev.map((f) => (f.id === editFlip.id ? updated : f)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this flip?")) return;
    await fetch(`/api/flips/${id}`, { method: "DELETE" });
    setFlips((prev) => prev.filter((f) => f.id !== id));
  };

  const handleMarkSold = async (flip: Flip, soldPrice: number) => {
    const res = await fetch(`/api/flips/${flip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldPrice }),
    });
    const updated = await res.json();
    setFlips((prev) => prev.map((f) => (f.id === flip.id ? updated : f)));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const thStyle: React.CSSProperties = {
    color: "var(--text-tertiary)",
    fontWeight: 600,
    fontSize: "0.65rem",
    letterSpacing: "0.06em",
    padding: "0 12px 8px",
    textAlign: "left",
    whiteSpace: "nowrap",
    borderBottom: "1px solid var(--border-subtle)",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    verticalAlign: "middle",
    borderBottom: "1px solid var(--border-subtle)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "20px 24px", borderBottom: "none", flexShrink: 0, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Flip Tracker</h1>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, marginBottom: 0 }}>
            {activeTab === "flips"
              ? `${flips.length} flip${flips.length !== 1 ? "s" : ""} · Live P&L dashboard`
              : activeTab === "deals"
              ? `${deals.length} deal${deals.length !== 1 ? "s" : ""} found by scanner`
              : activeTab === "watch"
              ? `${watches.length} watch${watches.length !== 1 ? "es" : ""} · Ticket price monitor`
              : "Scanner rules & fee configuration"}
          </p>
        </div>
        {activeTab === "flips" && (
          <button onClick={() => setShowAdd(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 6, fontSize: 14, fontWeight: 500, background: "var(--accent-purple)", color: "white", border: "none", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
            <Plus size={14} />Add Flip
          </button>
        )}
        {activeTab === "watch" && (
          <button onClick={() => setShowAddWatch(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 6, fontSize: 14, fontWeight: 500, background: "var(--accent-purple)", color: "white", border: "none", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
            <Plus size={14} />Add Watch
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "8px", padding: isMobile ? "0 14px 12px" : "0 24px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
        {([["flips", "Active Flips"], ["deals", "Deal Log"], ["rules", "Rules & Criteria"], ["watch", "Ticket Watch"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: "8px 20px",
              fontSize: "14px",
              fontWeight: activeTab === key ? 600 : 500,
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              background: activeTab === key ? "var(--accent-purple)" : "var(--bg-elevated)",
              color: activeTab === key ? "#fff" : "var(--text-secondary)",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {label}
            {key === "deals" && deals.filter(d => d.status === "presented").length > 0 && (
              <span style={{ marginLeft: "6px", background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "8px" }}>
                {deals.filter(d => d.status === "presented").length}
              </span>
            )}
            {key === "watch" && watches.filter(w => {
              const cheapest = w.last_cheapest_price != null ? Number(w.last_cheapest_price) : null;
              const max = w.max_price_per_ticket != null ? Number(w.max_price_per_ticket) : null;
              return cheapest != null && max != null && cheapest <= max && w.status === "watching";
            }).length > 0 && (
              <span style={{ marginLeft: "6px", background: "#26c97a", color: "#0f0f10", fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "8px" }}>
                🟢
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════ TICKET WATCH TAB ════════ */}
      {activeTab === "watch" && (
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px 14px" : "20px 24px" }}>
          {watchesLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, fontSize: 14, color: "var(--text-tertiary)" }}>
              Loading...
            </div>
          ) : watches.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, borderRadius: 14, border: "1px dashed var(--border-default)", gap: 12, color: "var(--text-muted)" }}>
              <Eye size={32} style={{ opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>No ticket watches yet</p>
              <button
                onClick={() => setShowAddWatch(true)}
                style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent-purple)", color: "white", border: "none", cursor: "pointer" }}
              >
                + Add Watch
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                gap: 16,
                alignItems: "start",
              }}
            >
              {watches.map((watch) => (
                <TicketWatchCard
                  key={watch.id}
                  watch={watch}
                  onEdit={() => setEditWatch(watch)}
                  onDelete={() => handleDeleteWatch(watch.id)}
                  onPause={() => handlePauseWatch(watch.id)}
                  onResume={() => handleResumeWatch(watch.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════ RULES TAB ════════ */}
      {activeTab === "rules" && (
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px 14px" : "20px 24px" }}>
          {!rules ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, fontSize: 14, color: "var(--text-tertiary)" }}>Loading rules...</div>
          ) : (<>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "20px", maxWidth: "900px" }}>

            {/* Deal Criteria — Editable */}
            <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <Filter size={18} style={{ color: "var(--accent-purple)" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Deal Criteria</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {([
                  { label: "Minimum ROI", field: "min_roi", suffix: "%", desc: "Only alert if estimated ROI exceeds this" },
                  { label: "Min Completed Sales", field: "min_completed_sales", suffix: " sales", desc: "Min zone-level sales in window to trust benchmark" },
                  { label: "Sales Window", field: "sales_window_days", suffix: " days", desc: "Only use zone completed sales from this window" },
                  { label: "Max Sales Used", field: "max_sales_used", suffix: " sales", desc: "Cap most recent zone sales to prevent skew" },
                  { label: "Min Hours Out", field: "min_hours_out", suffix: "h", desc: "Event must be this far in the future" },
                  { label: "Max Days Out", field: "max_days_out", suffix: " days", desc: "Skip events further than this (9999 = no limit)" },
                  { label: "Floor Divergence Flag", field: "floor_divergence_flag", suffix: "%", desc: "Warn when floor vs avg diverge by this much", multiply: 100 },
                ] as {label: string; field: string; suffix: string; desc: string; multiply?: number}[]).map((rule) => (
                  <div key={rule.field} style={{ display: "flex", justifyContent: "space-between", alignItems: "start", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{rule.label}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>{rule.desc}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "12px" }}>
                      <input
                        type="number"
                        defaultValue={rule.multiply ? Number(rules[rule.field]) * rule.multiply : Number(rules[rule.field])}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateRule(rule.field, rule.multiply ? val / rule.multiply : val);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            if (!isNaN(val)) updateRule(rule.field, rule.multiply ? val / rule.multiply : val);
                          }
                        }}
                        style={{ width: "70px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--accent-purple)", fontSize: "14px", fontWeight: 600, textAlign: "right", outline: "none" }}
                      />
                      <span style={{ fontSize: "12px", color: "var(--text-tertiary)", minWidth: "30px" }}>{rule.suffix}</span>
                      {savingRule === rule.field && <span style={{ fontSize: "10px", color: "#26c97a" }}>✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sell Benchmark — Static formulas */}
            <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <TrendingUp size={18} style={{ color: "#26c97a" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Sell Benchmark Formula</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)", borderLeft: "3px solid #26c97a" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
                    sell_price = MIN(active_floor, {Number(rules.sales_window_days)}day_avg)
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    Use the LOWER of current listing floor or recent completed sales average
                  </div>
                </div>
                <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)", borderLeft: "3px solid #3b82f6" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
                    net = sell_price × {(1 - Number(rules.seller_fee)).toFixed(2)}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    {(Number(rules.seller_fee) * 100).toFixed(0)}% StubHub seller fee deducted from sale price
                  </div>
                </div>
                <div style={{ padding: "12px", borderRadius: "8px", background: "var(--bg-primary)", borderLeft: "3px solid var(--accent-purple)" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
                    ROI = (net - buy_all_in) / buy_all_in × 100
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    All-in buy price includes platform fees + delivery
                  </div>
                </div>
              </div>
            </div>

            {/* Fee Model — Buy & Sell columns */}
            <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <DollarSign size={18} style={{ color: "#f0b429" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Platform Fees</h3>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "14px" }}>
                Buy fees = what you pay on top of listed price when purchasing. Sell fees = what the platform deducts from your sale.
              </div>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: "8px", padding: "0 12px 6px", fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <span>Platform</span>
                <span style={{ textAlign: "right" }}>Buy Fee</span>
                <span style={{ textAlign: "right" }}>Sell Fee</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {([
                  { platform: "TickPick", buyField: "tickpick_buyer_fee", sellField: null, color: "#8b5cf6", buyNote: "Zero fees", sellNote: "No seller access", buyLocked: true, sellLocked: true },
                  { platform: "Gametime", buyField: "gametime_buyer_fee", sellField: null, color: "#d4531c", buyNote: "~10-20%, varies", sellNote: "No seller portal", buyLocked: false, sellLocked: true },
                  { platform: "StubHub", buyField: "stubhub_buyer_fee", sellField: "seller_fee", color: "#26c97a", buyNote: "~10-30%, varies", sellNote: "Fixed", buyLocked: false, sellLocked: true },
                  { platform: "SeatGeek", buyField: "seatgeek_buyer_fee", sellField: "seatgeek_seller_fee", color: "#f0b429", buyNote: "~15-35%, varies", sellNote: "Fixed", buyLocked: false, sellLocked: true },
                  { platform: "Vivid Seats", buyField: "vivid_buyer_fee", sellField: "vivid_seller_fee", color: "#4d7cfe", buyNote: "~20-40%, varies", sellNote: "Fixed", buyLocked: false, sellLocked: true },
                ] as {platform: string; buyField: string; sellField: string | null; color: string; buyNote: string; sellNote: string; buyLocked: boolean; sellLocked: boolean}[]).map((p) => (
                  <div key={p.buyField} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: "8px", alignItems: "center", padding: "8px 12px", borderRadius: "6px", background: "var(--bg-primary)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                      <div>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{p.platform}</span>
                      </div>
                    </div>
                    {/* Buy Fee */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                      {p.buyLocked ? (
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{(Number(rules[p.buyField]) * 100).toFixed(0)}%</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                          <input
                            type="number"
                            defaultValue={(Number(rules[p.buyField]) * 100).toFixed(0)}
                            onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateRule(p.buyField, v / 100); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) updateRule(p.buyField, v / 100); } }}
                            style={{ width: "38px", padding: "2px 4px", borderRadius: "4px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px", fontWeight: 600, textAlign: "right", outline: "none" }}
                          />
                          <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>%</span>
                        </div>
                      )}
                      <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>{p.buyNote}</span>
                    </div>
                    {/* Sell Fee */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                      {p.sellField ? (
                        <>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#26c97a" }}>{(Number(rules[p.sellField]) * 100).toFixed(0)}% 🔒</span>
                          <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>{p.sellNote}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>N/A</span>
                          <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>{p.sellNote}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scanner Config — no sell platform */}
            <div style={{ padding: "20px", borderRadius: "12px", border: rules.scanner_enabled ? "1px solid var(--border-subtle)" : "1px solid #f05b5b40", background: "var(--bg-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Search size={18} style={{ color: rules.scanner_enabled ? "#3b82f6" : "#f05b5b" }} />
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Scanner</h3>
                  <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: rules.scanner_enabled ? "#26c97a18" : "#f05b5b18", color: rules.scanner_enabled ? "#26c97a" : "#f05b5b" }}>
                    {rules.scanner_enabled ? "RUNNING" : "OFF"}
                  </span>
                </div>
                <button
                  onClick={() => updateRule("scanner_enabled", !rules.scanner_enabled)}
                  style={{
                    padding: "6px 16px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                    border: "none", cursor: "pointer",
                    background: rules.scanner_enabled ? "#f05b5b18" : "#26c97a18",
                    color: rules.scanner_enabled ? "#f05b5b" : "#26c97a",
                  }}
                >
                  {rules.scanner_enabled ? "⏹ Stop Scanner" : "▶ Start Scanner"}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", opacity: rules.scanner_enabled ? 1 : 0.5 }}>
                {/* Top Events toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: "6px", background: "var(--bg-primary)" }}>
                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 500 }}>Top Events Scan</span>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Scan all 500 events independently (not just SeatDeals)</div>
                  </div>
                  <button
                    onClick={() => updateRule("top_events_enabled", !rules.top_events_enabled)}
                    disabled={!rules.scanner_enabled}
                    style={{
                      padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                      border: "none", cursor: rules.scanner_enabled ? "pointer" : "not-allowed",
                      background: rules.top_events_enabled ? "#26c97a18" : "#6b728018",
                      color: rules.top_events_enabled ? "#26c97a" : "#6b7280",
                    }}
                  >
                    {rules.top_events_enabled ? "ON" : "OFF"}
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: "6px", background: "var(--bg-primary)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>Scan Frequency</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>Every</span>
                    <input
                      type="number"
                      defaultValue={Number(rules.scan_frequency_min)}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val > 0) updateRule("scan_frequency_min", val);
                      }}
                      style={{ width: "50px", padding: "3px 6px", borderRadius: "4px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px", fontWeight: 600, textAlign: "right", outline: "none" }}
                    />
                    <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>min</span>
                  </div>
                </div>
                {[
                  { label: "Data Source", value: "SeatData Pro ($129/mo)" },
                  { label: "Events Scanned", value: "All tracked events" },
                  { label: "Buy Platforms", value: "TickPick, StubHub, SeatGeek, Vivid, Gametime" },
                  { label: "Alerts", value: "Email + Telegram" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: "6px", background: "var(--bg-primary)" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>{item.label}</span>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Auto-Buy Rules */}
          <div style={{ marginTop: "24px", maxWidth: "900px", padding: "20px", borderRadius: "12px", border: rules.auto_buy_enabled ? "1px solid #26c97a40" : "1px dashed var(--border-subtle)", background: "var(--bg-elevated)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Ticket size={18} style={{ color: rules.auto_buy_enabled ? "#26c97a" : "#f0b429" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Auto-Buy Rules</h3>
                <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: rules.auto_buy_enabled ? "#26c97a18" : "#f0b42918", color: rules.auto_buy_enabled ? "#26c97a" : "#f0b429" }}>
                  {rules.auto_buy_enabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>
              <button
                onClick={() => updateRule("auto_buy_enabled", !rules.auto_buy_enabled)}
                style={{
                  padding: "6px 16px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                  border: "none", cursor: "pointer",
                  background: rules.auto_buy_enabled ? "#f05b5b18" : "#26c97a18",
                  color: rules.auto_buy_enabled ? "#f05b5b" : "#26c97a",
                }}
              >
                {rules.auto_buy_enabled ? "Disable" : "Enable"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "10px" }}>
              {([
                { label: "Min ROI", field: "auto_buy_min_roi", suffix: "%" },
                { label: "Min Sales (7d)", field: "auto_buy_min_sales", suffix: " sales" },
                { label: "Min Days Out", field: "auto_buy_min_days_out", suffix: " days" },
                { label: "Max Days Out", field: "auto_buy_max_days_out", suffix: " days" },
              ] as {label: string; field: string; suffix: string}[]).map((rule) => (
                <div key={rule.field} style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--bg-primary)", opacity: rules.auto_buy_enabled ? 1 : 0.5 }}>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>{rule.label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="number"
                      defaultValue={Number(rules[rule.field])}
                      disabled={!rules.auto_buy_enabled}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) updateRule(rule.field, val);
                      }}
                      style={{ width: "70px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--accent-purple)", fontSize: "14px", fontWeight: 600, textAlign: "right", outline: "none" }}
                    />
                    <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>{rule.suffix}</span>
                  </div>
                </div>
              ))}
              {/* Max Cost — with per-seat/total toggle */}
              <div style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--bg-primary)", opacity: rules.auto_buy_enabled ? 1 : 0.5, gridColumn: isMobile ? "1" : "span 2" }}>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>Max Cost (all-in, including platform fees)</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{"$"}</span>
                    <input
                      type="number"
                      defaultValue={Number(rules.auto_buy_max_cost)}
                      disabled={!rules.auto_buy_enabled}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) updateRule("auto_buy_max_cost", val);
                      }}
                      style={{ width: "70px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--accent-purple)", fontSize: "14px", fontWeight: 600, textAlign: "right", outline: "none" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {(["per_seat", "total"] as const).map((t) => (
                      <button
                        key={t}
                        disabled={!rules.auto_buy_enabled}
                        onClick={() => updateRule("auto_buy_cost_type", t)}
                        style={{
                          padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                          border: "none", cursor: rules.auto_buy_enabled ? "pointer" : "not-allowed",
                          background: rules.auto_buy_cost_type === t ? "var(--accent-purple)" : "var(--bg-secondary)",
                          color: rules.auto_buy_cost_type === t ? "#fff" : "var(--text-tertiary)",
                        }}
                      >
                        {t === "per_seat" ? "Per Seat" : "Total Purchase"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {rules.auto_buy_enabled && (
              <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", background: "#26c97a10", border: "1px solid #26c97a30", fontSize: "12px", color: "#26c97a", fontFamily: "monospace" }}>
                IF roi &gt; {String(rules.auto_buy_min_roi)}% AND sales &gt; {String(rules.auto_buy_min_sales)} AND cost &lt; {"$"}{String(rules.auto_buy_max_cost)} AND days_out between {String(rules.auto_buy_min_days_out)}-{String(rules.auto_buy_max_days_out)} → AUTO BUY
              </div>
            )}
          </div>

          {/* Auto-List Rules */}
          <div style={{ marginTop: "16px", maxWidth: "900px", padding: "20px", borderRadius: "12px", border: rules.auto_list_enabled ? "1px solid #3b82f640" : "1px dashed var(--border-subtle)", background: "var(--bg-elevated)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Tag size={18} style={{ color: rules.auto_list_enabled ? "#3b82f6" : "#6b7280" }} />
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Auto-List After Purchase</h3>
                <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", background: rules.auto_list_enabled ? "#3b82f618" : "#6b728018", color: rules.auto_list_enabled ? "#3b82f6" : "#6b7280" }}>
                  {rules.auto_list_enabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>
              <button
                onClick={() => updateRule("auto_list_enabled", !rules.auto_list_enabled)}
                style={{
                  padding: "6px 16px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                  border: "none", cursor: "pointer",
                  background: rules.auto_list_enabled ? "#f05b5b18" : "#3b82f618",
                  color: rules.auto_list_enabled ? "#f05b5b" : "#3b82f6",
                }}
              >
                {rules.auto_list_enabled ? "Disable" : "Enable"}
              </button>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px", fontStyle: "italic" }}>
              These pricing rules are also used by the Listing Monitor to auto-adjust existing listings.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "10px" }}>
              <div style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>Platforms to List On</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {([
                    { id: "stubhub", label: "StubHub", ready: true },
                    { id: "vivid", label: "Vivid Seats", ready: true },
                    { id: "seatgeek", label: "SeatGeek", ready: false },
                    { id: "tickpick", label: "TickPick", ready: false },
                    { id: "gametime", label: "Gametime", ready: false },
                  ] as const).map((p) => {
                    const current = String(rules.auto_list_platforms || "stubhub").split(",");
                    const active = current.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        disabled={!p.ready}
                        onClick={() => {
                          if (!p.ready) return;
                          const updated = active ? current.filter(x => x !== p.id) : [...current, p.id];
                          if (updated.length > 0) updateRule("auto_list_platforms", updated.join(","));
                        }}
                        title={!p.ready ? "Seller access pending" : undefined}
                        style={{
                          padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                          border: "none", cursor: p.ready ? "pointer" : "not-allowed",
                          background: active ? "#3b82f618" : "var(--bg-secondary)",
                          color: active ? "#3b82f6" : "var(--text-tertiary)",
                          opacity: p.ready ? 1 : 0.4,
                          position: "relative" as const,
                        }}
                      >
                        {p.label}{!p.ready && " 🔒"}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--bg-primary)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px" }}>Undercut Cheapest Competitor By</div>
                <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
                  {(["dollars", "percent"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateRule("auto_list_undercut_mode", m)}
                      style={{
                        padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                        border: "none", cursor: "pointer",
                        background: rules.auto_list_undercut_mode === m ? "#3b82f6" : "var(--bg-secondary)",
                        color: rules.auto_list_undercut_mode === m ? "#fff" : "var(--text-tertiary)",
                      }}
                    >
                      {m === "dollars" ? "$ Amount" : "% Percentage"}
                    </button>
                  ))}
                </div>
                {rules.auto_list_undercut_mode === "dollars" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{"$"}</span>
                    <input
                      type="number"
                      defaultValue={Number(rules.auto_list_undercut_dollars)}
                      onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateRule("auto_list_undercut_dollars", v); }}
                      style={{ width: "60px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--accent-purple)", fontSize: "14px", fontWeight: 600, textAlign: "right", outline: "none" }}
                    />
                    <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>less than cheapest</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="number"
                      defaultValue={Number(rules.auto_list_undercut_pct)}
                      onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateRule("auto_list_undercut_pct", v); }}
                      style={{ width: "60px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--accent-purple)", fontSize: "14px", fontWeight: 600, textAlign: "right", outline: "none" }}
                    />
                    <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>% below cheapest</span>
                  </div>
                )}
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "6px" }}>
                  {rules.auto_list_undercut_mode === "dollars"
                    ? `Your listing = cheapest competitor's buyer-visible price minus $${Number(rules.auto_list_undercut_dollars).toFixed(0)}, converted to seller price`
                    : `Your listing = cheapest competitor's buyer-visible price × ${(1 - Number(rules.auto_list_undercut_pct) / 100).toFixed(2)}, converted to seller price`
                  }
                </div>
              </div>
            </div>
            <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", background: "#3b82f610", border: "1px solid #3b82f630", fontSize: "12px", color: "#3b82f6" }}>
              <strong>Pricing rule (auto-list + listing monitor):</strong> Price at{" "}
              {rules.auto_list_undercut_mode === "dollars"
                ? <><strong>{"$"}{String(rules.auto_list_undercut_dollars)}</strong> below cheapest competitor</>
                : <><strong>{String(rules.auto_list_undercut_pct)}%</strong> below cheapest competitor</>
              }
              {" "}on {String(rules.auto_list_platforms || "stubhub").split(",").map(p => p === "stubhub" ? "StubHub" : p === "vivid" ? "Vivid Seats" : "SeatGeek").join(", ")}
              {rules.auto_list_enabled
                ? <span style={{ color: "#26c97a" }}> · Auto-list ON</span>
                : <span style={{ color: "var(--text-muted)" }}> · Auto-list OFF (monitor still uses these rules)</span>
              }
            </div>

            {/* Max Auto-Reprice Safety Threshold */}
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px" }}>🛑 Max Auto-Reprice (% Change)</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="number"
                  min={5}
                  max={100}
                  step={5}
                  style={{ width: "70px", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "14px", textAlign: "center" }}
                  defaultValue={Number(rules.max_auto_reprice_pct) || 30}
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 5 && v <= 100) updateRule("max_auto_reprice_pct", v); }}
                />
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>%</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Price changes above this % require your approval. Prevents accidental catastrophic repricing.
              </div>
            </div>
          </div>

          {rules.updated_at && (
            <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--text-muted)" }}>
              Last updated: {new Date(rules.updated_at as string).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          )}
          </>)}
        </div>
      )}

      {/* ════════ DEAL LOG TAB ════════ */}
      {activeTab === "deals" && (
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px 14px" : "0 24px 24px" }}>
          {/* Filter pills */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "16px 0 12px" }}>
            {(["all", "presented", "bought", "passed", "sold", "missed"] as const).map((f) => {
              const count = f === "all" ? deals.length : deals.filter(d => d.status === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setDealFilter(f)}
                  style={{
                    padding: "5px 14px",
                    fontSize: "12px",
                    fontWeight: dealFilter === f ? 600 : 500,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: dealFilter === f ? "var(--accent-purple)" : "var(--bg-elevated)",
                    color: dealFilter === f ? "#fff" : "var(--text-secondary)",
                    textTransform: "capitalize",
                  }}
                >
                  {f} {count > 0 ? `(${count})` : ""}
                </button>
              );
            })}
          </div>

          {dealsLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, fontSize: 14, color: "var(--text-tertiary)" }}>Loading...</div>
          ) : filteredDeals.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 160, borderRadius: 12, border: "1px dashed var(--border-default)", gap: 8, color: "var(--text-muted)" }}>
              <Search size={28} style={{ opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>No deals found yet — scanner will log them here</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
                gap: "12px",
                marginTop: "8px",
                alignItems: "start",
              }}
            >
              {filteredDeals.map((deal) => {
                const roi = Number(deal.roi_pct ?? 0);
                const roiColor = roi >= 30 ? "#26c97a" : roi >= 0 ? "#f0b429" : "#f05b5b";
                const roiBg = roi >= 30 ? "#26c97a12" : roi >= 0 ? "#f0b42912" : "#f05b5b12";
                const estimatedProfitPerTicket = deal.sell_benchmark != null && deal.buy_all_in != null
                  ? (Number(deal.sell_benchmark) * 0.85) - Number(deal.buy_all_in)
                  : deal.profit_est != null
                    ? Number(deal.profit_est)
                    : null;
                const eventLink = String((deal as unknown as Record<string, unknown>).event_url || ((deal as unknown as Record<string, unknown>).stubhub_event_id ? `https://www.stubhub.com/event/${(deal as unknown as Record<string, unknown>).stubhub_event_id}` : ""));
                const buyLink = String((deal as unknown as Record<string, unknown>).buy_url || "");
                const formattedDateVenue = [deal.event_date, deal.venue].filter(Boolean).join(" • ") || "—";

                return (
                  <div
                    key={deal.id}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      padding: "12px",
                      minHeight: isMobile ? undefined : "118px",
                      borderRadius: "12px",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        {eventLink ? (
                          <a
                            href={eventLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "14px", fontWeight: 700, color: "#3b82f6", textDecoration: "none", lineHeight: 1.25 }}
                          >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deal.event_name}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {deal.event_name}
                          </div>
                        )}
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {formattedDateVenue}
                        </div>
                      </div>

                      {deal.status === "presented" ? (
                        <div
                          style={{
                            flexShrink: 0,
                            padding: "8px 10px",
                            borderRadius: "10px",
                            background: roiBg,
                            border: `1px solid ${roiColor}30`,
                            textAlign: "right",
                          }}
                        >
                          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>ROI</div>
                          <div style={{ fontSize: "24px", lineHeight: 1, fontWeight: 800, color: roiColor }}>
                            {Number.isFinite(roi) ? `${roi.toFixed(0)}%` : "—"}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative", flexShrink: 0 }}>
                          <DealStatusBadge status={deal.status} />
                          <button
                            onClick={() => setDealActionMenu(dealActionMenu === deal.id ? null : deal.id)}
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "8px",
                              border: "1px solid var(--border-subtle)",
                              background: "var(--bg-secondary)",
                              color: "var(--text-secondary)",
                              cursor: "pointer",
                              fontSize: "14px",
                              lineHeight: 1,
                            }}
                          >
                            •••
                          </button>
                          {dealActionMenu === deal.id && (
                            <div style={{ position: "absolute", top: "32px", right: 0, zIndex: 50, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "4px", minWidth: "132px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                              <button onClick={() => updateDealStatus(deal.id, "presented", "")} style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: "11px", textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: "var(--text-primary)", borderRadius: "4px" }}>↩ Back to New</button>
                              <button onClick={() => updateDealStatus(deal.id, "bought", "Bought manually")} style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: "11px", textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: "#8b5cf6", borderRadius: "4px" }}>🛒 Bought</button>
                              <button onClick={() => updateDealStatus(deal.id, "sold", "Sold")} style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: "11px", textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: "#26c97a", borderRadius: "4px" }}>💰 Sold</button>
                              <button onClick={() => updateDealStatus(deal.id, "passed", "Passed")} style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: "11px", textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: "#6b7280", borderRadius: "4px" }}>⏭ Passed</button>
                              <div style={{ height: "1px", background: "var(--border-subtle)", margin: "4px 0" }} />
                              <button onClick={() => { setDealActionMenu(null); deleteDeal(deal.id); }} style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: "11px", textAlign: "left", border: "none", cursor: "pointer", background: "transparent", color: "#f05b5b", borderRadius: "4px" }}>🗑 Delete</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr", gap: "10px", alignItems: "end" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>BUY</div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px", whiteSpace: "nowrap" }}>
                            {deal.buy_all_in != null ? fmt$(Number(deal.buy_all_in)) : "—"}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                            <span>{deal.buy_platform || "—"}</span>
                            {buyLink && (
                              <a href={buyLink} target="_blank" rel="noopener noreferrer" style={{ color: "#26c97a", textDecoration: "none", fontWeight: 600 }}>
                                🎟️ Buy
                              </a>
                            )}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>EST. PROFIT</div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: estimatedProfitPerTicket != null && estimatedProfitPerTicket >= 0 ? "#26c97a" : "#f05b5b", marginTop: "2px", whiteSpace: "nowrap" }}>
                            {estimatedProfitPerTicket != null ? fmt$(estimatedProfitPerTicket) : "—"}
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>per ticket @ 15% fee</div>
                        </div>

                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>QTY</div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                            {deal.quantity || "—"}
                          </div>
                        </div>
                      </div>

                      {deal.status === "presented" && (
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, minmax(0, 1fr))" : "repeat(3, minmax(70px, auto))", gap: "6px", justifyContent: isMobile ? undefined : "flex-end", width: "100%" }}>
                          <button onClick={() => updateDealStatus(deal.id, "bought", "Bought manually")} style={{ minWidth: 0, width: "100%", padding: "8px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, border: "none", cursor: "pointer", background: "#8b5cf618", color: "#8b5cf6" }}>Buy</button>
                          <button onClick={() => updateDealStatus(deal.id, "passed", "Passed")} style={{ minWidth: 0, width: "100%", padding: "8px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, border: "none", cursor: "pointer", background: "#6b728018", color: "#6b7280" }}>Pass</button>
                          <button onClick={() => updateDealStatus(deal.id, "missed", "Missed")} style={{ minWidth: 0, width: "100%", padding: "8px 8px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, border: "none", cursor: "pointer", background: "#f05b5b18", color: "#f05b5b" }}>Miss</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════ ACTIVE FLIPS TAB ════════ */}
      {activeTab === "flips" && <>
      {/* Stats bar — wraps on mobile */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 8 : 16, padding: isMobile ? "12px 14px" : "20px 24px", flexShrink: 0, borderBottom: "1px solid var(--border-subtle)" }}>
        <StatCard
          label="Active Flips"
          value={activeFlips.length.toString()}
          icon={Ticket}
        />
        <StatCard
          label="Total Invested"
          value={fmt$(totalInvested)}
          icon={DollarSign}
        />
        <StatCard
          label="Locked Profit"
          value={fmt$(lockedProfit)}
          icon={TrendingUp}
          valueColor={lockedProfit >= 0 ? "#26c97a" : "#f05b5b"}
        />
        <StatCard
          label="Avg ROI (sold)"
          value={soldFlips.length > 0 ? `${avgROI.toFixed(1)}%` : "—"}
          icon={Tag}
          valueColor={avgROI >= 0 ? "#26c97a" : "#f05b5b"}
        />
      </div>

      {/* Table / Cards */}
      <div className="fab-scroll-pad" style={{ flex: 1, overflow: "auto", padding: isMobile ? "12px 14px" : "0 24px 24px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, fontSize: 14, color: "var(--text-tertiary)" }}>Loading...</div>
        ) : flips.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 160, borderRadius: 12, border: "1px dashed var(--border-default)", gap: 8, color: "var(--text-muted)" }}>
            <Ticket size={28} style={{ opacity: 0.4 }} />
            <p style={{ fontSize: 14, margin: 0 }}>No flips yet — add your first one!</p>
          </div>
        ) : isMobile ? (
          /* ── Mobile: card layout ── */
          <div>
            {flips.map((flip) => (
              <MobileFlipCard
                key={flip.id}
                flip={flip}
                onEdit={() => setEditFlip(flip)}
                onSell={() => setSellFlip(flip)}
                onDelete={() => handleDelete(flip.id)}
              />
            ))}
          </div>
        ) : (
          /* ── Desktop: table layout ── */
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "EVENT",
                  "VENUE",
                  "SEC/ROW/QTY",
                  "BOUGHT",
                  "PLATFORMS",
                  "DAYS LEFT",
                  "STATUS",
                  "PROFIT",
                  "ROI",
                  "",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flips.map((flip) => {
                const status = computeStatus(flip);
                const profit = estimatedProfit(flip);
                const roi = estimatedROI(flip);
                return (
                  <tr
                    key={flip.id}
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* EVENT */}
                    <td style={tdStyle}>
                      <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                        {flip.eventName}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {new Date(flip.eventDate + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </td>

                    {/* VENUE */}
                    <td style={tdStyle}>
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {flip.venue || "—"}
                      </span>
                    </td>

                    {/* SEC/ROW/QTY */}
                    <td style={tdStyle}>
                      <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                        {[flip.section, flip.row].filter(Boolean).join(" · ") || "—"}
                        {" × "}
                        <span style={{ color: "var(--text-primary)" }}>{flip.quantity}</span>
                      </span>
                    </td>

                    {/* BOUGHT */}
                    <td style={tdStyle}>
                      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {flip.buyPlatform}
                      </div>
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {fmt$(flip.buyAllIn)}
                      </div>
                    </td>

                    {/* PLATFORMS */}
                    <td style={tdStyle}>
                      {flip.listings && flip.listings.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {flip.listings.map((listing: PlatformListing, li: number) => {
                            const color = PLATFORM_COLORS[listing.code] || "#888";
                            const statusIcon = listing.status === "sold" ? "✅" : listing.status === "delisted" ? "❌" : listing.status === "pending" ? "⏳" : "";
                            const timeStr = listing.listedAt
                              ? new Date(listing.listedAt).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()
                              : "—";
                            return (
                              <div key={li} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                                <span style={{ fontWeight: 700, color, width: "26px" }}>{listing.code}</span>
                                <button
                                  onClick={() => setPriceHistoryTarget({ flipId: flip.id, flipName: flip.eventName, platform: listing.platform || listing.code })}
                                  style={{ color: "var(--text-primary)", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textDecorationStyle: "dotted" as const, textUnderlineOffset: "3px", textDecorationColor: "var(--border-subtle)" }}
                                  title="View price history"
                                >
                                  {fmt$(listing.price)}
                                </button>
                                <span style={{ color: "var(--text-tertiary)" }}>{timeStr}</span>
                                <span>{statusIcon}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : flip.listPrice > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                          <span style={{ fontWeight: 700, color: "#26c97a", width: "26px" }}>SH</span>
                          <button
                            onClick={() => setPriceHistoryTarget({ flipId: flip.id, flipName: flip.eventName, platform: "StubHub" })}
                            style={{ color: "var(--text-primary)", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textDecorationStyle: "dotted" as const, textUnderlineOffset: "3px", textDecorationColor: "var(--border-subtle)" }}
                            title="View price history"
                          >
                            {fmt$(flip.listPrice)}
                          </button>
                          <span style={{ color: "var(--text-tertiary)" }}>—</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
                      )}
                      {/* Competitor floor info */}
                      {flip.competitor_floor != null && (
                        <div style={{ marginTop: 4, fontSize: "11px" }}>
                          {(() => {
                            const ourBuyer = (flip.listPrice || 0) * 1.10;
                            const isCompetitive = ourBuyer <= Number(flip.competitor_floor);
                            const checkTime = flip.last_competitor_check ? timeAgo(flip.last_competitor_check) : null;
                            return (
                              <>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ color: isCompetitive ? "#26c97a" : "#f0b429" }}>
                                    {isCompetitive ? "✅" : "⚠️"}
                                  </span>
                                  <span style={{ color: "var(--text-tertiary)" }}>Floor:</span>
                                  {flip.competitor_checkout_url ? (
                                    <a
                                      href={flip.competitor_checkout_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: isCompetitive ? "#26c97a" : "#f0b429", fontWeight: 600, textDecoration: "none" }}
                                      title="Buy competitor listing"
                                    >
                                      {fmt$(Number(flip.competitor_floor))}
                                    </a>
                                  ) : (
                                    <span style={{ color: isCompetitive ? "#26c97a" : "#f0b429", fontWeight: 600 }}>
                                      {fmt$(Number(flip.competitor_floor))}
                                    </span>
                                  )}
                                </div>
                                {checkTime && (
                                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, marginLeft: 18 }}>
                                    Checked {checkTime}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </td>

                    {/* DAYS LEFT */}
                    <td style={tdStyle}>
                      {flip.soldAt && flip.soldAt !== "null" ? (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Sold</span>
                      ) : (
                        <DaysLeft dateStr={flip.eventDate} />
                      )}
                    </td>

                    {/* STATUS */}
                    <td style={tdStyle}>
                      <StatusBadge status={status} />
                    </td>

                    {/* PROFIT */}
                    <td style={tdStyle}>
                      <span
                        className="text-sm font-medium"
                        style={{ color: profit >= 0 ? "#26c97a" : "#f05b5b" }}
                      >
                        {fmt$(profit)}
                      </span>
                      {flip.soldAt === null && (
                        <div className="text-xs" style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>
                          est.
                        </div>
                      )}
                    </td>

                    {/* ROI */}
                    <td style={tdStyle}>
                      <span
                        className="text-sm font-medium"
                        style={{ color: roi >= 0 ? "#26c97a" : "#f05b5b" }}
                      >
                        {roi.toFixed(1)}%
                      </span>
                    </td>

                    {/* ACTIONS */}
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditFlip(flip)}
                          title="Edit"
                          className="p-1.5 rounded"
                          style={{ color: "var(--text-tertiary)" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--text-primary)";
                            e.currentTarget.style.background = "var(--bg-elevated)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--text-tertiary)";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Pencil size={12} />
                        </button>

                        {!flip.soldAt && (
                          <button
                            onClick={() => setSellFlip(flip)}
                            title="Mark Sold"
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{
                              background: "#26c97a18",
                              color: "#26c97a",
                              fontSize: "0.65rem",
                            }}
                          >
                            Sold
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(flip.id)}
                          title="Delete"
                          className="p-1.5 rounded"
                          style={{ color: "var(--text-tertiary)" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#f05b5b";
                            e.currentTarget.style.background = "#f05b5b18";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--text-tertiary)";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* Extra bottom padding for mobile */}
      </>}

      {/* Modals */}
      {showAdd && (
        <FlipModal
          onClose={() => setShowAdd(false)}
          onSave={handleAdd}
        />
      )}

      {editFlip && (
        <FlipModal
          onClose={() => setEditFlip(null)}
          onSave={handleEdit}
          initial={editFlip}
        />
      )}

      {sellFlip && (
        <MarkSoldModal
          flip={sellFlip}
          onClose={() => setSellFlip(null)}
          onConfirm={(price) => handleMarkSold(sellFlip, price)}
        />
      )}

      {showAddWatch && (
        <WatchModal
          onClose={() => setShowAddWatch(false)}
          onSave={handleAddWatch}
        />
      )}

      {editWatch && (
        <WatchModal
          onClose={() => setEditWatch(null)}
          onSave={handleEditWatch}
          initial={editWatch}
        />
      )}

      {priceHistoryTarget && (
        <PriceHistoryModal
          flipId={priceHistoryTarget.flipId}
          flipName={priceHistoryTarget.flipName}
          platform={priceHistoryTarget.platform}
          onClose={() => setPriceHistoryTarget(null)}
        />
      )}
    </div>
  );
}
