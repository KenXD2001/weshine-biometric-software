import React, { useState } from "react";
import { uploadCandidateZIP } from "../helpers/api"; // reuse existing API
import { toast } from "sonner";

interface UploadCandidateDataProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

const UploadCandidateData: React.FC<UploadCandidateDataProps> = ({
  show,
  onClose,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ file?: string }>({});
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrors({});
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }
    setSelectedFile(files[0]);
  };

  const submitFile = async () => {
    if (!selectedFile) {
      setErrors({ file: "File is required" });
      return;
    }
    setIsUploading(true);

    const result = (await uploadCandidateZIP(selectedFile)) as any;
    setIsUploading(false);

    if (result.successful) {
      toast.success(result.message);
      onSuccess(result);
      handleClose();
    } else {
      // Show all error details in toast and below file input
      let errorMsg = result.message || result.error || "Upload failed.";
      if (result.error) {
        errorMsg += `\nDetails: ${result.error}`;
      }
      toast.error(errorMsg);
      const lines = errorMsg.split("|").map((l: string) => l.trim());
      const formatted = lines.map((l: string) => `- ${l}`).join("\n");
      setErrors({ file: formatted });
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setErrors({});
    onClose();
  };

  if (!show) return null;

  return (
    <div
      className="modal fade show cs-modal"
      style={{ display: "block", backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      tabIndex={-1}
    >
      <div className="modal-dialog cs-modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Upload File</h5>
            <button type="button" className="btn-close" onClick={handleClose}></button>
          </div>
          <div className="modal-body">
            <div className="col-lg-12 fv-row">
              <label className="required">Select file to upload</label>
              <input
                name="file"
                type="file"
                className="file-upload-field"
                style={{
                  width: "100%",
                  border: "1px solid #dbdbdb",
                }}
                onChange={handleFileChange}
              />
              {errors.file && (
                <p className="text-danger small mt-1">{errors.file}</p>
              )}
              <div className="mt-2 mx-2" style={{ display: "flex" }}>
                <p className="mx-1">
                  <span style={{ fontWeight: "bold" }}>
                    Allowed File size:
                  </span>
                  min 10KB, max 100MB
                </p>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isUploading}
              onClick={submitFile}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { UploadCandidateData };
