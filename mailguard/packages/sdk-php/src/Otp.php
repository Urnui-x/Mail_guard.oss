<?php

declare(strict_types=1);

namespace MailGuard;

/**
 * OTP namespace for cleaner API
 */
final readonly class Otp
{
    private MailGuard $client;

    public function __construct(MailGuard $client)
    {
        $this->client = $client;
    }

    /**
     * Send an OTP to an email address
     */
    public function send(string $email, ?string $purpose = null): SendOtpResponse
    {
        return $this->client->sendOtp($email, $purpose);
    }

    /**
     * Verify an OTP code
     */
    public function verify(string $email, string $code): VerifyOtpResponse
    {
        return $this->client->verifyOtp($email, $code);
    }
}