<?php

namespace App\Http\Controllers;

use App\Models\Waiter;
use App\Models\Table;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    // --- GARSON İŞLEMLERİ ---
    public function getWaiters(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => Waiter::all()]);
    }

    public function storeWaiter(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required',
            'username' => 'required|unique:waiters,username',
            'password' => 'required'
        ]);

        $waiter = Waiter::create([
            'name' => $request->name,
            'username' => $request->username,
            'password' => $request->password
        ]);

        return response()->json(['success' => true, 'data' => $waiter, 'message' => 'Garson eklendi!']);
    }

    public function deleteWaiter($id): JsonResponse
    {
        Waiter::destroy($id);
        return response()->json(['success' => true, 'message' => 'Garson silindi!']);
    }

    // --- MASA İŞLEMLERİ ---
    public function storeTable(Request $request): JsonResponse
    {
        $request->validate(['table_number' => 'required']);

        $table = Table::create([
            'table_number' => $request->table_number,
            'qr_code' => (string) Str::uuid()
        ]);

        return response()->json(['success' => true, 'data' => $table, 'message' => 'Masa eklendi!']);
    }

    public function deleteTable($id): JsonResponse
    {
        Table::destroy($id);
        return response()->json(['success' => true, 'message' => 'Masa silindi!']);
    }

    // --- KATEGORİ İŞLEMLERİ ---
    public function storeCategory(Request $request): JsonResponse
    {
        $request->validate(['name' => 'required']);
        $category = Category::create(['name' => $request->name]);
        return response()->json(['success' => true, 'data' => $category, 'message' => 'Kategori eklendi!']);
    }

    public function deleteCategory($id): JsonResponse
    {
        Category::destroy($id);
        return response()->json(['success' => true, 'message' => 'Kategori silindi!']);
    }

    // --- ÜRÜN İŞLEMLERİ (Görsel Yükleme Destekli) ---

    // Ürün Ekleme (Hafifletilmiş Base64 Destekli)
    // Ürün Ekleme (En Temiz, Standart ve Sorunsuz Yöntem)
    // Ürün Ekleme (Tamamen Bulut Destekli, Dosyasız Temiz Yöntem)
    public function storeProduct(Request $request): JsonResponse
    {
        $request->validate([
            'category_id' => 'required',
            'name'        => 'required',
            'price'       => 'required'
        ]);

        $formattedPrice = str_replace(',', '.', $request->price);

        $product = Product::create([
            'category_id' => $request->category_id,
            'name'        => $request->name,
            'price'       => $formattedPrice,
            // React'ten gelen ImgBB resim URL'sini direkt metin olarak kaydediyoruz
            'image'       => $request->image
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Ürün başarıyla eklendi!'
        ]);
    }

    public function deleteProduct($id): JsonResponse
    {
        Product::destroy($id);
        return response()->json(['success' => true, 'message' => 'Ürün silindi!']);
    }
}
