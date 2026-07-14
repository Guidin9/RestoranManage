<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Waiter extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'waiters';

    // Sanctum token ile doğrulama yapıyoruz, "beni hatırla" çerezine gerek yok.
    protected $rememberTokenName = '';

    protected $fillable = ['name', 'username', 'password'];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }
}
