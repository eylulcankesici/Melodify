'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function AudioUpload({ onUpload }: { onUpload: (fileUrl: string, purpose: 'transcription' | 'midiplayer') => void }) {
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [midiBlob, setMidiBlob] = useState<Blob | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState<'transcription' | 'midiplayer' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadPurpose(null); // Reset if no file is chosen
      return;
    }
    setUploading(true);
    setMidiBlob(null);
    setTranscribeError(null);
    setIsExpanded(false);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage
      .from('audio-files')
      .upload(fileName, file);

    setUploading(false);

    if (error) {
      alert('Yükleme hatası: ' + error.message);
      setUploadPurpose(null); // Reset on error
    } else {
      const url = supabase.storage.from('audio-files').getPublicUrl(fileName).data.publicUrl;
      setFileUrl(url);
      if (uploadPurpose) {
        onUpload(url, uploadPurpose);
      }
    }
  };

  const handleTranscribe = async () => {
    if (!fileUrl) return;
    setTranscribing(true);
    setTranscribeError(null);
    setMidiBlob(null);
    
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: fileUrl }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Transkripsiyon işlemi başarısız oldu');
      }

      const blob = await res.blob();
      setMidiBlob(blob);
    } catch (error: any) {
      console.error('Transkripsiyon hatası:', error);
      setTranscribeError(error.message || 'Transkripsiyon sırasında hata oluştu.');
    } finally {
      setTranscribing(false);
      // Bu satırı kaldırdık, çünkü kullanıcı yeni MIDI ile işlem yapmak isteyebilir.
      // setUploadPurpose(null); 
    }
  };

  const handleMidiDownload = () => {
    if (!midiBlob) return;
    
    const url = window.URL.createObjectURL(midiBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcribed.midi';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Transkripsiyon sonucunu oynatıcıya gönderen yeni fonksiyon
  const handlePlayTranscribedMidi = () => {
    if (!midiBlob) return;
    // Bellekteki MIDI verisinden geçici bir URL oluştur
    const blobUrl = URL.createObjectURL(midiBlob);
    // Bu URL'i, oynatıcıda çalınması amacıyla ana bileşene gönder
    onUpload(blobUrl, 'midiplayer');
  };

  const handleUploadButtonClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleOptionClick = (purpose: 'transcription' | 'midiplayer') => {
    setUploadPurpose(purpose);
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-2 items-center w-full max-w-xs">
      <input
        type="file"
        accept=".mp3,.wav,.mid,.midi"
        onChange={handleFileChange}
        disabled={uploading || transcribing}
        ref={fileInputRef}
        style={{ display: 'none' }}
      />

      <button
        onClick={handleUploadButtonClick}
        disabled={uploading || transcribing}
        className="w-full px-4 py-3 rounded-lg bg-[#FFD700] text-black font-semibold hover:bg-[#e6c200] transition-all disabled:opacity-60"
      >
        {uploading ? 'Yükleniyor...' : transcribing ? 'Transkribe Ediliyor...' : 'Dosya Yükle'}
      </button>

      {isExpanded && !uploading && !transcribing && (
        <div className="flex flex-col gap-2 w-full mt-2 animate-fade-in-up">
          <button
            onClick={() => handleOptionClick('midiplayer')}
            className="w-full px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition-all"
          >
            Midi Player İçin
          </button>
          <button
            onClick={() => handleOptionClick('transcription')}
            className="w-full px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition-all"
          >
            Transkripsiyon İçin
          </button>
        </div>
      )}
      
      {fileUrl && uploadPurpose === 'transcription' && !midiBlob && (
        <button
          onClick={handleTranscribe}
          disabled={transcribing}
          className="mt-3 px-4 py-2 rounded bg-[#FFD700] text-black font-semibold hover:bg-[#e6c200] transition-all disabled:opacity-60"
        >
          {transcribing ? 'Transkribe Ediliyor...' : 'Transkribe Et'}
        </button>
      )}
      
      {midiBlob && (
        <div className="flex flex-col gap-2 w-full mt-4">
          <button
            onClick={handlePlayTranscribedMidi}
            className="w-full px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-all"
          >
            Transkripsiyonu Oynat
          </button>
          <button
            onClick={handleMidiDownload}
            className="w-full px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
          >
            MIDI Dosyasını İndir
          </button>
        </div>
      )}
      
      {transcribeError && (
        <div className="text-red-400 text-sm mt-2">{transcribeError}</div>
      )}
    </div>
  );
}