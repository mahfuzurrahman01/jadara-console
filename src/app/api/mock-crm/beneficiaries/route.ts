import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

// Mock external "beneficiary CRM". Stands in for the tenant's real system so the
// integration executor has a real endpoint to call end to end.
// Protected by a static bearer token (MOCK_CRM_TOKEN).

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const token = env.mockCrmToken;
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  if (!token || provided !== token) {
    return unauthorized();
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const record = {
    name: typeof body.name === "string" ? body.name : null,
    income: typeof body.income === "number" ? body.income : null,
    district: typeof body.district === "string" ? body.district : null,
    children_under_18:
      typeof body.children_under_18 === "number" ? body.children_under_18 : null,
    has_national_id:
      typeof body.has_national_id === "boolean" ? body.has_national_id : null,
    payload: body,
  };

  const { data, error } = await supabaseAdmin()
    .from("mock_beneficiaries")
    .insert(record)
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { id: data.id, created_at: data.created_at, status: "created" },
    { status: 201 },
  );
}
