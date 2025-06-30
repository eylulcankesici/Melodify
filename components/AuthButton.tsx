'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthButton() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Giriş hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      alert('Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın.');
    } catch (error) {
      console.error('Kayıt hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <form className="flex flex-col gap-4 w-full max-w-md">
        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 border rounded"
          required
        />
        <div className="flex gap-4">
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="flex-1 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Yükleniyor...' : 'Giriş Yap'}
          </button>
          <button
            onClick={handleSignUp}
            disabled={loading}
            className="flex-1 bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Yükleniyor...' : 'Kayıt Ol'}
          </button>
        </div>
      </form>
    </div>
  );
} 