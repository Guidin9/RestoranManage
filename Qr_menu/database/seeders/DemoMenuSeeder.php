<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * Tasarımı gerçekçi bir menüyle değerlendirebilmek için örnek içerik.
 *
 * TEKRAR ÇALIŞTIRILABİLİR: kategoriyi adına, ürünü (kategori + ad) çiftine
 * göre eşliyor. DatabaseSeeder'ın aksine create() KULLANMAZ, yani dolu bir
 * veritabanında ikinci kez çalıştırmak kayıtları çoğaltmaz — yalnızca
 * fiyatları günceller.
 *
 * Ürünlerde bilerek fotoğraf yok: görsel akışı ImgBB'ye tarayıcıdan yükleme
 * üzerinden işliyor (bkz. Admin.jsx), buradan uydurma bir URL yazmak canlıda
 * kırık görsel bırakırdı. Fotoğraflı hâli görmek için /admin'den birkaç ürüne
 * görsel yükleyin.
 *
 * Temizlemek için: /admin'den kategoriyi silmek yeter — products tablosundaki
 * foreign key onDelete('cascade') olduğu için ürünleri de birlikte gider.
 */
class DemoMenuSeeder extends Seeder
{
    /** @var array<string, array<string, float>> */
    private const MENU = [
        'Kahvaltı' => [
            'Serpme Kahvaltı (2 Kişilik)' => 780,
            'Menemen' => 220,
            'Sucuklu Yumurta' => 245,
            'Omlet (Peynirli)' => 195,
            'Kaymaklı Bal' => 210,
            'Simit & Peynir Tabağı' => 165,
            'Sahanda Sucuk' => 235,
        ],
        'Başlangıçlar' => [
            'Humus' => 155,
            'Haydari' => 140,
            'Atom' => 150,
            'Şakşuka' => 160,
            'Sigara Böreği (6 Adet)' => 175,
            'Kalamar Tava' => 320,
            'Arnavut Ciğeri' => 285,
        ],
        'Çorbalar' => [
            'Mercimek Çorbası' => 120,
            'Ezogelin Çorbası' => 125,
            'Tavuk Suyu Çorba' => 130,
            'İşkembe Çorbası' => 170,
            'Domates Çorbası' => 120,
        ],
        'Ana Yemekler' => [
            'Adana Kebap' => 420,
            'Urfa Kebap' => 420,
            'Kuzu Şiş' => 495,
            'Tavuk Şiş' => 340,
            'İskender' => 460,
            'Karışık Izgara' => 620,
            'Köfte (Izgara)' => 365,
            'Izgara Levrek' => 540,
            'Mantı' => 285,
            'Karnıyarık' => 265,
        ],
        'Pide & Lahmacun' => [
            'Kaşarlı Pide' => 240,
            'Kıymalı Pide' => 265,
            'Kuşbaşılı Pide' => 310,
            'Karışık Pide' => 330,
            'Lahmacun' => 110,
            'Etli Ekmek' => 275,
        ],
        'Salatalar' => [
            'Çoban Salata' => 145,
            'Mevsim Salata' => 155,
            'Gavurdağı Salata' => 175,
            'Sezar Salata' => 265,
            'Ton Balıklı Salata' => 285,
        ],
        'Tatlılar' => [
            'Künefe' => 245,
            'Baklava (Fıstıklı)' => 280,
            'Sütlaç (Fırında)' => 165,
            'Kazandibi' => 165,
            'Trileçe' => 185,
            'Dondurma (3 Top)' => 140,
        ],
        'Sıcak İçecekler' => [
            'Çay' => 40,
            'Fincan Çay' => 55,
            'Türk Kahvesi' => 110,
            'Filtre Kahve' => 130,
            'Latte' => 155,
            'Cappuccino' => 155,
            'Espresso' => 115,
            'Salep' => 145,
            'Sıcak Çikolata' => 150,
        ],
        'Soğuk İçecekler' => [
            'Su (0.5 lt)' => 25,
            'Maden Suyu' => 45,
            'Ayran' => 55,
            'Şalgam' => 60,
            'Kola' => 85,
            'Gazoz' => 80,
            'Limonata (Ev Yapımı)' => 120,
            'Taze Portakal Suyu' => 165,
            'Ice Latte' => 165,
        ],
    ];

    public function run(): void
    {
        foreach (self::MENU as $categoryName => $products) {
            $category = Category::firstOrCreate(['name' => $categoryName]);

            foreach ($products as $name => $price) {
                Product::updateOrCreate(
                    ['category_id' => $category->id, 'name' => $name],
                    ['price' => $price],
                );
            }
        }

        $this->command?->info(
            'Demo menü hazır: ' . count(self::MENU) . ' kategori, ' .
            array_sum(array_map('count', self::MENU)) . ' ürün.'
        );
    }
}
