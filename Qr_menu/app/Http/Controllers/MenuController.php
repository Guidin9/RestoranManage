<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Order;
use App\Models\Table;
use Illuminate\Http\JsonResponse;

class MenuController extends Controller
{
    // Müşteri QR kodu okuttuğunda: masayı doğrula ve menüyü dön.
    public function show(string $tableUuid): JsonResponse
    {
        $table = Table::where('qr_code', $tableUuid)->first();

        if (! $table) {
            return response()->json([
                'success' => false,
                'message' => 'Geçersiz veya hatalı QR kod!',
            ], 404);
        }

        // N+1 sorgusunu engellemek için ürünleri eager load ediyoruz.
        $menu = Category::with('products')->get();

        // Masanın o ana kadarki açık adisyon toplamı — müşteri kendi sepetinden
        // ayrı olarak masanın güncel borcunu (herkesin siparişi) görebilsin.
        $activeOrder = Order::with('items')
            ->where('table_id', $table->id)
            ->where('status', 'active')
            ->first();

        $activeTotal = 0;
        $activeItemCount = 0;
        if ($activeOrder) {
            foreach ($activeOrder->items as $item) {
                $activeTotal += $item->price_at_sale * $item->quantity;
                $activeItemCount += $item->quantity;
            }
        }

        return response()->json([
            'success' => true,
            'table_number' => $table->table_number,
            'table_id' => $table->id,
            'data' => $menu,
            'active_order_total' => round($activeTotal, 2),
            'active_order_item_count' => $activeItemCount,
        ], 200);
    }
}
