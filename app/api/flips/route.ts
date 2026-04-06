import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function rowToFlip(r: Record<string, unknown>) {
  return {
    id: r.id,
    eventName: r.event_name,
    eventDate: r.event_date,
    venue: r.venue,
    section: r.section,
    row: r.row,
    quantity: r.quantity,
    buyPlatform: r.buy_platform,
    buyPrice: Number(r.buy_price),
    buyerFee: Number(r.buyer_fee),
    deliveryFee: Number(r.delivery_fee),
    buyAllIn: Number(r.buy_all_in),
    listPrice: Number(r.list_price),
    sellerFee: Number(r.seller_fee),
    status: r.status,
    purchasedAt: r.purchased_at,
    soldAt: r.sold_at,
    soldPrice: r.sold_price ? Number(r.sold_price) : null,
    profit: r.profit ? Number(r.profit) : null,
    roi: r.roi ? Number(r.roi) : null,
    notes: r.notes,
    listings: r.listings || [],
  };
}

export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM mc_flips ORDER BY event_date ASC`;
    return NextResponse.json(rows.map(rowToFlip));
  } catch (e) {
    console.error("GET /api/flips error:", e);
    return NextResponse.json({ error: "Failed to read flips" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sql = getDb();
    const id = Date.now().toString();
    const buyAllIn =
      body.buyPrice * (1 + (body.buyerFee ?? 0.3)) + (body.deliveryFee ?? 3.5);

    await sql`INSERT INTO mc_flips (id, event_name, event_date, venue, section, row, quantity, buy_platform, buy_price, buyer_fee, delivery_fee, buy_all_in, list_price, seller_fee, status, purchased_at, notes)
      VALUES (${id}, ${body.eventName || ""}, ${body.eventDate || ""}, ${body.venue || ""}, ${body.section || ""}, ${body.row || ""}, ${body.quantity || 1}, ${body.buyPlatform || "StubHub"}, ${body.buyPrice || 0}, ${body.buyerFee ?? 0.3}, ${body.deliveryFee ?? 3.5}, ${body.buyAllIn ?? buyAllIn}, ${body.listPrice || 0}, ${body.sellerFee ?? 0.15}, ${"active"}, ${new Date().toISOString()}, ${body.notes || ""})`;

    const flip = {
      id,
      eventName: body.eventName || "",
      eventDate: body.eventDate || "",
      venue: body.venue || "",
      section: body.section || "",
      row: body.row || "",
      quantity: body.quantity || 1,
      buyPlatform: body.buyPlatform || "StubHub",
      buyPrice: body.buyPrice || 0,
      buyerFee: body.buyerFee ?? 0.3,
      deliveryFee: body.deliveryFee ?? 3.5,
      buyAllIn: body.buyAllIn ?? buyAllIn,
      listPrice: body.listPrice || 0,
      sellerFee: body.sellerFee ?? 0.15,
      status: "active",
      purchasedAt: new Date().toISOString(),
      soldAt: null,
      soldPrice: null,
      profit: null,
      roi: null,
      notes: body.notes || "",
    };

    return NextResponse.json(flip, { status: 201 });
  } catch (e) {
    console.error("POST /api/flips error:", e);
    return NextResponse.json({ error: "Failed to create flip" }, { status: 500 });
  }
}
