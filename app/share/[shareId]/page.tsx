'use client';

import { useEffect, useState } from 'react';

interface SharedTranscription {
  audio_url: string;
  midi_url: string;
  created_at: string;
}

export default function SharedTranscriptionPage({ params }: { params: { shareId: string } }) {
  const [transcription, setTranscription] = useState<SharedTranscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedTranscription() {
      try {
        // Mikroservisten paylaşılan transkripsiyonu çek
        const response = await fetch(`http://localhost:3001/api/share/${params.shareId}`);
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Transkripsiyon bulunamadı');
        }

        const data: { audioUrl: string; midiUrl: string; createdAt: string } = await response.json();

        // Mikroservis formatını component formatına dönüştür
        setTranscription({
          audio_url: data.audioUrl,
          midi_url: data.midiUrl,
          created_at: data.createdAt,
        });
      } catch (error: unknown) {
        console.error('Paylaşılan transkripsiyon yükleme hatası:', error);
        setError('Bu transkripsiyon artık mevcut değil veya paylaşım süresi dolmuş.');
      } finally {
        setLoading(false);
      }
    }

    fetchSharedTranscription();
  }, [params.shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#181c24] via-[#232a34] to-[#0e1013] flex items-center justify-center">
        <div className="text-white">Yükleniyor...</div>
      </div>
    );
  }

  if (error || !transcription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#181c24] via-[#232a34] to-[#0e1013] flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#181c24] via-[#232a34] to-[#0e1013] flex flex-col items-center py-12">
      <div className="w-full max-w-2xl bg-[#181c24] rounded-2xl shadow-lg p-6 border border-[#232a34]">
        <h2 className="text-xl font-bold text-white mb-4">Paylaşılan Transkripsiyon</h2>
        <div className="bg-[#232a34] rounded-xl p-4 flex flex-col gap-2 border border-[#232a34]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <a href={transcription.audio_url} target="_blank" rel="noopener noreferrer" className="text-green-400 underline break-all text-sm">
              Yüklenen dosya
            </a>
            <span className="text-xs text-gray-400">{new Date(transcription.created_at).toLocaleString('tr-TR')}</span>
            <a href={transcription.midi_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all text-sm">
              MIDI dosyasını indir / görüntüle
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 