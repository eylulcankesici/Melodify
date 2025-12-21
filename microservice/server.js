import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS ayarları
app.use(cors());
app.use(express.json());

// Supabase client - hem SUPABASE_URL hem NEXT_PUBLIC_SUPABASE_URL'yi kontrol et
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

console.log('Supabase URL kontrol:', supabaseUrl ? 'Bulundu ✓' : 'Bulunamadı ✗');
console.log('Supabase Anon Key kontrol:', supabaseAnonKey ? 'Bulundu ✓' : 'Bulunamadı ✗');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL veya Key bulunamadı! .env dosyasını kontrol edin.');
  console.error('Aranan değişkenler: SUPABASE_URL veya NEXT_PUBLIC_SUPABASE_URL');
  console.error('Aranan değişkenler: SUPABASE_ANON_KEY veya NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Kullanıcı token'ıyla çalışan client
const supabase = createClient(supabaseUrl, supabaseAnonKey);
// RLS'i aşmak için servis rollerini kullanan admin client (yalnızca backend'te)
const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Multer için memory storage (blob'ları işlemek için)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/transcriptions
 * MIDI blob'unu Supabase Storage'a yükler ve veritabanına kayıt ekler
 */
app.post('/api/transcriptions', upload.single('midiBlob'), async (req, res) => {
  try {
    const { userId, audioUrl, accessToken } = req.body;
    const midiBlob = req.file?.buffer;

    console.log('Gelen istek - userId:', userId, 'accessToken var mı:', !!accessToken);

    // Validasyon
    if (!userId) {
      return res.status(400).json({ error: 'userId gerekli' });
    }
    if (!audioUrl) {
      return res.status(400).json({ error: 'audioUrl gerekli' });
    }
    if (!midiBlob) {
      return res.status(400).json({ error: 'midiBlob gerekli' });
    }

    // Kullanıcı token'ı varsa authenticated client oluştur, yoksa anon kullan
    let clientToUse = supabase;
    if (accessToken) {
      console.log('Authenticated client oluşturuluyor...');
      clientToUse = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      });
    } else {
      console.log('Anon client kullanılıyor (token yok)');
    }

    // MIDI dosyasını Supabase Storage'a yükle
    const midiFileName = `${Date.now()}_${uuidv4()}.mid`;
    console.log('Storage\'a yükleme başlıyor, dosya adı:', midiFileName);
    const { data: uploadData, error: uploadError } = await clientToUse.storage
      .from('audio-files') // Mevcut bucket'ı kullanıyoruz
      .upload(midiFileName, midiBlob, {
        contentType: 'audio/midi',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage yükleme hatası detayı:', JSON.stringify(uploadError, null, 2));
      return res.status(500).json({ error: 'MIDI dosyası yüklenemedi: ' + uploadError.message });
    }
    console.log('Storage yükleme başarılı!');

    // Public URL al
    const { data: urlData } = clientToUse.storage
      .from('audio-files')
      .getPublicUrl(midiFileName);

    const midiUrl = urlData.publicUrl;

    // Veritabanına kayıt ekle
    console.log('Veritabanına kayıt ekleniyor - userId:', userId, 'audioUrl:', audioUrl, 'midiUrl:', midiUrl);
    const { data: dbData, error: dbError } = await clientToUse
      .from('transcriptions')
      .insert({
        user_id: userId,
        audio_url: audioUrl,
        midi_url: midiUrl
      })
      .select()
      .single();

    if (dbError) {
      console.error('Veritabanı kayıt hatası detayı:', JSON.stringify(dbError, null, 2));
      // Storage'daki dosyayı sil (rollback)
      await clientToUse.storage.from('audio-files').remove([midiFileName]);
      return res.status(500).json({ error: 'Veritabanına kayıt eklenemedi: ' + dbError.message });
    }

    console.log('Veritabanına kayıt başarılı! Kayıt ID:', dbData.id);

    // Başarılı yanıt
    res.status(201).json({
      id: dbData.id.toString(),
      userId: dbData.user_id,
      audioUrl: dbData.audio_url,
      midiUrl: dbData.midi_url,
      createdAt: dbData.created_at
    });

  } catch (error) {
    console.error('Genel hata:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transcriptions
 * Kullanıcının transkripsiyonlarını listeler
 */
app.get('/api/transcriptions', async (req, res) => {
  try {
    const { userId } = req.query;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');

    console.log('GET /api/transcriptions - userId:', userId, 'accessToken var mı:', !!accessToken);

    if (!userId) {
      return res.status(400).json({ error: 'userId query parametresi gerekli' });
    }

    // Kullanıcı token'ı varsa authenticated client oluştur
    let clientToUse = supabase;
    if (accessToken) {
      clientToUse = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      });
    }

    const { data, error } = await clientToUse
      .from('transcriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Veritabanı okuma hatası:', error);
      return res.status(500).json({ error: 'Transkripsiyonlar alınamadı: ' + error.message });
    }

    console.log('Veritabanından gelen kayıt sayısı:', data?.length || 0);

    // Veriyi frontend'in beklediği formata dönüştür
    const transcriptions = data.map(item => ({
      id: item.id.toString(),
      audioUrl: item.audio_url,
      midiUrl: item.midi_url,
      createdAt: item.created_at,
      shareId: item.share_id || null
    }));

    console.log('Döndürülen transcriptions:', transcriptions);
    res.json(transcriptions);

  } catch (error) {
    console.error('Genel hata:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/transcriptions/:id/share
 * Paylaşım linki oluşturur
 */
app.post('/api/transcriptions/:id/share', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('POST /api/transcriptions/:id/share - id:', id);

    // Benzersiz share_id oluştur
    const shareId = uuidv4();

    // Veritabanında güncelle
    const { data, error } = await adminSupabase
      .from('transcriptions')
      .update({ share_id: shareId })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Paylaşım linki oluşturma hatası:', error);
      return res.status(500).json({ error: 'Paylaşım linki oluşturulamadı: ' + error.message });
    }

    const updated = Array.isArray(data) ? data[0] : data;

    if (!updated) {
      return res.status(404).json({ error: 'Transkripsiyon bulunamadı' });
    }

    // Frontend URL'sini oluştur (environment variable'dan al veya varsayılan kullan)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const shareUrl = `${frontendUrl}/share/${shareId}`;

    res.json({
      shareId: shareId,
      shareUrl: shareUrl
    });

  } catch (error) {
    console.error('Genel hata:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/share/:shareId
 * Paylaşılan transkripsiyonu getirir
 */
app.get('/api/share/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;

    const { data, error } = await supabase
      .from('transcriptions')
      .select('audio_url, midi_url, created_at')
      .eq('share_id', shareId)
      .single();

    if (error) {
      console.error('Paylaşılan transkripsiyon okuma hatası:', error);
      return res.status(500).json({ error: 'Transkripsiyon alınamadı: ' + error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Paylaşılan transkripsiyon bulunamadı' });
    }

    res.json({
      audioUrl: data.audio_url,
      midiUrl: data.midi_url,
      createdAt: data.created_at
    });

  } catch (error) {
    console.error('Genel hata:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'transcription-service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Transkripsiyon Mikroservisi port ${PORT} üzerinde çalışıyor`);
  console.log(`📡 Endpoints:`);
  console.log(`   POST   /api/transcriptions`);
  console.log(`   GET    /api/transcriptions?userId=xxx`);
  console.log(`   POST   /api/transcriptions/:id/share`);
  console.log(`   GET    /api/share/:shareId`);
  console.log(`   GET    /health`);
});

