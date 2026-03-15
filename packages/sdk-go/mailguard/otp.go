package mailguard

import (
	"encoding/json"
)

// SendOtp sends an OTP to an email address
func (c *Client) SendOtp(email string, purpose string) (*SendOtpResponse, error) {
	data := map[string]string{"email": email}
	if purpose != "" {
		data["purpose"] = purpose
	}

	respBody, err := c.request("POST", "/api/v1/otp/send", data)
	if err != nil {
		return nil, err
	}

	var response SendOtpResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, err
	}

	return &response, nil
}

// VerifyOtp verifies an OTP code
func (c *Client) VerifyOtp(email, code string) (*VerifyOtpResponse, error) {
	data := map[string]string{
		"email": email,
		"code":  code,
	}

	respBody, err := c.request("POST", "/api/v1/otp/verify", data)
	if err != nil {
		return nil, err
	}

	var response VerifyOtpResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, err
	}

	return &response, nil
}

// Health checks the API health
func (c *Client) Health() (*HealthResponse, error) {
	respBody, err := c.request("GET", "/health", nil)
	if err != nil {
		return nil, err
	}

	var response HealthResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, err
	}

	return &response, nil
}

// Otp provides namespace-style access to OTP methods
type Otp struct {
	client *Client
}

// NewOtp creates an Otp namespace helper
func NewOtp(client *Client) *Otp {
	return &Otp{client: client}
}

// Send sends an OTP to an email address
func (o *Otp) Send(email string, purpose string) (*SendOtpResponse, error) {
	return o.client.SendOtp(email, purpose)
}

// Verify verifies an OTP code
func (o *Otp) Verify(email, code string) (*VerifyOtpResponse, error) {
	return o.client.VerifyOtp(email, code)
}