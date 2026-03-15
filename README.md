# MailGuard OSS

A self-hosted OTP server for developers. Deploy it, add your Gmail/Outlook account through a Telegram Bot, and use two simple API endpoints to send and verify OTPs.

## Features

- 🔐 **Self-hosted OTP service** - Full control over your data
- 📧 **Email provider auto-detection** - Gmail, Outlook, Yahoo, Zoho, iCloud, ProtonMail, Fastmail
- 🤖 **Telegram Bot admin interface** - Manage senders, projects, and API keys
- 🚀 **REST API** - Simple send and verify endpoints
- 📦 **Multi-language SDKs** - JavaScript, Python, PHP, Go
- 🔒 **Security first** - AES-256-GCM encryption, bcrypt OTP hashing, rate limiting
- ☁️ **Cloud-native** - Deploy to Railway, Docker, or any Node.js host

## Quick Start

### 1. Prerequisites

- Node.js 20+
- Supabase account (free tier works)
- Upstash Redis account (free tier works)
- Telegram account

### 2. Setup Supabase

1. Create a new Supabase project
2. Go to SQL Editor and run the contents of `supabase/schema.sql`
3. Get your project URL and service role key from Settings > API

### 3. Setup Upstash Redis

1. Create a new Redis database
2. Copy the connection URL

### 4. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Use `/newbot` to create a new bot
3. Copy the bot token
4. Message [@userinfobot](https://t.me/userinfobot) to get your Telegram user ID

### 5. Generate Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate encryption key
openssl rand -hex 32
```

### 6. Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/mailguard)

Or manually:

1. Fork this repository
2. Create a new project on Railway
3. Add environment variables from `.env.example`
4. Deploy all three services

### 7. Configure via Telegram

1. Open your bot on Telegram
2. Send `/start` to see the dashboard
3. Use `/addemail` to add your sender email
4. Use `/newproject` to create a project
5. Use `/genkey` to generate API keys

## API Usage

### Send OTP

```bash
curl -X POST https://your-api.railway.app/api/v1/otp/send \
  -H "Authorization: Bearer mg_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

Response:
```json
{
  "id": "uuid",
  "status": "sent",
  "expires_in": 600,
  "masked_email": "use***@example.com"
}
```

### Verify OTP

```bash
curl -X POST https://your-api.railway.app/api/v1/otp/verify \
  -H "Authorization: Bearer mg_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "code": "123456"}'
```

Response:
```json
{
  "verified": true,
  "token": "jwt_token",
  "expires_at": "2024-01-01T00:15:00Z"
}
```

## SDK Usage

### JavaScript/TypeScript

```bash
npm install mailguard-sdk
```

```typescript
import MailGuard from 'mailguard-sdk';

MailGuard.init({ 
  apiKey: 'mg_live_your_api_key',
  baseUrl: 'https://your-api.railway.app'
});

// Send OTP
const result = await MailGuard.getInstance().sendOtp({
  email: 'user@example.com'
});

// Verify OTP
const verification = await MailGuard.getInstance().verifyOtp({
  email: 'user@example.com',
  code: '123456'
});
```

### Python

```bash
pip install mailguard-sdk
```

```python
from mailguard_sdk import MailGuard

MailGuard.init(api_key="mg_live_your_api_key", base_url="https://your-api.railway.app")

# Send OTP
result = MailGuard.get_instance().send_otp("user@example.com")

# Verify OTP
verification = MailGuard.get_instance().verify_otp("user@example.com", "123456")
```

### PHP

```bash
composer require mailguard/mailguard-sdk
```

```php
use MailGuard\MailGuard;

MailGuard::init('mg_live_your_api_key', 'https://your-api.railway.app');

// Send OTP
$result = MailGuard::getInstance()->sendOtp('user@example.com');

// Verify OTP
$verification = MailGuard::getInstance()->verifyOtp('user@example.com', '123456');
```

### Go

```bash
go get github.com/mailguard/mailguard-go
```

```go
import "github.com/mailguard/mailguard-go/mailguard"

client := mailguard.Init(mailguard.Config{
    APIKey:  "mg_live_your_api_key",
    BaseURL: "https://your-api.railway.app",
})

// Send OTP
result, err := client.SendOtp("user@example.com", "")

// Verify OTP
verification, err := client.VerifyOtp("user@example.com", "123456")
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your App      │────▶│   API Server    │────▶│   Supabase      │
│   (SDK)         │     │   (Fastify)     │     │   (PostgreSQL)  │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Redis         │
                        │   (Upstash)     │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │  Worker  │ │   Bot    │ │  Queue   │
              │(BullMQ)  │ │ (grammY) │ │ (BullMQ) │
              └──────────┘ └──────────┘ └──────────┘
                    │
                    ▼
              ┌──────────┐
              │  Email   │
              │ Providers│
              └──────────┘
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show dashboard with system status |
| `/addemail` | Add a sender email account |
| `/newproject` | Create a new project |
| `/setotp <slug>` | Configure OTP email templates |
| `/genkey <slug> [label] [--test]` | Generate API key |
| `/senders` | List all sender accounts |
| `/projects` | List all projects |
| `/logs [--failed] [--today]` | Show email logs |

## Security

### Encryption
- App passwords are encrypted with AES-256-GCM
- Fresh IV for each encryption
- Auth tags verified on decryption

### OTP Storage
- OTP codes are hashed with bcrypt (cost factor 10)
- Never stored in plaintext
- Never logged

### API Keys
- SHA-256 hash stored in database
- Full key shown only once at generation
- Test keys available for development

### Rate Limiting
- Per-email: 10 OTPs/hour
- Per-IP: 5 requests/minute
- Per-project: 200 emails/hour
- Per-API-key: 60 requests/minute

## Development

```bash
# Clone the repository
git clone https://github.com/mailguard/mailguard-oss.git

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run in development
npm run dev
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.