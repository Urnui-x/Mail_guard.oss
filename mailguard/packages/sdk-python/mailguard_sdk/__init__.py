"""
MailGuard SDK for Python

A lightweight SDK for interacting with MailGuard OSS API.
Zero external dependencies - uses urllib for HTTP requests.
"""

import json
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Optional

__version__ = "1.0.0"


@dataclass
class MailGuardConfig:
    """Configuration for MailGuard SDK"""
    api_key: str
    base_url: str = "https://api.mailguard.io"


@dataclass
class SendOtpResponse:
    """Response from sending an OTP"""
    id: str
    status: str
    expires_in: int
    masked_email: str


@dataclass
class VerifyOtpResponse:
    """Response from verifying an OTP"""
    verified: bool
    token: Optional[str] = None
    expires_at: Optional[str] = None
    error: Optional[str] = None
    attempts_remaining: Optional[int] = None


@dataclass
class HealthResponse:
    """Health check response"""
    status: str
    timestamp: str
    services: dict


class MailGuardError(Exception):
    """Base error for MailGuard SDK"""
    
    def __init__(self, code: str, message: str = None, retry_after: int = None, 
                 attempts_remaining: int = None):
        self.code = code
        self.message = message or code
        self.retry_after = retry_after
        self.attempts_remaining = attempts_remaining
        super().__init__(self.message)


class RateLimitError(MailGuardError):
    """Rate limit exceeded error"""
    pass


class ValidationError(MailGuardError):
    """Validation error"""
    pass


class AuthenticationError(MailGuardError):
    """Authentication error"""
    pass


class MailGuard:
    """
    MailGuard SDK client
    
    Usage:
        client = MailGuard.init(api_key="your-api-key")
        
        # Send OTP
        result = client.otp.send("user@example.com")
        
        # Verify OTP
        result = client.otp.verify("user@example.com", "123456")
    """
    
    _instance: Optional['MailGuard'] = None
    
    def __init__(self, config: MailGuardConfig):
        self._api_key = config.api_key
        self._base_url = config.base_url.rstrip('/')
        self.otp = _OtpNamespace(self)
    
    @classmethod
    def init(cls, api_key: str, base_url: str = None) -> 'MailGuard':
        """Initialize the SDK with configuration"""
        config = MailGuardConfig(
            api_key=api_key,
            base_url=base_url or "https://api.mailguard.io"
        )
        cls._instance = cls(config)
        return cls._instance
    
    @classmethod
    def get_instance(cls) -> 'MailGuard':
        """Get the singleton instance"""
        if cls._instance is None:
            raise RuntimeError("MailGuard SDK not initialized. Call MailGuard.init() first.")
        return cls._instance
    
    @classmethod
    def reset(cls):
        """Reset the singleton (useful for testing)"""
        cls._instance = None
    
    def _request(self, method: str, path: str, data: dict = None) -> dict:
        """Make an API request"""
        url = f"{self._base_url}{path}"
        
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json"
        }
        
        body = json.dumps(data).encode('utf-8') if data else None
        
        request = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method=method
        )
        
        try:
            with urllib.request.urlopen(request) as response:
                return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            error_data = json.loads(e.read().decode('utf-8'))
            code = error_data.get('error', 'unknown_error')
            message = error_data.get('message')
            retry_after = error_data.get('retry_after')
            attempts_remaining = error_data.get('attempts_remaining')
            
            if e.code == 429:
                raise RateLimitError(code, message, retry_after, attempts_remaining)
            if e.code == 401:
                raise AuthenticationError(code, message, retry_after, attempts_remaining)
            if e.code == 400:
                raise ValidationError(code, message, retry_after, attempts_remaining)
            
            raise MailGuardError(code, message, retry_after, attempts_remaining)
    
    def send_otp(self, email: str, purpose: str = None) -> SendOtpResponse:
        """Send an OTP to an email address"""
        data = {"email": email}
        if purpose:
            data["purpose"] = purpose
        
        response = self._request("POST", "/api/v1/otp/send", data)
        return SendOtpResponse(
            id=response["id"],
            status=response["status"],
            expires_in=response["expires_in"],
            masked_email=response["masked_email"]
        )
    
    def verify_otp(self, email: str, code: str) -> VerifyOtpResponse:
        """Verify an OTP code"""
        response = self._request("POST", "/api/v1/otp/verify", {
            "email": email,
            "code": code
        })
        return VerifyOtpResponse(
            verified=response["verified"],
            token=response.get("token"),
            expires_at=response.get("expires_at"),
            error=response.get("error"),
            attempts_remaining=response.get("attempts_remaining")
        )
    
    def health(self) -> HealthResponse:
        """Check API health"""
        response = self._request("GET", "/health")
        return HealthResponse(
            status=response["status"],
            timestamp=response["timestamp"],
            services=response["services"]
        )


class _OtpNamespace:
    """OTP namespace for cleaner API"""
    
    def __init__(self, client: MailGuard):
        self._client = client
    
    def send(self, email: str, purpose: str = None) -> SendOtpResponse:
        """Send an OTP to an email address"""
        return self._client.send_otp(email, purpose)
    
    def verify(self, email: str, code: str) -> VerifyOtpResponse:
        """Verify an OTP code"""
        return self._client.verify_otp(email, code)


# Convenience functions
def init(api_key: str, base_url: str = None) -> MailGuard:
    """Initialize the MailGuard SDK"""
    return MailGuard.init(api_key, base_url)


def get_instance() -> MailGuard:
    """Get the MailGuard SDK instance"""
    return MailGuard.get_instance()


# Module-level otp namespace
class _OtpModuleNamespace:
    """Module-level OTP namespace"""
    
    @staticmethod
    def send(email: str, purpose: str = None) -> SendOtpResponse:
        return MailGuard.get_instance().send_otp(email, purpose)
    
    @staticmethod
    def verify(email: str, code: str) -> VerifyOtpResponse:
        return MailGuard.get_instance().verify_otp(email, code)


otp = _OtpModuleNamespace()


def health() -> HealthResponse:
    """Check API health"""
    return MailGuard.get_instance().health()