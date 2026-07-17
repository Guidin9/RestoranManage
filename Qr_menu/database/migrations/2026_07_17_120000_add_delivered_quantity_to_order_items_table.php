<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            // Bu kalemden kaç adet müşteriye teslim edildi (servis edildi).
            // pending = quantity - delivered_quantity → teslim bekleyen "yeni" miktar.
            $table->integer('delivered_quantity')->default(0)->after('quantity');
        });

        // Mevcut açık adisyonlar deploy anında "teslim bekliyor" uyarısı yağdırmasın:
        // eldeki tüm kalemleri teslim edilmiş kabul et.
        DB::table('order_items')->update(['delivered_quantity' => DB::raw('quantity')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('delivered_quantity');
        });
    }
};
