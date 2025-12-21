import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Frontend'den gelen isteğin gövdesini al
    const body = await req.json();
    const { audioUrl } = body;

    // Python backend'ine aynı isteği yolla
    const response = await fetch('http://localhost:5000/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: audioUrl }), // Python'un beklediği format
    });

    // Python'dan gelen yanıt başarısızsa, hatayı olduğu gibi yansıt
    if (!response.ok) {
      // Content-Type'ı kontrol et - HTML mi JSON mu?
      const contentType = response.headers.get('content-type') || '';
      let errorData;
      
      if (contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        // HTML hata sayfası geldi, text olarak oku
        const errorText = await response.text();
        console.error('Backend HTML hatası (ilk 500 karakter):', errorText.substring(0, 500));
        errorData = { 
          error: `Backend hatası (${response.status}): ${response.statusText}. Python backend servisi çalışmıyor olabilir.` 
        };
      }
      
      return NextResponse.json(
        { error: errorData.error || 'Backend tarafında bir hata oluştu' },
        { status: response.status }
      );
    }

    // Python'dan gelen MIDI dosyasını (blob) al
    const midiBlob = await response.blob();

    // Gelen MIDI dosyasını, hiçbir değişiklik yapmadan,
    // doğrudan frontend'e yeni bir Response olarak gönder.
    // Doğru 'Content-Type' başlığını da ekliyoruz.
    return new NextResponse(midiBlob, {
      status: 200,
      headers: {
        'Content-Type': 'audio/midi',
      },
    });

  } catch (error: unknown) {
    console.error('API Route Hatası:', error);

    // Eğer fetch hatası ise (backend erişilemiyor)
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('ECONNREFUSED'))) {
      return NextResponse.json(
        { error: 'Python backend servisine erişilemiyor (localhost:5000). Servisin çalıştığından emin olun.' },
        { status: 503 }
      );
    }

    const message =
      error instanceof Error ? error.message : 'Transkripsiyon sırasında bir hata oluştu';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}