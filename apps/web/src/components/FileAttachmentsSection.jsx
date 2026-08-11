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
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/projects/${projectId}/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    },
    onMutate: () => setIsUploading(true),
    onSuccess: () => {
      setIsUploading(false);
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Attachment uploaded successfully!');
    },
    onError: (err) => {
      setIsUploading(false);
      toast.error(err.response?.data?.error || 'Failed to upload attachment');
    }
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId) => {
      await api.delete(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Attachment removed');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to delete attachment');
    }
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error('File size cannot exceed 20MB');
        return;
      }
      uploadAttachmentMutation.mutate(file);
    }
  };

  const getFileIcon = (fileType, filename) => {
    const lowerType = (fileType || '').toLowerCase();
    const lowerName = (filename || '').toLowerCase();

    if (lowerType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(lowerName)) {
      return <ImageIcon className="w-4 h-4 text-emerald-500" />;
    }
    if (lowerType.includes('pdf') || lowerName.endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-red-500" />;
    }
    if (lowerType.includes('sheet') || lowerType.includes('csv') || lowerType.includes('excel') || /\.(xlsx?|csv)$/.test(lowerName)) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
    }
    if (lowerType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(lowerName)) {
      return <Music className="w-4 h-4 text-purple-500" />;
    }
    return <File className="w-4 h-4 text-blue-500" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="mt-6 border-t border-[#E8E4DD] dark:border-white/10 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-black/60 dark:text-white/60 flex items-center gap-2">
          <Paperclip className="w-3.5 h-3.5" />
          <span>Attachments ({attachments.length})</span>
        </h4>
        {canEdit && (
          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-white dark:bg-white/10 text-black dark:text-white border border-[#E8E4DD] dark:border-white/10 hover:border-signal-red hover:text-signal-red transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-signal-red" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" />
                  <span>Add File</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs font-mono text-black/40 dark:text-white/40 italic py-2">
          No files attached to this task protocol.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((att) => {
            const downloadUrl = att.url || `${API_BASE}/api/projects/${projectId}/tasks/${taskId}/attachments/${att.id}/download`;
            return (
              <div 
                key={att.id || att._id} 
                className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#141417] border border-[#E8E4DD] dark:border-white/10 hover:border-signal-red/50 transition-all shadow-sm group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className="p-1.5 rounded-lg bg-off-white dark:bg-white/5 border border-[#E8E4DD] dark:border-white/10 shrink-0">
                    {getFileIcon(att.fileType, att.filename)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-sans font-medium text-black dark:text-white truncate" title={att.filename}>
                      {att.filename}
                    </p>
                    <p className="text-[10px] font-mono text-black/40 dark:text-white/40">
                      {formatFileSize(att.fileSize)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={att.filename}
                    className="p-1.5 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-off-white dark:hover:bg-white/10 rounded-lg transition-colors"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => deleteAttachmentMutation.mutate(att.id || att._id)}
                      disabled={deleteAttachmentMutation.isPending}
                      className="p-1.5 text-black/40 dark:text-white/40 hover:text-signal-red hover:bg-signal-red/10 rounded-lg transition-colors disabled:opacity-40"
                      title="Delete File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
