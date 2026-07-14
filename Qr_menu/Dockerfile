# PHP sürümü yerel geliştirme ortamıyla (Herd PHP 8.4) aynı tutulur.
# composer.json "php": "^8.3" istiyor; eski 8.2 imajı Laravel 13'ü çalıştıramazdı.
FROM php:8.4-apache

# Sistem araçları ve PHP eklentileri.
# dom/mbstring/iconv/tokenizer/fileinfo resmi imajda hazır gelir; ek olarak
# sadece pdo_mysql (MySQL) ve gd (eski yerel görseller) gerekiyor.
# opcache production'da ciddi performans farkı yaratır.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        zip \
        unzip \
    && docker-php-ext-configure gd --with-jpeg --with-freetype \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql gd opcache \
    && rm -rf /var/lib/apt/lists/*

# Laravel'in çalışması için zorunlu olan Apache modülünü aç
RUN a2enmod rewrite

WORKDIR /var/www/html

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Önce sadece bağımlılık dosyaları kopyalanır: uygulama kodu değiştiğinde bu
# katman önbellekten gelir, her deploy'da paketler yeniden indirilmez.
#
# NOT: composer install eskiden HİÇ çalışmıyordu. vendor/ .gitignore'da olduğu
# için sunucuda taze "git clone" sonrası imajda vendor/autoload.php bulunmuyor,
# backend hiç ayağa kalkmıyordu. Yerelde çalışmasının tek sebebi vendor/
# klasörünün zaten diskte olup COPY ile kopyalanmasıydı.
#
# artisan bu aşamada henüz kopyalanmadığı için --no-scripts zorunlu.
COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-interaction \
        --no-scripts \
        --prefer-dist \
        --optimize-autoloader

# Uygulama kodu (.dockerignore vendor/ ve .env'i dışarıda bırakır)
COPY . .

# Autoload'u tamamla. Bu adım composer.json'daki post-autoload-dump'ı,
# yani "artisan package:discover" komutunu da çalıştırır.
RUN composer dump-autoload --no-dev --optimize

# Apache'nin DocumentRoot ayarını Laravel'in "public" klasörüne yönlendir
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# İzinleri ayarla (log ve cache yazabilmesi için)
RUN chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80

# Konteyner çalışırken başlatılacak komut
CMD ["apache2-foreground"]
