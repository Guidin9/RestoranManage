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
            // Mutfağın hazırladığı adet. Üç aşamalı akış:
            //   preparing = quantity - prepared_quantity   (mutfakta)
            //   ready     = prepared_quantity - delivered_quantity  (servis bekliyor)
            //   delivered = delivered_quantity              (servis edildi)
            $table->integer('prepared_quantity')->default(0)->after('quantity');
        });

        // Mevcut kalemler hazırlanmış sayılır (zaten delivered_quantity = quantity idi),
        // böylece eski açık adisyonlar mutfağa "hazırlanacak" olarak düşmez.
        DB::table('order_items')->update(['prepared_quantity' => DB::raw('quantity')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('prepared_quantity');
        });
    }
};
