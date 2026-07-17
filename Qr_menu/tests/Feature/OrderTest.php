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

it('müşteri menüsünde masanın aktif adisyon toplamını ve ürün listesini döndürür', function () {
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
            'active_order_items' => [
                ['quantity' => 2, 'line_total' => 150, 'stage' => 'preparing', 'is_delivered' => false],
            ],
        ]);
});

// --- Üç aşamalı akış: Hazırlanıyor → Servise Hazır → Servis Edildi ---

function staffToken(string $role, string $username): string
{
    $user = User::create([
        'name' => ucfirst($role), 'username' => $username, 'email' => $username.'@qrmenu.local',
        'password' => 'sifre123', 'role' => $role,
    ]);

    return $user->createToken('test', [$role])->plainTextToken;
}

it('yeni sipariş mutfakta (preparing) başlar', function () {
    $table = Table::create(['table_number' => 'Masa 4']);
    $product = makeProduct(40);

    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    $item = Order::where('table_id', $table->id)->firstOrFail()->items()->first();
    expect($item->stage)->toBe('preparing');
    expect($item->preparing_quantity)->toBe(2);
    expect($item->ready_quantity)->toBe(0);
});

it('mutfak hazırlar (ready), garson servis eder (served)', function () {
    $kitchen = staffToken('kitchen', 'mutfak');
    $waiterToken = staffToken('waiter', 'grs');

    $table = Table::create(['table_number' => 'Masa 5']);
    $product = makeProduct(60);

    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    $item = Order::where('table_id', $table->id)->firstOrFail()->items()->first();

    // Mutfak hazırlar → ready.
    $this->withHeaders(['Authorization' => 'Bearer '.$kitchen])
        ->postJson('/api/kitchen/items/'.$item->id.'/prepare')
        ->assertOk();

    $item->refresh();
    expect($item->stage)->toBe('ready');
    expect($item->ready_quantity)->toBe(2);

    // Garson servis eder → served. (Test içinde token değiştiğinden guard'ı sıfırla.)
    $this->app['auth']->forgetGuards();
    $this->withHeaders(['Authorization' => 'Bearer '.$waiterToken])
        ->postJson('/api/waiter/items/'.$item->id.'/serve')
        ->assertOk();

    $item->refresh();
    expect($item->stage)->toBe('served');
    expect($item->is_delivered)->toBeTrue();
});

it('hazırlanmadan servis denenince kalem servis edilmez', function () {
    $cashier = staffToken('cashier', 'kasa');

    $table = Table::create(['table_number' => 'Masa 6']);
    $product = makeProduct(25);

    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    $item = Order::where('table_id', $table->id)->firstOrFail()->items()->first();

    // prepared = 0 olduğu için servis delivered'ı artırmaz.
    $this->withHeaders(['Authorization' => 'Bearer '.$cashier])
        ->postJson('/api/cashier/items/'.$item->id.'/serve')
        ->assertOk();

    $item->refresh();
    expect((int) $item->delivered_quantity)->toBe(0);
    expect($item->stage)->toBe('preparing');
});

it('servis edilmiş ürüne merge ile yeni adet gelince tekrar preparing oluşur', function () {
    $kitchen = staffToken('kitchen', 'mutfak');
    $cashier = staffToken('cashier', 'kasa');

    $table = Table::create(['table_number' => 'Masa 7']);
    $product = makeProduct(30);

    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    $order = Order::where('table_id', $table->id)->firstOrFail();
    $item = $order->items()->first();

    $this->withHeaders(['Authorization' => 'Bearer '.$kitchen])->postJson('/api/kitchen/orders/'.$order->id.'/prepare')->assertOk();
    $this->app['auth']->forgetGuards();
    $this->withHeaders(['Authorization' => 'Bearer '.$cashier])->postJson('/api/cashier/orders/'.$order->id.'/serve')->assertOk();

    // Aynı üründen 1 daha → quantity 3, prepared/delivered 2 → 1 preparing.
    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();

    $item->refresh();
    expect((int) $item->quantity)->toBe(3);
    expect($item->preparing_quantity)->toBe(1);
    expect($item->stage)->toBe('preparing');
});

it('mutfak paneli fiyatsız veri döndürür ve yalnız kitchen yetkisiyle erişilir', function () {
    $kitchen = staffToken('kitchen', 'mutfak');

    $table = Table::create(['table_number' => 'Masa 8']);
    $product = makeProduct(90);

    $this->postJson('/api/orders', [
        'table_id' => $table->id,
        'items' => [['id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();

    // Yetkisiz erişim reddedilir.
    $this->getJson('/api/kitchen/orders')->assertUnauthorized();

    $item = $this->withHeaders(['Authorization' => 'Bearer '.$kitchen])
        ->getJson('/api/kitchen/orders')
        ->assertOk()
        ->json('data.0.items.0');

    expect($item)->toHaveKey('name');
    expect($item)->not->toHaveKey('price_at_sale');
    expect($item)->not->toHaveKey('line_total');
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
