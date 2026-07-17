<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Waiter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Admin token'ı kasa ve garson ekranlarına da erişebilir; yönetici paneli
     * bu uçları (masa listesi, menü) kendi içinde kullanıyor.
     */
    private const ROLE_ABILITIES = [
        'admin' => ['admin', 'cashier', 'waiter'],
        'cashier' => ['cashier'],
        'kitchen' => ['kitchen'],
    ];

    public function adminLogin(Request $request): JsonResponse
    {
        return $this->loginAsUser($request, 'admin');
    }

    public function cashierLogin(Request $request): JsonResponse
    {
        return $this->loginAsUser($request, 'cashier');
    }

    public function kitchenLogin(Request $request): JsonResponse
    {
        return $this->loginAsUser($request, 'kitchen');
    }

    public function waiterLogin(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $waiter = Waiter::where('username', $credentials['username'])->first();

        if (! $waiter || ! Hash::check($credentials['password'], $waiter->password)) {
            return $this->invalidCredentials();
        }

        $waiter->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Giriş başarılı!',
            'token' => $waiter->createToken('waiter', ['waiter'])->plainTextToken,
            'waiter' => [
                'id' => $waiter->id,
                'name' => $waiter->name,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['success' => true, 'message' => 'Çıkış yapıldı.']);
    }

    private function loginAsUser(Request $request, string $role): JsonResponse
    {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $credentials['username'])
            ->where('role', $role)
            ->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return $this->invalidCredentials();
        }

        // Aynı hesap tek oturumda kullanılıyor; eski token'ları temizliyoruz.
        $user->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Giriş başarılı!',
            'token' => $user->createToken($role, self::ROLE_ABILITIES[$role])->plainTextToken,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
            ],
        ]);
    }

    private function invalidCredentials(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Kullanıcı adı veya şifre hatalı!',
        ], 401);
    }
}
