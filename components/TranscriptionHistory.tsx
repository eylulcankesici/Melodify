'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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

      // Mikroservisten transkripsiyonları çek
      try {
        const userId = user.data.user.id;
        console.log('Transkripsiyonlar çekiliyor, userId:', userId);
        
        // Kullanıcı session'ını al
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        
        // Authorization header ile istek gönder
        const headers: HeadersInit = {};
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
        
        const response = await fetch(`/api/transcriptions?userId=${userId}`, {
          headers
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Mikroservis yanıt hatası:', response.status, errorText);
          throw new Error(`Transkripsiyonlar alınamadı: ${response.status}`);
        }
        
        const data: Array<{
          id: string | number;
          audioUrl: string;
          midiUrl: string;
          createdAt: string;
          shareId: string | null;
        }> = await response.json();
        console.log('Mikroservisten gelen veri:', data);
        
        // Mikroservis formatını component formatına dönüştür
        const formattedData: Transcription[] = data.map((item) => ({
          id: String(item.id),
          audio_url: item.audioUrl,
          midi_url: item.midiUrl,
          created_at: item.createdAt,
          share_id: item.shareId || undefined,
        }));
        
        console.log('Formatlanmış veri:', formattedData);
        setTranscriptions(formattedData);
      } catch (error: unknown) {
        console.error('Transkripsiyon yükleme hatası:', error);
        setTranscriptions([]);
      }
      
      setLoading(false);
    }
    fetchTranscriptions();
  }, []);

  const handleShare = async (id: string) => {
    setShareLoading(id);
    try {
      // Kullanıcı session'ından access token al
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      // Mikroservise paylaşım linki oluşturma isteği gönder
      const headers: HeadersInit = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`/api/transcriptions/${id}/share`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Paylaşım linki oluşturulamadı');
      }

      const data: { shareId: string; shareUrl: string } = await response.json();

      // State'i güncelle
      setTranscriptions(prev => 
        prev.map(t => t.id === id ? { ...t, share_id: data.shareId } : t)
      );

      // Paylaşım linkini panoya kopyala
      await navigator.clipboard.writeText(data.shareUrl);
      alert('Paylaşım linki kopyalandı!');
    } catch (error: unknown) {
      console.error('Paylaşım hatası:', error);
      const message =
        error instanceof Error ? error.message : 'Paylaşım linki oluşturulurken bir hata oluştu.';
      alert('Paylaşım linki oluşturulurken bir hata oluştu: ' + message);
    } finally {
      setShareLoading(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-6 bg-[#fdf6e3] rounded-2xl shadow-md border border-[#e0d7c3] relative overflow-hidden">
      {/* Arka plan müzik sembolleri */}
      <div className="absolute inset-0 pointer-events-none">
        <span className="absolute text-6xl text-[#e0c879] top-4 left-6 opacity-60">♪</span>
        <span className="absolute text-5xl text-[#e0c879] bottom-6 right-10 opacity-60">♫</span>
        <span className="absolute text-7xl text-[#f0d9a3] top-1/2 left-1/3 -translate-y-1/2 opacity-70">♬</span>
        <span className="absolute text-4xl text-[#e0c879] top-10 right-1/4 opacity-55">♭</span>
      </div>

      <div className="relative z-10">
        <div className="px-6 py-4 border-b border-[#e0d7c3]">
          <h2 className="text-2xl font-bold text-[#586e75]">
            Transkripsiyon Geçmişi
          </h2>
        </div>

        <div className="px-6 py-4">
          {loading ? (
            <div className="text-[#657b83] text-sm">Yükleniyor...</div>
          ) : transcriptions.length === 0 ? (
            <div className="text-[#657b83] text-sm">
              Henüz transkripsiyon yapılmamış.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {transcriptions.map((t) => (
                <div
                  key={t.id}
                  className="bg-[#fdf6e3] rounded-xl px-4 py-3 border border-[#e0d7c3] flex flex-col gap-2"
                >
                  <div className="flex flex-col md:flex-row md:flex-nowrap md:items-center md:justify-between gap-3">
                    <a
                      href={t.audio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#859900] underline whitespace-nowrap text-xs md:text-sm"
                    >
                      Yüklenen dosya
                    </a>
                    <span className="text-[11px] md:text-xs text-[#93a1a1] whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString('tr-TR')}
                    </span>
                    <a
                      href={t.midi_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#268bd2] underline whitespace-nowrap text-xs md:text-sm"
                    >
                      MIDI dosyasını indir
                    </a>
                    <button
                      onClick={() => handleShare(t.id)}
                      disabled={!!shareLoading}
                      className="text-[#b58900] text-xs md:text-sm hover:underline disabled:opacity-50 whitespace-nowrap"
                    >
                      {shareLoading === t.id
                        ? 'Paylaşılıyor...'
                        : t.share_id
                        ? 'Linki Kopyala'
                        : 'Paylaş'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 