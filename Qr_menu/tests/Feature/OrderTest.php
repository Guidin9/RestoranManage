<?php

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Table;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeProduct(float $price = 100): Product
{
    $category = Category::create(['name' => 'Test Kategori']);

    return Product::create([
        'category_id' => $category->id,
        'name' => 'Test Ürün '.uniqid(),
        'price' => $price,
    ]);
}

// --- Sipariş birleştirme ---

it('aynı ürünü ayrı satır açmadan mevcut kalemde birleştirir', function () {
    $table = Table::create(['table_number' => 'Masa 1']);
    $product = makeProduct(50);

    // İki ayrı kişi/istek aynı ürünü sipariş eder.
    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 3]],
    ])->assertCreated();

    $order = Order::where('table_id', $table->id)->where('status', 'active')->firstOrFail();

    // Tek adisyon, tek kalem, adet 5.
    expect($order->items()->count())->toBe(1);
    expect((int) $order->items()->first()->quantity)->toBe(5);
});

it('müşteri menüsünde masanın aktif adisyon toplamını döndürür', function () {
    $table = Table::create(['table_number' => 'Masa 2']);
    $product = makeProduct(75);

    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    $this->getJson('/api/menu/'.$table->qr_code)
        ->assertOk()
        ->assertJson([
            'success' => true,
            'active_order_total' => 150,
            'active_order_item_count' => 2,
        ]);
});

// --- Gün özeti ---

it('gün özeti seçilen günün cirosunu ve kapanan masa sayısını verir', function () {
    $admin = User::create([
        'name' => 'Kasa', 'username' => 'kasa', 'email' => 'kasa@qrmenu.local',
        'password' => 'sifre123', 'role' => 'cashier',
    ]);
    $token = $admin->createToken('test', ['cashier'])->plainTextToken;

    $table = Table::create(['table_number' => 'Masa 3']);
    $product = makeProduct(120);

    // Sipariş oluştur ve öde (bugün).
    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    $order = Order::where('table_id', $table->id)->firstOrFail();

    $this->withHeaders(['Authorization' => 'Bearer '.$token])
        ->postJson('/api/cashier/orders/'.$order->id.'/pay')
        ->assertOk();

    $today = now()->toDateString();

    $this->withHeaders(['Authorization' => 'Bearer '.$token])
        ->getJson('/api/cashier/summary?date='.$today)
        ->assertOk()
        ->assertJson([
            'success' => true,
            'date' => $today,
            'today' => [
                'revenue' => 240,
                'tables_closed' => 1,
                'items_sold' => 2,
                'avg_ticket' => 240,
            ],
        ]);
});
