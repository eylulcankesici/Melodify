'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import { Lobster } from 'next/font/google';
import TranscriptionHistory from '@/components/TranscriptionHistory';

import '@/components/react-piano-player/src/App.css';
import '@/components/react-piano-player/src/index.css';

const lobster = Lobster({
  subsets: ['latin'],
  weight: '400',
});

const PianoPlayer = dynamic(
  () => import('@/components/react-piano-player/src/PianoPlayer'),
  { 
    ssr: false,
    loading: () => <div className="w-full h-full flex items-center justify-center bg-[#dcd5c4]"><div className="animate-pulse text-5xl"><span style={{ animationDelay: '0.1s', color: '#b58900' }}>♪</span><span style={{ animationDelay: '0.2s', color: '#cb4b16' }}>♫</span><span style={{ animationDelay: '0.3s', color: '#dc322f' }}>♩</span><span style={{ animationDelay: '0.4s', color: '#d33682' }}>♬</span><span style={{ animationDelay: '0.5s', color: '#6c71c4' }}>♭</span></div></div>
  }
);

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [midiUrl, setMidiUrl] = useState('/demo.mid');
  
  const [uploading, setUploading] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pianoRef = useRef<HTMLDivElement>(null);


  const [transcriptionFileUrl, setTranscriptionFileUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResultUrl, setTranscriptionResultUrl] = useState<string | null>(null);
  const [showTranscriptions, setShowTranscriptions] = useState(false);

  useEffect(() => {
    const fetchUser = supabase.auth.getUser();
    const minDelay = new Promise(resolve => setTimeout(resolve, 4000));

    Promise.all([fetchUser, minDelay]).then(([{ data }]) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    purpose: 'transcription' | 'midiplayer'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setShowUploadOptions(false);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage
      .from('audio-files')
      .upload(fileName, file);

    setUploading(false);

    if (error) {
      alert('Yükleme hatası: ' + error.message);
    } else {
      const url = supabase.storage.from('audio-files').getPublicUrl(fileName).data.publicUrl;
      handleMidiUpload(url, purpose);
    }
  };
  
  const handleOptionClick = (purpose: 'transcription' | 'midiplayer') => {
    if (fileInputRef.current) {
      const newFileInput = fileInputRef.current.cloneNode(true) as HTMLInputElement;
      fileInputRef.current.parentNode?.replaceChild(newFileInput, fileInputRef.current);
      
      newFileInput.onchange = (event: Event) =>
        handleFileChange(event as unknown as React.ChangeEvent<HTMLInputElement>, purpose);
      newFileInput.click();
    }
  };

  const handleMidiUpload = (url: string, purpose: 'transcription' | 'midiplayer') => {
    if (purpose === 'midiplayer') {
      setMidiUrl(url);
      setTranscriptionFileUrl(null);
      setTranscriptionResultUrl(null);

      setTimeout(() => {
        pianoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else {
      setTranscriptionFileUrl(url);
    }
  };

  const handleStartTranscription = async () => {
    if (!transcriptionFileUrl || isTranscribing || !user) return;

    setIsTranscribing(true);
    setTranscriptionResultUrl(null);

    try {
      // 1. Flask servisine istek at - MIDI üret (Next.js API route üzerinden)
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audioUrl: transcriptionFileUrl }),
      });

      if (!transcribeResponse.ok) {
        const err = await transcribeResponse.json();
        throw new Error(err.error || 'Transkripsiyon sırasında bir hata oluştu.');
      }

      const midiBlob = await transcribeResponse.blob();
      
      // 2. MIDI blob'unu yeni mikroservise gönder - Storage'a yükle ve veritabanına kaydet
      // Kullanıcı access token'ını al
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const formData = new FormData();
      formData.append('midiBlob', midiBlob, 'transcribed.midi');
      formData.append('userId', user.id);
      formData.append('audioUrl', transcriptionFileUrl);
      if (accessToken) {
        formData.append('accessToken', accessToken);
      }

      const saveResponse = await fetch('/api/transcriptions', {
        method: 'POST',
        body: formData,
      });

      if (!saveResponse.ok) {
        const err = await saveResponse.json();
        throw new Error(err.error || 'Transkripsiyon kaydedilirken bir hata oluştu.');
      }

      const savedData: { midiUrl: string } = await saveResponse.json();
      
      // 3. Kalıcı MIDI URL'ini kullan
      setTranscriptionResultUrl(savedData.midiUrl);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
      alert('Hata: ' + message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const resetTranscription = () => {
    setTranscriptionFileUrl(null);
    setIsTranscribing(false);
    setTranscriptionResultUrl(null);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="min-h-screen w-full bg-[#eee8d5] flex flex-col items-center justify-center">
          <div className={`${lobster.className} text-8xl text-[#586e75] drop-shadow-sm select-none flex items-end`}>
            <span>Melodi</span>
            <span className="text-9xl text-[#b58900] leading-none mx-[-0.05em]">𝄞</span>
            <span className="mb-2">y</span>
          </div>
          <div className="initial-loading-notes-container">
            <span className="initial-loading-note">♪</span>
            <span className="initial-loading-note">♫</span>
            <span className="initial-loading-note">♩</span>
            <span className="initial-loading-note">♬</span>
            <span className="initial-loading-note">♪</span>
          </div>
        </div>
      );
    }
  
    if (!user) {
      return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#eee8d5] overflow-hidden p-4 isolate">
          <span className="text-8xl text-[#268bd2] font-black opacity-20 absolute top-[5%] left-[10%] select-none animate-float">♪</span>
          <span className="text-4xl text-[#b58900] font-black opacity-30 absolute top-[15%] left-[20%] select-none animate-float-delay-1">♫</span>
          <span className="text-6xl text-[#657b83] font-black opacity-20 absolute top-[30%] left-[5%] select-none animate-float-delay-2">♮</span>
          <span className="text-3xl text-[#586e75] font-black opacity-20 absolute top-[25%] left-[45%] -translate-x-1/2 select-none animate-float-delay-4">♭</span>
          <span className="text-5xl text-[#b58900] font-black opacity-30 absolute top-[5%] left-[40%] -translate-x-1/2 select-none animate-float-delay-5">♩</span>
          <span className="text-9xl text-[#859900] font-black opacity-20 absolute top-[8%] right-[8%] select-none animate-float-delay-1">♬</span>
          <span className="text-5xl text-[#93a1a1] font-black opacity-20 absolute top-[28%] right-[15%] select-none animate-float-delay-2">♩</span>
          <span className="text-6xl text-[#b58900] font-black opacity-30 absolute top-[20%] right-[5%] select-none animate-float-delay-6">♪</span>
          <span className="text-7xl text-[#cb4b16] font-black opacity-20 absolute top-1/2 -translate-y-1/2 left-[15%] select-none animate-float-delay-3">♯</span>
          <span className="text-4xl text-[#93a1a1] font-black opacity-30 absolute top-1/2 -translate-y-1/2 -mt-20 left-[25%] select-none animate-float-delay-4">♭</span>
          <span className="text-8xl text-[#b58900] font-black opacity-30 absolute top-1/2 -translate-y-1/2 right-[20%] select-none animate-float-delay-5">♫</span>
          <span className="text-5xl text-[#6c71c4] font-black opacity-20 absolute top-1/2 -translate-y-1/2 mt-24 right-[12%] select-none animate-float-delay-6">♮</span>
          <span className="text-9xl text-[#d33682] font-black opacity-20 absolute bottom-[10%] left-[12%] select-none animate-float">♬</span>
          <span className="text-6xl text-[#93a1a1] font-black opacity-30 absolute bottom-[25%] left-[22%] select-none animate-float-delay-1">♩</span>
          <span className="text-4xl text-[#b58900] font-black opacity-20 absolute bottom-[5%] left-[30%] select-none animate-float-delay-2">♪</span>
          <span className="text-7xl text-[#2aa198] font-black opacity-20 absolute bottom-[8%] left-1/2 -translate-x-1/2 select-none animate-float-delay-3">♭</span>
          <span className="text-5xl text-[#b58900] font-black opacity-30 absolute bottom-[20%] left-1/2 -translate-x-1/2 ml-16 select-none animate-float-delay-4">♯</span>
          <span className="text-8xl text-[#93a1a1] font-black opacity-20 absolute bottom-[5%] right-[5%] select-none animate-float-delay-5">♫</span>
          <span className="text-5xl text-[#586e75] font-black opacity-30 absolute bottom-[30%] right-[15%] select-none animate-float-delay-6">♮</span>
          <span className="text-3xl text-[#268bd2] font-black opacity-20 absolute top-[50%] left-[55%] select-none animate-float-delay-1">♪</span>
          <span className="text-5xl text-[#b58900] font-black opacity-20 absolute top-[65%] left-[80%] select-none animate-float-delay-2">♫</span>
          <span className="text-7xl text-[#859900] font-black opacity-20 absolute top-[80%] left-[5%] select-none animate-float-delay-3">♮</span>
          <span className="text-4xl text-[#93a1a1] font-black opacity-20 absolute top-[95%] left-[45%] select-none animate-float-delay-4">♯</span>
          <span className="text-6xl text-[#6c71c4] font-black opacity-20 absolute top-[60%] right-[30%] select-none animate-float-delay-5">♭</span>
          <span className="text-3xl text-[#b58900] font-black opacity-30 absolute bottom-[5%] right-[25%] select-none animate-float-delay-6">♬</span>
          <span className="text-5xl text-[#d33682] font-black opacity-20 absolute bottom-[15%] right-[45%] select-none animate-float">♩</span>
          <span className="text-4xl text-[#cb4b16] font-black opacity-20 absolute top-[70%] left-[18%] select-none animate-float-delay-1">♪</span>
          <span className="text-6xl text-[#268bd2] font-black opacity-25 absolute top-[5%] right-[30%] select-none animate-float-delay-3">♫</span>
          <span className="text-3xl text-[#d33682] font-black opacity-30 absolute bottom-[35%] right-[5%] select-none animate-float-delay-5">♭</span>
          <span className="text-7xl text-[#859900] font-black opacity-20 absolute bottom-[2%] left-[50%] select-none animate-float-delay-2">♮</span>
          <span className="text-5xl text-[#6c71c4] font-black opacity-25 absolute top-[45%] left-[35%] select-none animate-float-delay-4">♯</span>
          <span className="text-4xl text-[#b58900] font-black opacity-30 absolute top-[75%] right-[25%] select-none animate-float-delay-6">♩</span>
          <span className="text-8xl text-[#657b83] font-black opacity-20 absolute top-[50%] right-[45%] select-none animate-float-delay-1">♬</span>
          <span className="text-5xl text-[#2aa198] font-black opacity-25 absolute bottom-[10%] left-[40%] select-none animate-float-delay-3">♪</span>
          <span className="text-3xl text-[#cb4b16] font-black opacity-30 absolute top-[2%] left-[60%] select-none animate-float-delay-5">♫</span>
          <span className="text-6xl text-[#93a1a1] font-black opacity-20 absolute bottom-[40%] left-[10%] select-none animate-float-delay-2">♩</span>
          <span className="text-8xl text-[#268bd2] font-black opacity-20 absolute top-[5%] left-[10%] select-none animate-float">♪</span>
          <span className="text-6xl text-[#93a1a1] font-black opacity-20 absolute bottom-[40%] left-[10%] select-none animate-float-delay-2">♩</span>
          
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

    return (
      <div className="min-h-screen w-full bg-[#eee8d5] flex flex-col font-sans relative overflow-hidden">
        <span className="text-8xl text-[#268bd2] font-black opacity-20 absolute top-[5%] left-[10%] select-none animate-float">♪</span>
        <span className="text-4xl text-[#b58900] font-black opacity-30 absolute top-[15%] left-[20%] select-none animate-float-delay-1">♫</span>
        <span className="text-6xl text-[#657b83] font-black opacity-20 absolute top-[30%] left-[5%] select-none animate-float-delay-2">♮</span>
        <span className="text-3xl text-[#586e75] font-black opacity-20 absolute top-[25%] left-[45%] -translate-x-1/2 select-none animate-float-delay-4">♭</span>
        <span className="text-5xl text-[#b58900] font-black opacity-30 absolute top-[5%] left-[40%] -translate-x-1/2 select-none animate-float-delay-5">♩</span>
        <span className="text-9xl text-[#859900] font-black opacity-20 absolute top-[8%] right-[8%] select-none animate-float-delay-1">♬</span>
        <span className="text-5xl text-[#93a1a1] font-black opacity-20 absolute top-[28%] right-[15%] select-none animate-float-delay-2">♩</span>
        <span className="text-6xl text-[#b58900] font-black opacity-30 absolute top-[20%] right-[5%] select-none animate-float-delay-6">♪</span>
        <span className="text-7xl text-[#cb4b16] font-black opacity-20 absolute top-1/2 -translate-y-1/2 left-[15%] select-none animate-float-delay-3">♯</span>
        <span className="text-4xl text-[#93a1a1] font-black opacity-30 absolute top-1/2 -translate-y-1/2 -mt-20 left-[25%] select-none animate-float-delay-4">♭</span>
        <span className="text-8xl text-[#b58900] font-black opacity-30 absolute top-1/2 -translate-y-1/2 right-[20%] select-none animate-float-delay-5">♫</span>
        <span className="text-5xl text-[#6c71c4] font-black opacity-20 absolute top-1/2 -translate-y-1/2 mt-24 right-[12%] select-none animate-float-delay-6">♮</span>
        <span className="text-9xl text-[#d33682] font-black opacity-20 absolute bottom-[10%] left-[12%] select-none animate-float">♬</span>
        <span className="text-6xl text-[#93a1a1] font-black opacity-30 absolute bottom-[25%] left-[22%] select-none animate-float-delay-1">♩</span>
        <span className="text-4xl text-[#b58900] font-black opacity-20 absolute bottom-[5%] left-[30%] select-none animate-float-delay-2">♪</span>
        <span className="text-7xl text-[#2aa198] font-black opacity-20 absolute bottom-[8%] left-1/2 -translate-x-1/2 select-none animate-float-delay-3">♭</span>
        <span className="text-5xl text-[#b58900] font-black opacity-30 absolute bottom-[20%] left-1/2 -translate-x-1/2 ml-16 select-none animate-float-delay-4">♯</span>
        <span className="text-8xl text-[#93a1a1] font-black opacity-20 absolute bottom-[5%] right-[5%] select-none animate-float-delay-5">♫</span>
        <span className="text-5xl text-[#586e75] font-black opacity-30 absolute bottom-[30%] right-[15%] select-none animate-float-delay-6">♮</span>
        <span className="text-3xl text-[#268bd2] font-black opacity-20 absolute top-[50%] left-[55%] select-none animate-float-delay-1">♪</span>
        <span className="text-5xl text-[#b58900] font-black opacity-20 absolute top-[65%] left-[80%] select-none animate-float-delay-2">♫</span>
        <span className="text-7xl text-[#859900] font-black opacity-20 absolute top-[80%] left-[5%] select-none animate-float-delay-3">♮</span>
        <span className="text-4xl text-[#93a1a1] font-black opacity-20 absolute top-[95%] left-[45%] select-none animate-float-delay-4">♯</span>
        <span className="text-6xl text-[#6c71c4] font-black opacity-20 absolute top-[60%] right-[30%] select-none animate-float-delay-5">♭</span>
        <span className="text-3xl text-[#b58900] font-black opacity-30 absolute bottom-[5%] right-[25%] select-none animate-float-delay-6">♬</span>
        <span className="text-5xl text-[#d33682] font-black opacity-20 absolute bottom-[15%] right-[45%] select-none animate-float">♩</span>
        <span className="text-4xl text-[#cb4b16] font-black opacity-20 absolute top-[70%] left-[18%] select-none animate-float-delay-1">♪</span>
        <span className="text-6xl text-[#268bd2] font-black opacity-25 absolute top-[5%] right-[30%] select-none animate-float-delay-3">♫</span>
        <span className="text-3xl text-[#d33682] font-black opacity-30 absolute bottom-[35%] right-[5%] select-none animate-float-delay-5">♭</span>
        <span className="text-7xl text-[#859900] font-black opacity-20 absolute bottom-[2%] left-[50%] select-none animate-float-delay-2">♮</span>
        <span className="text-5xl text-[#6c71c4] font-black opacity-25 absolute top-[45%] left-[35%] select-none animate-float-delay-4">♯</span>
        <span className="text-4xl text-[#b58900] font-black opacity-30 absolute top-[75%] right-[25%] select-none animate-float-delay-6">♩</span>
        <span className="text-8xl text-[#657b83] font-black opacity-20 absolute top-[50%] right-[45%] select-none animate-float-delay-1">♬</span>
        <span className="text-5xl text-[#2aa198] font-black opacity-25 absolute bottom-[10%] left-[40%] select-none animate-float-delay-3">♪</span>
        <span className="text-3xl text-[#cb4b16] font-black opacity-30 absolute top-[2%] left-[60%] select-none animate-float-delay-5">♫</span>
        <span className="text-6xl text-[#93a1a1] font-black opacity-20 absolute bottom-[40%] left-[10%] select-none animate-float-delay-2">♩</span>
        <span className="text-4xl text-[#dc322f] font-black opacity-25 absolute bottom-[15%] right-[8%] select-none animate-float-delay-4">♬</span>
        <span className="text-7xl text-[#268bd2] font-black opacity-20 absolute top-[40%] left-[8%] select-none animate-float-delay-5">♪</span>
        <span className="text-5xl text-[#cb4b16] font-black opacity-30 absolute bottom-[45%] right-[12%] select-none animate-float-delay-1">♫</span>
        <span className="text-3xl text-[#859900] font-black opacity-25 absolute top-[85%] left-[15%] select-none animate-float-delay-3">♩</span>
        <span className="text-6xl text-[#6c71c4] font-black opacity-20 absolute top-[12%] right-[40%] select-none animate-float-delay-6">♬</span>
        <span className="text-5xl text-[#d33682] font-black opacity-20 absolute bottom-[18%] right-[22%] select-none animate-float-delay-2">♬</span>
        <span className="text-7xl text-[#93a1a1] font-black opacity-25 absolute top-[60%] left-[12%] select-none animate-float-delay-4">♪</span>
        <span className="text-4xl text-[#2aa198] font-black opacity-30 absolute top-[15%] right-[25%] select-none animate-float-delay-5">♫</span>
        <span className="text-6xl text-[#cb4b16] font-black opacity-20 absolute bottom-[30%] left-[8%] select-none animate-float-delay-6">♩</span>
        <span className="text-5xl text-[#586e75] font-black opacity-25 absolute top-[55%] right-[40%] select-none animate-float">♪</span>
        <span className="text-4xl text-[#2aa198] font-black opacity-20 absolute top-[18%] left-[30%] select-none animate-float-delay-1">♫</span>
        <span className="text-7xl text-[#d33682] font-black opacity-25 absolute top-[35%] right-[10%] select-none animate-float-delay-2">♪</span>
        <span className="text-3xl text-[#b58900] font-black opacity-30 absolute top-[5%] right-[20%] select-none animate-float-delay-3">♩</span>
        <span className="text-5xl text-[#268bd2] font-black opacity-20 absolute top-[25%] left-[55%] select-none animate-float-delay-4">♬</span>
        <span className="text-5xl text-[#859900] font-black opacity-25 absolute top-[22%] left-[35%] select-none animate-float-delay-1">♫</span>
        <span className="text-4xl text-[#6c71c4] font-black opacity-20 absolute top-[38%] right-[35%] select-none animate-float-delay-2">♭</span>
        <span className="text-6xl text-[#d33682] font-black opacity-25 absolute top-[52%] left-[28%] select-none animate-float-delay-3">♬</span>
        <span className="text-3xl text-[#2aa198] font-black opacity-30 absolute top-[68%] right-[18%] select-none animate-float-delay-4">♪</span>
        <span className="text-7xl text-[#b58900] font-black opacity-20 absolute top-[32%] left-[50%] -translate-x-1/2 select-none animate-float-delay-5">♩</span>
        <span className="text-5xl text-[#93a1a1] font-black opacity-25 absolute top-[42%] right-[28%] select-none animate-float-delay-6">♮</span>
        <span className="text-4xl text-[#268bd2] font-black opacity-20 absolute bottom-[22%] left-[18%] select-none animate-float">♫</span>
        <span className="text-6xl text-[#cb4b16] font-black opacity-30 absolute top-[28%] left-[42%] select-none animate-float-delay-1">♯</span>
        <span className="text-3xl text-[#859900] font-black opacity-25 absolute bottom-[28%] right-[35%] select-none animate-float-delay-2">♬</span>
        <span className="text-5xl text-[#6c71c4] font-black opacity-20 absolute top-[48%] left-[38%] select-none animate-float-delay-3">♪</span>
        <span className="text-7xl text-[#d33682] font-black opacity-25 absolute bottom-[12%] left-[25%] select-none animate-float-delay-4">♭</span>
        <span className="text-4xl text-[#2aa198] font-black opacity-30 absolute top-[62%] right-[15%] select-none animate-float-delay-5">♩</span>
        <span className="text-6xl text-[#b58900] font-black opacity-20 absolute top-[38%] left-[48%] select-none animate-float-delay-6">♫</span>
        <span className="text-3xl text-[#93a1a1] font-black opacity-25 absolute bottom-[35%] right-[28%] select-none animate-float">♮</span>
        <span className="text-5xl text-[#268bd2] font-black opacity-20 absolute top-[58%] left-[22%] select-none animate-float-delay-1">♯</span>
        <header className="w-full bg-[#fdf6e3]/80 backdrop-blur-sm border-b border-[#93a1a1]/30 sticky top-0 z-50"></header>
        <span className="text-6xl text-[#cb4b16] font-black opacity-25 absolute top-[45%] left-[2%] select-none animate-float-delay-5">♫</span>
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
              <button
                onClick={() => setShowTranscriptions(prev => !prev)}
                className="bg-[#fdf6e3] text-[#586e75] px-6 py-2 rounded-full border border-[#93a1a1]/50 hover:bg-[#dcd5c4] transition shadow-sm font-semibold"
              >
                {showTranscriptions ? 'Ana Ekran' : 'Transkripsiyonlarım'}
              </button>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                className="bg-[#fdf6e3] text-[#586e75] px-6 py-2 rounded-full border border-[#93a1a1]/50 hover:bg-[#dcd5c4] transition shadow-sm"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </header>

        <main className="w-full flex-grow flex flex-col items-center">
          <div className="w-full flex-grow flex items-center justify-center" style={{minHeight: 'calc(100vh - 80px)'}}>
            <div className="w-full max-w-6xl px-4 relative isolate">
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                  <span className="text-[30rem] md:text-[50rem] text-[#93a1a1] opacity-[0.15] select-none -rotate-12">𝄞</span>
              </div>
              <div className="flex flex-col md:flex-row items-center justify-center gap-16 w-full">
                  <div className="flex-1 flex flex-col gap-6 items-start">
                    {showTranscriptions ? (
                      <div className="w-full">
                        <TranscriptionHistory />
                      </div>
                    ) : (
                      <>
                        <h1 className="text-5xl md:text-6xl font-extrabold text-[#586e75] leading-tight tracking-tight drop-shadow-sm animate-fade-in-up">
                          <span className="block">Piyano Dosyanı Yükle</span>
                          <span className="block text-4xl md:text-5xl text-[#839496] mt-4">
                            Dilersen <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b58900] to-[#cb4b16]">Oynat</span>
                          </span>
                          <span className="block text-4xl md:text-5xl text-[#839496]">
                            Dilersen <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#268bd2] to-[#2aa198]">Dönüştür</span>
                          </span>
                        </h1>
                        <p className="text-lg md:text-xl text-[#657b83] max-w-xl animate-fade-in-up delay-100">
                          Dilediğin piyano dosyasını yükle, piyanoda çal veya notalara dönüştür.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col items-center gap-8 animate-fade-in-up delay-300">
                    <div 
                      className="rotating-glow-box group"
                      onClick={() => !uploading && !transcriptionFileUrl && !showUploadOptions && setShowUploadOptions(true)}
                      onMouseLeave={() => setShowUploadOptions(false)}
                    >
                      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-4">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept=".mp3,.wav,.mid,.midi"
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
                            <div className="loading-animation">
                              <span className="note" style={{ animationDelay: '0.1s', color: '#b58900' }}>♪</span>
                              <span className="note" style={{ animationDelay: '0.2s', color: '#cb4b16' }}>♫</span>
                              <span className="note" style={{ animationDelay: '0.3s', color: '#dc322f' }}>♩</span>
                              <span className="note" style={{ animationDelay: '0.4s', color: '#d33682' }}>♬</span>
                              <span className="note" style={{ animationDelay: '0.5s', color: '#6c71c4' }}>♪</span>
                            </div>
                          </div>
                        ) : isTranscribing ? (
                          <div className="flex flex-col items-center justify-center gap-4">
                            <span className="text-2xl text-[#586e75] font-bold">İşleniyor...</span>
                             <div className="loading-animation">
                              <span className="note" style={{ animationDelay: '0.1s', color: '#b58900' }}>♪</span>
                              <span className="note" style={{ animationDelay: '0.2s', color: '#cb4b16' }}>♫</span>
                              <span className="note" style={{ animationDelay: '0.3s', color: '#dc322f' }}>♩</span>
                              <span className="note" style={{ animationDelay: '0.4s', color: '#d33682' }}>♬</span>
                              <span className="note" style={{ animationDelay: '0.5s', color: '#6c71c4' }}>♪</span>
                            </div>
                          </div>
                        ) : transcriptionResultUrl ? (
                          <div className="z-20 flex flex-col gap-4 p-4 text-center animate-button-options">
                            <h3 className="text-2xl text-[#586e75] font-bold mb-2">Transkripsiyon Tamamlandı!</h3>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMidiUrl(transcriptionResultUrl);
                                pianoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                              className="bg-[#b58900] text-white font-semibold px-8 py-3 rounded-full shadow-lg hover:bg-[#a17900] transform hover:scale-105 transition-all duration-200 ease-in-out text-lg"
                            >
                              Piyanoda Çal
                            </button>
                            <a
                              href={transcriptionResultUrl}
                              download="transcribed.midi"
                              className="block bg-[#2aa198] text-white font-semibold px-8 py-3 rounded-full shadow-lg hover:bg-[#208a80] transform hover:scale-105 transition-all duration-200 ease-in-out text-lg"
                            >
                              İndir
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); resetTranscription(); }}
                              className="text-sm text-[#657b83] hover:underline pt-2"
                            >
                              Yeni Dosya Yükle
                            </button>
                          </div>
                        ) : transcriptionFileUrl ? (
                          <div className="z-20 flex flex-col gap-4 p-4 text-center animate-button-options">
                            <h3 className="text-2xl text-[#586e75] font-bold mb-2">Dosya Yüklendi</h3>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartTranscription(); }}
                              className="bg-[#268bd2] text-white font-semibold px-8 py-3 rounded-full shadow-lg hover:bg-[#1f72b0] transform hover:scale-105 transition-all duration-200 ease-in-out text-lg"
                            >
                              Transkripsiyonu Başlat
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); resetTranscription(); }}
                              className="bg-[#93a1a1] text-[#fdf6e3] font-semibold px-6 py-2 rounded-full shadow-md hover:bg-[#657b83] transform hover:scale-105 transition-all duration-200 ease-in-out text-base"
                            >
                              İptal
                            </button>
                          </div>
                        ) : showUploadOptions ? (
                          <div className="z-20 flex flex-col gap-4 animate-button-options">
                            <button onClick={(e) => { e.stopPropagation(); handleOptionClick('midiplayer'); }} className="bg-[#b58900] text-white font-semibold px-8 py-3 rounded-full shadow-lg hover:bg-[#a17900] transform hover:scale-105 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 ease-in-out text-lg">Piyanoda Çal</button>
                            <button onClick={(e) => { e.stopPropagation(); handleOptionClick('transcription'); }} className="bg-[#657b83] text-[#fdf6e3] font-semibold px-8 py-3 rounded-full shadow-lg hover:bg-[#586e75] transform hover:scale-105 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 ease-in-out text-lg">Notalara Dönüştür</button>
                          </div>
                        ) : (
                           <span className="text-2xl text-[#586e75] font-bold transition-transform duration-300 group-hover:scale-110 text-center">Piyano Dosyası Yükle</span>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          </div>

          {!showTranscriptions && (
            <div className="w-full flex justify-center py-16" ref={pianoRef}>
              <div className="relative w-full h-[58rem] overflow-hidden border-y-2 border-[#dcd5c4] bg-[#002b36]">
                <PianoPlayer midiUrl={midiUrl} />
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <>
      {renderContent()}

      <style jsx global>{`
        body, html {
          overflow: auto !important;
        }

        @keyframes spin-glow {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
         @keyframes spin-glow-reverse {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }

        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animate-float-delay-1 { animation: float 7s ease-in-out infinite 1s; }
        .animate-float-delay-2 { animation: float 8s ease-in-out infinite 2.5s; }
        .animate-float-delay-3 { animation: float 5.5s ease-in-out infinite 0.5s; }
        .animate-float-delay-4 { animation: float 7.5s ease-in-out infinite 1.5s; }
        .animate-float-delay-5 { animation: float 6.5s ease-in-out infinite 3s; }
        .animate-float-delay-6 { animation: float 5s ease-in-out infinite 2s; }

        /* --- SADECE GİRİŞ FORMU İÇİN IŞIK EFEKTİ --- */
        .login-glow-box {
          position: relative;
          border-radius: 1.5rem;
          overflow: hidden;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        }
        .login-glow-box::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 250%;
          height: 250%;
          background: conic-gradient(from 0deg, transparent 70%, #b58900 100%);
          animation: spin-glow 4s linear infinite;
        }
        .login-glow-box::after {
          content: '';
          position: absolute;
          inset: 3px;
          background-color: #fdf6e3;
          border-radius: 1.35rem;
          z-index: 0;
        }
        
        .rotating-glow-box {
          position: relative;
          width: 340px;
          height: 340px;
          border-radius: 1.5rem;
          overflow: hidden;
          cursor: pointer;
          background: #fdf6e3;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
        }

        @media (min-width: 768px) {
          .rotating-glow-box {
            width: 400px;
            height: 400px;
          }
        }

        .rotating-glow-box::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 150%;
          height: 150%;
          background: conic-gradient(from 0deg, transparent 0%, transparent 70%, #b58900 100%);
          animation: spin-glow 4s linear infinite;
        }

        .rotating-glow-box::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          right: 3px;
          bottom: 3px;
          background: #fdf6e3;
          border-radius: 1.35rem;
          z-index: 0;
        }

        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(40px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 1s cubic-bezier(0.23, 1, 0.32, 1) both;
        }

        @keyframes fade-in-scale-up {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-button-options {
          animation: fade-in-scale-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        
        .loading-animation .note {
          display: inline-block;
          font-size: 2.5rem;
          margin: 0 0.5rem;
          animation: loading-wave 1.5s ease-in-out infinite;
        }

        @keyframes loading-wave {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          50% {
            transform: translateY(-20px) scale(1.2);
            opacity: 0.7;
          }
        }

        /* --- BAŞLANGIÇ YÜKLEME ANİMASYONU --- */
        .initial-loading-notes-container {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          margin-top: 2rem;
        }
        
        .initial-loading-note {
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
      `}</style>
    </>
  );
}