import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, BUCKET_NAME } from "@/lib/supabaseAdmin";

// READ (single file): return a short-lived signed URL to download it
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: row, error } = await supabaseAdmin
    .from("files_metadata")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const { data, error: signError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(row.storage_path, 60); // valid for 60 seconds

  if (signError || !data) {
    return NextResponse.json(
      { error: signError?.message || "Could not create signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: data.signedUrl, filename: row.filename });
}

// UPDATE: replace the uploaded_by field (simple metadata edit from the UI)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { uploaded_by } = body;

  if (!uploaded_by) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("files_metadata")
    .update({ uploaded_by })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE: remove from Storage and the metadata table
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: row, error } = await supabaseAdmin
    .from("files_metadata")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await supabaseAdmin.storage.from(BUCKET_NAME).remove([row.storage_path]);
  await supabaseAdmin.from("files_metadata").delete().eq("id", params.id);

  return NextResponse.json({ success: true });
}
