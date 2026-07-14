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
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('table_id')->constrained()->onDelete('cascade'); // Sipariş hangi masaya ait?
            $table->enum('status', ['active', 'paid', 'cancelled'])->default('active'); // Masa şu an açık mı, ödendi mi?
            $table->timestamps(); // created_at bize masanın sipariş verdiği ilk anı (süreyi) söyleyecek
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
