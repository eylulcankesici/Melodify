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
  const [selectedTask, setSelectedTask] = useState<string>('demucs');
  const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<any>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    // Clear last cached session storage
    sessionStorage.removeItem('melodify_last_status');
    sessionStorage.removeItem('melodify_last_result');
    sessionStorage.removeItem('melodify_last_task');
    sessionStorage.removeItem('melodify_last_audio_url');

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

    // Dosya seçim elemanının değerini sıfırlayalım ki aynı dosya tekrar seçilebilsin
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Supabase'den Transkripsiyon Durumunu Sorgulayan ve Polling Yapan Mekanizma
  const startPolling = (userId: string, originalUrl: string) => {
    setTranscriptionStatus('processing');
    setTranscriptionError(null);
    setTranscriptionResult(null);

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('transcriptions')
          .select('metadata')
          .eq('user_id', userId)
          .eq('original_audio_url', originalUrl)
          .order('id', { ascending: false })
          .limit(1);

        if (error) {
          console.error("Sorgulama hatası:", error.message);
          return;
        }

        if (data && data.length > 0) {
          const row = data[0];
          const meta = row.metadata;
          if (meta) {
            if (meta.status === 'completed') {
              setTranscriptionStatus('completed');
              setTranscriptionResult(meta);
              
              // Persist completion state for back button navigation
              sessionStorage.setItem('melodify_last_status', 'completed');
              sessionStorage.setItem('melodify_last_result', JSON.stringify(meta));
              sessionStorage.setItem('melodify_last_task', selectedTask);
              sessionStorage.setItem('melodify_last_audio_url', originalUrl);
              
              clearInterval(interval);
            } else if (meta.status === 'failed') {
              setTranscriptionStatus('failed');
              setTranscriptionError(meta.error || 'Bilinmeyen bir hata oluştu.');
              clearInterval(interval);
            }
          }
        }
      } catch (err: any) {
        console.error("Polling catch hatası:", err);
      }
    }, 3000);
  };

  const downloadChordsAsText = () => {
    if (!transcriptionResult || !transcriptionResult.outputs || !transcriptionResult.outputs.chords) return;

    const chords = transcriptionResult.outputs.chords;
    const bpm = transcriptionResult.outputs.bpm || 'N/A';
    const key = transcriptionResult.outputs.key || 'N/A';

    let textContent = `MELODIFY - AKOR ANALIZ RAPORU\n`;
    textContent += `=========================================\n`;
    textContent += `Tempo (BPM): ${bpm}\n`;
    textContent += `Anahtar Ton: ${key}\n`;
    textContent += `=========================================\n\n`;
    textContent += `AKOR DIZILIMI (ZAMAN DAMGALI):\n`;
    textContent += `-----------------------------------------\n`;

    chords.forEach((c: any) => {
      textContent += `[${c.start.toFixed(2)}s - ${c.end.toFixed(2)}s]  ->  ${c.chord}\n`;
    });

    textContent += `\n-----------------------------------------\n`;
    textContent += `Melodify AI tarafindan otomatik olarak uretilmistir.\n`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `akor_raporu.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Python Yapay Zeka Sunucusuna İsteği Gönderen Dinamik Fonksiyon
  const handleTranscriptionStart = async (endpoint: string, taskName: string) => {
    if (!transcriptionFileUrl || !user) return;

    const fileName = transcriptionFileUrl.split('/').pop() || 'dosya.mp3';

    try {
      const res = await fetch(endpoint, {
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
      alert(`Sunucu ile Bağlantı Kuruldu! ` + (data.message || 'İşlem başarıyla kuyruğa alındı.'));

      // Polling başlatıyoruz
      startPolling(user.id, transcriptionFileUrl);
    } catch (err) {
      console.error(err);
      alert("Eyvah! Python sunucusuna (Backend) ulaşılamıyor. Terminalde FastAPI sunucusu çalışıyor mu?");
    }
  };

  useEffect(() => {
    // Restore session state if returning from MIDI player
    try {
      const savedStatus = sessionStorage.getItem('melodify_last_status');
      const savedResult = sessionStorage.getItem('melodify_last_result');
      const savedTask = sessionStorage.getItem('melodify_last_task');
      const savedAudioUrl = sessionStorage.getItem('melodify_last_audio_url');

      if (savedStatus && savedResult) {
        setTranscriptionStatus(savedStatus as any);
        setTranscriptionResult(JSON.parse(savedResult));
        if (savedTask) setSelectedTask(savedTask);
        if (savedAudioUrl) setTranscriptionFileUrl(savedAudioUrl);
      }
    } catch (e) {
      console.error("Session state restore error:", e);
    }
  }, []);

  useEffect(() => {
    // Mevcut oturumu al ve en az 4 saniyelik şık başlangıç gecikmesi uygula
    const fetchUser = supabase.auth.getSession();
    const minDelay = new Promise(resolve => setTimeout(resolve, 4000));

    Promise.all([fetchUser, minDelay]).then(([{ data: { session } }]) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      // Sadece kullanıcı kesin çıkış yaptığında yükleme kalıntılarını ve state'leri temizle
      // SIGNED_IN kontrolünü kaldırdık, çünkü tarayıcı sekmesi odağı geri kazandığında 
      // Supabase otomatik oturum tazeleyip SIGNED_IN tetikleyebilir ve mevcut ekranımızı sıfırlayabilirdi.
      if (_event === 'SIGNED_OUT') {
        setTranscriptionFileUrl(null);
        setUploading(false);
        setTranscriptionStatus('idle');
        setTranscriptionError(null);
        setTranscriptionResult(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#eee8d5] flex flex-col items-center justify-center">
        <style dangerouslySetInnerHTML={{
          __html: `
          .initial-loading-notes-container {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1rem;
          }
          
          .initial-loading-note {
            display: inline-block;
            font-size: 2.5rem;
            color: #93a1a1;
            animation: initial-loading-wave 1.5s infinite ease-in-out;
            opacity: 0;
          }

          @keyframes initial-loading-wave {
            0%, 100% {
              transform: translateY(0);
              opacity: 0;
            }
            50% {
              transform: translateY(-20px);
              opacity: 1;
            }
          }
          
          .initial-loading-note:nth-child(1) { animation-delay: 0s; }
          .initial-loading-note:nth-child(2) { animation-delay: 0.1s; }
          .initial-loading-note:nth-child(3) { animation-delay: 0.2s; }
          .initial-loading-note:nth-child(4) { animation-delay: 0.3s; }
          .initial-loading-note:nth-child(5) { animation-delay: 0.4s; }
          `
        }} />
        <div className={`${lobster.className} text-8xl text-[#586e75] drop-shadow-sm select-none flex items-end animate-pulse`}>
          <span>Melodi</span>
          <span className="text-9xl text-[#b58900] leading-none mx-[-0.05em]">𝄞</span>
          <span className="mb-2">y</span>
        </div>
        <div className="initial-loading-notes-container mt-8">
          <span className="initial-loading-note">♪</span>
          <span className="initial-loading-note">♫</span>
          <span className="initial-loading-note">♩</span>
          <span className="initial-loading-note">♬</span>
          <span className="initial-loading-note">♪</span>
        </div>
      </div>
    );
  }

  if (user) {
    // GİRİŞ YAPMIŞ KULLANICI EKRANI (DASHBOARD)
    return (
      <div className="min-h-screen w-full bg-[#eee8d5] flex flex-col font-sans relative isolate overflow-hidden">
        <BackgroundNotes />
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes note-burst-1 {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            10% { opacity: 0.9; }
            90% { opacity: 0.8; }
            100% { transform: translate(calc(-50% - 180px), calc(-50% - 180px)) scale(1.6) rotate(-45deg); opacity: 0; }
          }
          @keyframes note-burst-2 {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            10% { opacity: 0.9; }
            90% { opacity: 0.8; }
            100% { transform: translate(calc(-50% + 180px), calc(-50% - 180px)) scale(1.4) rotate(45deg); opacity: 0; }
          }
          @keyframes note-burst-3 {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            10% { opacity: 0.9; }
            90% { opacity: 0.8; }
            100% { transform: translate(calc(-50% - 210px), calc(-50% + 110px)) scale(1.5) rotate(-15deg); opacity: 0; }
          }
          @keyframes note-burst-4 {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            10% { opacity: 0.9; }
            90% { opacity: 0.8; }
            100% { transform: translate(calc(-50% + 210px), calc(-50% + 110px)) scale(1.7) rotate(60deg); opacity: 0; }
          }
          @keyframes note-burst-5 {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            10% { opacity: 0.9; }
            90% { opacity: 0.8; }
            100% { transform: translate(-50%, calc(-50% - 220px)) scale(1.5) rotate(-20deg); opacity: 0; }
          }
          @keyframes note-burst-6 {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            10% { opacity: 0.9; }
            90% { opacity: 0.8; }
            100% { transform: translate(-50%, calc(-50% + 220px)) scale(1.4) rotate(25deg); opacity: 0; }
          }
          @keyframes note-burst-7 {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            10% { opacity: 0.9; }
            90% { opacity: 0.8; }
            100% { transform: translate(calc(-50% - 240px), calc(-50% - 20px)) scale(1.6) rotate(-60deg); opacity: 0; }
          }
          @keyframes note-burst-8 {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            10% { opacity: 0.9; }
            90% { opacity: 0.8; }
            100% { transform: translate(calc(-50% + 240px), calc(-50% - 20px)) scale(1.5) rotate(55deg); opacity: 0; }
          }

          .burst-card-container:hover .bn-1 { animation: note-burst-1 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite !important; }
          .burst-card-container:hover .bn-2 { animation: note-burst-2 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite 0.2s !important; }
          .burst-card-container:hover .bn-3 { animation: note-burst-3 1.5s cubic-bezier(0.16, 1, 0.3, 1) infinite 0.1s !important; }
          .burst-card-container:hover .bn-4 { animation: note-burst-4 1.9s cubic-bezier(0.16, 1, 0.3, 1) infinite 0.3s !important; }
          .burst-card-container:hover .bn-5 { animation: note-burst-5 1.7s cubic-bezier(0.16, 1, 0.3, 1) infinite 0.15s !important; }
          .burst-card-container:hover .bn-6 { animation: note-burst-6 2.0s cubic-bezier(0.16, 1, 0.3, 1) infinite 0.35s !important; }
          .burst-card-container:hover .bn-7 { animation: note-burst-7 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite 0.05s !important; }
          .burst-card-container:hover .bn-8 { animation: note-burst-8 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite 0.25s !important; }

          /* --- BAŞLANGIÇ YÜKLEME DALGALI NOTA ANİMASYONU --- */
          .initial-loading-notes-container {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1rem;
          }
          
          .initial-loading-note {
            display: inline-block;
            font-size: 2.5rem;
            color: #93a1a1;
            animation: initial-loading-wave 1.5s infinite ease-in-out;
            opacity: 0;
          }

          @keyframes initial-loading-wave {
            0%, 100% {
              transform: translateY(0);
              opacity: 0;
            }
            50% {
              transform: translateY(-20px);
              opacity: 1;
            }
          }
          
          .initial-loading-note:nth-child(1) { animation-delay: 0s; }
          .initial-loading-note:nth-child(2) { animation-delay: 0.1s; }
          .initial-loading-note:nth-child(3) { animation-delay: 0.2s; }
          .initial-loading-note:nth-child(4) { animation-delay: 0.3s; }
          .initial-loading-note:nth-child(5) { animation-delay: 0.4s; }
        ` }} />
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
              {/*<Link
                    href="/play"
                    className="bg-[#b58900] text-white px-6 py-2 rounded-full hover:bg-[#b58900]/80 transition shadow-sm font-semibold flex items-center gap-2"
                  >
                    🎹 MIDI Player
                  </Link> */}
              <button
                onClick={async () => { await supabase.auth.signOut(); }}
                className="bg-[#fdf6e3] text-[#586e75] px-6 py-2 rounded-full border border-[#93a1a1]/50 hover:bg-[#dcd5c4] transition shadow-sm"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </header>

        <main className="w-full flex-grow flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <div className="w-full max-w-6xl px-4 relative isolate">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
              <span className="text-[30rem] md:text-[50rem] text-[#93a1a1] opacity-[0.15] select-none -rotate-12">𝄞</span>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-16 w-full py-8 md:py-12">
              <div className="flex-1 flex flex-col gap-8 items-start select-none">
                <div className="flex flex-col gap-4">
                  <h1 className="text-4xl md:text-5xl font-extrabold text-[#586e75] leading-tight tracking-tight drop-shadow-sm animate-fade-in-up">
                    <span className="block">Yapay Zekanın Gücüyle</span>
                    <span className="block text-3xl md:text-4xl text-[#839496] mt-1">
                      Müziğini <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b58900] to-[#cb4b16]">Yeniden Keşfet!</span>
                    </span>
                  </h1>
                  <p className="text-base text-[#657b83] max-w-xl leading-relaxed font-medium animate-fade-in-up delay-100">
                    Melodify, en gelişmiş yapay zeka ve derin öğrenme modellerini tek bir stüdyoda birleştirir. Şarkılarınızı dilediğiniz gibi ayrıştırın, transkribe edin veya analiz edin!
                  </p>
                </div>

                {/* Yapay Zeka Model Yetenekleri */}
                <div className="w-full flex flex-col gap-4 max-w-xl">
                  {[
                    {
                      icon: "🎙️",
                      title: "Profesyonel Ses Ayrıştırma",
                      desc: "Yüklediğiniz herhangi bir ses dosyasını saniyeler içinde Vokal, Bateri, Bas ve Diğer enstrümanlar olmak üzere 4 izole kanala (stem) böler."
                    },
                    {
                      icon: "🥁",
                      title: "Bateri Transkripsiyonu",
                      desc: "Davul ritimlerini yapay zeka ile analiz ederek milisaniye düzeyinde vuruş tespiti yapar, MIDI parçası ve PDF Nota Kağıdı üretir."
                    },
                    {
                      icon: "🎹",
                      title: "Piyano Transkripsiyonu",
                      desc: "Karmaşık piyano ezgilerini nota nota yakalayarak dinlenebilir MIDI dosyalarına ve pırıl pırıl basılı nota sayfalarına (PDF) dönüştürür."
                    },
                    {
                      icon: "🗣️",
                      title: "Mırıldanma Analizi",
                      desc: "Sadece şarkı söyleyerek veya mırıldanarak yaptığınız kayıtları dinleyerek melodinizi dijital notalara ve ritim şablonlarına döker."
                    },
                    {
                      icon: "🎼",
                      title: "Akor, BPM ve Ton Keşfi",
                      desc: "Şarkının temposunu (BPM), anahtar tonunu ve akor geçişlerini raporlayıp akor MIDI dosyası ile Nota Kağıdı (PDF) hazırlar."
                    }
                  ].map((model, idx) => (
                    <div
                      key={idx}
                      className="flex gap-4 p-3 bg-[#fdf6e3]/50 hover:bg-[#fdf6e3]/80 border border-[#93a1a1]/10 hover:border-[#93a1a1]/30 rounded-2xl transition-all duration-300 shadow-xs hover:shadow-sm"
                    >
                      <span className="text-3xl flex items-center justify-center p-2.5 bg-[#eee8d5] rounded-xl self-start">{model.icon}</span>
                      <div className="flex-1 flex flex-col gap-1">
                        <h4 className="font-bold text-sm text-[#586e75] tracking-tight">{model.title}</h4>
                        <p className="text-xs text-[#657b83] leading-relaxed font-medium">{model.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center animate-fade-in-up delay-300 w-full">
                {/* Pastel Beyazı / Krem Tonlu Premium Kapsayıcı Kutu */}
                <div className="w-full max-w-xl bg-[#fdf6e3]/90 backdrop-blur border border-[#93a1a1]/30 rounded-3xl p-6 md:p-12 flex flex-col items-center justify-center gap-6 md:gap-8 shadow-xl relative burst-card-container">

                  {/* Fışkıran Nota Sembolleri (Hover ile tetiklenir) */}
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none text-4xl font-bold select-none z-10 burst-note bn-1 text-[#b58900]">♩</span>
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none text-4xl font-bold select-none z-10 burst-note bn-2 text-[#2aa198]">♪</span>
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none text-4xl font-bold select-none z-10 burst-note bn-3 text-[#268bd2]">♫</span>
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none text-4xl font-bold select-none z-10 burst-note bn-4 text-[#cb4b16]">♬</span>
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none text-4xl font-bold select-none z-10 burst-note bn-5 text-[#859900]">𝄞</span>
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none text-4xl font-bold select-none z-10 burst-note bn-6 text-[#d33682]">𝄢</span>
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none text-4xl font-bold select-none z-10 burst-note bn-7 text-[#6c71c4]">♯</span>
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 pointer-events-none text-4xl font-bold select-none z-10 burst-note bn-8 text-[#b58900]">♭</span>

                  {/* MIDI Player Hızlı Erişim Butonu */}
                  <Link
                    href="/play"
                    className="w-full max-w-md bg-[#84a98c] text-[#fdf6e3] py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:bg-[#72977a] transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 group/btn cursor-pointer text-lg tracking-wide"
                  >
                    <span className="text-2xl group-hover/btn:scale-110 transition-transform duration-300">🎹</span>
                    <span>Doğrudan MIDI Player'ı Aç</span>
                  </Link>

                  {/* İki butonu birbirinden ayıran zarif pastel ayraç */}
                  <div className="w-full max-w-md flex items-center gap-4 py-1">
                    <div className="flex-grow h-px bg-[#93a1a1]/20"></div>
                    <span className="text-xs font-semibold text-[#93a1a1]/60 tracking-wider uppercase select-none">Veya</span>
                    <div className="flex-grow h-px bg-[#93a1a1]/20"></div>
                  </div>

                  {/* Gizli Dosya Girişi */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".mp3,.wav,.midi"
                  />

                   {uploading ? (
                    /* Yükleme State'i - Renkli Nota Animasyonu ile */
                    <div className="w-full max-w-md flex flex-col items-center gap-6 py-8">
                      <div className="initial-loading-notes-container my-4">
                        <span className="initial-loading-note" style={{ color: '#b58900' }}>♪</span>
                        <span className="initial-loading-note" style={{ color: '#cb4b16' }}>♫</span>
                        <span className="initial-loading-note" style={{ color: '#dc322f' }}>♩</span>
                        <span className="initial-loading-note" style={{ color: '#d33682' }}>♬</span>
                        <span className="initial-loading-note" style={{ color: '#6c71c4' }}>♪</span>
                      </div>
                      <div className="text-center">
                        <h3 className="text-2xl font-black text-[#586e75] tracking-tight">Dosyanız Yükleniyor...</h3>
                        <p className="text-sm text-[#657b83] mt-2 animate-pulse font-medium">Lütfen bekleyin, ses dosyası güvenle stüdyoya aktarılıyor.</p>
                      </div>
                    </div>
                  ) : transcriptionStatus === 'processing' ? (
                    /* Yapay Zeka İşleniyor State'i */
                    <div className="w-full max-w-md flex flex-col items-center gap-6 py-8">
                      <div className="initial-loading-notes-container my-4">
                        <span className="initial-loading-note" style={{ color: '#b58900' }}>♪</span>
                        <span className="initial-loading-note" style={{ color: '#cb4b16' }}>♫</span>
                        <span className="initial-loading-note" style={{ color: '#dc322f' }}>♩</span>
                        <span className="initial-loading-note" style={{ color: '#d33682' }}>♬</span>
                        <span className="initial-loading-note" style={{ color: '#6c71c4' }}>♪</span>
                      </div>
                      <div className="text-center">
                        <h3 className="text-2xl font-black text-[#586e75] tracking-tight">Yapay Zeka İşliyor...</h3>
                        <p className="text-sm text-[#657b83] mt-2 animate-pulse font-medium">Lütfen bekleyin, ses analizi ve transkripsiyon gerçekleştiriliyor.</p>
                      </div>
                      <div className="w-full bg-[#93a1a1]/20 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#84a98c] h-full rounded-full animate-pulse" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                  ) : transcriptionStatus === 'completed' ? (
                    /* Yapay Zeka Tamamlandı State'i */
                    <div className="w-full max-w-md flex flex-col items-center gap-6 py-6">
                      <div className="text-center">
                        <h3 className="text-2xl font-black text-[#84a98c] tracking-tight">İşlem Başarıyla Tamamlandı!</h3>
                        <p className="text-sm text-[#657b83] mt-1 font-semibold">Yapay zeka transkripsiyonu tamamladı.</p>
                      </div>

                      {/* Sonuç Linkleri / Butonlar */}
                      <div className="w-full flex flex-col gap-4 mt-2">
                        {transcriptionResult?.outputs?.midi_url ? (
                          (() => {
                            const isDrums = transcriptionResult.task_type === 'adtof' || selectedTask === 'adtof';
                            const isBTC = transcriptionResult.task_type === 'btc' || selectedTask === 'btc';
                            const isBasicPitch = transcriptionResult.task_type === 'basic_pitch' || selectedTask === 'basic_pitch';
                            const defaultInstrument = isDrums ? 'synth_drum' : 'acoustic_grand_piano';
                            const downloadFilename = isDrums
                              ? 'drums_transcription.mid'
                              : (isBTC ? 'chords_transcription.mid' : (isBasicPitch ? 'hum_transcription.mid' : 'piano_transcription.mid'));
                            const playEmoji = isDrums ? '🥁' : (isBTC ? '🎼' : (isBasicPitch ? '🗣️' : '🎹'));
                            const playText = isDrums
                              ? "MIDI Player'da Oynat (Davul)"
                              : (isBTC ? "Akorları MIDI Player'da Oynat" : (isBasicPitch ? "Mırıldanmayı MIDI Player'da Oynat" : "MIDI Player'da Oynat (Piyano)"));

                            return (
                              <>
                                {isBTC && (transcriptionResult.outputs.bpm || transcriptionResult.outputs.key) && (
                                  <div className="w-full flex flex-col gap-3 p-4 bg-[#eee8d5] border border-[#93a1a1]/30 rounded-2xl shadow-sm mb-2 text-left">
                                    <h4 className="font-bold text-[#586e75] text-sm tracking-wide uppercase">🎵 Analiz Sonuçları</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="bg-[#84a98c]/15 p-3 rounded-xl border border-[#84a98c]/25 text-center">
                                        <span className="text-[10px] font-bold text-[#657b83] uppercase tracking-wide">Hız (BPM)</span>
                                        <p className="text-xl font-black text-[#586e75] mt-1">🥁 {transcriptionResult.outputs.bpm}</p>
                                      </div>
                                      <div className="bg-[#b58900]/15 p-3 rounded-xl border border-[#b58900]/25 text-center">
                                        <span className="text-[10px] font-bold text-[#657b83] uppercase tracking-wide">Anahtar Ton</span>
                                        <p className="text-sm font-black text-[#b58900] mt-1.5" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🎹 {transcriptionResult.outputs.key}</p>
                                      </div>
                                    </div>

                                    {transcriptionResult.outputs.chords && transcriptionResult.outputs.chords.length > 0 && (
                                      <div className="mt-1 w-full overflow-hidden">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-semibold text-[#586e75]">🎶 Çıkartılan Akor Dizilimi:</span>
                                          <button
                                            onClick={downloadChordsAsText}
                                            className="text-[10px] bg-[#6b828a] hover:bg-[#5a6f76] text-[#fdf6e3] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer hover:scale-105 active:scale-95"
                                          >
                                            <span>📄</span> TXT İndir
                                          </button>
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#93a1a1]/30 scrollbar-track-transparent w-full">
                                          {transcriptionResult.outputs.chords.map((c: any, idx: number) => (
                                            <div key={idx} className="flex-shrink-0 bg-[#fdf6e3] border border-[#93a1a1]/30 px-3.5 py-1.5 rounded-xl text-center shadow-xs">
                                              <span className="block font-black text-sm text-[#cb4b16]">{c.chord}</span>
                                              <span className="block text-[9px] font-mono text-[#93a1a1] mt-0.5">{c.start}s - {c.end}s</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <Link
                                  href={`/play?url=${encodeURIComponent(transcriptionResult.outputs.midi_url)}&name=${encodeURIComponent(downloadFilename)}&instrument=${defaultInstrument}${transcriptionResult.outputs.pdf_url ? `&pdfUrl=${encodeURIComponent(transcriptionResult.outputs.pdf_url)}` : ''}`}
                                  className="w-full bg-[#84a98c] text-[#fdf6e3] py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:bg-[#72977a] transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer text-lg tracking-wide group/btn text-center"
                                >
                                  <span className="text-2xl group-hover/btn:rotate-12 transition-transform">{playEmoji}</span>
                                  <span>{playText}</span>
                                </Link>

                                <a
                                  href={`${transcriptionResult.outputs.midi_url}?download=${downloadFilename}`}
                                  className="w-full bg-[#6b828a] text-[#fdf6e3] py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:bg-[#5a6f76] transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer text-lg tracking-wide text-center"
                                >
                                  <span className="text-2xl">📥</span>
                                  <span>{isBTC ? 'Akor MIDI Dosyasını İndir' : (isBasicPitch ? 'Mırıldanma MIDI Dosyasını İndir' : 'MIDI Dosyasını İndir')}</span>
                                </a>

                                {transcriptionResult.outputs.pdf_url && (
                                  <a
                                    href={`${transcriptionResult.outputs.pdf_url}?download=${isDrums ? 'drums_sheet.pdf' : (isBTC ? 'chords_sheet.pdf' : (isBasicPitch ? 'hum_sheet.pdf' : 'piano_sheet.pdf'))}`}
                                    className="w-full bg-[#c2847a] text-[#fdf6e3] py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:bg-[#b07268] transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer text-lg tracking-wide text-center"
                                  >
                                    <span className="text-2xl">🎼</span>
                                    <span>{isBTC ? 'Akor Nota Kağıdını İndir (PDF)' : (isBasicPitch ? 'Mırıldanma Nota Kağıdını İndir (PDF)' : 'Nota Kağıdını İndir (PDF)')}</span>
                                  </a>
                                )}
                              </>
                            );
                          })()
                        ) : transcriptionResult?.outputs?.vocals_url ? (
                          /* Demucs Ayrıştırılan Parçalar (Vokal, Davul, Bas, Diğer) */
                          <div className="w-full flex flex-col gap-4">
                            <p className="text-sm font-black text-[#586e75] mb-1 tracking-tight flex items-center gap-2">
                              <span>🎙️</span> Ayrıştırılan Ses Kanalları (Demucs AI Stems)
                            </p>
                            {[
                              { label: '🎙️ Vokal (Vocals)', url: transcriptionResult.outputs.vocals_url, name: 'vocals.wav' },
                              { label: '🥁 Davul (Drums)', url: transcriptionResult.outputs.drums_url, name: 'drums.wav' },
                              { label: '🎸 Bas (Bass)', url: transcriptionResult.outputs.bass_url, name: 'bass.wav' },
                              { label: '🎵 Diğer (Other)', url: transcriptionResult.outputs.other_url, name: 'other.wav' },
                            ].map((track, idx) => (
                              <div
                                key={idx}
                                className="w-full bg-[#fdf6e3]/80 hover:bg-[#fdf6e3] border border-[#93a1a1]/30 p-4 rounded-2xl shadow-sm flex flex-col gap-2.5 transition-all duration-300 hover:shadow-md"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-bold text-sm text-[#586e75]">{track.label}</span>
                                  <a
                                    href={`${track.url}?download=${track.name}`}
                                    className="bg-[#6b828a] hover:bg-[#5a6f76] text-[#fdf6e3] py-1 px-3 rounded-xl flex items-center gap-1.5 transition-all duration-200 text-xs font-bold cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                                  >
                                    <span>📥</span>
                                    <span>İndir</span>
                                  </a>
                                </div>
                                <div className="w-full mt-0.5">
                                  <audio
                                    src={track.url}
                                    controls
                                    className="w-full h-8 rounded-lg outline-none opacity-85 hover:opacity-100 transition-opacity"
                                    style={{
                                      filter: 'sepia(15%) saturate(80%) grayscale(5%)',
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-[#cb4b16] font-bold">Çıktı dosyası bulunamadı.</p>
                        )}
                      </div>

                      {/* Yeni Dosya İşle Butonu */}
                      <button
                        onClick={() => {
                          setTranscriptionFileUrl(null);
                          setTranscriptionStatus('idle');
                          setTranscriptionResult(null);
                        }}
                        className="text-xs text-[#586e75] hover:underline font-bold mt-4 cursor-pointer transition-colors"
                      >
                        🔄 Yeni Bir İşlem Başlat
                      </button>
                    </div>
                  ) : transcriptionStatus === 'failed' ? (
                    /* Yapay Zeka Hata State'i */
                    <div className="w-full max-w-md flex flex-col items-center gap-6 py-8">
                      <div className="text-7xl">⚠️</div>
                      <div className="text-center">
                        <h3 className="text-2xl font-black text-[#cb4b16] tracking-tight">İşlem Başarısız Oldu</h3>
                        <p className="text-sm text-[#657b83] mt-2 font-medium">Yapay zeka transkripsiyon yaparken bir sorunla karşılaştı.</p>
                        {transcriptionError && (
                          <div className="mt-4 p-4 bg-[#cb4b16]/10 text-[#cb4b16] rounded-xl text-xs font-mono max-h-32 overflow-y-auto border border-[#cb4b16]/20">
                            {transcriptionError}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setTranscriptionStatus('idle');
                          setTranscriptionError(null);
                        }}
                        className="w-full bg-[#c2847a] text-[#fdf6e3] py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:bg-[#b07268] transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer text-lg tracking-wide"
                      >
                        <span>🔄 Yeniden Dene</span>
                      </button>
                    </div>
                  ) : transcriptionFileUrl ? (
                    /* Dosya Hazır ve Seçenek Seçim Paneli */
                    <div className="w-full max-w-md flex flex-col items-center gap-6">
                      <div className="text-center">
                        <h3 className="text-xl text-[#586e75] font-extrabold tracking-tight">🎉 Dosyan Başarıyla Yüklendi!</h3>
                        <p className="text-xs text-[#657b83] mt-1">Uygulamak istediğin yapay zeka işlemini seç:</p>
                      </div>

                      {/* Yapay Zeka İşlem Listesi */}
                      <div className="w-full flex flex-col gap-3">
                        {[
                          { id: 'demucs', name: "Şarkıyı vokal, bateri, bass ve diğer enstrümanlar olarak 4 parçaya ayır.", emoji: "🎙️" },
                          { id: 'adtof', name: "Bateri Transkripsiyonu", emoji: "🥁" },
                          { id: 'bytedance', name: "Piyano Transkripsiyonu", emoji: "🎹" },
                          { id: 'basic_pitch', name: "Mırıldanmayı Ritme Dönüştür", emoji: "🗣️" },
                          { id: 'btc', name: "Şarkının akorlarını, bpm ve tonunu çıkart.", emoji: "🎼" },
                        ].map((task) => {
                          const isSelected = selectedTask === task.id;
                          return (
                            <button
                              key={task.id}
                              onClick={() => setSelectedTask(task.id)}
                              className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3.5 cursor-pointer select-none ${isSelected
                                  ? 'bg-[#84a98c]/10 border-[#84a98c] shadow-sm'
                                  : 'bg-[#fdf6e3]/40 border-[#93a1a1]/30 hover:border-[#6b828a] hover:bg-[#fdf6e3]'
                                }`}
                            >
                              <span className="text-xl mt-0.5">{task.emoji}</span>
                              <div className="flex-1">
                                <p className={`text-xs font-bold leading-relaxed ${isSelected ? 'text-[#586e75]' : 'text-[#657b83]'}`}>
                                  {task.name}
                                </p>
                              </div>
                              <div className="flex items-center h-full pt-1">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#84a98c] bg-[#84a98c]' : 'border-[#93a1a1]/50'
                                  }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#fdf6e3]"></div>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* İşlemi Başlat Butonu - MIDI Player Butonuyla %100 Aynı Formatta */}
                      <div className="w-full flex flex-col items-center gap-3 mt-1">
                        <button
                          onClick={() => {
                            const taskMap: Record<string, { name: string, endpoint: string }> = {
                              demucs: { name: "Demucs Ayrıştırma", endpoint: "http://127.0.0.1:8000/api/transcribe" },
                              adtof: { name: "ADTOF Bateri Transkripsiyonu", endpoint: "http://127.0.0.1:8000/api/transcribe/adtof" },
                              bytedance: { name: "ByteDance Piyano Transkripsiyonu", endpoint: "http://127.0.0.1:8000/api/transcribe/bytedance" },
                              basic_pitch: { name: "Basic Pitch Ritme Dönüştürme", endpoint: "http://127.0.0.1:8000/api/transcribe/basic_pitch" },
                              btc: { name: "BTC Akor & BPM Analizi", endpoint: "http://127.0.0.1:8000/api/transcribe/btc" },
                            };
                            const current = taskMap[selectedTask];
                            handleTranscriptionStart(current.endpoint, current.name);
                          }}
                          className="w-full bg-[#c2847a] text-[#fdf6e3] py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:bg-[#b07268] transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer text-lg tracking-wide"
                        >
                          <span className="text-2xl">🚀</span>
                          <span>İşlemi Başlat</span>
                        </button>

                        <button
                          onClick={() => setTranscriptionFileUrl(null)}
                          className="text-xs text-[#586e75] hover:underline font-bold cursor-pointer transition-colors"
                        >
                          Farklı Bir Dosya Yükle
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Dosya Seç Butonu - MIDI Player Butonuyla %100 Aynı Formatta */
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full max-w-md bg-[#6b828a] text-[#fdf6e3] py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:bg-[#5a6f76] transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer text-lg tracking-wide group/btn"
                    >
                      <span className="text-2xl group-hover/btn:scale-110 transition-transform duration-300">🎵</span>
                      <span>Transkripsiyon Yap</span>
                    </button>
                  )}
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
