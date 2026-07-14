<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = ['category_id', 'name', 'price', 'image'];
    protected $appends = ['image_url'];

    public function getImageUrlAttribute()
    {
        if (!$this->image) {
            return null;
        }

        // Eğer veritabanındaki resim 'http' ile başlıyorsa (Yeni Bulut Sistemi)
        if (str_starts_with($this->image, 'http')) {
            return $this->image;
        }

        // 'http' yoksa eski sistem yerel resimdir
        return asset('storage/' . $this->image);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
