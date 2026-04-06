"use client";

import { useState, useEffect } from "react";
import { Save, Settings, Percent, DollarSign, Clock } from "lucide-react";

interface ScannerRules {
  scanner_enabled: boolean;
  top_events_enabled: boolean;
  scan_frequency_min: number;
  min_roi: number;
  min_completed_sales: number;
  sales_window_days: number;
  max_sales_used: number;
  min_hours_out: number;
  max_days_out: number;
  floor_divergence_flag: number;
  seller_fee: number;
  stubhub_seller_fee: number;
  vivid_seller_fee: number;
  seatgeek_seller_fee: number;
  stubhub_buyer_fee: number;
  tickpick_buyer_fee: number;
  seatgeek_buyer_fee: number;
  vivid_buyer_fee: number;
  gametime_buyer_fee: number;
  auto_buy_enabled: boolean;
  auto_buy_min_roi: number;
  auto_buy_min_sales: number;
  auto_buy_max_cost: number;
  auto_buy_min_days_out: number;
  auto_buy_max_days_out: number;
  auto_list_undercut_mode: 'percent' | 'dollars';
  auto_list_undercut_pct: number;
  auto_list_undercut_dollars: number;
}

export default function ScannerRulesPage() {
  const [rules, setRules] = useState<ScannerRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    try {
      const res = await fetch("/api/scanner-rules");
      const data = await res.json();
      setRules(data.rules);
    } catch (e) {
      console.error("Failed to load rules:", e);
    } finally {
      setLoading(false);
    }
  }

  async function saveRules() {
    if (!rules) return;
    setSaving(true);
    try {
      await fetch("/api/scanner-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save rules:", e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading rules...</div>
      </div>
    );
  }

  if (!rules) {
    return <div className="text-gray-400">Failed to load rules</div>;
  }

  const update = (key: keyof ScannerRules, value: any) => {
    setRules({ ...rules, [key]: value });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Settings className="text-blue-400" size={24} />
          <h1 className="text-2xl font-bold text-white">Scanner Rules</h1>
        </div>
        <button
          onClick={saveRules}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
            saved
              ? "bg-green-600 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          }`}
        >
          <Save size={18} />
          {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Scanner Status */}
        <section className="bg-[#0f0f0f] border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Scanner Status</h2>
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.scanner_enabled}
                onChange={(e) => update("scanner_enabled", e.target.checked)}
                className="w-5 h-5 rounded border-white/20 bg-[#1a1a1a] text-blue-500 focus:ring-blue-500"
              />
              <span className="text-white">Scanner Enabled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.top_events_enabled}
                onChange={(e) => update("top_events_enabled", e.target.checked)}
                className="w-5 h-5 rounded border-white/20 bg-[#1a1a1a] text-blue-500 focus:ring-blue-500"
              />
              <span className="text-white">Top Events Enabled</span>
            </label>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Scan Frequency (minutes)
            </label>
            <input
              type="number"
              className="bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white w-32 focus:outline-none focus:border-blue-500"
              value={rules.scan_frequency_min}
              onChange={(e) => update("scan_frequency_min", parseInt(e.target.value))}
            />
          </div>
        </section>

        {/* Deal Thresholds */}
        <section className="bg-[#0f0f0f] border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Percent size={20} className="text-blue-400" />
            Deal Thresholds
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Min ROI (%)</label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={rules.min_roi}
                onChange={(e) => update("min_roi", parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Min Completed Sales</label>
              <input
                type="number"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={rules.min_completed_sales}
                onChange={(e) => update("min_completed_sales", parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Sales Window (days)</label>
              <input
                type="number"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={rules.sales_window_days}
                onChange={(e) => update("sales_window_days", parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Max Sales Used</label>
              <input
                type="number"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={rules.max_sales_used}
                onChange={(e) => update("max_sales_used", parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Min Hours Out</label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={rules.min_hours_out}
                onChange={(e) => update("min_hours_out", parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Max Days Out</label>
              <input
                type="number"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={rules.max_days_out}
                onChange={(e) => update("max_days_out", parseInt(e.target.value))}
              />
            </div>
          </div>
        </section>

        {/* Platform Fees */}
        <section className="bg-[#0f0f0f] border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-green-400" />
            Platform Fees
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-300 mb-3">Buyer Fees</h3>
              <div className="space-y-3">
                {[
                  { key: "stubhub_buyer_fee", label: "StubHub" },
                  { key: "tickpick_buyer_fee", label: "TickPick" },
                  { key: "seatgeek_buyer_fee", label: "SeatGeek" },
                  { key: "vivid_buyer_fee", label: "Vivid" },
                  { key: "gametime_buyer_fee", label: "Gametime" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-gray-400">{label}</span>
                    <input
                      type="number"
                      step="0.01"
                      className="bg-[#1a1a1a] border border-white/10 rounded px-3 py-1 text-white w-24 focus:outline-none focus:border-blue-500"
                      value={rules[key as keyof ScannerRules] as number}
                      onChange={(e) => update(key as keyof ScannerRules, parseFloat(e.target.value))}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-300 mb-3">Seller Fees</h3>
              <div className="space-y-3">
                {[
                  { key: "seller_fee", label: "Default" },
                  { key: "stubhub_seller_fee", label: "StubHub" },
                  { key: "vivid_seller_fee", label: "Vivid" },
                  { key: "seatgeek_seller_fee", label: "SeatGeek" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-gray-400">{label}</span>
                    <input
                      type="number"
                      step="0.01"
                      className="bg-[#1a1a1a] border border-white/10 rounded px-3 py-1 text-white w-24 focus:outline-none focus:border-blue-500"
                      value={rules[key as keyof ScannerRules] as number}
                      onChange={(e) => update(key as keyof ScannerRules, parseFloat(e.target.value))}
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Auto-List Settings */}
        <section className="bg-[#0f0f0f] border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={20} className="text-purple-400" />
            Auto-List Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Undercut Mode</label>
              <select
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={rules.auto_list_undercut_mode}
                onChange={(e) => update("auto_list_undercut_mode", e.target.value)}
              >
                <option value="percent">Percent</option>
                <option value="dollars">Dollars</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Undercut Percent</label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={rules.auto_list_undercut_pct}
                onChange={(e) => update("auto_list_undercut_pct", parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Undercut Dollars</label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                value={rules.auto_list_undercut_dollars}
                onChange={(e) => update("auto_list_undercut_dollars", parseFloat(e.target.value))}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
