<?php

/*
|--------------------------------------------------------------------------
| Personel Hesapları
|--------------------------------------------------------------------------
|
| Admin ve kasa hesapları tek kullanıcılı sabit hesaplardır. Bilgileri
| .env üzerinden yönetilir; StaffSeeder bu değerleri veritabanına yazar.
| Şifre değiştirmek için .env'yi güncelleyip şu komutu çalıştırın:
|
|   php artisan db:seed --class=StaffSeeder
|
*/

return [

    'admin' => [
        'name' => env('ADMIN_NAME', 'Yönetici'),
        'username' => env('ADMIN_USERNAME', 'admin'),
        'email' => env('ADMIN_EMAIL', 'admin@qrmenu.local'),
        'password' => env('ADMIN_PASSWORD', 'admin123'),
    ],

    'cashier' => [
        'name' => env('CASHIER_NAME', 'Kasa'),
        'username' => env('CASHIER_USERNAME', 'kasa'),
        'email' => env('CASHIER_EMAIL', 'kasa@qrmenu.local'),
        'password' => env('CASHIER_PASSWORD', '123456'),
    ],

];
