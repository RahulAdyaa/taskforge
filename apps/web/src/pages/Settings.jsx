import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';

export default function Settings() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const navigate = useNavigate();

  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data;
    },
    retry: false
  });

  useEffect(() => {
    if (projectError) {
      toast.error('Project not found or access denied.');
      navigate('/app');
    }
  }, [projectError, navigate]);

  const addMemberMutation = useMutation({
    mutationFn: async (data) => {
      await api.post(`/projects/${id}/members`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project', id]);
      setEmail('');
      toast.success('Member clearance granted.');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add member')
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId) => {
      await api.delete(`/projects/${id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project', id]);
      toast.success('Member clearance revoked.');
    },
    onError: () => toast.error('Failed to remove member')
  });

  const handleAddMember = (e) => {
    e.preventDefault();
    addMemberMutation.mutate({ email, role });
  };

  return (
    <div className="min-h-screen bg-off-white">
      <header className="bg-white border-b border-[#E8E4DD] px-8 py-4 flex items-center gap-6 sticky top-0 z-10">
        <Link to={`/app/projects/${id}`} className="p-2 hover:bg-off-white rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-sans font-bold text-xl">Project Settings</h1>
          {isProjectLoading ? (
            <div className="h-4 w-32 rounded skeleton-loading mt-1" />
          ) : (
            <p className="font-mono text-xs text-black/50">{project?.name}</p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-12">
        <div className="bg-white p-10 rounded-[2rem] border border-[#E8E4DD] shadow-xl mb-10">
          <h2 className="font-display font-extrabold text-4xl tracking-tight mb-2">Access Control</h2>
          <p className="font-mono text-xs text-black/50 mb-8 uppercase tracking-widest">Manage project personnel</p>

          <form onSubmit={handleAddMember} className="flex gap-4 mb-12">
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Personnel Email..."
              className="flex-1 bg-off-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-black"
              required 
            />
            <select 
              value={role} 
              onChange={e => setRole(e.target.value)}
              className="bg-off-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-black"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button 
              type="submit" 
              disabled={addMemberMutation.isPending}
              className="btn-brutal bg-signal-red text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Authorize</span>
            </button>
          </form>

          <div className="space-y-4">
            <h3 className="font-sans font-bold text-lg mb-4">Current Personnel</h3>
            {isProjectLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-off-white dark:bg-[#1A1A1A] rounded-xl border border-[#E8E4DD] dark:border-white/10 opacity-70">
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-1/4 rounded skeleton-loading" />
                      <div className="h-4 w-1/3 rounded skeleton-loading" />
                    </div>
                    <div className="w-16 h-6 rounded skeleton-loading" />
                  </div>
                ))}
              </div>
            ) : (
              project?.members?.map(m => (
                <div key={m.user.id} className="flex items-center justify-between p-4 bg-off-white rounded-xl border border-[#E8E4DD]">
                  <div className="flex flex-col">
                    <span className="font-sans font-medium">{m.user.name}</span>
                    <span className="font-mono text-xs text-black/60">{m.user.email}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono text-xs px-2 py-1 rounded ${m.role === 'ADMIN' ? 'bg-signal-red/10 text-signal-red' : 'bg-black/10 text-black'}`}>
                      {m.role}
                    </span>
                    <button 
                      onClick={() => {
                        if(confirm('Revoke access for this personnel?')) removeMemberMutation.mutate(m.user.id);
                      }}
                      className="p-2 text-black/40 hover:text-signal-red transition-colors"
                      title="Revoke Access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
