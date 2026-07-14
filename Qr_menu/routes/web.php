<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Rotaları
|--------------------------------------------------------------------------
|
| Bu backend API-only çalışır; kullanıcı arayüzü ayrı bir React uygulamasıdır
| (qr-menu-frontend). Burası eskiden Laravel'in "welcome" sayfasını dönüyordu,
| ancak o sayfa @vite kullanıyor ve public/build .gitignore'da olduğundan
| sunucuda derlenmiş asset bulunamayıp 500 veriyordu. API-only bir serviste
| o sayfanın işlevi olmadığı için basit bir durum cevabı dönüyoruz.
|
| Ayrıntılı sağlık kontrolü için Laravel'in hazır /up ucu kullanılabilir.
|
*/

Route::get('/', function () {
    return response()->json([
        'success' => true,
        'service' => config('app.name'),
        'message' => 'QR Menü API çalışıyor. Uçlar /api altındadır.',
    ]);
});
