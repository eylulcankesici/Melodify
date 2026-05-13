import "./global.css";
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Linking
} from 'react-native';
import { supabase } from './src/lib/supabase';
import { useFonts } from 'expo-font';
import { Lobster_400Regular } from '@expo-google-fonts/lobster';
import BackgroundNotes from './src/components/BackgroundNotes';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, InterruptionModeAndroid } from 'expo-av';

// 🔧 Sunucu Bağlantı Ayarları
// Fiziksel telefon kullandığınız için doğrudan bilgisayarınızın Wi-Fi IP'si olan '10.25.172.167' değerini tanımlıyoruz.
const BACKEND_IP = '[IP_ADDRESS]';
const WEB_BASE = `http://${BACKEND_IP}:3000`;
const API_BASE = `http://${BACKEND_IP}:8000`;

export default function App() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Lobster Fontunu Yüklüyoruz
  const [fontsLoaded] = useFonts({
    Lobster_400Regular,
  });

  // Auth State'leri
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  // Dashboard & Transkripsiyon State'leri
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [localFile, setLocalFile] = useState<any>(null);
  const [fileName, setFileName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [transcriptionFileUrl, setTranscriptionFileUrl] = useState<string | null>(null);

  const [transcriptionStatus, setTranscriptionStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<any>(null);

  // MIDI Player WebView State'leri
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerMidiUrl, setPlayerMidiUrl] = useState<string>('');
  const [playerMidiName, setPlayerMidiName] = useState<string>('');
  const [midiPickerLoading, setMidiPickerLoading] = useState(false);

  // 🎙️ Ses Kayıt (Mikrofon) State'leri
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<any>(null);

  // 🎙️ Mikrofon Kaydı Başlatma (Uygulama İçi Kayıt ve Sayaç)
  const startRecording = async () => {
    if (!selectedTask) {
      Alert.alert('Model Seçilmedi', 'Lütfen ses kaydetmeden önce yukarıdan bir yapay zeka modeli seçin.');
      return;
    }

    try {
      // 1. İzin kontrolü
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('İzin Reddedildi', 'Ses kaydetmek için mikrofon izni gereklidir.');
        return;
      }

      // 2. Ses modunu taze ve temiz biçimde ayarlama
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      // 3. Kararlı ve donma yapmayan AAC kodek konfigürasyonu
      const customOptions = {
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(customOptions);

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      const timer = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      setRecordingTimer(timer);

    } catch (err: any) {
      if (recordingTimer) clearInterval(recordingTimer);
      setIsRecording(false);
      setRecording(null);
      Alert.alert('Kayıt Hatası', 'Mikrofon başlatılamadı. Detay: ' + err.message);
    }
  };

  // ⏹️ Mikrofon Kaydını Durdurma
  const stopRecording = async () => {
    try {
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
      setIsRecording(false);

      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          shouldDuckAndroid: false,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          staysActiveInBackground: false,
        });

        const uri = recording.getURI();
        if (uri) {
          const timestamp = new Date().getTime();
          const filename = `mic_recording_${timestamp}.m4a`;

          setLocalFile({ uri, name: filename, type: 'audio/m4a' });
          setFileName(filename);
        }
      }
    } catch (err: any) {
      Alert.alert('Durdurma Hatası', 'Kayıt durdurulamadı: ' + err.message);
    }
  };

  // Oturum ve Kalıcı Durum Dinleyicisi
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (_event === 'SIGNED_OUT') {
        resetDashboard();
      }
    });

    // 🔄 Tarayıcıdan Dönüşte (App Resume) Kalıcı AI Sonuçlarını Geri Yükle
    AsyncStorage.getItem('saved_transcription_status').then((savedStatus) => {
      if (savedStatus === 'completed') {
        AsyncStorage.getItem('saved_transcription_result').then((savedRes) => {
          if (savedRes) {
            setTranscriptionResult(JSON.parse(savedRes));
            setTranscriptionStatus('completed');
          }
        });
        AsyncStorage.getItem('saved_selected_task').then((savedTask) => {
          if (savedTask) setSelectedTask(savedTask as any);
        });
      }
    }).catch(() => { });

    return () => subscription.unsubscribe();
  }, []);

  const resetDashboard = () => {
    if (isRecording && recording) {
      recording.stopAndUnloadAsync().catch(() => { });
      if (recordingTimer) clearInterval(recordingTimer);
      setIsRecording(false);
    }

    setSelectedTask('');
    setTranscriptionFileUrl(null);
    setLocalFile(null);
    setFileName('');
    setUploading(false);
    setTranscriptionStatus('idle');
    setTranscriptionError(null);
    setTranscriptionResult(null);
    setShowPlayer(false);

    // Kalıcı hafızayı temizle
    AsyncStorage.removeItem('saved_transcription_status').catch(() => { });
    AsyncStorage.removeItem('saved_transcription_result').catch(() => { });
    AsyncStorage.removeItem('saved_selected_task').catch(() => { });
  };

  // Auth Giriş / Kayıt İşlemi
  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Eksik Bilgi', 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert('Giriş Başarısız', error.message);
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

  // Çıkış Yapma İşlemi
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  // Mobil Cihazdan Dosya Seçme
  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setLocalFile(asset);
        setFileName(asset.name);

        // Reset previous results
        setTranscriptionStatus('idle');
        setTranscriptionResult(null);
        setTranscriptionFileUrl(null);
      }
    } catch (err) {
      console.error("Document selection error:", err);
    }
  };

  const uploadAudioFile = async (uri: string, name: string) => {
    setUploading(true);
    try {
      const fileExt = name.split('.').pop()?.toLowerCase() || 'mp3';
      const uniqueName = `${Date.now()}.${fileExt}`;

      // Supabase Storage MIME doğrulamasının kabul ettiği standart MIME tiplerini tanımlıyoruz:
      // Standart MP3 formatı "audio/mpeg"dir. "audio/mp3" standart dışı olduğu için Supabase tarafından reddedilir.
      let mimeType = 'audio/mpeg';
      if (fileExt === 'wav') {
        mimeType = 'audio/wav';
      } else if (fileExt === 'mid' || fileExt === 'midi') {
        mimeType = 'audio/midi';
      }

      // React Native'de ikili (binary) Blob dönüştürme hatalarını engellemek için
      // en güvenli ve kararlı yöntem olan FormData üzerinden dosya akışını (stream) tetikliyoruz.
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: uniqueName,
        type: mimeType,
      } as any);

      const { data, error } = await supabase.storage
        .from('audio-files')
        .upload(uniqueName, formData, {
          contentType: 'multipart/form-data',
        });

      if (error) throw error;

      const publicUrl = supabase.storage.from('audio-files').getPublicUrl(uniqueName).data.publicUrl;
      return publicUrl;
    } catch (err: any) {
      console.error("Supabase upload error:", err);
      Alert.alert("Yükleme Hatası", err.message || "Dosya yüklenirken bir hata oluştu.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  // Transkripsiyon Başlatma (Python API)
  const handleTranscriptionStart = async () => {
    if (!user) return;
    if (!selectedTask) {
      Alert.alert('Model Seçilmedi', 'Lütfen işleme başlamadan önce bir yapay zeka modeli seçin.');
      return;
    }

    let currentUrl = transcriptionFileUrl;

    // Eğer dosya henüz yüklenmediyse önce yükle
    if (!currentUrl) {
      if (!localFile) {
        Alert.alert("Eksik Dosya", "Lütfen işlem yapabilmek için bir ses dosyası seçin.");
        return;
      }
      currentUrl = await uploadAudioFile(localFile.uri, localFile.name);
      if (!currentUrl) return;
      setTranscriptionFileUrl(currentUrl);

      // Kaydı tabloya ekle
      await supabase.from('transcriptions').insert({
        user_id: user.id,
        original_audio_url: currentUrl,
      });
    }

    // Görev ve Endpoint tespiti
    const taskConfig: Record<string, { endpoint: string; name: string }> = {
      demucs: { endpoint: `${API_BASE}/api/transcribe`, name: "Ses Ayrıştırma" },
      adtof: { endpoint: `${API_BASE}/api/transcribe/adtof`, name: "Bateri Transkripsiyonu" },
      bytedance: { endpoint: `${API_BASE}/api/transcribe/bytedance`, name: "Piyano Transkripsiyonu" },
      basic_pitch: { endpoint: `${API_BASE}/api/transcribe/basic_pitch`, name: "Mırıldanma Analizi" },
      btc: { endpoint: `${API_BASE}/api/transcribe/btc`, name: "Akor, BPM ve Ton Keşfi" },
    };

    const config = taskConfig[selectedTask];
    setTranscriptionStatus('processing');
    setTranscriptionError(null);
    setTranscriptionResult(null);

    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          original_audio_url: currentUrl,
          filename: fileName || 'audio.mp3',
        }),
      });

      if (!res.ok) throw new Error("Yapay zeka sunucusu isteği kabul etmedi.");

      // Polling başlat
      startPolling(user.id, currentUrl);
    } catch (err: any) {
      setTranscriptionStatus('failed');
      setTranscriptionError(err.message);
      Alert.alert("Bağlantı Hatası", "Python backend sunucusuna ulaşılamadı. Sunucunun çalıştığından emin olun.");
    }
  };

  // Polling Mekanizması
  const startPolling = (userId: string, originalUrl: string) => {
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
              clearInterval(interval);
              AsyncStorage.setItem('saved_transcription_status', 'completed').catch(() => { });
              AsyncStorage.setItem('saved_transcription_result', JSON.stringify(meta)).catch(() => { });
              AsyncStorage.setItem('saved_selected_task', selectedTask).catch(() => { });
            } else if (meta.status === 'failed') {
              setTranscriptionStatus('failed');
              setTranscriptionError(meta.error || 'İşlem başarısız oldu.');
              clearInterval(interval);
            }
          }
        }
      } catch (err) {
        console.error("Polling catch:", err);
      }
    }, 3000);
  };

  // MIDI Player'da Açma
  const handleOpenPlayer = (midiUrl: string, name: string) => {
    setPlayerMidiUrl(midiUrl);
    setPlayerMidiName(name);
    setShowPlayer(true);
  };

  // Yerel sunucuya MIDI yükleme fonksiyonu
  const uploadMidiToLocalBackend = async (uri: string, name: string) => {
    try {
      const formData = new FormData();
      // React Native fetch için standard FormData yapısı
      formData.append('file', {
        uri: uri,
        name: name,
        type: 'audio/midi',
      } as any);

      const response = await fetch(`${API_BASE}/api/upload-midi`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Yerel sunucu hatası oluştu.');
      }

      const resData = await response.json();
      if (resData.success && resData.url) {
        // WebView player url'si bilgisayardaki Next.js adresi + public url olacak
        return `${WEB_BASE}${resData.url}`;
      } else {
        throw new Error('Yükleme başarılı oldu fakat url alınamadı.');
      }
    } catch (err: any) {
      console.error("Local upload error:", err);
      Alert.alert("Yükleme Hatası", `Yerel sunucuya yüklenirken hata oluştu: ${err.message}`);
      return null;
    }
  };

  // Telefondan MIDI Dosyası Seç, Yerel Sunucuya Yükle ve Player'da Aç
  const handlePickAndOpenMidi = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // MIDI için özel MIME desteği kısıtlı, hepsine açıyoruz
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      // Sadece .mid / .midi uzantılarına izin ver
      const ext = asset.name.split('.').pop()?.toLowerCase();
      if (ext !== 'mid' && ext !== 'midi') {
        Alert.alert('Geçersiz Dosya', 'Lütfen .mid veya .midi uzantılı bir dosya seçin.');
        return;
      }

      setMidiPickerLoading(true);

      // Yerel sunucuya yükle → yerel link al
      const localUrl = await uploadMidiToLocalBackend(asset.uri, asset.name);
      if (!localUrl) {
        setMidiPickerLoading(false);
        return;
      }

      setMidiPickerLoading(false);
      handleOpenPlayer(localUrl, asset.name);
    } catch (err: any) {
      setMidiPickerLoading(false);
      Alert.alert('Hata', err.message || 'Dosya seçilirken bir hata oluştu.');
    }
  };

  // Font Yükleniyor
  if (!fontsLoaded) {
    return <View className="flex-1 bg-[#eee8d5] items-center justify-center" />;
  }

  // MIDI PLAYER EKRANI (TAM EKRAN WEBVIEW)
  if (showPlayer) {
    const webPlayerUrl = `${WEB_BASE}/play?url=${encodeURIComponent(playerMidiUrl)}&name=${encodeURIComponent(playerMidiName)}&hideDownloads=true`;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#002b36', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0, paddingBottom: 0 }}>
        <StatusBar barStyle="light-content" />

        {/* Mobile Header with Native Back Button */}
        <View className="h-16 bg-[#073642] px-4 flex-row items-center justify-between border-b border-[#586e75]/30">
          <TouchableOpacity
            onPress={() => setShowPlayer(false)}
            className="flex-row items-center bg-[#586e75]/20 py-2 px-4 rounded-full border border-[#93a1a1]/30"
          >
            <Text className="text-white font-bold text-xs">◀ Geri Dön</Text>
          </TouchableOpacity>
          <View className="items-end">
            <Text className="text-white font-bold text-xs">Melodify Player</Text>
            <Text className="text-[#859900] font-bold text-[10px]" numberOfLines={1}>{playerMidiName}</Text>
          </View>
        </View>

        {/* Telefon alt tuşlarının play butonunu kapatmasını önlemek için dikeyde (portrait) 55px kesin alt boşluk (margin) veriyoruz. Yatayda (landscape) ise buna gerek olmadığı için 0px yapıyoruz. */}
        <View style={{ flex: 1, marginBottom: isLandscape ? 0 : 55, overflow: 'hidden', backgroundColor: '#002b36' }}>
          <WebView
            source={{ uri: webPlayerUrl }}
            style={{ flex: 1, backgroundColor: '#002b36' }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      </SafeAreaView>
    );
  }

  // LOGOUT (KULLANICI GİRİŞ YAPMAMIŞ) -> AUTH EKRANI
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#eee8d5', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0, paddingBottom: Platform.OS === 'ios' ? 20 : 10 }}>
        <StatusBar barStyle="dark-content" />
        <View className="flex-1 items-center justify-center px-4 overflow-hidden relative">
          <BackgroundNotes />

          {/* Logo Alanı */}
          <View style={{ overflow: 'visible' }} className="mb-4 mt-4 items-center justify-center">
            <Text style={{ fontSize: 74, lineHeight: 105, overflow: 'visible' }} className="font-lobster text-[#586e75] text-center">
              Melodi<Text style={{ fontSize: 46, color: '#b58900' }}>𝄞</Text>y
            </Text>
          </View>

          <Text className="text-[#839496] text-sm text-center mb-8 font-semibold leading-5 px-6">
            Melodify dünyasına hoş geldin!{"\n"}Müziğini saniyeler içinde notaya dök.
          </Text>

          {/* Form Kartı */}
          <View className="w-full max-w-md bg-[#fdf6e3] p-6 rounded-3xl shadow-md border border-[#93a1a1]/30">
            <Text className="text-2xl font-black text-[#586e75] mb-5 text-center">
              {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
            </Text>

            <View className="w-full flex-col gap-3.5">
              {!isLogin && (
                <View className="flex-col gap-1">
                  <Text className="text-xs font-bold text-[#657b83] uppercase tracking-wide">Ad Soyad</Text>
                  <TextInput
                    className="px-4 py-3 border border-[#93a1a1]/30 rounded-xl bg-white text-[#586e75] text-base"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  // placeholder="Müzisyen İsmi"
                  />
                </View>
              )}

              <View className="flex-col gap-1">
                <Text className="text-xs font-bold text-[#657b83] uppercase tracking-wide">E-posta</Text>
                <TextInput
                  className="px-4 py-3 border border-[#93a1a1]/30 rounded-xl bg-white text-[#586e75] text-base"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"

                // placeholder="ornek@melodify.com"
                />
              </View>

              <View className="flex-col gap-1">
                <Text className="text-xs font-bold text-[#657b83] uppercase tracking-wide">Şifre</Text>
                <TextInput
                  className="px-4 py-3 border border-[#93a1a1]/30 rounded-xl bg-white text-[#586e75] text-base"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                //placeholder="••••••"
                />
              </View>

              <TouchableOpacity
                className="w-full bg-[#b58900] rounded-2xl py-4 mt-3 items-center justify-center shadow-md"
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-base tracking-wide">
                    {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View className="mt-5 border-t border-[#93a1a1]/20 w-full pt-4 items-center flex-row justify-center">
              <Text className="text-xs text-[#657b83]">
                {isLogin ? "Hesabın yok mu? " : "Zaten hesabın var mı? "}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text className="font-bold text-[#268bd2] text-xs">
                  {isLogin ? 'Kayıt Ol' : 'Giriş Yap'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Giriş formunu ve logoyu biraz daha yukarı taşımak için alta spacer ekliyoruz */}
          <View style={{ height: 200 }} />
        </View>
      </SafeAreaView>
    );
  }

  // LOGIN OLMUŞ KULLANICI -> HOŞ GELDİNİZ DASHBOARD EKRANI
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#eee8d5', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0, paddingBottom: Platform.OS === 'ios' ? 20 : 10 }}>
      <StatusBar barStyle="dark-content" />

      {/* Mobil Üst Bar */}
      <View className="h-16 px-4 flex-row items-center justify-between border-b border-[#93a1a1]/30 bg-[#fdf6e3]/80">
        <View className="overflow-visible">
          <Text style={{ fontSize: 24, lineHeight: 32, overflow: 'visible' }} className="font-lobster text-[#586e75]">
            Melodi<Text style={{ fontSize: 17, color: '#b58900' }}>𝄞</Text>y
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          {user && (
            <Text className="text-xs font-bold text-[#586e75]">
              {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Müzisyen'}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleSignOut}
            className="bg-red-500/10 border border-red-500/20 px-3.5 py-1.5 rounded-full"
          >
            <Text className="text-red-600 font-bold text-xs">Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} className="flex-1">

        {/* Kullanıcı Karşılama Kartı */}
        {/*<View className="bg-[#fdf6e3] p-5 rounded-3xl border border-[#93a1a1]/30 shadow-sm mb-6">
          <Text className="text-lg font-black text-[#586e75]">Merhaba Müzisyen! 👋</Text>
          <Text className="text-xs text-[#657b83] mt-1 font-medium">{user.email}</Text>
        </View>*/}

        {/* Görev Seçimi Başlığı */}
        <Text className="text-sm font-bold text-[#586e75] uppercase tracking-wider mb-3">MODEL SEÇİN</Text>

        {/* Görev Kartları Listesi */}
        {[
          { id: 'demucs', emoji: '', title: 'Ses Ayrıştırma', desc: 'Şarkıyı vokal, davul, bas kanallarına ayırır.' },
          { id: 'adtof', emoji: '', title: 'Bateri Transkripsiyonu', desc: 'Davul vuruşlarını MIDI ve nota kağıdına çevirir.' },
          { id: 'bytedance', emoji: '', title: 'Piyano Transkripsiyonu', desc: 'Melodileri piyanoyla nota dökümüne alır.' },
          { id: 'basic_pitch', emoji: '', title: 'Mırıldanma Analizi', desc: 'Mırıldandığınız ses tonlarını piyanoya çevirir.' },
          { id: 'btc', emoji: '', title: 'Akor, BPM ve Ton Keşfi', desc: 'Akor analiz raporu, tempo ve anahtar tonu belirler.' }
        ].map((task) => {
          const isSelected = selectedTask === task.id;
          return (
            <TouchableOpacity
              key={task.id}
              onPress={() => setSelectedTask(task.id)}
              className={`p-4 rounded-2xl border mb-3 flex-row items-start gap-3.5 ${isSelected
                ? 'bg-[#fff3c7] border-1'
                : 'bg-[#fff9e6] border-[#f1c40f]/30'
                }`}
            >
              <Text className="text-2xl">{task.emoji}</Text>
              <View className="flex-1">
                <Text className="font-bold text-sm text-[#586e75]">{task.title}</Text>
                <Text className="text-xs text-[#657b83] mt-0.5 leading-4 font-medium">{task.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* MIDI Player Butonu */}
        <TouchableOpacity
          onPress={handlePickAndOpenMidi}
          disabled={midiPickerLoading}
          className={`w-full rounded-2xl py-4 mt-2 mb-4 flex-row items-center justify-center gap-2 shadow-md ${midiPickerLoading ? 'bg-[#DC9B9B]/50' : 'bg-[#DC9B9B]'}`}
        >
          {midiPickerLoading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text className="text-white font-bold text-base">Yükleniyor...</Text>
            </>
          ) : (
            <>
              <Text className="text-xl"></Text>
              <Text className="text-white font-bold text-base">MIDI Dosyası Seç ve Oynat</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Dosya Yükleyici Alanı */}
        <Text className="text-sm font-bold text-[#586e75] uppercase tracking-wider mt-2 mb-3">Dosya Yükleme</Text>

        <View className="bg-[#fdf6e3] p-6 rounded-3xl border border-[#93a1a1]/30 shadow-sm items-center justify-center gap-4">

          {uploading ? (
            <View className="items-center py-4">
              <ActivityIndicator size="large" color="#b58900" />
              <Text className="text-[#586e75] font-bold text-sm mt-3">Supabase'e Yükleniyor...</Text>
            </View>
          ) : transcriptionStatus === 'processing' ? (
            <View className="items-center py-4">
              <ActivityIndicator size="large" color="#84a98c" />
              <Text className="text-[#586e75] font-bold text-sm mt-3">Yapay Zeka Analiz Ediyor...</Text>
              <Text className="text-xs text-[#657b83] mt-1 text-center font-semibold">Lütfen bekleyin, nota dökümü tamamlanıyor.</Text>
            </View>
          ) : transcriptionStatus === 'completed' ? (
            /* BAŞARI VE DOSYA DETAYLARI */
            <View className="w-full items-center py-2">
              <Text className="text-md font-black text-[#84a98c] text-center">İşlem Başarıyla Tamamlandı!</Text>

              {/* BTC Özel Bilgiler */}
              {selectedTask === 'btc' && transcriptionResult?.outputs && (
                <View className="w-full bg-[#eee8d5] p-5 rounded-3xl border border-[#93a1a1]/30 mt-4 gap-3 shadow-sm">
                  <Text className="font-black text-sm text-[#586e75] uppercase tracking-wider border-b border-[#93a1a1]/20 pb-2">🎵 Müzikal Analiz Raporu</Text>

                  <View className="flex-row justify-between items-center py-2 bg-[#fdf6e3] px-3.5 rounded-xl border border-[#93a1a1]/15">
                    <Text className="text-xs text-[#657b83] font-bold"> Ritim / Tempo:</Text>
                    <Text className="text-xs text-[#586e75] font-black">{transcriptionResult.outputs.bpm} BPM</Text>
                  </View>

                  <View className="flex-row justify-between items-center py-2 bg-[#fdf6e3] px-3.5 rounded-xl border border-[#93a1a1]/15">
                    <Text className="text-xs text-[#657b83] font-bold"> Anahtar Ton (Key):</Text>
                    <Text className="text-xs text-[#b58900] font-black">{transcriptionResult.outputs.key}</Text>
                  </View>

                  {/* Akor Listesi */}
                  {transcriptionResult.outputs.chords && transcriptionResult.outputs.chords.length > 0 && (
                    <View className="mt-2 gap-2">
                      <Text className="text-xs text-[#586e75] font-black tracking-wide">Tespit Edilen Akor Akışı:</Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {transcriptionResult.outputs.chords.map((chordObj: any, idx: number) => (
                          <View key={idx} className="bg-[#84a98c] px-3 py-1.5 rounded-lg shadow-sm flex-row items-center gap-1">
                            <Text className="text-white text-xs font-black">{typeof chordObj === 'string' ? chordObj : chordObj?.chord}</Text>
                            {typeof chordObj === 'object' && chordObj?.start !== undefined && (
                              <Text className="text-white/80 text-[9px]">({Math.round(chordObj.start)}s)</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* MIDI Oynatma ve İndirme Butonları */}
              {transcriptionResult?.outputs?.midi_url && (
                <View className="w-full gap-3 mt-5">
                  <TouchableOpacity
                    onPress={() => handleOpenPlayer(
                      transcriptionResult.outputs.midi_url,
                      selectedTask === 'adtof' ? 'drums_transcription.mid' : (selectedTask === 'btc' ? 'chords_transcription.mid' : (selectedTask === 'basic_pitch' ? 'hum_transcription.mid' : 'piano_transcription.mid'))
                    )}
                    className="w-full bg-[#C8AAAA] rounded-2xl py-4 flex-row items-center justify-center gap-2 shadow-sm"
                  >
                    <Text className="text-lg"></Text>
                    <Text className="text-white font-bold text-base">MIDI Player'da Oynat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      Linking.openURL(transcriptionResult.outputs.midi_url).catch(err => {
                        Alert.alert('Hata', 'Bağlantı açılamadı: ' + err.message);
                      });
                    }}
                    className="w-full bg-[#DAA464] rounded-2xl py-4 flex-row items-center justify-center gap-2 shadow-sm"
                  >
                    <Text className="text-lg"></Text>
                    <Text className="text-white font-bold text-base">MIDI Dosyasını İndir</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Demucs Ses Ayrıştırma Çoklu Kanal Çalar (Embedded Web Mixer) - Geçici Olarak Yorum Satırında */}
              {/*
              {selectedTask === 'demucs' && transcriptionResult?.outputs && (
                <View className="w-full mt-5 bg-[#eee8d5] rounded-3xl overflow-hidden border border-[#93a1a1]/30 shadow-sm">
                  <View className="px-4 py-3 bg-[#fdf6e3] border-b border-[#93a1a1]/20 flex-row items-center justify-between">
                    <Text className="text-[#586e75] font-black text-xs">🎙️ Yapay Zeka Ses Mikseri (DAW)</Text>
                  </View>
                  
                  <View style={{ height: 490 }}>
                    <WebView
                      originWhitelist={['*']}
                      source={{
                        html: getDemucsMixerHtml(
                          transcriptionResult.outputs.vocals_url || '',
                          transcriptionResult.outputs.drums_url || '',
                          transcriptionResult.outputs.bass_url || '',
                          transcriptionResult.outputs.other_url || ''
                        )
                      }}
                      style={{ backgroundColor: '#eee8d5' }}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      scrollEnabled={true}
                    />
                  </View>
                </View>
              )}
              */}

              {/* 🎙️ Demucs Alternatif Çıktı Kanal Listesi (Tarayıcıda Dinle/İndir) */}
              {selectedTask === 'demucs' && transcriptionResult?.outputs && (
                <View className="w-full mt-5 bg-[#fdf6e3] rounded-3xl p-5 border border-[#93a1a1]/30 shadow-sm gap-4">
                  <Text className="text-sm font-black text-[#586e75] border-b border-[#93a1a1]/20 pb-2">Çıktı Kanalları</Text>

                  {[
                    { label: '🎙️ Vokal Kanalı', url: transcriptionResult.outputs.vocals_url },
                    { label: '🥁 Davul Kanalı', url: transcriptionResult.outputs.drums_url },
                    { label: '🎸 Bas Kanalı', url: transcriptionResult.outputs.bass_url },
                    { label: '🎵 Diğer Enstrümanlar', url: transcriptionResult.outputs.other_url }
                  ].map((item, index) => (
                    <View key={index} className="flex-row items-center justify-between bg-[#eee8d5]/30 p-3.5 rounded-2xl border border-[#93a1a1]/15">
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-bold text-[#586e75]">{item.label}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          if (item.url) {
                            Linking.openURL(item.url).catch(err => {
                              Alert.alert('Hata', 'Bağlantı açılamadı: ' + err.message);
                            });
                          } else {
                            Alert.alert('Bilgi', 'Bu kanal çıktısı mevcut değil.');
                          }
                        }}
                        className="bg-[#84a98c] px-4 py-2.5 rounded-xl shadow-sm"
                      >
                        <Text className="text-white text-[10px] font-extrabold tracking-tight">Dinle / İndir</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Temizle/Yeniden Başla */}
              <TouchableOpacity
                onPress={resetDashboard}
                className="mt-4"
              >
                <Text className="text-xs text-[#586e75] underline font-bold">Yeni İşlem Başlat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* DOSYA SEÇİLİ DEĞİL / ANALİZ BAŞLATMA */
            <View className="w-full items-center gap-3">
              <View className="flex-row w-full gap-2.5">
                {/* Dosya Yükle Butonu */}
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedTask) {
                      Alert.alert('Model Seçilmedi', 'Lütfen dosya yüklemeden önce yukarıdan bir yapay zeka modeli seçin.');
                      return;
                    }
                    handleSelectFile();
                  }}
                  disabled={!selectedTask}
                  className={`flex-1 border-2 rounded-2xl p-4 items-center justify-center ${selectedTask ? 'border-[#b58900]/40 bg-[#b58900]/10 shadow-xs' : 'border-[#93a1a1]/20 bg-[#eee8d5]/10 opacity-50'}`}
                >
                  <Text className="text-2xl mb-1">🎵</Text>
                  <Text className="text-xs font-bold text-[#586e75] text-center">
                    {fileName && !fileName.startsWith('mic_') ? fileName : 'Ses Dosyası Seç'}
                  </Text>
                  <Text className="text-[9px] text-[#657b83] mt-0.5 font-semibold text-center">
                    MP3 / WAV
                  </Text>
                </TouchableOpacity>

                {/* Mikrofonla Kaydet Butonu */}
                <TouchableOpacity
                  onPress={() => {
                    if (!selectedTask) {
                      Alert.alert('Model Seçilmedi', 'Lütfen ses kaydetmeden önce yukarıdan bir yapay zeka modeli seçin.');
                      return;
                    }
                    if (isRecording) {
                      stopRecording();
                    } else {
                      startRecording();
                    }
                  }}
                  disabled={!selectedTask}
                  className={`flex-1 border-2 rounded-2xl p-4 items-center justify-center ${selectedTask
                    ? (isRecording ? 'border-[#dc322f] bg-[#dc322f]/15' : 'border-[#b58900]/40 bg-[#b58900]/10')
                    : 'border-[#93a1a1]/20 bg-[#eee8d5]/10 opacity-50'
                    }`}
                >
                  <Text className="text-2xl mb-1">{isRecording ? '🔴' : '🎙️'}</Text>
                  <Text className={`text-xs font-bold text-center ${isRecording ? 'text-[#dc322f]' : 'text-[#586e75]'}`}>
                    {isRecording ? `Kayıtta (${recordingDuration}s)` : (fileName && fileName.startsWith('mic_') ? 'Sesin Kaydedildi' : 'Mikrofonla Kaydet')}
                  </Text>
                  <Text className="text-[9px] text-[#657b83] mt-0.5 font-semibold text-center">
                    {isRecording ? 'Durdurmak için dokun' : 'Canlı ses kaydet'}
                  </Text>
                </TouchableOpacity>
              </View>

              {selectedTask && localFile && !isRecording && (
                <TouchableOpacity
                  onPress={handleTranscriptionStart}
                  className="w-full bg-[#767F9E] rounded-2xl py-4 mt-2 items-center justify-center shadow-md flex-row gap-2"
                >
                  <Text className="text-white font-bold text-base">İşlemi Başlat</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        </View>

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}

// 🎚️ ÇOKLU KANAL SES MİKSERİ HTML ŞABLONU (DEMUCS)
function getDemucsMixerHtml(vocalsUrl: string, drumsUrl: string, bassUrl: string, otherUrl: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
      * {
        box-sizing: border-box;
      }
      body {
        background-color: #eee8d5;
        color: #586e75;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        margin: 0;
        padding: 12px;
        user-select: none;
      }
      .mixer-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      /* Master Panel */
      .master-panel {
        background: #fdf6e3;
        border-radius: 14px;
        padding: 12px 14px;
        border: 1px solid rgba(147, 161, 161, 0.3);
        box-shadow: 0 4px 10px rgba(88, 110, 117, 0.08);
      }
      .master-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .play-btn {
        background: #a3b18a;
        color: #fdf6e3;
        border: none;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        font-size: 16px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 6px rgba(163, 177, 138, 0.3);
        cursor: pointer;
        transition: all 0.2s;
      }
      .play-btn.playing {
        background: #e09f8d;
        box-shadow: 0 3px 6px rgba(224, 159, 141, 0.3);
      }
      .master-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .time-display {
        display: flex;
        justify-content: space-between;
        font-family: monospace;
        font-size: 11px;
        color: #586e75;
      }
      .progress-slider {
        -webkit-appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: rgba(88, 110, 117, 0.15);
        outline: none;
      }
      .progress-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #b58900;
        cursor: pointer;
      }

      /* Track (Stem) List */
      .track-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .track-card {
        background: #fdf6e3;
        border-radius: 12px;
        padding: 10px 12px;
        border-left: 5px solid #586e75;
        border-top: 1px solid rgba(147, 161, 161, 0.15);
        border-right: 1px solid rgba(147, 161, 161, 0.15);
        border-bottom: 1px solid rgba(147, 161, 161, 0.15);
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-shadow: 0 2px 4px rgba(88, 110, 117, 0.04);
      }
      .track-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .track-title {
        font-weight: bold;
        font-size: 12px;
        color: #586e75;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .track-actions {
        display: flex;
        gap: 4px;
      }
      .action-btn {
        background: rgba(88, 110, 117, 0.05);
        color: #586e75;
        border: 1px solid rgba(88, 110, 117, 0.15);
        border-radius: 5px;
        width: 26px;
        height: 26px;
        font-size: 10px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      }
      .action-btn.mute-active {
        background: #e09f8d;
        color: #fdf6e3;
        border-color: #e09f8d;
      }
      .action-btn.solo-active {
        background: #e5c158;
        color: #fdf6e3;
        border-color: #e5c158;
      }
      .track-bottom {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .vol-icon {
        font-size: 11px;
        color: #93a1a1;
      }
      .vol-slider {
        -webkit-appearance: none;
        flex: 1;
        height: 4px;
        border-radius: 2px;
        background: rgba(88, 110, 117, 0.15);
        outline: none;
      }
      .vol-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #93a1a1;
        cursor: pointer;
      }
      
      /* Specific Pastel Colors */
      .vocals-card { border-left-color: #e29578; }
      .vocals-card .vol-slider::-webkit-slider-thumb { background: #e29578; }
      
      .drums-card { border-left-color: #a3b18a; }
      .drums-card .vol-slider::-webkit-slider-thumb { background: #a3b18a; }
      
      .bass-card { border-left-color: #83c5be; }
      .bass-card .vol-slider::-webkit-slider-thumb { background: #83c5be; }
      
      .other-card { border-left-color: #ddb892; }
      .other-card .vol-slider::-webkit-slider-thumb { background: #ddb892; }

      .loading-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(238, 232, 213, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        z-index: 100;
        transition: opacity 0.3s ease;
      }
      .spinner {
        border: 3px solid rgba(88, 110, 117, 0.1);
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border-left-color: #83c5be;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div id="loading" class="loading-overlay">
      <div class="spinner"></div>
      <div style="font-size: 12px; font-weight: bold; color: #586e75;">Ses Kanalları Çekiliyor...</div>
    </div>

    <div class="mixer-container">
      <!-- Master Panel -->
      <div class="master-panel">
        <div class="master-row">
          <button id="master-play" class="play-btn" onclick="togglePlay()">▶</button>
          <div class="master-info">
            <input type="range" id="progress" class="progress-slider" min="0" max="100" value="0" oninput="seek(this.value)">
            <div class="time-display">
              <span id="current-time">0:00</span>
              <span id="total-duration">0:00</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Track List -->
      <div class="track-list">
        <!-- Vocals -->
        <div class="track-card vocals-card">
          <div class="track-header">
            <div class="track-title">🎙️ Vokal Kanalı (Vocals)</div>
            <div class="track-actions">
              <button id="mute-vocals" class="action-btn" onclick="toggleMute('vocals')">M</button>
              <button id="solo-vocals" class="action-btn" onclick="toggleSolo('vocals')">S</button>
            </div>
          </div>
          <div class="track-bottom">
            <span class="vol-icon">🔈</span>
            <input type="range" id="vol-vocals" class="vol-slider" min="0" max="100" value="80" oninput="setVolume('vocals', this.value)">
          </div>
        </div>

        <!-- Drums -->
        <div class="track-card drums-card">
          <div class="track-header">
            <div class="track-title">🥁 Davul Kanalı (Drums)</div>
            <div class="track-actions">
              <button id="mute-drums" class="action-btn" onclick="toggleMute('drums')">M</button>
              <button id="solo-drums" class="action-btn" onclick="toggleSolo('drums')">S</button>
            </div>
          </div>
          <div class="track-bottom">
            <span class="vol-icon">🔈</span>
            <input type="range" id="vol-drums" class="vol-slider" min="0" max="100" value="80" oninput="setVolume('drums', this.value)">
          </div>
        </div>

        <!-- Bass -->
        <div class="track-card bass-card">
          <div class="track-header">
            <div class="track-title">🎸 Bas Kanalı (Bass)</div>
            <div class="track-actions">
              <button id="mute-bass" class="action-btn" onclick="toggleMute('bass')">M</button>
              <button id="solo-bass" class="action-btn" onclick="toggleSolo('bass')">S</button>
            </div>
          </div>
          <div class="track-bottom">
            <span class="vol-icon">🔈</span>
            <input type="range" id="vol-bass" class="vol-slider" min="0" max="100" value="80" oninput="setVolume('bass', this.value)">
          </div>
        </div>

        <!-- Other -->
        <div class="track-card other-card">
          <div class="track-header">
            <div class="track-title">🎵 Diğer Enstrümanlar (Other)</div>
            <div class="track-actions">
              <button id="mute-other" class="action-btn" onclick="toggleMute('other')">M</button>
              <button id="solo-other" class="action-btn" onclick="toggleSolo('other')">S</button>
            </div>
          </div>
          <div class="track-bottom">
            <span class="vol-icon">🔈</span>
            <input type="range" id="vol-other" class="vol-slider" min="0" max="100" value="80" oninput="setVolume('other', this.value)">
          </div>
        </div>
      </div>
    </div>

    <script>
      const urls = {
        vocals: "${vocalsUrl}",
        drums: "${drumsUrl}",
        bass: "${bassUrl}",
        other: "${otherUrl}"
      };

      const tracks = {};
      let isPlaying = false;
      let duration = 0;
      let loadedCount = 0;
      let syncInterval = null;
      let isWaiting = {};

      // Initialize HTML5 Audio elements
      Object.keys(urls).forEach(key => {
        const audio = new Audio(urls[key]);
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        
        tracks[key] = {
          audio: audio,
          volume: 0.8,
          isMuted: false,
          isSolo: false
        };

        audio.volume = 0.8;

        // Track loaded state
        const onLoaded = () => {
          if (!tracks[key].loaded) {
            tracks[key].loaded = true;
            loadedCount++;
            if (loadedCount >= 4) {
              hideLoading();
            }
          }
        };

        audio.addEventListener('canplay', onLoaded);
        audio.addEventListener('canplaythrough', onLoaded);
        audio.addEventListener('loadedmetadata', onLoaded);

        // Loop / ended support
        audio.addEventListener('ended', () => {
          if (key === 'vocals') {
            pauseAll();
            seek(0);
            document.getElementById('progress').value = 0;
          }
        });
      });

      // 🕒 Yükleme Ekranı Gizleme Yardımcısı
      function hideLoading() {
        const loader = document.getElementById('loading');
        if (loader && loader.style.display !== 'none') {
          loader.style.opacity = 0;
          setTimeout(() => {
            loader.style.display = 'none';
          }, 300);
          if (tracks.vocals && tracks.vocals.audio) {
            duration = tracks.vocals.audio.duration;
            document.getElementById('total-duration').innerText = formatTime(duration);
          }
        }
      }

      // 🛡️ Fail-safe (Güvenlik Zamanlayıcısı): Ağ gecikmesi olsa bile en geç 3 saniyede mikseri açar
      setTimeout(hideLoading, 3000);

      // 🔄 GERÇEK ZAMANLI DRiFT DÜZELTME VE SENKRONİZASYON MOTORU
      function startSyncLoop() {
        if (syncInterval) clearInterval(syncInterval);
        
        syncInterval = setInterval(() => {
          if (!isPlaying) return;
          
          const masterTrack = tracks.vocals;
          if (!masterTrack || !masterTrack.audio) return;
          
          // 🛑 TAMPONLAMA VE DURAKLAMA KONTROLÜ
          // Vokal çalıyor mu ve arabelleğinde yeterli veri var mı (readyState >= 3)?
          // readyState < 3 ise vokal anlık tamponlama (buffering) yaşıyor demektir.
          const isMasterPlaying = !masterTrack.audio.paused && masterTrack.audio.readyState >= 3;
          
          if (!isMasterPlaying) {
            // Vokal tamponlanıyorsa veya durduysa, diğer kanalları da derhal duraklat ki kopup gitmesinler!
            Object.keys(tracks).forEach(k => {
              if (k !== 'vocals' && !tracks[k].audio.paused) {
                tracks[k].audio.pause();
              }
            });
            return;
          }
          
          const masterTime = masterTrack.audio.currentTime;

          Object.keys(tracks).forEach(key => {
            if (key === 'vocals') return; // Vokal referans (master) kanaldır
            
            const track = tracks[key];
            const audio = track.audio;
            
            // Eğer vokal çalıyor ama bu kanal durmuşsa geri başlat
            if (audio.paused && isPlaying) {
              audio.play().catch(e => {});
              return; // Önemli: Önce çalmaya başlasın, senkron ayarını bir sonraki milisaniyede yapacağız (pıtırdıyı önler)
            }
            
            // Farkı hesapla (saniye cinsinden)
            const diff = audio.currentTime - masterTime;
            const absDiff = Math.abs(diff);

            if (absDiff > 0.15) {
              // 1. Faz (Büyük Sapma): Doğrudan tam saniyeye seek (atlama) yap
              audio.currentTime = masterTime;
              audio.playbackRate = 1.0;
            } else if (absDiff > 0.02) {
              // 2. Faz (Mikro Sapma - 20ms ile 150ms arası):
              // Çalma hızını (playbackRate) milisaniyelik ayarlayarak kulağa hissettirmeden senkronu düzeltir.
              if (diff < 0) {
                audio.playbackRate = 1.08; // Geri kalmış, biraz hızlandır
              } else {
                audio.playbackRate = 0.92; // İleri gitmiş, biraz yavaşlat
              }
            } else {
              // Tam senkron durumda normal hızda oynat
              audio.playbackRate = 1.0;
            }
          });
        }, 50); // Her 50 milisaniyede bir kontrol et
      }

      function stopSyncLoop() {
        if (syncInterval) {
          clearInterval(syncInterval);
          syncInterval = null;
        }
        // Tüm hız çarpanlarını sıfırla
        Object.keys(tracks).forEach(k => {
          if (tracks[k]?.audio) tracks[k].audio.playbackRate = 1.0;
        });
      }

      // Helper to format time (e.g. 1:45)
      function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return m + ":" + (s < 10 ? "0" : "") + s;
      }

      // Toggle master play/pause
      function togglePlay() {
        const playBtn = document.getElementById('master-play');
        if (isPlaying) {
          pauseAll();
          playBtn.innerText = "▶";
          playBtn.className = "play-btn";
        } else {
          playAll();
          playBtn.innerText = "❚❚";
          playBtn.className = "play-btn playing";
        }
      }

      function playAll() {
        isPlaying = true;
        let syncTime = tracks.vocals.audio.currentTime;
        
        Object.keys(tracks).forEach(key => {
          tracks[key].audio.currentTime = syncTime;
          tracks[key].audio.play().catch(e => console.log("Play error: ", e));
        });
        
        startSyncLoop();
      }

      function pauseAll() {
        isPlaying = false;
        stopSyncLoop();
        Object.keys(tracks).forEach(key => {
          tracks[key].audio.pause();
        });
      }

      // Update progress bar as audio plays
      setInterval(() => {
        if (isPlaying && tracks.vocals && Object.keys(isWaiting).length === 0) {
          const current = tracks.vocals.audio.currentTime;
          document.getElementById('current-time').innerText = formatTime(current);
          if (duration > 0) {
            const percent = (current / duration) * 100;
            document.getElementById('progress').value = percent;
          }
        }
      }, 250);

      // Seek all tracks simultaneously
      function seek(percent) {
        if (duration > 0) {
          const time = (percent / 100) * duration;
          const wasPlaying = isPlaying;
          
          if (wasPlaying) pauseAll();
          
          Object.keys(tracks).forEach(key => {
            tracks[key].audio.currentTime = time;
          });
          
          document.getElementById('current-time').innerText = formatTime(time);
          
          if (wasPlaying) playAll();
        }
      }

      // Set volume for a single track
      function setVolume(name, val) {
        const vol = val / 100;
        tracks[name].volume = vol;
        if (!tracks[name].isMuted) {
          tracks[name].audio.volume = vol;
        }
      }

      // Mute/Unmute track
      function toggleMute(name) {
        const btn = document.getElementById('mute-' + name);
        const track = tracks[name];
        if (track.isMuted) {
          track.isMuted = false;
          track.audio.volume = track.volume;
          btn.className = "action-btn";
        } else {
          track.isMuted = true;
          track.audio.volume = 0;
          btn.className = "action-btn mute-active";
        }
      }

      // Solo logic: mute all other tracks unless they are also soloed
      function toggleSolo(name) {
        const btn = document.getElementById('solo-' + name);
        const track = tracks[name];
        track.isSolo = !track.isSolo;
        
        btn.className = track.isSolo ? "action-btn solo-active" : "action-btn";

        // Check if any track is soloed
        const anySolo = Object.keys(tracks).some(k => tracks[k].isSolo);

        Object.keys(tracks).forEach(k => {
          const t = tracks[k];
          if (anySolo) {
            if (t.isSolo) {
              t.audio.volume = t.isMuted ? 0 : t.volume;
            } else {
              t.audio.volume = 0;
            }
          } else {
            // Revert to their standard volume/mute states
            t.audio.volume = t.isMuted ? 0 : t.volume;
          }
        });
      }
    </script>
  </body>
  </html>
  `;
}

