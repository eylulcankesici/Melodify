'use client';
import React, { useState } from 'react';

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="flex flex-col items-center w-full">
      <h2 className="text-3xl font-bold text-[#586e75] mb-6">
        {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
      </h2>
      
      <form className="w-full flex flex-col gap-4">
        {!isLogin && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[#657b83]">Ad Soyad</label>
            <input 
              type="text" 
              className="px-4 py-2 border border-[#93a1a1]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b58900] bg-white text-[#586e75]"
              placeholder="Adınızı girin"
            />
          </div>
        )}
        
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[#657b83]">E-posta</label>
          <input 
            type="email" 
            className="px-4 py-2 border border-[#93a1a1]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b58900] bg-white text-[#586e75]"
            placeholder="ornek@email.com"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[#657b83]">Şifre</label>
          <input 
            type="password" 
            className="px-4 py-2 border border-[#93a1a1]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b58900] bg-white text-[#586e75]"
            placeholder="••••••••"
          />
        </div>

        <button 
          type="button"
          className="mt-4 bg-[#b58900] text-white font-bold py-3 rounded-xl hover:bg-[#a17a00] transition-all transform hover:scale-[1.02] shadow-md"
        >
          {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
        </button>
      </form>

      <div className="mt-6 border-t border-[#93a1a1]/30 w-full pt-4 text-center">
        <p className="text-sm text-[#657b83]">
          {isLogin ? "Hesabın yok mu?" : "Zaten hesabın var mı?"}
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 font-bold text-[#268bd2] hover:underline"
          >
            {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
          </button>
        </p>
      </div>
    </div>
  );
}
