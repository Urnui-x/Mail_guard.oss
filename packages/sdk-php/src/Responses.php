<?php

declare(strict_types=1);

namespace MailGuard;

/**
 * Response from sending an OTP
 */
final readonly class SendOtpResponse
{
    public function __construct(
        public string $id,
        public string $status,
        public int $expiresIn,
        public string $maskedEmail
    ) {}
}

/**
 * Response from verifying an OTP
 */
final readonly class VerifyOtpResponse
{
    public function __construct(
        public bool $verified,
        public ?string $token = null,
        public ?string $expiresAt = null,
        public ?string $error = null,
        public ?int $attemptsRemaining = null
    ) {}
}

/**
 * Health check response
 */
final readonly class HealthResponse
{
    public function __construct(
        public string $status,
        public string $timestamp,
        public array $services
    ) {}
}