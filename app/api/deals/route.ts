import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS mc_deal_log (
      id SERIAL PRIMARY KEY,
      deal_id TEXT UNIQUE,
      event_name TEXT NOT NULL,
      event_date TEXT,
      event_time TEXT,
      venue TEXT,
      zone TEXT,
      section TEXT,
      row TEXT,
      quantity INTEGER,
      buy_price NUMERIC,
      buy_platform TEXT,
      buy_all_in NUMERIC,
      sell_benchmark NUMERIC,
      sell_benchmark_source TEXT,
      roi_pct NUMERIC,
      profit_est NUMERIC,
      source TEXT DEFAULT 'scanner',
      status TEXT DEFAULT 'presented',
      action_taken TEXT,
      buy_actual NUMERIC,
      sell_price NUMERIC,
      sell_platform TEXT,
      sell_date TIMESTAMPTZ,
      profit_actual NUMERIC,
      notes TEXT,
      scanner_data JSONB,
      found_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(req: Request) {
  try {
    await ensureTable();
    const sql = getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "200");

    let rows;
    if (status) {
      rows = await sql`
        SELECT * FROM mc_deal_log
        WHERE status = ${status}
        ORDER BY found_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM mc_deal_log
        ORDER BY found_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ deals: rows });
  } catch (e) {
    console.error("GET /api/deals error:", e);
    return NextResponse.json({ error: "Failed to load deals" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable();
    const sql = getDb();
    const body = await req.json();

    const rows = await sql`
      INSERT INTO mc_deal_log (
        deal_id, event_name, event_date, event_time, venue, zone, section, row,
        quantity, buy_price, buy_platform, buy_all_in, sell_benchmark,
        sell_benchmark_source, roi_pct, profit_est, source, status, buy_method,
        scanner_data, buy_url, event_url, stubhub_event_id
      ) VALUES (
        ${body.deal_id}, ${body.event_name}, ${body.event_date}, ${body.event_time || null},
        ${body.venue || null}, ${body.zone || null}, ${body.section || null}, ${body.row || null},
        ${body.quantity || null}, ${body.buy_price || null}, ${body.buy_platform || null},
        ${body.buy_all_in || null}, ${body.sell_benchmark || null},
        ${body.sell_benchmark_source || null}, ${body.roi_pct || null}, ${body.profit_est || null},
        ${body.source || 'scanner'}, ${body.status || 'presented'},
        ${body.buy_method || 'manual'},
        ${body.scanner_data ? JSON.stringify(body.scanner_data) : null},
        ${body.buy_url || null},
        ${body.event_url || null},
        ${body.stubhub_event_id || null}
      )
      ON CONFLICT (deal_id) DO UPDATE SET
        sell_benchmark = COALESCE(EXCLUDED.sell_benchmark, mc_deal_log.sell_benchmark),
        roi_pct = COALESCE(EXCLUDED.roi_pct, mc_deal_log.roi_pct),
        updated_at = NOW()
      RETURNING *
    `;

    return NextResponse.json({ deal: rows[0] });
  } catch (e) {
    console.error("POST /api/deals error:", e);
    return NextResponse.json({ error: "Failed to log deal" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTable();
    const sql = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await sql`DELETE FROM mc_deal_log WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/deals error:", e);
    return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureTable();
    const sql = getDb();
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Build dynamic update
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      await sql`UPDATE mc_deal_log SET status = ${updates.status}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (updates.action_taken !== undefined) {
      await sql`UPDATE mc_deal_log SET action_taken = ${updates.action_taken}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (updates.buy_actual !== undefined) {
      await sql`UPDATE mc_deal_log SET buy_actual = ${updates.buy_actual}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (updates.sell_price !== undefined) {
      await sql`UPDATE mc_deal_log SET sell_price = ${updates.sell_price}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (updates.sell_platform !== undefined) {
      await sql`UPDATE mc_deal_log SET sell_platform = ${updates.sell_platform}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (updates.sell_date !== undefined) {
      await sql`UPDATE mc_deal_log SET sell_date = ${updates.sell_date}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (updates.profit_actual !== undefined) {
      await sql`UPDATE mc_deal_log SET profit_actual = ${updates.profit_actual}, updated_at = NOW() WHERE id = ${id}`;
    }
    if (updates.notes !== undefined) {
      await sql`UPDATE mc_deal_log SET notes = ${updates.notes}, updated_at = NOW() WHERE id = ${id}`;
    }

    const rows = await sql`SELECT * FROM mc_deal_log WHERE id = ${id}`;
    return NextResponse.json({ deal: rows[0] });
  } catch (e) {
    console.error("PATCH /api/deals error:", e);
    return NextResponse.json({ error: "Failed to update deal" }, { status: 500 });
  }
}
