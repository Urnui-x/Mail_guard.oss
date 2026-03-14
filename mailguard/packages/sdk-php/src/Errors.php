<?php

declare(strict_types=1);

namespace MailGuard;

/**
 * Base error for MailGuard SDK
 */
class MailGuardError extends \Exception
{
    public readonly string $errorCode;
    public readonly ?int $retryAfter;
    public readonly ?int $attemptsRemaining;

    public function __construct(
        string $code,
        ?string $message = null,
        ?int $retryAfter = null,
        ?int $attemptsRemaining = null
    ) {
        $this->errorCode = $code;
        $this->retryAfter = $retryAfter;
        $this->attemptsRemaining = $attemptsRemaining;
        parent::__construct($message ?? $code);
    }

    public static function fromResponse(array $response, int $statusCode): self
    {
        $code = $response['error'] ?? 'unknown_error';
        $message = $response['message'] ?? null;
        $retryAfter = $response['retry_after'] ?? null;
        $attemptsRemaining = $response['attempts_remaining'] ?? null;

        if ($statusCode === 429) {
            return new RateLimitError($code, $message, $retryAfter, $attemptsRemaining);
        }
        if ($statusCode === 401) {
            return new AuthenticationError($code, $message, $retryAfter, $attemptsRemaining);
        }
        if ($statusCode === 400) {
            return new ValidationError($code, $message, $retryAfter, $attemptsRemaining);
        }

        return new self($code, $message, $retryAfter, $attemptsRemaining);
    }
}

/**
 * Rate limit exceeded error
 */
final class RateLimitError extends MailGuardError {}

/**
 * Validation error
 */
final class ValidationError extends MailGuardError {}

/**
 * Authentication error
 */
final class AuthenticationError extends MailGuardError {}