<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = ['order_id', 'product_id', 'quantity', 'price_at_sale', 'delivered_quantity'];

    protected $casts = [
        'quantity' => 'integer',
        'delivered_quantity' => 'integer',
    ];

    // Garson/kasa/müşteri JSON'unda teslim durumu hazır gelsin diye ekli alanlar.
    protected $appends = ['pending_quantity', 'is_delivered'];

    // Teslim bekleyen (yeni gelen) miktar.
    public function getPendingQuantityAttribute(): int
    {
        return max(0, (int) $this->quantity - (int) $this->delivered_quantity);
    }

    // Kalemin tamamı teslim edildi mi?
    public function getIsDeliveredAttribute(): bool
    {
        return $this->pending_quantity === 0;
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
