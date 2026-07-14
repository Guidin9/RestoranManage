<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class OrderController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // 1. Gelen verileri doğrula (Validation)
        $request->validate([
            'table_id' => 'required|exists:tables,id',
            'items' => 'required|array',
            'items.*.id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1'
        ]);

        // 2. Masanın aktif (ödenmemiş) bir adisyonu var mı bak, yoksa yeni oluştur
        $order = Order::firstOrCreate([
            'table_id' => $request->table_id,
            'status' => 'active'
        ]);

        // 3. Gönderilen ürünleri döngüyle adisyona ekle
        foreach ($request->items as $item) {
            $product = Product::find($item['id']);

            $order->items()->create([
                'product_id' => $item['id'],
                'quantity' => $item['quantity'],
                'price_at_sale' => $product->price
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Siparişiniz başarıyla alındı ve kasaya iletildi!',
            'order_id' => $order->id
        ], 201);
    }

    // 1. Kasa Ekranı İçin: Sadece "active" (açık) siparişleri ve ürün detaylarını getir
    public function activeOrders(): JsonResponse
    {
        // with(['items.product', 'table']) ile artık masanın ismini de çekiyoruz
        $orders = Order::with(['items.product', 'table'])
            ->where('status', 'active')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $orders
        ], 200);
    }

    // 2. Kasa Ekranı İçin: Masanın hesabını kapat (status = paid)
    public function closeOrder($id): JsonResponse
    {
        $order = Order::find($id);

        if (!$order) {
            return response()->json([
                'success' => false,
                'message' => 'Sipariş bulunamadı.'
            ], 404);
        }

        $order->status = 'paid';
        $order->save();

        return response()->json([
            'success' => true,
            'message' => 'Hesap başarıyla kapatıldı, masa boşaltıldı.'
        ], 200);
    }

    // Garson & Admin Ekranı İçin: Tüm Masaları ve Dolu/Boş Durumlarını Getir
    public function waiterTables(): JsonResponse
    {
        $tables = \App\Models\Table::all();

        $activeOrders = Order::with('items.product')
            ->where('status', 'active')
            ->get()
            ->keyBy('table_id');

        $data = $tables->map(function ($table) use ($activeOrders) {
            // 🛡️ KENDİ KENDİNİ TAMİR ETME (AUTO-HEAL):
            // Eğer veritabanında qr_code NULL ise anında UUID üretip kaydeder!
            if (empty($table->qr_code)) {
                $table->qr_code = (string) \Illuminate\Support\Str::uuid();
                $table->save();
            }

            $hasOrder = isset($activeOrders[$table->id]);
            return [
                'id' => $table->id,
                'table_number' => $table->table_number,
                'qr_code' => $table->qr_code, // Artık Asla NULL Gelemez!
                'is_occupied' => $hasOrder,
                'active_order' => $hasOrder ? $activeOrders[$table->id] : null
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data
        ], 200);
    }

    // Garson Ekranı İçin: UUID olmadan doğrudan tüm Menüyü Getir
    public function waiterMenu(): JsonResponse
    {
        $categories = \App\Models\Category::with('products')->get();
        return response()->json([
            'success' => true,
            'data' => $categories
        ], 200);
    }

    // Garson Ekranı İçin: Adisyondan tekil ürün kalemini silme / eksiltme
    public function removeOrderItem($itemId): JsonResponse
    {
        $item = \App\Models\OrderItem::find($itemId);

        if (!$item) {
            return response()->json(['success' => false, 'message' => 'Kalem bulunamadı.'], 404);
        }

        $orderId = $item->order_id;

        if ($item->quantity > 1) {
            $item->quantity -= 1;
            $item->save();
        } else {
            $item->delete();
        }

        $remainingCount = \App\Models\OrderItem::where('order_id', $orderId)->count();
        if ($remainingCount === 0) {
            $order = Order::find($orderId);
            if ($order) {
                $order->status = 'paid';
                $order->save();
            }
        }

        return response()->json(['success' => true, 'message' => 'Ürün adisyondan düşüldü.']);
    }
}
