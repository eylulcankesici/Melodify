# Mikroservis Kurulum ve Kullanım Kılavuzu

## ✅ Yapılan Değişiklikler

### 1. Mikroservis Oluşturuldu
- 📁 Klasör: `microservice/`
- 🔌 Port: `3001`
- 🛠️ Teknoloji: Node.js + Express

### 2. Frontend Güncellemeleri
- ✅ `app/page.tsx` - `handleStartTranscription` fonksiyonu güncellendi
- ✅ `components/TranscriptionHistory.tsx` - Mikroservisten veri çekiyor
- ✅ `app/share/[shareId]/page.tsx` - Mikroservisten paylaşılan transkripsiyonları çekiyor

## 🚀 Kurulum Adımları

### 1. Mikroservis Bağımlılıklarını Yükle
```bash
cd microservice
npm install
```

### 2. Environment Variables (.env) Dosyası Oluştur
`microservice/` klasöründe `.env` dosyası oluştur:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Frontend URL (paylaşım linkleri için)
FRONTEND_URL=http://localhost:3000

# Server Port
PORT=3001
```

**Not:** Bu değerleri ana projenin `.env.local` dosyasından alabilirsin (NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY).

### 3. Mikroservisi Başlat
```bash
cd microservice
npm start
```

Veya geliştirme modu için (otomatik yeniden başlatma):
```bash
npm run dev
```

### 4. Ana Uygulamayı Başlat
Ayrı bir terminal penceresinde:
```bash
npm run dev
```

## 🔄 İş Akışı

1. **Kullanıcı ses dosyası yükler** → Supabase Storage'a gider
2. **Kullanıcı transkripsiyon başlatır** → Flask servisi (port 5000) MIDI üretir
3. **Frontend MIDI blob'unu alır** → Yeni mikroservise (port 3001) gönderir
4. **Mikroservis:**
   - MIDI blob'unu Supabase Storage'a yükler
   - Veritabanına kayıt ekler
   - Kalıcı MIDI URL'i döndürür
5. **Kullanıcı geçmişini görüntüler** → Mikroservisten veri çekilir
6. **Kullanıcı paylaşım linki oluşturur** → Mikroservis share_id üretir

## 📡 API Endpoints (Mikroservis)

- `POST /api/transcriptions` - MIDI kaydet
- `GET /api/transcriptions?userId=xxx` - Kullanıcı transkripsiyonlarını listele
- `POST /api/transcriptions/:id/share` - Paylaşım linki oluştur
- `GET /api/share/:shareId` - Paylaşılan transkripsiyonu getir
- `GET /health` - Servis sağlık kontrolü

## 🧪 Test Etme

1. Mikroservisi başlat (port 3001)
2. Ana uygulamayı başlat (port 3000)
3. Flask servisini başlat (port 5000)
4. Bir ses dosyası yükle ve transkript et
5. "Transkripsiyonlarım" sayfasında görüntüle
6. Paylaşım linki oluştur ve test et

## ⚠️ Önemli Notlar

- Üç servisin de aynı anda çalışması gerekir:
  - Next.js Frontend (port 3000)
  - Flask Transkripsiyon Servisi (port 5000)
  - Express Mikroservis (port 3001)
- Mikroservis çalışmazsa, transkripsiyon kaydedilmeyecek ve geçmiş görüntülenemeyecek
- MIDI dosyaları `audio-files` bucket'ına yüklenir (ses dosyalarıyla aynı)

## 🐛 Sorun Giderme

**Mikroservis başlamıyor:**
- `.env` dosyasının doğru konumda olduğundan emin ol
- Supabase URL ve Key'in doğru olduğunu kontrol et

**Transkripsiyon kaydedilmiyor:**
- Mikroservisin çalıştığından emin ol (port 3001)
- Browser console'da hata var mı kontrol et
- Mikroservis log'larını kontrol et

**Geçmiş görüntülenemiyor:**
- Mikroservis çalışıyor mu kontrol et
- Kullanıcının giriş yaptığından emin ol
- Browser console'da API isteğinin başarılı olduğunu kontrol et




