import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, BUCKET_NAME } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

// READ: list all files
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("files_metadata")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// CREATE: upload a file, validate it via the Edge Function, insert metadata
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const uploadedBy = (formData.get("uploadedBy") as string) || "anonymous";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mimetype = file.type || "application/octet-stream";

  // 1. Ask the Edge Function to validate BEFORE uploading anything
  let validation: { valid: boolean; notes: string } = {
    valid: true,
    notes: "Edge Function not reachable — validation skipped",
  };
  try {
    const resp = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/validate-file`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          mimetype,
        }),
      }
    );
    if (resp.ok) {
      validation = await resp.json();
    }
  } catch (err) {
    console.error("Edge Function call failed:", err);
  }

  if (!validation.valid) {
    return NextResponse.json(
      { error: `File rejected by validation: ${validation.notes}` },
      { status: 400 }
    );
  }

  // 2. Upload the bytes to Storage
  const storagePath = `${randomUUID()}_${file.name}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(storagePath, arrayBuffer, { contentType: mimetype });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // 3. Insert the metadata row
  const { data, error: insertError } = await supabaseAdmin
    .from("files_metadata")
    .insert({
      filename: file.name,
      storage_path: storagePath,
      uploaded_by: uploadedBy,
      file_type: mimetype,
      file_size: file.size,
      validated: validation.valid,
      validation_notes: validation.notes,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
