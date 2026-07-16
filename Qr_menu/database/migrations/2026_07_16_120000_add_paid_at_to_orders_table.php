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
        Schema::table('orders', function (Blueprint $table) {
            // Hesabın kapatıldığı (ödendiği) an. Gün özeti raporları bu kolona göre
            // filtreler; created_at/updated_at ödeme anını güvenilir vermiyordu.
            $table->timestamp('paid_at')->nullable()->after('status');
        });

        // Mevcut ödenmiş kayıtları geriye dönük doldur: ödeme anı ~ son güncelleme.
        DB::table('orders')
            ->where('status', 'paid')
            ->whereNull('paid_at')
            ->update(['paid_at' => DB::raw('updated_at')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('paid_at');
        });
    }
};
