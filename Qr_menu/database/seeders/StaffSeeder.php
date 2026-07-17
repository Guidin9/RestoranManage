<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class StaffSeeder extends Seeder
{
    /**
     * Admin ve kasa hesaplarını config/staff.php (yani .env) değerlerinden kurar.
     * Tekrar çalıştırılabilir: şifreyi .env'de değiştirip yeniden çalıştırmak yeter.
     */
    public function run(): void
    {
        $this->upsertStaff('admin', config('staff.admin'));
        $this->upsertStaff('cashier', config('staff.cashier'));
        $this->upsertStaff('kitchen', config('staff.kitchen'));
    }

    private function upsertStaff(string $role, array $staff): void
    {
        User::updateOrCreate(
            ['username' => $staff['username']],
            [
                'name' => $staff['name'],
                'email' => $staff['email'],
                // 'hashed' cast'i şifreyi otomatik hash'ler.
                'password' => $staff['password'],
                'role' => $role,
            ]
        );
    }
}
