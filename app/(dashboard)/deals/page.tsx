"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Calendar, MapPin, DollarSign, Filter } from "lucide-react";

interface Deal {
  id: number;
  deal_id: string;
  event_name: string;
  event_date: string;
  event_time: string;
  venue: string;
  zone: string;
  section: string;
  row: string;
  quantity: number;
  buy_price: number;
  buy_platform: string;
  buy_all_in: number;
  sell_benchmark: number;
  sell_benchmark_source: string;
  roi_pct: number;
  profit_est: number;
  status: 'presented' | 'bought' | 'passed' | 'expired';
  buy_url: string | null;
  event_url: string | null;
  found_at: string;
}

function fmt$(n: number | null) {
  if (n === null) return "$—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function daysUntil(dateStr: string): number {
  const event = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchDeals();
  }, []);

  async function fetchDeals() {
    try {
      const url = filter === "all" ? "/api/deals" : `/api/deals?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setDeals(data.deals || []);
    } catch (e) {
      console.error("Failed to load deals:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDeals();
  }, [filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading deals...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Deal Log</h1>
        <div className="flex items-center gap-3">
          <Filter className="text-gray-400" size={18} />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Deals</option>
            <option value="presented">Presented</option>
            <option value="bought">Bought</option>
            <option value="passed">Passed</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      <div className="bg-[#0f0f0f] border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#1a1a1a]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Event</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Zone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Buy</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Benchmark</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ROI</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Found</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {deals.map((deal) => (
              <tr key={deal.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{deal.event_name}</div>
                  <div className="flex items-center gap-1 text-sm text-gray-400 mt-1">
                    <Calendar size={12} />
                    {deal.event_date}
                    <span className="text-gray-500">({daysUntil(deal.event_date)} days)</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{deal.zone}</div>
                  <div className="text-sm text-gray-400">Sec {deal.section}, Row {deal.row}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{fmt$(deal.buy_all_in)}</div>
                  <div className="text-sm text-gray-400">{deal.buy_platform}</div>
                </td>
                <td className="px-4 py-3 text-white">
                  {fmt$(deal.sell_benchmark)}
                </td>
                <td className="px-4 py-3">
                  <div className={`font-medium ${deal.roi_pct > 20 ? "text-green-400" : "text-gray-400"}`}>
                    {deal.roi_pct.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-400">{fmt$(deal.profit_est)}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    deal.status === 'bought' ? 'bg-green-500/20 text-green-400' :
                    deal.status === 'passed' ? 'bg-gray-500/20 text-gray-400' :
                    deal.status === 'expired' ? 'bg-red-500/20 text-red-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {deal.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {new Date(deal.found_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deals.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No deals found
          </div>
        )}
      </div>
    </div>
  );
}
