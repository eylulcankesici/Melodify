# Transkripsiyon Kayıt ve Paylaşım Mikroservisi - Detaylı Açıklama

## 📋 İçindekiler
1. [Mevcut Durum Analizi](#mevcut-durum-analizi)
2. [Mikroservis Mantığı](#mikroservis-mantığı)
3. [İş Akışı (Workflow)](#iş-akışı-workflow)
4. [API Endpoint'leri](#api-endpointleri)
5. [Veri Yapısı](#veri-yapısı)

---

## 🔍 Mevcut Durum Analizi

### Şu An Ne Oluyor?
1. Kullanıcı MP3/WAV dosyası yükler → Supabase Storage'a gider
2. Frontend → Flask servisine istek atar (`POST /transcribe`)
3. Flask servisi → AI modeli çalıştırır, MIDI üretir
4. MIDI → Frontend'e blob olarak döner
5. Frontend → MIDI'yi tarayıcıda geçici olarak gösterir (`URL.createObjectURL`)

### ❌ Problemler:
- MIDI dosyası **sadece tarayıcıda geçici olarak** tutuluyor
- Sayfa yenilendiğinde veya tarayıcı kapatıldığında **kaybolur**
- Veritabanına **hiç kaydedilmiyor**
- Geçmiş transkripsiyonlar görüntülenemiyor
- Paylaşım linki çalışmıyor (çünkü veri yok)

---

## 🎯 Mikroservis Mantığı

### Mikroservis Ne Yapacak?

**"Transkripsiyon Kayıt ve Paylaşım Servisi"** aşağıdaki sorumlulukları üstlenecek:

1. ✅ **Transkripsiyon sonuçlarını kaydetmek**
   - Hangi kullanıcı yaptı?
   - Hangi ses dosyasından üretildi?
   - Üretilen MIDI dosyası nerede?
   - Ne zaman yapıldı?

2. ✅ **MIDI dosyasını kalıcı depolamaya yüklemek**
   - Şu an: Tarayıcıda geçici blob
   - Olacak: Supabase Storage'da kalıcı dosya
   - Böylece: Link paylaşılabilir, daha sonra erişilebilir

3. ✅ **Kullanıcının geçmiş transkripsiyonlarını listelemek**
   - "Transkripsiyonlarım" sayfasında gösterilecek

4. ✅ **Paylaşım linki oluşturmak**
   - Her transkripsiyon için benzersiz bir `share_id` üret
   - `/share/{share_id}` linkiyle herkes erişebilsin

---

## 🔄 İş Akışı (Workflow)

### Senaryo: Kullanıcı Ses Dosyasını Transkript Eder

```
┌─────────────┐
│   Frontend  │
│  (Next.js)  │
└──────┬──────┘
       │
       │ 1. Kullanıcı ses dosyasını yükler
       │    → Supabase Storage'a gider (audio_url)
       │
       │ 2. Transkripsiyon başlat
       │    POST /transcribe (Flask servisi)
       │    { audio_url: "https://..." }
       │
       ▼
┌─────────────────┐
│  Flask Servisi  │  ◄─── Mikroservis 1: Ses → MIDI Dönüştürme
│ (port 5000)     │
└────────┬────────┘
         │
         │ 3. AI model çalışır, MIDI üretir
         │
         │ 4. MIDI dosyasını döndür (blob)
         │
         ▼
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       │ 5. MIDI blob'unu alır
       │
       │ 6. YENİ MİKROSERVİSE istek atar
       │    POST http://localhost:3001/api/transcriptions
       │    {
       │      userId: "user-uuid",
       │      audioUrl: "https://storage.../audio.mp3",
       │      midiBlob: <binary data>
       │    }
       │
       ▼
┌──────────────────────┐
│ Transkripsiyon       │  ◄─── Mikroservis 2: Kayıt ve Paylaşım
│ Kayıt Servisi        │
│ (port 3001)          │
└──────────┬───────────┘
           │
           │ 7a. MIDI blob'unu Supabase Storage'a yükle
           │     → midi_url = "https://storage.../midi.midi"
           │
           │ 7b. Veritabanına kayıt ekle
           │     INSERT INTO transcriptions (
           │       user_id, audio_url, midi_url, created_at
           │     )
           │
           │ 8. Kayıt ID'sini döndür
           │    { id: "transcription-123", midi_url: "..." }
           │
           ▼
┌─────────────┐
│   Frontend  │
└─────────────┘
       │
       │ 9. MIDI URL'ini göster
       │    Artık kalıcı bir link var!
       │
       │ 10. Kullanıcı "Transkripsiyonlarım" sayfasında görür
```

---

## 📡 API Endpoint'leri

### Yeni Mikroservis: `http://localhost:3001`

#### 1. Transkripsiyon Kaydet
```
POST /api/transcriptions
```

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "audioUrl": "https://supabase.co/storage/audio-files/123.mp3",
  "midiBlob": <binary data veya base64 encoded>
}
```

**Response:**
```json
{
  "id": "123",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "audioUrl": "https://supabase.co/storage/audio-files/123.mp3",
  "midiUrl": "https://supabase.co/storage/midi-files/123.midi",
  "createdAt": "2025-12-17T15:30:00Z"
}
```

**Ne yapar?**
- MIDI blob'unu Supabase Storage'a yükler
- Veritabanına yeni kayıt ekler
- Kayıt bilgilerini döndürür

---

#### 2. Kullanıcının Transkripsiyonlarını Listele
```
GET /api/transcriptions?userId={userId}
```

**Response:**
```json
[
  {
    "id": "123",
    "audioUrl": "https://...",
    "midiUrl": "https://...",
    "createdAt": "2025-12-17T15:30:00Z",
    "shareId": null
  },
  {
    "id": "124",
    "audioUrl": "https://...",
    "midiUrl": "https://...",
    "createdAt": "2025-12-17T14:20:00Z",
    "shareId": "abc-123-def"
  }
]
```

---

#### 3. Paylaşım Linki Oluştur
```
POST /api/transcriptions/{id}/share
```

**Response:**
```json
{
  "shareId": "abc-123-def-456",
  "shareUrl": "http://localhost:3000/share/abc-123-def-456"
}
```

**Ne yapar?**
- Veritabanında ilgili kaydın `share_id` alanını günceller
- Benzersiz bir UUID üretir
- Paylaşım URL'ini döndürür

---

#### 4. Paylaşılan Transkripsiyonu Getir
```
GET /api/share/{shareId}
```

**Response:**
```json
{
  "id": "123",
  "audioUrl": "https://...",
  "midiUrl": "https://...",
  "createdAt": "2025-12-17T15:30:00Z"
}
```

---

## 🗄️ Veri Yapısı

### Supabase `transcriptions` Tablosu

```sql
CREATE TABLE transcriptions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,      -- Orijinal ses dosyasının Supabase Storage URL'si
  midi_url TEXT NOT NULL,       -- Üretilen MIDI dosyasının Supabase Storage URL'si
  share_id TEXT UNIQUE          -- Paylaşım için benzersiz ID (null olabilir)
);
```

---

## 🎓 Özet: Neden Bu Bir Mikroservis?

### ✅ Mikroservis Özellikleri:

1. **Tek Sorumluluk Prensibi (Single Responsibility)**
   - Sadece "transkripsiyon kayıt ve paylaşım" işiyle ilgilenir
   - Ses→MIDI dönüştürme işine karışmaz (o Flask servisinin işi)

2. **Bağımsız Çalışabilir**
   - Kendi portunda çalışır (örn: 3001)
   - Flask servisi (5000) çökse bile çalışmaya devam edebilir

3. **Ayrı Deploy Edilebilir**
   - Frontend'den ayrı
   - Flask servisinden ayrı
   - Kendi başına ölçeklendirilebilir

4. **HTTP API ile İletişim**
   - RESTful endpoint'ler
   - JSON veri alışverişi
   - Başka servisler de kullanabilir

---

## 🚀 Avantajlar

### Şu Anki Sistemle Karşılaştırma:

| Özellik | Şu Anki Durum | Mikroservis ile |
|---------|---------------|-----------------|
| MIDI kalıcılığı | ❌ Sadece tarayıcıda | ✅ Supabase Storage'da |
| Geçmiş görüntüleme | ❌ Çalışmıyor | ✅ Çalışır |
| Paylaşım linki | ❌ Çalışmıyor | ✅ Çalışır |
| Veri kaybı | ❌ Sayfa yenilendiğinde kaybolur | ✅ Kalıcı |
| Ölçeklenebilirlik | ❌ Frontend'e bağımlı | ✅ Ayrı ölçeklenebilir |

---

## 📝 Sonuç

Bu mikroservis, **transkripsiyon sonuçlarının kalıcı olmasını** ve **kullanıcıların geçmişlerini görebilmesini** sağlar. Flask servisi sadece "ses→MIDI dönüştürme" işine odaklanırken, bu servis "veri yönetimi ve paylaşım" işine odaklanır.

Bu sayede:
- Her servis kendi sorumluluğuna odaklanır
- Sistem modüler ve bakımı kolay olur
- Ölçeklendirme daha kolay olur
- Ödev için güzel bir mikroservis örneği olur! 🎉

