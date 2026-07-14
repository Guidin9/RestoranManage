<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str; // 👈 İŞTE ÇÖKME YAPAN EKSİK BUYDU!

class Table extends Model
{
    protected $fillable = ['table_number', 'qr_code'];

    protected static function booted()
    {
        static::creating(function ($table) {
            if (empty($table->qr_code)) {
                $table->qr_code = (string) Str::uuid();
            }
        });
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
