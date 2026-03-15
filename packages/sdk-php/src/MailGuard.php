<?php

declare(strict_types=1);

namespace MailGuard;

/**
 * MailGuard SDK for PHP
 * 
 * A lightweight SDK for interacting with MailGuard OSS API.
 * Zero external dependencies - uses curl extension.
 */
final class MailGuard
{
    private static ?self $instance = null;
    private string $apiKey;
    private string $baseUrl;

    private function __construct(string $apiKey, string $baseUrl = 'https://api.mailguard.io')
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    /**
     * Initialize the SDK with configuration
     */
    public static function init(string $apiKey, string $baseUrl = 'https://api.mailguard.io'): self
    {
        self::$instance = new self($apiKey, $baseUrl);
        return self::$instance;
    }

    /**
     * Get the singleton instance
     */
    public static function getInstance(): self
    {
        if (self::$instance === null) {
            throw new \RuntimeException('MailGuard SDK not initialized. Call MailGuard::init() first.');
        }
        return self::$instance;
    }

    /**
     * Reset the singleton (useful for testing)
     */
    public static function reset(): void
    {
        self::$instance = null;
    }

    /**
     * Make an API request
     */
    private function request(string $method, string $path, ?array $data = null): array
    {
        $url = $this->baseUrl . $path;
        
        $ch = curl_init();
        
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json',
        ];
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CUSTOMREQUEST => $method,
        ]);
        
        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $decoded = json_decode($response, true) ?? [];
        
        if ($statusCode >= 400) {
            throw MailGuardError::fromResponse($decoded, $statusCode);
        }
        
        return $decoded;
    }

    /**
     * Send an OTP to an email address
     */
    public function sendOtp(string $email, ?string $purpose = null): SendOtpResponse
    {
        $data = ['email' => $email];
        if ($purpose !== null) {
            $data['purpose'] = $purpose;
        }
        
        $response = $this->request('POST', '/api/v1/otp/send', $data);
        
        return new SendOtpResponse(
            id: $response['id'],
            status: $response['status'],
            expiresIn: $response['expires_in'],
            maskedEmail: $response['masked_email']
        );
    }

    /**
     * Verify an OTP code
     */
    public function verifyOtp(string $email, string $code): VerifyOtpResponse
    {
        $response = $this->request('POST', '/api/v1/otp/verify', [
            'email' => $email,
            'code' => $code,
        ]);
        
        return new VerifyOtpResponse(
            verified: $response['verified'],
            token: $response['token'] ?? null,
            expiresAt: $response['expires_at'] ?? null,
            error: $response['error'] ?? null,
            attemptsRemaining: $response['attempts_remaining'] ?? null
        );
    }

    /**
     * Check API health
     */
    public function health(): HealthResponse
    {
        $response = $this->request('GET', '/health');
        
        return new HealthResponse(
            status: $response['status'],
            timestamp: $response['timestamp'],
            services: $response['services']
        );
    }
}