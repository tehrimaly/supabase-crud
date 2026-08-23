"use client";

import { useEffect, useState, FormEvent } from "react";

type FileRow = {
  id: string;
  filename: string;
  storage_path: string;
  uploaded_by: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  validated: boolean;
  validation_notes: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedBy, setUploadedBy] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function loadFiles() {
    setLoading(true);
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      setFiles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("uploadedBy", uploadedBy || "anonymous");

    try {
      const res = await fetch("/api/files", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setSelectedFile(null);
      (document.getElementById("file-input") as HTMLInputElement).value = "";
      await loadFiles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/files/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Download failed");
      window.open(data.url, "_blank");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this file? This can't be undone.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await loadFiles();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(row: FileRow) {
    setEditingId(row.id);
    setEditValue(row.uploaded_by || "");
  }

  async function saveEdit(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploaded_by: editValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEditingId(null);
      await loadFiles();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h1 className="title">Supabase File Manager</h1>
      <p className="subtitle">
        Upload, view, and manage files. Every upload is validated server-side
        by a Supabase Edge Function before it's stored.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h2>Upload a file</h2>
        <form className="upload-form" onSubmit={handleUpload}>
          <input
            id="file-input"
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
          <input
            type="text"
            placeholder="Uploaded by (name/email)"
            value={uploadedBy}
            onChange={(e) => setUploadedBy(e.target.value)}
          />
          <button type="submit" disabled={!selectedFile || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Files ({files.length})</h2>
        {loading ? (
          <div className="empty">Loading...</div>
        ) : files.length === 0 ? (
          <div className="empty">No files uploaded yet.</div>
        ) : (
          files.map((row) => (
            <div className="file-row" key={row.id}>
              <div className="file-info">
                <div className="file-name">
                  {row.filename}
                  <span className={`badge ${row.validated ? "valid" : "invalid"}`}>
                    {row.validated ? "validated" : "flagged"}
                  </span>
                </div>
                {editingId === row.id ? (
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{ padding: "4px 8px", fontSize: 12 }}
                    />
                    <button
                      className="ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => saveEdit(row.id)}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="file-meta">
                    {formatSize(row.file_size)} · uploaded by {row.uploaded_by} ·{" "}
                    {new Date(row.uploaded_at).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="file-actions">
                <button className="ghost" onClick={() => handleDownload(row.id)}>
                  Download
                </button>
                <button className="ghost" onClick={() => startEdit(row)}>
                  Edit
                </button>
                <button className="danger" onClick={() => handleDelete(row.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
