import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { 
  Paperclip, 
  FileSpreadsheet, 
  FileText, 
  Music, 
  File, 
  Download, 
  Trash2, 
  Plus, 
  Image as ImageIcon,
  Loader2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || (!import.meta.env.PROD ? 'http://localhost:3001' : '');

export default function FileAttachmentsSection({ taskId, projectId, attachments = [], canEdit = true }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ filename, fileData, fileType }) => {
      const res = await api.post(`/projects/${projectId}/tasks/${taskId}/attachments`, {
        filename,
        fileData,
        fileType
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success('Attachment uploaded successfully!');
      setIsUploading(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to upload attachment');
      setIsUploading(false);
    }
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId) => {
      const res = await api.delete(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success('Attachment deleted');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to delete attachment');
    }
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds 15MB limit');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result;
      uploadAttachmentMutation.mutate({
        filename: file.name,
        fileData: base64Data,
        fileType: file.type || 'application/octet-stream'
      });
    };
    reader.onerror = () => {
      toast.error('Error reading file');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  const getFileIcon = (fileType, filename = '') => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (['xlsx', 'xls', 'csv'].includes(ext) || fileType.includes('spreadsheet') || fileType.includes('csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    }
    if (['pdf', 'docx', 'doc', 'txt'].includes(ext) || fileType.includes('pdf') || fileType.includes('word') || fileType.includes('text')) {
      return <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
    if (['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'].includes(ext) || fileType.includes('audio')) {
      return <Music className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || fileType.includes('image')) {
      return <ImageIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFullFileUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_BASE}${path}`;
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-[#E8E4DD] dark:border-white/10 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[#E63B2E]" />
          <h3 className="font-mono text-xs text-black/60 dark:text-white/60 uppercase tracking-widest font-bold">
            Attachments ({attachments.length})
          </h3>
        </div>

        {canEdit && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.mp3,.wav,.m4a,.ogg,.aac,.txt,.png,.jpg,.jpeg,.gif,.webp"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="btn-brutal bg-[#F5F3EE] dark:bg-white/10 text-black dark:text-white text-xs px-3 py-1.5 rounded-xl border border-[#E8E4DD] dark:border-white/10 hover:border-black dark:hover:border-white flex items-center gap-1.5 font-medium transition-all disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Attach File</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-black/40 dark:text-white/40 italic font-mono text-xs text-center py-4 bg-[#F5F3EE] dark:bg-white/5 rounded-xl border border-dashed border-[#E8E4DD] dark:border-white/10">
          No files attached yet. (Supports Excel, CSV, PDF, Word, Audio & Images)
        </p>
      ) : (
        <div className="space-y-3">
          {attachments.map((att) => {
            const ext = att.filename.split('.').pop()?.toLowerCase();
            const isAudio = ['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext) || att.fileType?.includes('audio');
            const fileUrl = getFullFileUrl(att.fileUrl);

            return (
              <div
                key={att.id}
                className="bg-[#F5F3EE] dark:bg-white/5 p-3 rounded-xl border border-[#E8E4DD] dark:border-white/10 flex flex-col gap-2 transition-all hover:border-black/30 dark:hover:border-white/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-white dark:bg-black/40 border border-[#E8E4DD] dark:border-white/10 shrink-0">
                      {getFileIcon(att.fileType, att.filename)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-sans text-xs font-semibold text-black dark:text-white truncate" title={att.filename}>
                        {att.filename}
                      </h4>
                      <p className="text-[10px] font-mono text-black/50 dark:text-white/50">
                        {formatFileSize(att.fileSize)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={fileUrl}
                      download={att.filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition-colors"
                      title="Download File"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {canEdit && (
                      <button
                        onClick={() => deleteAttachmentMutation.mutate(att.id)}
                        disabled={deleteAttachmentMutation.isPending}
                        className="p-1.5 rounded-lg text-black/40 dark:text-white/40 hover:text-signal-red hover:bg-white dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                        title="Delete Attachment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline HTML5 Audio Player for audio files */}
                {isAudio && (
                  <div className="mt-1 pt-2 border-t border-[#E8E4DD]/60 dark:border-white/10">
                    <audio
                      controls
                      src={fileUrl}
                      className="w-full h-8 rounded"
                    >
                      Your browser does not support playing audio directly.
                    </audio>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
