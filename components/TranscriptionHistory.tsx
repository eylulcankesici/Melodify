'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SimplePianoRoll from './SimplePianoRoll';

interface Transcription {
  id: string;
  audio_url: string;
  midi_url: string;
  created_at: string;
  share_id?: string;
}

export default function TranscriptionHistory() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTranscriptions() {
      setLoading(true);
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        setTranscriptions([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('transcriptions').select('*');
      console.log(data);
      if (error) {
        setTranscriptions([]);
      } else {
        setTranscriptions(data as Transcription[]);
      }
      setLoading(false);
    }
    fetchTranscriptions();
  }, []);

  const handleShare = async (id: string) => {
    setShareLoading(id);
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .update({ share_id: crypto.randomUUID() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTranscriptions(prev => 
        prev.map(t => t.id === id ? { ...t, share_id: data.share_id } : t)
      );

      const shareUrl = `${window.location.origin}/share/${data.share_id}`;
      await navigator.clipboard.writeText(shareUrl);
      alert('Paylaşım linki kopyalandı!');
    } catch (error) {
      console.error('Paylaşım hatası:', error);
      alert('Paylaşım linki oluşturulurken bir hata oluştu.');
    } finally {
      setShareLoading(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-10 bg-[#181c24] rounded-2xl shadow-lg p-6 border border-[#232a34]">
      <h2 className="text-xl font-bold text-white mb-4">Transkripsiyon Geçmişi</h2>
      {loading ? (
        <div className="text-gray-400">Yükleniyor...</div>
      ) : transcriptions.length === 0 ? (
        <div className="text-gray-400">Henüz transkripsiyon yapılmamış.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {transcriptions.map((t) => (
            <div key={t.id} className="bg-[#232a34] rounded-xl p-4 flex flex-col gap-2 border border-[#232a34]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <a href={t.audio_url} target="_blank" rel="noopener noreferrer" className="text-green-400 underline break-all text-sm">
                  Yüklenen dosya
                </a>
                <span className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString('tr-TR')}</span>
                <a href={t.midi_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all text-sm">
                  MIDI dosyasını indir / görüntüle
                </a>
                <button
                  onClick={() => handleShare(t.id)}
                  disabled={!!shareLoading}
                  className="text-[#FFD700] hover:underline text-sm disabled:opacity-50"
                >
                  {shareLoading === t.id ? 'Paylaşılıyor...' : t.share_id ? 'Linki Kopyala' : 'Paylaş'}
                </button>
              </div>
              <SimplePianoRoll midiUrl={t.midi_url} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 