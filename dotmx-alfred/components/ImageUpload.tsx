'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { uploadTokenIcon } from '@/services/upload';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onError?: (error: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function ImageUpload({
  value,
  onChange,
  onError,
  placeholder = 'Upload image',
  className = '',
  disabled = false
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);

    // Create local preview
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    try {
      const url = await uploadTokenIcon(file);
      setPreviewUrl(url);
      onChange(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      onError?.(message);
      // Revert to previous value on error
      setPreviewUrl(value || null);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }, [value, onChange, onError]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled, isUploading, handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input so the same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      inputRef.current?.click();
    }
  }, [disabled, isUploading]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setError(null);
    onChange('');
  }, [onChange]);

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
        onChange={handleChange}
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      <div
        onClick={handleClick}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative w-full h-32 rounded-xl border-2 border-dashed transition-all duration-200
          flex items-center justify-center cursor-pointer
          ${dragActive 
            ? 'border-white bg-zinc-800/50' 
            : 'border-zinc-800 hover:border-zinc-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-900/50' : ''}
        `}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            <span className="text-xs text-zinc-500">Uploading...</span>
          </div>
        ) : previewUrl ? (
          <div className="relative w-full h-full p-4 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/80 hover:bg-red-950/80 text-zinc-400 hover:text-red-400 transition-all"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center">
              {dragActive ? (
                <Upload className="w-6 h-6" />
              ) : (
                <ImageIcon className="w-6 h-6" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-400">{placeholder}</p>
              <p className="text-xs text-zinc-600 mt-1">
                PNG, JPEG, WebP, or SVG up to 5MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
