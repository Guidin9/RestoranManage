<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Garson şifreleri eskiden düz metin olarak saklanıyordu. Mevcut kayıtları
     * tek seferlik hash'e çeviriyoruz ki Hash::check ile giriş yapabilsinler.
     */
    public function up(): void
    {
        DB::table('waiters')->orderBy('id')->each(function ($waiter) {
            if (Hash::isHashed($waiter->password)) {
                return;
            }

            DB::table('waiters')
                ->where('id', $waiter->id)
                ->update(['password' => Hash::make($waiter->password)]);
        });
    }

    public function down(): void
    {
        // Hash'lenmiş şifreler düz metne geri çevrilemez.
    }
};
