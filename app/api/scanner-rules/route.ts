import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS mc_scanner_rules (
      id TEXT PRIMARY KEY DEFAULT 'default',
      min_roi NUMERIC DEFAULT 20,
      min_completed_sales INTEGER DEFAULT 3,
      sales_window_days INTEGER DEFAULT 7,
      max_sales_used INTEGER DEFAULT 15,
      min_hours_out NUMERIC DEFAULT 48,
      max_days_out INTEGER DEFAULT 9999,
      floor_divergence_flag NUMERIC DEFAULT 0.50,
      seller_fee NUMERIC DEFAULT 0.15,
      stubhub_buyer_fee NUMERIC DEFAULT 0.30,
      tickpick_buyer_fee NUMERIC DEFAULT 0,
      seatgeek_buyer_fee NUMERIC DEFAULT 0.20,
      vivid_buyer_fee NUMERIC DEFAULT 0.25,
      gametime_buyer_fee NUMERIC DEFAULT 0.15,
      scan_frequency_min INTEGER DEFAULT 20,
      auto_buy_enabled BOOLEAN DEFAULT FALSE,
      auto_buy_min_roi NUMERIC DEFAULT 40,
      auto_buy_min_sales INTEGER DEFAULT 5,
      auto_buy_max_cost NUMERIC DEFAULT 200,
      auto_buy_min_days_out INTEGER DEFAULT 7,
      auto_buy_max_days_out INTEGER DEFAULT 60,
      max_auto_reprice_pct NUMERIC DEFAULT 30,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`INSERT INTO mc_scanner_rules (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`;
}

export async function GET() {
  try {
    await ensureTable();
    const sql = getDb();
    const rows = await sql`SELECT * FROM mc_scanner_rules WHERE id = 'default'`;
    return NextResponse.json({ rules: rows[0] || null });
  } catch (e) {
    console.error("GET /api/scanner-rules error:", e);
    return NextResponse.json({ error: "Failed to load rules" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureTable();
    const sql = getDb();
    const body = await req.json();

    // Update each field that's provided
    // Update all provided fields in one query
    await sql`
      UPDATE mc_scanner_rules SET
        min_roi = COALESCE(${body.min_roi ?? null}, min_roi),
        min_completed_sales = COALESCE(${body.min_completed_sales ?? null}, min_completed_sales),
        sales_window_days = COALESCE(${body.sales_window_days ?? null}, sales_window_days),
        max_sales_used = COALESCE(${body.max_sales_used ?? null}, max_sales_used),
        min_hours_out = COALESCE(${body.min_hours_out ?? null}, min_hours_out),
        max_days_out = COALESCE(${body.max_days_out ?? null}, max_days_out),
        floor_divergence_flag = COALESCE(${body.floor_divergence_flag ?? null}, floor_divergence_flag),
        seller_fee = COALESCE(${body.seller_fee ?? null}, seller_fee),
        stubhub_buyer_fee = COALESCE(${body.stubhub_buyer_fee ?? null}, stubhub_buyer_fee),
        tickpick_buyer_fee = COALESCE(${body.tickpick_buyer_fee ?? null}, tickpick_buyer_fee),
        seatgeek_buyer_fee = COALESCE(${body.seatgeek_buyer_fee ?? null}, seatgeek_buyer_fee),
        vivid_buyer_fee = COALESCE(${body.vivid_buyer_fee ?? null}, vivid_buyer_fee),
        gametime_buyer_fee = COALESCE(${body.gametime_buyer_fee ?? null}, gametime_buyer_fee),
        scan_frequency_min = COALESCE(${body.scan_frequency_min ?? null}, scan_frequency_min),
        auto_buy_enabled = COALESCE(${body.auto_buy_enabled ?? null}, auto_buy_enabled),
        auto_buy_min_roi = COALESCE(${body.auto_buy_min_roi ?? null}, auto_buy_min_roi),
        auto_buy_min_sales = COALESCE(${body.auto_buy_min_sales ?? null}, auto_buy_min_sales),
        auto_buy_max_cost = COALESCE(${body.auto_buy_max_cost ?? null}, auto_buy_max_cost),
        auto_buy_min_days_out = COALESCE(${body.auto_buy_min_days_out ?? null}, auto_buy_min_days_out),
        auto_buy_max_days_out = COALESCE(${body.auto_buy_max_days_out ?? null}, auto_buy_max_days_out),
        auto_list_enabled = COALESCE(${body.auto_list_enabled ?? null}, auto_list_enabled),
        auto_list_platforms = COALESCE(${body.auto_list_platforms ?? null}, auto_list_platforms),
        auto_list_undercut_pct = COALESCE(${body.auto_list_undercut_pct ?? null}, auto_list_undercut_pct),
        scanner_enabled = COALESCE(${body.scanner_enabled ?? null}, scanner_enabled),
        top_events_enabled = COALESCE(${body.top_events_enabled ?? null}, top_events_enabled),
        auto_buy_cost_type = COALESCE(${body.auto_buy_cost_type ?? null}, auto_buy_cost_type),
        auto_buy_cost_includes_fees = COALESCE(${body.auto_buy_cost_includes_fees ?? null}, auto_buy_cost_includes_fees),
        auto_list_undercut_mode = COALESCE(${body.auto_list_undercut_mode ?? null}, auto_list_undercut_mode),
        auto_list_undercut_dollars = COALESCE(${body.auto_list_undercut_dollars ?? null}, auto_list_undercut_dollars),
        stubhub_seller_fee = COALESCE(${body.stubhub_seller_fee ?? null}, stubhub_seller_fee),
        vivid_seller_fee = COALESCE(${body.vivid_seller_fee ?? null}, vivid_seller_fee),
        seatgeek_seller_fee = COALESCE(${body.seatgeek_seller_fee ?? null}, seatgeek_seller_fee),
        max_auto_reprice_pct = COALESCE(${body.max_auto_reprice_pct ?? null}, max_auto_reprice_pct),
        updated_at = NOW()
      WHERE id = 'default'
    `;

    // Return updated rules
    const rows = await sql`SELECT * FROM mc_scanner_rules WHERE id = 'default'`;
    return NextResponse.json({ rules: rows[0] });
  } catch (e) {
    console.error("PATCH /api/scanner-rules error:", e);
    return NextResponse.json({ error: "Failed to update rules" }, { status: 500 });
  }
}
