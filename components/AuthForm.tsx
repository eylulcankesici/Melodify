'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);

  // State elements
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Visual states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        // GİRİŞ YAP
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // On success, standard `onAuthStateChange` in page.tsx will rerender
      } else {
        // KAYIT OL
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });
        if (error) throw error;

        // NOT: Profil oluşturma (profiles tablosuna kayıt ekleme) işlemini artık Supabase içerisinde 
        // veritabanı Trigger'ı ile otomatik yapacağız, o yüzden buradaki manuel ekleme kodunu kaldırdık.

        setSuccessMsg("Kayıt başarılı! Lütfen giriş yapın.");
        setIsLogin(true); // Giriş yap sayfasına çevir
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <h2 className="text-3xl font-bold text-[#586e75] mb-4">
        {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
      </h2>

      {errorMsg && (
        <div className="w-full bg-[#dc322f]/10 border border-[#dc322f]/30 text-[#dc322f] px-3 py-2 rounded-lg text-sm mb-4 text-center">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="w-full bg-[#859900]/10 border border-[#859900]/30 text-[#859900] px-3 py-2 rounded-lg text-sm mb-4 text-center">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        {!isLogin && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[#657b83]">Ad Soyad</label>
            <input
              type="text"
              required={!isLogin}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="px-4 py-2 border border-[#93a1a1]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b58900] bg-white text-[#586e75]"
              placeholder="Adınızı girin"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[#657b83]">E-posta</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-2 border border-[#93a1a1]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b58900] bg-white text-[#586e75]"
          // placeholder="ornek@email.com"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[#657b83]">Şifre</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-2 border border-[#93a1a1]/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b58900] bg-white text-[#586e75]"
          // placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`mt-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''} bg-[#b58900] text-white font-bold py-3 rounded-xl hover:bg-[#a17a00] transition-all transform hover:scale-[1.02] shadow-md`}
        >
          {loading ? 'Yükleniyor...' : (isLogin ? 'Giriş Yap' : 'Kayıt Ol')}
        </button>
      </form>

      <div className="mt-6 border-t border-[#93a1a1]/30 w-full pt-4 text-center">
        <p className="text-sm text-[#657b83]">
          {isLogin ? "Hesabın yok mu?" : "Zaten hesabın var mı?"}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="ml-2 font-bold text-[#268bd2] hover:underline"
          >
            {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
          </button>
        </p>
      </div>
    </div>
  );
}
