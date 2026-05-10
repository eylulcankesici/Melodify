import "./global.css";
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from './src/lib/supabase';
import { useFonts } from 'expo-font';
import { Lobster_400Regular } from '@expo-google-fonts/lobster';
import BackgroundNotes from './src/components/BackgroundNotes';

export default function App() {
  // Lobster Fontunu Yüklüyoruz
  const [fontsLoaded] = useFonts({
    Lobster_400Regular,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  async function handleAuth() {
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert('Giriş Başarısız', error.message);
        else Alert.alert('Başarılı', 'Melodify dünyasına hoş geldin!');
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { full_name: fullName }
          }
        });
        if (error) Alert.alert('Kayıt Başarısız', error.message);
        else {
          Alert.alert('Başarılı', 'Kayıt başarılı! Lütfen giriş yapın.');
          setIsLogin(true);
        }
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    } finally {
      setLoading(false);
    }
  }

  // Fontlar yüklenene kadar boş bir ekran gösteriyoruz (veya bir yükleniyor ikonu koyabiliriz)
  if (!fontsLoaded) {
    return <View className="flex-1 bg-[#eee8d5]" />;
  }

  return (
    <View className="flex-1 items-center justify-center bg-[#eee8d5] px-4 overflow-hidden relative">
      <BackgroundNotes />
      
      {/* Logo Alanı */}
      <View className="flex-row items-center justify-center mb-0 mt-4 overflow-visible">
        <Text className="font-lobster text-6xl text-[#586e75]">Melodi</Text>
        <Text style={{ fontSize: 90, paddingTop: 40, paddingBottom: 40, marginTop: -20, marginBottom: -20 }} className="font-lobster text-[#b58900] -mx-2">𝄞</Text>
        <Text className="font-lobster text-6xl text-[#586e75] mt-4">y</Text>
      </View>
      
      <Text className="text-[#839496] text-lg text-center mb-8 font-medium">
        Melodify dünyasına hoş geldin!{"\n"}Müziğini notaya dökmeye hazır mısın?
      </Text>

      {/* Form Kartı */}
      <View className="w-full max-w-md bg-[#fdf6e3] p-8 rounded-2xl shadow-sm border border-[#93a1a1]/30">
        <Text className="text-3xl font-bold text-[#586e75] mb-6 text-center">
          {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
        </Text>

        <View className="w-full flex-col gap-4">
          {!isLogin && (
            <View className="flex-col gap-1">
              <Text className="text-sm font-semibold text-[#657b83]">Ad Soyad</Text>
              <TextInput
                className="px-4 py-3 border border-[#93a1a1]/50 rounded-lg bg-white text-[#586e75] text-base"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View className="flex-col gap-1">
            <Text className="text-sm font-semibold text-[#657b83]">E-posta</Text>
            <TextInput
              className="px-4 py-3 border border-[#93a1a1]/50 rounded-lg bg-white text-[#586e75] text-base"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View className="flex-col gap-1">
            <Text className="text-sm font-semibold text-[#657b83]">Şifre</Text>
            <TextInput
              className="px-4 py-3 border border-[#93a1a1]/50 rounded-lg bg-white text-[#586e75] text-base"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            className="w-full bg-[#b58900] rounded-xl py-4 mt-2 items-center justify-center shadow-sm"
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-lg">
                {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="mt-6 border-t border-[#93a1a1]/30 w-full pt-6 items-center flex-row justify-center">
          <Text className="text-sm text-[#657b83]">
            {isLogin ? "Hesabın yok mu? " : "Zaten hesabın var mı? "}
          </Text>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text className="font-bold text-[#268bd2] text-sm">
              {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
