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

        // 3. Gönderilen ürünleri döngüyle adisyona ekle.
        //    Aynı üründen adisyonda zaten varsa yeni satır açma; mevcut kalemin
        //    adedini artır. Böylece çok kişili masa ve garsonun tek tek eklemesi
        //    kasada tek satırda birleşir (price_at_sale ilk satış anında sabit kalır).
        foreach ($request->items as $item) {
            $existing = $order->items()->where('product_id', $item['id'])->first();

            if ($existing) {
                $existing->increment('quantity', $item['quantity']);
            } else {
                $product = Product::find($item['id']);

                $order->items()->create([
                    'product_id' => $item['id'],
                    'quantity' => $item['quantity'],
                    'price_at_sale' => $product->price
                ]);
            }
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
        $order->paid_at = now();
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
            // Değişmez kural: delivered ≤ prepared ≤ quantity — taşanları kırp.
            if ($item->prepared_quantity > $item->quantity) {
                $item->prepared_quantity = $item->quantity;
            }
            if ($item->delivered_quantity > $item->prepared_quantity) {
                $item->delivered_quantity = $item->prepared_quantity;
            }
            $item->save();
        } else {
            $item->delete();
        }

        $remainingCount = \App\Models\OrderItem::where('order_id', $orderId)->count();
        if ($remainingCount === 0) {
            $order = Order::find($orderId);
            if ($order) {
                $order->status = 'paid';
                $order->paid_at = now();
                $order->save();
            }
        }

        return response()->json(['success' => true, 'message' => 'Ürün adisyondan düşüldü.']);
    }

    // Mutfak Ekranı İçin: Hazırlanacak kalemi olan (preparing > 0) aktif masaları,
    // FİYATSIZ olarak döndürür — hangi masada ne var, hangi aşamada.
    public function kitchenOrders(): JsonResponse
    {
        $orders = Order::with('items.product')
            ->where('status', 'active')
            ->orderBy('created_at', 'asc')
            ->get()
            ->filter(fn ($order) => $order->items->contains(fn ($i) => $i->preparing_quantity > 0))
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'table_number' => $order->table->table_number ?? ('Masa ' . $order->table_id),
                    'opened_at' => optional($order->created_at)->toIso8601String(),
                    'items' => $order->items->map(fn ($i) => [
                        'id' => $i->id,
                        'name' => $i->product ? $i->product->name : 'Ürün',
                        'quantity' => (int) $i->quantity,
                        'prepared_quantity' => (int) $i->prepared_quantity,
                        'preparing_quantity' => $i->preparing_quantity,
                        'ready_quantity' => $i->ready_quantity,
                        'stage' => $i->stage,
                    ])->values(),
                ];
            })
            ->values();

        return response()->json(['success' => true, 'data' => $orders], 200);
    }

    // Mutfak: tek kalemi hazır işaretle (prepared_quantity = quantity → servise hazır).
    public function prepareItem($itemId): JsonResponse
    {
        $item = \App\Models\OrderItem::find($itemId);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kalem bulunamadı.'], 404);
        }

        $item->prepared_quantity = $item->quantity;
        $item->save();

        return response()->json(['success' => true, 'message' => 'Ürün hazır olarak işaretlendi.']);
    }

    // Mutfak: siparişin tüm kalemlerini hazır işaretle ("Tümünü Hazırla").
    public function prepareOrder($id): JsonResponse
    {
        $order = Order::with('items')->find($id);

        if (! $order) {
            return response()->json(['success' => false, 'message' => 'Sipariş bulunamadı.'], 404);
        }

        foreach ($order->items as $item) {
            if ($item->prepared_quantity !== (int) $item->quantity) {
                $item->prepared_quantity = $item->quantity;
                $item->save();
            }
        }

        return response()->json(['success' => true, 'message' => 'Siparişin tüm ürünleri hazırlandı.']);
    }

    // Garson/Kasa: tek kalemi servis edildi işaretle (delivered = prepared).
    // Yalnız hazırlanmış adet servis edilebilir.
    public function serveItem($itemId): JsonResponse
    {
        $item = \App\Models\OrderItem::find($itemId);

        if (! $item) {
            return response()->json(['success' => false, 'message' => 'Kalem bulunamadı.'], 404);
        }

        $item->delivered_quantity = $item->prepared_quantity;
        $item->save();

        return response()->json(['success' => true, 'message' => 'Ürün servis edildi olarak işaretlendi.']);
    }

    // Garson/Kasa: siparişin servise hazır tüm kalemlerini servis et ("Tümünü Servis Et").
    public function serveOrder($id): JsonResponse
    {
        $order = Order::with('items')->find($id);

        if (! $order) {
            return response()->json(['success' => false, 'message' => 'Sipariş bulunamadı.'], 404);
        }

        foreach ($order->items as $item) {
            if ($item->delivered_quantity !== (int) $item->prepared_quantity) {
                $item->delivered_quantity = $item->prepared_quantity;
                $item->save();
            }
        }

        return response()->json(['success' => true, 'message' => 'Sipariş servis edildi olarak işaretlendi.']);
    }

    // Kasa Ekranı İçin: Seçilen günün gün özeti + haftalık/aylık bağlam + grafik verisi.
    // ?date=YYYY-MM-DD (varsayılan bugün). Ödenmiş siparişler paid_at gününe göre filtrelenir.
    public function dailySummary(Request $request): JsonResponse
    {
        $date = $request->query('date')
            ? \Carbon\Carbon::parse($request->query('date'))->startOfDay()
            : \Carbon\Carbon::today();

        $weekStart  = $date->copy()->startOfWeek();
        $weekEnd    = $date->copy()->endOfWeek();
        $monthStart = $date->copy()->startOfMonth();
        $monthEnd   = $date->copy()->endOfMonth();
        $trendStart = $date->copy()->subDays(13)->startOfDay();

        // Tüm hesapları tek sorguda çek (en geniş aralık), gerisini PHP'de topla.
        $rangeStart = $trendStart->lt($monthStart) ? $trendStart : $monthStart;
        $dayEnd     = $date->copy()->endOfDay();
        $rangeEnd   = $monthEnd->gt($dayEnd) ? $monthEnd : $dayEnd;

        $orders = Order::with('items.product')
            ->where('status', 'paid')
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$rangeStart, $rangeEnd])
            ->get();

        $orderTotal = fn ($o) => $o->items->sum(fn ($i) => $i->price_at_sale * $i->quantity);
        $orderQty   = fn ($o) => $o->items->sum('quantity');
        $inRange    = fn ($start, $end) => $orders->filter(fn ($o) => $o->paid_at->between($start, $end));

        $metrics = function ($subset) use ($orderTotal, $orderQty) {
            $revenue = round($subset->sum($orderTotal), 2);
            $tables  = $subset->count();
            $days    = $subset->map(fn ($o) => $o->paid_at->toDateString())->unique()->count();

            return [
                'revenue'           => $revenue,
                'tables_closed'     => $tables,
                'items_sold'        => (int) $subset->sum($orderQty),
                'avg_ticket'        => $tables ? round($revenue / $tables, 2) : 0,
                'avg_daily_revenue' => $days ? round($revenue / $days, 2) : 0,
            ];
        };

        $todaySet = $inRange($date->copy()->startOfDay(), $dayEnd);

        // Son 14 günün günlük ciro trendi (çubuk grafik için).
        $trend = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = $date->copy()->subDays($i);
            $set = $inRange($d->copy()->startOfDay(), $d->copy()->endOfDay());
            $trend[] = [
                'date'    => $d->toDateString(),
                'revenue' => round($set->sum($orderTotal), 2),
                'tables'  => $set->count(),
            ];
        }

        // Seçili günün en çok satan ilk 5 ürünü (yatay çubuk için).
        $productAgg = [];
        foreach ($todaySet as $o) {
            foreach ($o->items as $it) {
                $name = $it->product->name ?? 'Ürün';
                if (! isset($productAgg[$name])) {
                    $productAgg[$name] = ['name' => $name, 'qty' => 0, 'revenue' => 0];
                }
                $productAgg[$name]['qty']     += $it->quantity;
                $productAgg[$name]['revenue'] += $it->price_at_sale * $it->quantity;
            }
        }
        $topProducts = collect($productAgg)
            ->sortByDesc('qty')
            ->take(5)
            ->map(fn ($p) => [
                'name'    => $p['name'],
                'qty'     => (int) $p['qty'],
                'revenue' => round($p['revenue'], 2),
            ])
            ->values();

        return response()->json([
            'success'      => true,
            'date'         => $date->toDateString(),
            'today'        => $metrics($todaySet),
            'week'         => $metrics($inRange($weekStart, $weekEnd)),
            'month'        => $metrics($inRange($monthStart, $monthEnd)),
            'daily_trend'  => $trend,
            'top_products' => $topProducts,
        ], 200);
    }
}
