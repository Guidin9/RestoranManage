<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\OrderController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Rotaları
|--------------------------------------------------------------------------
|
| Yetkilendirme Sanctum token'ları ile yapılır. Giriş uçları token döner,
| korumalı uçlar "Authorization: Bearer <token>" başlığı bekler.
|
| Token yetkileri (abilities):
|   admin   -> ['admin', 'cashier', 'waiter']  (panel garson uçlarını da kullanıyor)
|   cashier -> ['cashier']
|   waiter  -> ['waiter']
|
*/

/*
| Herkese Açık — Müşteri QR Menüsü
|--------------------------------------------------------------------------
| Müşterilerin hesabı yoktur: QR kodu okutan herkes menüyü görüp sipariş verir.
*/
Route::get('/menu/{tableUuid}', [MenuController::class, 'show']);
Route::post('/orders', [OrderController::class, 'store']);

/*
| Herkese Açık — Giriş Uçları
*/
Route::post('/admin/login', [AuthController::class, 'adminLogin']);
Route::post('/cashier/login', [AuthController::class, 'cashierLogin']);
Route::post('/waiter/login', [AuthController::class, 'waiterLogin']);
Route::post('/kitchen/login', [AuthController::class, 'kitchenLogin']);

/*
| Korumalı Uçlar
*/
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    // 💰 Kasa
    Route::middleware('abilities:cashier')->group(function () {
        Route::get('/cashier/orders', [OrderController::class, 'activeOrders']);
        Route::post('/cashier/orders/{id}/pay', [OrderController::class, 'closeOrder']);
        Route::post('/cashier/items/{id}/serve', [OrderController::class, 'serveItem']);
        Route::post('/cashier/orders/{id}/serve', [OrderController::class, 'serveOrder']);
        Route::get('/cashier/summary', [OrderController::class, 'dailySummary']);
    });

    // 🍳 Mutfak
    Route::middleware('abilities:kitchen')->group(function () {
        Route::get('/kitchen/orders', [OrderController::class, 'kitchenOrders']);
        Route::post('/kitchen/items/{id}/prepare', [OrderController::class, 'prepareItem']);
        Route::post('/kitchen/orders/{id}/prepare', [OrderController::class, 'prepareOrder']);
    });

    // 🤵 Garson (admin token'ı da bu yetkiye sahip)
    Route::middleware('abilities:waiter')->group(function () {
        Route::get('/waiter/tables', [OrderController::class, 'waiterTables']);
        Route::get('/waiter/menu', [OrderController::class, 'waiterMenu']);
        Route::post('/waiter/items/{id}/remove', [OrderController::class, 'removeOrderItem']);
        Route::post('/waiter/items/{id}/serve', [OrderController::class, 'serveItem']);
        Route::post('/waiter/orders/{id}/serve', [OrderController::class, 'serveOrder']);
    });

    // 👑 Admin
    Route::middleware('abilities:admin')->prefix('admin')->group(function () {
        Route::get('/waiters', [AdminController::class, 'getWaiters']);
        Route::post('/waiters', [AdminController::class, 'storeWaiter']);
        Route::delete('/waiters/{id}', [AdminController::class, 'deleteWaiter']);

        Route::post('/tables', [AdminController::class, 'storeTable']);
        Route::delete('/tables/{id}', [AdminController::class, 'deleteTable']);

        Route::post('/categories', [AdminController::class, 'storeCategory']);
        Route::delete('/categories/{id}', [AdminController::class, 'deleteCategory']);

        Route::post('/products', [AdminController::class, 'storeProduct']);
        Route::delete('/products/{id}', [AdminController::class, 'deleteProduct']);
    });
});
