'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Lobster } from 'next/font/google';
import AuthForm from '@/components/AuthForm';
import BackgroundNotes from '@/components/BackgroundNotes';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

const lobster = Lobster({
  subsets: ['latin'],
  weight: '400',
});

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Dosya Yükleme State'leri
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [transcriptionFileUrl, setTranscriptionFileUrl] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    
    // Supabase Storage'a Müzik Dosyasını Yükle
    const { error } = await supabase.storage
      .from('audio-files')
      .upload(fileName, file);

    setUploading(false);

    if (error) {
      alert('Yükleme hatası: ' + error.message);
    } else {
      const url = supabase.storage.from('audio-files').getPublicUrl(fileName).data.publicUrl;
      setTranscriptionFileUrl(url);
      
      // Yükleme sonrası işlemi Veritabanına (transcriptions) tabloya kayıt et
      if (user) {
        await supabase.from('transcriptions').insert({
          user_id: user.id,
          original_audio_url: url,
        });
      }
    }
  };

  // Python Demucs Sunucusuna İsteği Gönderen Fonksiyon
  const handleTranscriptionStart = async () => {
    if (!transcriptionFileUrl || !user) return;
    
    // Güvenlik: Yüklü dosya ismini urlden çıkar veya default isimlendir
    const fileName = transcriptionFileUrl.split('/').pop() || 'dosya.mp3';
    
    try {
      const res = await fetch('http://127.0.0.1:8000/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          original_audio_url: transcriptionFileUrl,
          filename: fileName
        }),
      });
      
      const data = await res.json();
      alert("Demucs'a Bağlanıldı! " + data.message);
    } catch (err) {
      console.error(err);
      alert("Eyvah! Python sunucusuna (Backend) ulaşılamıyor. Terminalde 'uvicorn main:app' çalışıyor mu?");
    }
  };

  useEffect(() => {
    // Mevcut oturumu al
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      // Kullanıcı çıkış yaptığında veya yeni bir hesaba girdiğinde yükleme kalıntılarını temizle
      if (_event === 'SIGNED_OUT' || _event === 'SIGNED_IN') {
        setTranscriptionFileUrl(null);
        setUploading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#eee8d5] flex items-center justify-center">
        <span className="text-2xl text-[#586e75] font-bold animate-pulse">Melodify Yükleniyor...</span>
      </div>
    );
  }

  if (user) {
    // GİRİŞ YAPMIŞ KULLANICI EKRANI (DASHBOARD)
    return (
        <div className="min-h-screen w-full bg-[#eee8d5] flex flex-col font-sans relative isolate overflow-hidden">
            <BackgroundNotes />
            <header className="w-full bg-[#fdf6e3]/80 backdrop-blur-sm border-b border-[#93a1a1]/30 sticky top-0 z-50">
              <div className="w-full max-w-7xl mx-auto px-4 flex justify-between items-center py-5">
                <Link href="/" className="cursor-pointer">
                  <div className={`${lobster.className} text-5xl text-[#586e75] drop-shadow-sm select-none flex items-end`}>
                    <span>Melodi</span>
                    <span className="text-6xl text-[#b58900] leading-none mx-[-0.05em]">𝄞</span>
                    <span className="mb-1">y</span>
                  </div>
                </Link>
                <div className="flex items-center gap-4">
                  <span className="text-[#586e75] font-semibold text-lg">{user.user_metadata?.full_name || user.email}</span>
                  <button
                    onClick={async () => { await supabase.auth.signOut(); }}
                    className="bg-[#fdf6e3] text-[#586e75] px-6 py-2 rounded-full border border-[#93a1a1]/50 hover:bg-[#dcd5c4] transition shadow-sm"
                  >
                    Çıkış Yap
                  </button>
                </div>
              </div>
            </header>
            
            <main className="w-full flex-grow flex items-center justify-center" style={{minHeight: 'calc(100vh - 80px)'}}>
            <div className="w-full max-w-6xl px-4 relative isolate">
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                  <span className="text-[30rem] md:text-[50rem] text-[#93a1a1] opacity-[0.15] select-none -rotate-12">𝄞</span>
              </div>
              <div className="flex flex-col md:flex-row items-center justify-center gap-16 w-full">
                  <div className="flex-1 flex flex-col gap-6 items-start">
                    <h1 className="text-5xl md:text-6xl font-extrabold text-[#586e75] leading-tight tracking-tight drop-shadow-sm animate-fade-in-up">
                      <span className="block">Şarkı Dosyanı Yükle</span>
                      <span className="block text-4xl md:text-5xl text-[#839496] mt-4">
                        Yapay Zeka <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#268bd2] to-[#2aa198]">Ayrıştırsın</span>
                      </span>
                    </h1>
                    <p className="text-lg md:text-xl text-[#657b83] max-w-xl animate-fade-in-up delay-100">
                      Dilediğin MP3, WAV veya MIDI dosyasını yükle. Yapay zeka servislerimiz kanallarını (Vokal, Davul) saniyeler içinde ayırsın.
                    </p>
                  </div>

                  <div className="flex-1 flex flex-col items-center gap-8 animate-fade-in-up delay-300">
                    <div 
                      className="rotating-glow-box group"
                      onClick={() => !uploading && fileInputRef.current?.click()}
                    >
                      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-4">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          accept=".mp3,.wav,.midi"
                        />
                        
                        <>
                          <span className="text-6xl text-[#b58900] font-black opacity-25 absolute left-6 top-6 select-none group-hover:opacity-40 transition-opacity duration-300">♪</span>
                          <span className="text-2xl text-[#586e75] font-black opacity-20 absolute left-1/3 top-12 select-none group-hover:opacity-30 transition-opacity duration-300">♩</span>
                          <span className="text-5xl text-[#93a1a1] font-black opacity-25 absolute top-10 right-8 select-none group-hover:opacity-35 transition-opacity duration-300">♫</span>
                          <span className="text-4xl text-[#657b83] font-black opacity-15 absolute top-1/3 right-20 select-none group-hover:opacity-25 transition-opacity duration-300">♮</span>
                          <span className="text-5xl text-[#b58900] font-black opacity-20 absolute bottom-1/4 left-8 select-none group-hover:opacity-30 transition-opacity duration-300">♯</span>
                          <span className="text-2xl text-[#839496] font-black opacity-25 absolute bottom-1/3 left-1/2 select-none group-hover:opacity-35 transition-opacity duration-300">♪</span>
                          <span className="text-3xl text-[#268bd2] font-black opacity-15 absolute bottom-12 right-1/3 select-none group-hover:opacity-25 transition-opacity duration-300">♭</span>
                          <span className="text-6xl text-[#93a1a1] font-black opacity-20 absolute right-6 bottom-6 select-none group-hover:opacity-30 transition-opacity duration-300">♬</span>
                          <span className="text-4xl text-[#b58900] font-black opacity-25 absolute bottom-20 left-1/4 select-none group-hover:opacity-35 transition-opacity duration-300">♮</span>
                        </>

                        {uploading ? (
                          <div className="flex flex-col items-center justify-center gap-4">
                            <span className="text-2xl text-[#586e75] font-bold">Yükleniyor...</span>
                          </div>
                        ) : transcriptionFileUrl ? (
                          <div className="z-20 flex flex-col gap-4 p-4 text-center animate-button-options">
                            <h3 className="text-2xl text-[#586e75] font-bold mb-2">Dosya Hazır!</h3>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleTranscriptionStart(); 
                              }}
                              className="bg-[#268bd2] text-white font-semibold px-8 py-3 rounded-full shadow-lg hover:bg-[#1f72b0] transform hover:scale-105 transition-all duration-200 ease-in-out text-lg"
                            >
                              Transkripsiyonu Başlat
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setTranscriptionFileUrl(null); }}
                              className="text-sm text-[#586e75] hover:underline pt-2"
                            >
                              Yeni Dosya Seç
                            </button>
                          </div>
                        ) : (
                           <span className="text-3xl text-[#586e75] font-bold transition-transform duration-300 group-hover:scale-110 text-center">Dosyayı Seç veya Sürükle</span>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          </main>
        </div>
    );
  }

  // GİRİŞ YAPMAMIŞ KULLANICI EKRANI (LOGIN)
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#eee8d5] overflow-hidden p-4 isolate">
      {/* V1 Floaty notes background map */}
      <BackgroundNotes />
      
      {/* --- YENİ EKLENEN ARKA PLAN SEMBOLÜ --- */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
        <span className="text-[40rem] md:text-[50rem] text-[#93a1a1] opacity-[0.15] select-none -rotate-12">𝄞</span>
      </div>
      
      <div className="z-10 w-full max-w-md flex flex-col items-center">
        {/* --- YENİ EKLENEN LOGO VE SLOGAN --- */}
        <Link href="/" className="cursor-pointer mb-8">
          <div className={`${lobster.className} text-6xl text-[#586e75] drop-shadow-sm select-none flex items-end`}>
            <span>Melodi</span>
            <span className="text-7xl text-[#b58900] leading-none mx-[-0.05em]">𝄞</span>
            <span className="mb-1">y</span>
          </div>
        </Link>
        <p className="text-xl text-[#657b83] mb-8 -mt-6">
          Müziğin dünyasına hoş geldin.
        </p>
        
        {/* --- YENİ VE DOĞRU GİRİŞ FORMU KUTUSU --- */}
        <div className="login-glow-box w-full max-w-md">
            <div className="relative z-10 p-8">
                <AuthForm />
            </div>
        </div>
      </div>
    </div>
  );
}
