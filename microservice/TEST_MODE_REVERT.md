# TEST MODE - GERİ ALMA REHBERİ

Bu dosya, test için yapılan değişiklikleri geri almak için hazırlanmıştır.

## Yapılan Değişiklikler

### 1. POST /api/transcriptions endpoint (60-75. satırlar arası)

**Test Modu (Şu anki):**
```javascript
// TEST İÇİN: adminSupabase kullan (RLS'i bypass eder)
const clientToUse = adminSupabase;
console.log('TEST MODE: Admin client kullanılıyor (RLS bypass)');
```

**Eski Hali (Geri Alınacak):**
```javascript
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
```

---

### 2. GET /api/transcriptions endpoint (154-166. satırlar arası)

**Test Modu (Şu anki):**
```javascript
// TEST İÇİN: adminSupabase kullan (RLS'i bypass eder)
const { data, error } = await adminSupabase
  .from('transcriptions')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**Eski Hali (Geri Alınacak):**
```javascript
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
```

---

## Geri Alma Adımları

1. `microservice/server.js` dosyasını açın
2. Yorum satırlarındaki eski kodları bulun
3. Test modu kodlarını silin
4. Yorum satırlarındaki eski kodların yorumunu kaldırın
5. Mikroservisi yeniden başlatın: `sudo systemctl restart melodify-microservice`

---

## Not

Bu değişiklikler yalnızca test amaçlıdır. Production'da RLS politikalarını düzgün yapılandırarak authenticated client kullanılmalıdır.

