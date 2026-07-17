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

        // Masanın o ana kadarki açık adisyonu — müşteri kendi sepetinden ayrı olarak
        // masanın güncel borcunu ve sipariş edilen ürünleri (teslim durumuyla) görebilsin.
        $activeOrder = Order::with('items.product')
            ->where('table_id', $table->id)
            ->where('status', 'active')
            ->first();

        $activeTotal = 0;
        $activeItemCount = 0;
        $activeItems = [];
        if ($activeOrder) {
            foreach ($activeOrder->items as $item) {
                $lineTotal = $item->price_at_sale * $item->quantity;
                $activeTotal += $lineTotal;
                $activeItemCount += $item->quantity;
                $activeItems[] = [
                    'name' => $item->product ? $item->product->name : 'Ürün',
                    'quantity' => (int) $item->quantity,
                    'price_at_sale' => (float) $item->price_at_sale,
                    'line_total' => round($lineTotal, 2),
                    'pending_quantity' => $item->pending_quantity,
                    'is_delivered' => $item->is_delivered,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'table_number' => $table->table_number,
            'table_id' => $table->id,
            'data' => $menu,
            'active_order_total' => round($activeTotal, 2),
            'active_order_item_count' => $activeItemCount,
            'active_order_items' => $activeItems,
        ], 200);
    }
}
