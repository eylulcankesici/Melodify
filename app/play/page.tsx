'use client';

import React, { useState, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <div>
            {midiUrl ? (
              <button
                onClick={resetPlayer}
                className="bg-[#fdf6e3] text-[#586e75] px-5 py-2 rounded-full border border-[#93a1a1]/50 hover:bg-[#dcd5c4] transition shadow-sm font-semibold text-sm"
              >
                Yeni Dosya Seç
              </button>
            ) : (
              <div className="w-28"></div>
            )}
          </div>
        </div>
      </header>

      <main className="w-full flex-grow flex flex-col items-center justify-center">
        {midiUrl ? (
          /* MIDI Oynatıcı - Tam Ekran Genişliğinde (Edge-to-Edge) ve h-[calc(100vh-80px)] */
          <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden border-b-2 border-[#dcd5c4] bg-[#002b36]">
            <PianoPlayer midiUrl={midiUrl} />
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
