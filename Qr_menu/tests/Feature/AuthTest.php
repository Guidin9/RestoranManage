<?php

use App\Models\Table;
use App\Models\User;
use App\Models\Waiter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

function makeStaff(string $role, string $username = 'test', string $password = 'sifre123'): User
{
    return User::create([
        'name' => 'Test '.$role,
        'username' => $username,
        'email' => $username.'@qrmenu.local',
        'password' => $password,
        'role' => $role,
    ]);
}

function tokenFor(User $user, array $abilities): string
{
    return $user->createToken('test', $abilities)->plainTextToken;
}

function authHeader(string $token): array
{
    return ['Authorization' => 'Bearer '.$token];
}

// --- Herkese açık uçlar ---

it('müşteri menüsünü token olmadan gösterir', function () {
    $table = Table::create(['table_number' => 'Masa 1']);

    $this->getJson('/api/menu/'.$table->qr_code)
        ->assertOk()
        ->assertJson(['success' => true, 'table_number' => 'Masa 1']);
});

it('geçersiz QR kod için 404 döner', function () {
    $this->getJson('/api/menu/olmayan-uuid')->assertNotFound();
});

// --- Korumalı uçlar token istiyor ---

it('korumalı uçlar token olmadan 401 döner', function (string $method, string $url) {
    $this->json($method, $url)->assertUnauthorized();
})->with([
    ['GET', '/api/admin/waiters'],
    ['POST', '/api/admin/waiters'],
    ['DELETE', '/api/admin/waiters/1'],
    ['POST', '/api/admin/tables'],
    ['POST', '/api/admin/categories'],
    ['POST', '/api/admin/products'],
    ['GET', '/api/cashier/orders'],
    ['POST', '/api/cashier/orders/1/pay'],
    ['GET', '/api/waiter/tables'],
    ['GET', '/api/waiter/menu'],
]);

// --- Giriş ---

it('admin doğru bilgilerle token alır', function () {
    makeStaff('admin', 'admin', 'admin123');

    $response = $this->postJson('/api/admin/login', [
        'username' => 'admin',
        'password' => 'admin123',
    ])->assertOk()->assertJson(['success' => true]);

    expect($response->json('token'))->toBeString()->not->toBeEmpty();
});

it('admin yanlış şifreyle 401 alır', function () {
    makeStaff('admin', 'admin', 'admin123');

    $this->postJson('/api/admin/login', [
        'username' => 'admin',
        'password' => 'yanlis',
    ])->assertUnauthorized()->assertJson(['success' => false]);
});

it('kasa hesabı admin ucundan giriş yapamaz', function () {
    makeStaff('cashier', 'kasa', '123456');

    // Rol eşleşmediği için admin giriş ucu bu hesabı tanımamalı.
    $this->postJson('/api/admin/login', [
        'username' => 'kasa',
        'password' => '123456',
    ])->assertUnauthorized();
});

it('garson doğru bilgilerle token alır', function () {
    Waiter::create(['name' => 'Ahmet', 'username' => 'ahmet', 'password' => '123456']);

    $this->postJson('/api/waiter/login', [
        'username' => 'ahmet',
        'password' => '123456',
    ])->assertOk()->assertJson([
        'success' => true,
        'waiter' => ['name' => 'Ahmet'],
    ]);
});

it('garson şifresini düz metin olarak saklamaz', function () {
    $waiter = Waiter::create(['name' => 'Ahmet', 'username' => 'ahmet', 'password' => '123456']);

    expect($waiter->fresh()->password)->not->toBe('123456');
    expect(Hash::check('123456', $waiter->fresh()->password))->toBeTrue();
});

it('garson şifresini API cevabında sızdırmaz', function () {
    Waiter::create(['name' => 'Ahmet', 'username' => 'ahmet', 'password' => '123456']);
    $token = tokenFor(makeStaff('admin'), ['admin', 'cashier', 'waiter']);

    $response = $this->getJson('/api/admin/waiters', authHeader($token))->assertOk();

    expect($response->json('data.0'))->not->toHaveKey('password');
});

// --- Yetki (ability) sınırları ---

it('garson token’ı admin uçlarına erişemez', function () {
    $waiter = Waiter::create(['name' => 'Ahmet', 'username' => 'ahmet', 'password' => '123456']);
    $token = $waiter->createToken('waiter', ['waiter'])->plainTextToken;

    $this->getJson('/api/admin/waiters', authHeader($token))->assertForbidden();
});

it('kasa token’ı admin uçlarına erişemez', function () {
    $token = tokenFor(makeStaff('cashier', 'kasa'), ['cashier']);

    $this->getJson('/api/admin/waiters', authHeader($token))->assertForbidden();
});

it('kasa token’ı garson uçlarına erişemez', function () {
    $token = tokenFor(makeStaff('cashier', 'kasa'), ['cashier']);

    $this->getJson('/api/waiter/tables', authHeader($token))->assertForbidden();
});

it('garson token’ı kendi uçlarına erişebilir', function () {
    $waiter = Waiter::create(['name' => 'Ahmet', 'username' => 'ahmet', 'password' => '123456']);
    $token = $waiter->createToken('waiter', ['waiter'])->plainTextToken;

    $this->getJson('/api/waiter/tables', authHeader($token))->assertOk();
});

it('admin token’ı garson ve kasa uçlarına da erişebilir', function () {
    $token = tokenFor(makeStaff('admin'), ['admin', 'cashier', 'waiter']);

    $this->getJson('/api/waiter/tables', authHeader($token))->assertOk();
    $this->getJson('/api/waiter/menu', authHeader($token))->assertOk();
    $this->getJson('/api/cashier/orders', authHeader($token))->assertOk();
    $this->getJson('/api/admin/waiters', authHeader($token))->assertOk();
});

// --- Çıkış ---

it('çıkış yapınca token geçersizleşir', function () {
    $user = makeStaff('admin');
    $token = tokenFor($user, ['admin', 'cashier', 'waiter']);

    $this->postJson('/api/logout', [], authHeader($token))->assertOk();

    expect($user->tokens()->count())->toBe(0);

    // Guard, çözdüğü kullanıcıyı örnek üzerinde önbelleğe alır. Gerçek hayatta her
    // istek uygulamayı sıfırdan ayağa kaldırdığı için bu önbellek taşınmaz;
    // testte aynı örnek kullanıldığından yeni isteği taklit etmek üzere sıfırlıyoruz.
    $this->app['auth']->forgetGuards();

    $this->getJson('/api/admin/waiters', authHeader($token))->assertUnauthorized();
});
