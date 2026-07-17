<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = ['order_id', 'product_id', 'quantity', 'price_at_sale', 'prepared_quantity', 'delivered_quantity'];

    protected $casts = [
        'quantity' => 'integer',
        'prepared_quantity' => 'integer',
        'delivered_quantity' => 'integer',
    ];

    // Üç aşamalı durum, JSON'da hazır gelsin diye ekli alanlar:
    //   preparing (mutfakta) → ready (servis bekliyor) → delivered (servis edildi)
    protected $appends = ['preparing_quantity', 'ready_quantity', 'pending_quantity', 'stage', 'is_delivered'];

    // Mutfakta, henüz hazırlanmamış adet.
    public function getPreparingQuantityAttribute(): int
    {
        return max(0, (int) $this->quantity - (int) $this->prepared_quantity);
    }

    // Hazırlanmış ama henüz servis edilmemiş (garsonu bekleyen) adet.
    public function getReadyQuantityAttribute(): int
    {
        return max(0, (int) $this->prepared_quantity - (int) $this->delivered_quantity);
    }

    // Henüz servis edilmemiş toplam (mutfakta + serviste bekleyen).
    public function getPendingQuantityAttribute(): int
    {
        return max(0, (int) $this->quantity - (int) $this->delivered_quantity);
    }

    // Kalemin en erken aktif aşaması — müşteri/etiket gösterimi için.
    public function getStageAttribute(): string
    {
        if ($this->preparing_quantity > 0) {
            return 'preparing';
        }
        if ($this->ready_quantity > 0) {
            return 'ready';
        }

        return 'served';
    }

    // Kalemin tamamı servis edildi mi?
    public function getIsDeliveredAttribute(): bool
    {
        return (int) $this->delivered_quantity >= (int) $this->quantity;
    }

    // HATA VEREN EKSİK İLİŞKİ BURASIYDI:
    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
