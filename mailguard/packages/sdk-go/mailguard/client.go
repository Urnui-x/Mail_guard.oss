// Package mailguard provides a Go SDK for MailGuard OSS API.
//
// A lightweight SDK for interacting with MailGuard OSS API.
// Zero external dependencies - uses net/http and encoding/json.
package mailguard

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Version of the SDK
const Version = "1.0.0"

// Default base URL for the API
const DefaultBaseURL = "https://api.mailguard.io"

// Client is the main SDK client
type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
}

// Config holds SDK configuration
type Config struct {
	APIKey  string
	BaseURL string
	Timeout time.Duration
}

var (
	instance *Client
)

// New creates a new MailGuard client
func New(config Config) *Client {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}

	timeout := config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	client := &Client{
		apiKey:  config.APIKey,
		baseURL: baseURL,
		http: &http.Client{
			Timeout: timeout,
		},
	}

	instance = client
	return client
}

// Init initializes the SDK with configuration and returns the singleton instance
func Init(config Config) *Client {
	return New(config)
}

// GetInstance returns the singleton instance
func GetInstance() (*Client, error) {
	if instance == nil {
		return nil, errors.New("mailguard: SDK not initialized, call Init() first")
	}
	return instance, nil
}

// Reset clears the singleton instance (useful for testing)
func Reset() {
	instance = nil
}

// request makes an API request
func (c *Client) request(method, path string, data interface{}) ([]byte, error) {
	url := c.baseURL + path

	var body io.Reader
	if data != nil {
		jsonData, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("mailguard: failed to marshal request: %w", err)
		}
		body = bytes.NewReader(jsonData)
	}

	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, fmt.Errorf("mailguard: failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mailguard: request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("mailguard: failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var apiErr ApiError
		if err := json.Unmarshal(respBody, &apiErr); err == nil {
			return nil, &apiErr
		}
		return nil, fmt.Errorf("mailguard: API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}