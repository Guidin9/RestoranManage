<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Laravel\Sanctum\Http\Middleware\CheckForAnyAbility;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum token yetkisi (ability) kontrolü için takma adlar.
        $middleware->alias([
            'abilities' => CheckAbilities::class,
            'ability' => CheckForAnyAbility::class,
        ]);

        // Uygulama Caddy'nin arkasında çalışır ve TLS'i Caddy sonlandırır; bu yüzden
        // Laravel isteği "http" olarak görür. X-Forwarded-* başlıklarına güvenmezsek
        // asset() ile üretilen eski görsel adresleri http:// çıkar ve HTTPS sayfada
        // mixed-content olarak bloklanır. Backend porta dışarı açılmadığı, yalnızca
        // Docker ağı üzerinden Caddy'den eriştiği için '*' burada güvenlidir.
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
