package mailguard

import "time"

// SendOtpResponse is the response from sending an OTP
type SendOtpResponse struct {
	ID         string `json:"id"`
	Status     string `json:"status"`
	ExpiresIn  int    `json:"expires_in"`
	MaskedEmail string `json:"masked_email"`
}

// VerifyOtpResponse is the response from verifying an OTP
type VerifyOtpResponse struct {
	Verified          bool   `json:"verified"`
	Token             string `json:"token,omitempty"`
	ExpiresAt         string `json:"expires_at,omitempty"`
	Error             string `json:"error,omitempty"`
	AttemptsRemaining int    `json:"attempts_remaining,omitempty"`
}

// HealthResponse is the health check response
type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Services  struct {
		Database struct {
			Status   string `json:"status"`
			LatencyMs int   `json:"latency_ms,omitempty"`
		} `json:"database"`
		Redis struct {
			Status   string `json:"status"`
			LatencyMs int   `json:"latency_ms,omitempty"`
		} `json:"redis"`
		Queue struct {
			Status string `json:"status"`
			Depth  int    `json:"depth,omitempty"`
		} `json:"queue"`
	} `json:"services"`
}

// SendOtpOptions are options for sending an OTP
type SendOtpOptions struct {
	Email   string `json:"email"`
	Purpose string `json:"purpose,omitempty"`
}

// VerifyOtpOptions are options for verifying an OTP
type VerifyOtpOptions struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

// ApiError represents an API error response
type ApiError struct {
	Code              string `json:"error"`
	Message           string `json:"message,omitempty"`
	RetryAfter        int    `json:"retry_after,omitempty"`
	AttemptsRemaining int    `json:"attempts_remaining,omitempty"`
}

// Error implements the error interface
func (e *ApiError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return e.Code
}

// RateLimitError is returned when rate limit is exceeded
type RateLimitError struct {
	ApiError
}

// ValidationError is returned for validation errors
type ValidationError struct {
	ApiError
}

// AuthenticationError is returned for authentication errors
type AuthenticationError struct {
	ApiError
}