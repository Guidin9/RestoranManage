<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Table;
use App\Models\Category;
use App\Models\Product;
use App\Models\Waiter;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 0. Admin & Kasa hesapları (.env üzerinden yönetilir)
        $this->call(StaffSeeder::class);

        // 1. Varsayılan Garsonları Veritabanına Ekle (şifreler otomatik hash'lenir)
        Waiter::create(['name' => 'Ahmet Yılmaz', 'username' => 'ahmet', 'password' => '123456']);
        Waiter::create(['name' => 'Mehmet Demir', 'username' => 'mehmet', 'password' => '123456']);
        Waiter::create(['name' => 'Ayşe Kaya',    'username' => 'ayse',   'password' => '123456']);

        // 2. Varsayılan Masaları Otomatik UUID ile Ekle
        Table::create(['table_number' => 'Masa 1', 'qr_code' => (string) Str::uuid()]);
        Table::create(['table_number' => 'Masa 2', 'qr_code' => (string) Str::uuid()]);
        Table::create(['table_number' => 'Masa 3', 'qr_code' => (string) Str::uuid()]);

        // 3. Menü & Ürünleri Ekle
        $cat1 = Category::create(['name' => 'Sıcak İçecekler']);
        Product::create(['category_id' => $cat1->id, 'name' => 'Çay', 'price' => 25.00]);
        Product::create(['category_id' => $cat1->id, 'name' => 'Türk Kahvesi', 'price' => 60.00]);

        $cat2 = Category::create(['name' => 'Yiyecekler']);
        Product::create(['category_id' => $cat2->id, 'name' => 'Kaşarlı Tost', 'price' => 120.00]);
        Product::create(['category_id' => $cat2->id, 'name' => 'Hamburger', 'price' => 250.00]);
    }
}
