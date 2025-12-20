# Transkripsiyon Kayıt ve Paylaşım Mikroservisi

Bu mikroservis, Melodify uygulamasının transkripsiyon kayıt ve paylaşım işlemlerini yönetir.

## 📋 Özellikler

- ✅ MIDI dosyalarını Supabase Storage'a yükler
- ✅ Transkripsiyonları veritabanına kaydeder
- ✅ Kullanıcının geçmiş transkripsiyonlarını listeler
- ✅ Paylaşım linki oluşturur ve yönetir

## 🚀 Kurulum

1. Bağımlılıkları yükleyin:
```bash
cd microservice
npm install
```

2. `.env` dosyası oluşturun (`.env.example` dosyasını referans alarak):
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
FRONTEND_URL=http://localhost:3000
PORT=3001
```

3. Servisi başlatın:
```bash
npm start
# veya geliştirme modu için:
npm run dev
```

## 📡 API Endpoints

### POST /api/transcriptions
MIDI blob'unu Storage'a yükler ve veritabanına kaydeder.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `midiBlob`: MIDI dosyası (File/Blob)
  - `userId`: Kullanıcı ID'si (string)
  - `audioUrl`: Orijinal ses dosyası URL'si (string)

**Response:**
```json
{
  "id": "123",
  "userId": "user-uuid",
  "audioUrl": "https://...",
  "midiUrl": "https://...",
  "createdAt": "2025-12-17T15:30:00Z"
}
```

### GET /api/transcriptions?userId={userId}
Kullanıcının transkripsiyonlarını listeler.

**Response:**
```json
[
  {
    "id": "123",
    "audioUrl": "https://...",
    "midiUrl": "https://...",
    "createdAt": "2025-12-17T15:30:00Z",
    "shareId": "uuid-or-null"
  }
]
```

### POST /api/transcriptions/:id/share
Paylaşım linki oluşturur.

**Response:**
```json
{
  "shareId": "uuid",
  "shareUrl": "http://localhost:3000/share/uuid"
}
```

### GET /api/share/:shareId
Paylaşılan transkripsiyonu getirir.

**Response:**
```json
{
  "audioUrl": "https://...",
  "midiUrl": "https://...",
  "createdAt": "2025-12-17T15:30:00Z"
}
```

### GET /health
Servis sağlık kontrolü.

**Response:**
```json
{
  "status": "ok",
  "service": "transcription-service"
}
```

## 🔧 Geliştirme

Mikroservis port 3001'de çalışır. Frontend'in bu portta çalışan servisle iletişim kurabilmesi için servisin çalışır durumda olması gerekir.

## 📝 Notlar

- MIDI dosyaları `audio-files` bucket'ına yüklenir (ses dosyalarıyla aynı bucket)
- Veritabanı tablosu: `transcriptions`
- Paylaşım linkleri benzersiz UUID kullanır







