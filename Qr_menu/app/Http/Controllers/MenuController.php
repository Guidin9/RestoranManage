<?php

namespace App\Http\Controllers;

use App\Models\Category;
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

        return response()->json([
            'success' => true,
            'table_number' => $table->table_number,
            'table_id' => $table->id,
            'data' => $menu,
        ], 200);
    }
}
