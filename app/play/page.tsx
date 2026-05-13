'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const PianoPlayer = dynamic(
  () => import('@/components/react-piano-player/src/PianoPlayer'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#dcd5c4] text-[#586e75]">
        <div className="animate-pulse text-5xl flex gap-2">
          <span style={{ animationDelay: '0.1s', color: '#b58900' }}>♪</span>
          <span style={{ animationDelay: '0.2s', color: '#cb4b16' }}>♫</span>
          <span style={{ animationDelay: '0.3s', color: '#dc322f' }}>♩</span>
          <span style={{ animationDelay: '0.4s', color: '#d33682' }}>♬</span>
          <span style={{ animationDelay: '0.5s', color: '#6c71c4' }}>♭</span>
        </div>
      </div>
    )
  }
);

export default function PlayPage() {
  const [midiUrl, setMidiUrl] = useState<string | null>(null);
  const [midiFileName, setMidiFileName] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hideDownloads, setHideDownloads] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL Query parametresiyle gelen MIDI dosyalarını otomatik yükleme desteği
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    const nameParam = params.get('name') || 'AI Transkripsiyon Çıktısı';
    const pdfParam = params.get('pdfUrl');
    const hideDownloadsParam = params.get('hideDownloads');
    
    if (urlParam) {
      setMidiUrl(urlParam);
      setMidiFileName(nameParam);
    }
    if (pdfParam) {
      setPdfUrl(pdfParam);
    }
    if (hideDownloadsParam === 'true') {
      setHideDownloads(true);
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loadMidiFile(file);
    }
  };

  const loadMidiFile = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setMidiUrl(objectUrl);
    setMidiFileName(file.name);
  };

  const resetPlayer = () => {
    if (midiUrl) {
      URL.revokeObjectURL(midiUrl);
    }
    setMidiUrl(null);
    setMidiFileName('');
  };

  return (
    <div className="min-h-screen w-full bg-[#eee8d5] flex flex-col font-sans relative">
      {/* HTML/Body Scrollbar Kilitleyici ve Engelleme Stili */}
      <style dangerouslySetInnerHTML={{__html: `
        body, html {
          overflow: hidden !important;
          height: 100vh !important;
          width: 100vw !important;
        }
      `}} />

      {/* Arka Plan Süsü */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 select-none -z-10">
        <span className="text-[50rem] text-[#93a1a1] -rotate-12">𝄞</span>
      </div>

      {!hideDownloads && (
        <header className="w-full bg-[#fdf6e3]/80 backdrop-blur-sm border-b border-[#93a1a1]/30 sticky top-0 z-50">
          <div className="w-full max-w-7xl mx-auto px-6 flex justify-between items-center py-4">
            <Link href="/" className="cursor-pointer text-md font-bold text-[#586e75] hover:text-[#b58900] transition flex items-center gap-1">
              ◀ Ana Sayfa
            </Link>
            <div className="text-center">
              <h1 className="text-2xl font-black text-[#586e75] tracking-tight">Melodify Piano Visualizer</h1>
              {midiFileName && (
                <p className="text-sm text-[#b58900] font-semibold mt-0.5">Oynatılan: {midiFileName}</p>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {!hideDownloads && midiUrl && midiUrl.startsWith('http') && (
                <a
                  href={`${midiUrl}${midiUrl.includes('?') ? '&' : '?'}download=${midiFileName || 'midi_file.mid'}`}
                  className="bg-[#6b828a] hover:bg-[#5a6f76] text-[#fdf6e3] px-4 py-1.5 rounded-full transition shadow-sm font-bold text-xs flex items-center gap-1.5"
                >
                  <span>📥</span>
                  <span>MIDI İndir</span>
                </a>
              )}
              {!hideDownloads && pdfUrl && (
                <a
                  href={`${pdfUrl}?download=${midiFileName.includes('drums') ? 'drums_sheet.pdf' : 'piano_sheet.pdf'}`}
                  className="bg-[#c2847a] hover:bg-[#b07268] text-[#fdf6e3] px-4 py-1.5 rounded-full transition shadow-sm font-bold text-xs flex items-center gap-1.5"
                >
                  <span>🎼</span>
                  <span>Nota Kağıdı İndir (PDF)</span>
                </a>
              )}
              {!hideDownloads && midiUrl ? (
                <button
                  onClick={resetPlayer}
                  className="bg-[#fdf6e3] text-[#586e75] px-4 py-1.5 rounded-full border border-[#93a1a1]/50 hover:bg-[#dcd5c4] transition shadow-sm font-semibold text-xs"
                >
                  Yeni Dosya Seç
                </button>
              ) : !hideDownloads ? (
                <div className="w-28"></div>
              ) : null}
            </div>
          </div>
        </header>
      )}

      <main className="w-full flex-grow flex flex-col items-center justify-center">
        {midiUrl ? (
          /* MIDI Oynatıcı - Tam Ekran Genişliğinde ve hideDownloads varsa h-screen, yoksa h-[calc(100vh-80px)] */
          <div className={`relative w-full overflow-hidden border-b-2 border-[#dcd5c4] bg-[#002b36] ${
            hideDownloads ? 'h-screen' : 'h-[calc(100vh-80px)]'
          }`}>
            <PianoPlayer midiUrl={midiUrl} fileName={midiFileName} />
          </div>
        ) : (
          /* Dosya Seçim Ekranı */
          <div className="w-full max-w-2xl bg-[#fdf6e3]/90 backdrop-blur border border-[#93a1a1]/40 rounded-2xl p-12 text-center shadow-2xl flex flex-col items-center justify-center gap-8 my-8 mx-4">
            <div className="text-7xl text-[#b58900] animate-bounce duration-1000">🎹</div>
            <div>
              <h2 className="text-3xl font-black text-[#586e75]">Bir MIDI Dosyası Yükle</h2>
              <p className="text-md text-[#657b83] mt-2 max-w-md mx-auto">
                Yapay zekanın çıkardığı veya kendi sahip olduğun herhangi bir .mid/.midi dosyasını sürükleyip bırakarak piyano üzerinde canlandır.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".mid,.midi"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#b58900] hover:bg-[#b58900]/90 text-white font-bold px-10 py-4 rounded-full shadow-lg transform hover:scale-105 transition-all text-lg flex items-center gap-2"
            >
              Dosya Seçin
            </button>

            <div className="text-xs text-[#93a1a1]">
              Desteklenen formatlar: .mid, .midi (Tüm işlemler tarayıcında yerel olarak yapılır)
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
