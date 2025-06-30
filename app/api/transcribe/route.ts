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
      const errorData = await response.json();
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

  } catch (error: any) {
    console.error('API Route Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Transkripsiyon sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}