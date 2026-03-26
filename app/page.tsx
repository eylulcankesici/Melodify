'use client';

import React from 'react';
import Link from 'next/link';
import { Lobster } from 'next/font/google';
import AuthForm from '@/components/AuthForm';

const lobster = Lobster({
  subsets: ['latin'],
  weight: '400',
});

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#eee8d5] overflow-hidden p-4 isolate">
      {/* V1 Floaty notes background map */}
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
