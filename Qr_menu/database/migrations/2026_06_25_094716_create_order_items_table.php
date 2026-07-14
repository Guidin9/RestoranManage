<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->onDelete('cascade'); // Hangi sipariş sipariş başlığına ait?
            $table->foreignId('product_id')->constrained()->onDelete('cascade'); // Hangi ürün sipariş edildi?
            $table->integer('quantity'); // Kaç adet istendi?
            $table->decimal('price_at_sale', 8, 2); // Satış anındaki fiyatı (Menü değişirse eski hesaplar bozulmasın diye)
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
