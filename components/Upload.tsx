"use client";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileImage, Plus } from "lucide-react";
export default function Upload({
  onFiles,
  disabled,
  onError,
}: {
  onFiles: (files: File[]) => void;
  disabled: boolean;
  onError: (s: string) => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    disabled,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    maxSize: 20 * 1024 * 1024,
    onDrop: (accepted) => onFiles(accepted),
    onDropRejected: (files) =>
      onError(
        files
          .map(
            ({ file, errors }) =>
              `${file.name}: ${errors.some((e) => e.code === "file-too-large") ? "Ảnh vượt quá 20 MB." : "Chỉ nhận JPG hoặc PNG. Nếu là HEIC, hãy chuyển sang JPG hoặc PNG."}`,
          )
          .join(" "),
      ),
  });
  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
    >
      <input
        {...getInputProps()}
        style={{ display: "none" }}
        aria-label="Chọn ảnh tài liệu"
      />
      <div className="upload-icon">
        <UploadCloud size={30} />
      </div>
      <h3>
        {isDragActive ? "Thả ảnh vào đây" : "Kéo thả ảnh tài liệu vào đây"}
      </h3>
      <p>hoặc chọn ảnh từ thiết bị của bạn</p>
      <span className="primary">
        <Plus size={18} /> Chọn ảnh tài liệu
      </span>
      <div className="file-note">
        <FileImage size={15} /> JPG, PNG · Tối đa 20 MB/ảnh · 20 ảnh/lượt
      </div>
    </div>
  );
}
