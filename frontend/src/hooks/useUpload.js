import { useState, useCallback } from "react";
import axios from "axios";

/**
 * useUpload - handles PDF upload with progress tracking
 * Returns: { upload, progress, uploading, error, result }
 */
export function useUpload(userId) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const upload = useCallback(
    async (file) => {
      if (!file) return;
      setUploading(true);
      setError(null);
      setResult(null);
      setProgress(0);

      const formData = new FormData();
      formData.append("user_id", userId);
      formData.append("file", file);

      const token = localStorage.getItem("access_token");

      try {
        const res = await axios.post("/api/documents/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded * 100) / (e.total || 1));
            setProgress(pct);
          },
        });
        setResult(res.data);
        setProgress(100);
        return res.data;
      } catch (err) {
        const msg = err.response?.data?.detail || "Upload failed.";
        setError(msg);
        throw new Error(msg);
      } finally {
        setUploading(false);
      }
    },
    [userId]
  );

  return { upload, progress, uploading, error, result };
}
