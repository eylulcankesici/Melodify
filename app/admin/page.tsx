'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface Transcription {
  id: string;
  user_id: string;
  audio_url: string;
  midi_url: string;
  created_at: string;
}

const ADMIN_EMAILS = [
  'eylukankesici@gmail.com', // örnek admin email, kendi emailinizi ekleyin
  'sudemcucemen7@gmail.com'
];

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const user = await supabase.auth.getUser();
      if (!user.data.user || !ADMIN_EMAILS.includes(user.data.user.email!)) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      setCurrentUserId(user.data.user.id);
      // Kullanıcıları çek
      const { data: usersData } = await supabase.from('users').select('id, email, created_at');
      setUsers(usersData || []);
      // Tüm transkripsiyonları çek
      const { data: transData } = await supabase.from('transcriptions').select('*').order('created_at', { ascending: false });
      setTranscriptions(transData || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleDeleteUser = async (id: string) => {
    if (id === currentUserId) {
      alert('Kendi hesabınızı admin panelinden silemezsiniz!');
      return;
    }
    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
    await supabase.from('users').delete().eq('id', id);
    setUsers(users => users.filter(u => u.id !== id));
  };

  const handleDeleteTranscription = async (id: string) => {
    if (!confirm('Bu transkripsiyon kaydını silmek istediğinize emin misiniz?')) return;
    await supabase.from('transcriptions').delete().eq('id', id);
    setTranscriptions(ts => ts.filter(t => t.id !== id));
  };

  if (loading) {
    return <div className="text-white text-center mt-20">Yükleniyor...</div>;
  }
  if (!isAdmin) {
    return <div className="text-red-400 text-center mt-20">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#181c24] via-[#232a34] to-[#0e1013] flex flex-col items-center py-12">
      <div className="w-full max-w-4xl bg-[#181c24] rounded-2xl shadow-lg p-6 border border-[#232a34] mb-10">
        <h2 className="text-xl font-bold text-white mb-4">Kullanıcılar</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-[#232a34]">
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-left">Email</th>
                <th className="px-2 py-1 text-left">Oluşturulma</th>
                <th className="px-2 py-1 text-left">Sil</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-[#232a34]">
                  <td className="px-2 py-1 break-all">{u.id}</td>
                  <td className="px-2 py-1">{u.email}</td>
                  <td className="px-2 py-1">{new Date(u.created_at).toLocaleString('tr-TR')}</td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-60"
                      disabled={u.id === currentUserId}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="w-full max-w-4xl bg-[#181c24] rounded-2xl shadow-lg p-6 border border-[#232a34]">
        <h2 className="text-xl font-bold text-white mb-4">Tüm Transkripsiyonlar</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-[#232a34]">
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-left">Kullanıcı</th>
                <th className="px-2 py-1 text-left">Audio</th>
                <th className="px-2 py-1 text-left">MIDI</th>
                <th className="px-2 py-1 text-left">Tarih</th>
                <th className="px-2 py-1 text-left">Sil</th>
              </tr>
            </thead>
            <tbody>
              {transcriptions.map(t => (
                <tr key={t.id} className="border-b border-[#232a34]">
                  <td className="px-2 py-1 break-all">{t.id}</td>
                  <td className="px-2 py-1 break-all">{t.user_id}</td>
                  <td className="px-2 py-1 break-all"><a href={t.audio_url} className="text-green-400 underline" target="_blank" rel="noopener noreferrer">Audio</a></td>
                  <td className="px-2 py-1 break-all"><a href={t.midi_url} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer">MIDI</a></td>
                  <td className="px-2 py-1">{new Date(t.created_at).toLocaleString('tr-TR')}</td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => handleDeleteTranscription(t.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
} 