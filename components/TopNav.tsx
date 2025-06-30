"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from '@/lib/supabase';

const ADMIN_EMAILS = [
  'eylukankesici@gmail.com',
  'sudemcucemen7@gmail.com'
];

export default function TopNav() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && ADMIN_EMAILS.includes(data.user.email!)) {
        setIsAdmin(true);
      }
    });
  }, []);
  return (
    <nav className="w-full flex justify-end items-center px-6 py-4 bg-transparent gap-6">
      <Link href="/transcriptions" className="text-sm text-[#FFD700] font-semibold hover:underline">
        Transkripsiyonlarım
      </Link>
      {isAdmin && (
        <Link href="/admin" className="text-sm text-red-400 font-semibold hover:underline">
          Admin Paneli
        </Link>
      )}
    </nav>
  );
}
