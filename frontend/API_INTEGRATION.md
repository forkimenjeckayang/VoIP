# Frontend API Integration Audit

## ✅ Authentication APIs
| Frontend Call | Backend Route | Method | Auth Required | Status |
|--------------|---------------|--------|---------------|--------|
| `/auth/login` | `/api/auth/login` | POST | No | ✅ Correct |
| `/auth/register` | `/api/auth/register` | POST | No | ✅ Correct |
| `/auth/user/get` | `/api/auth/user/get` | POST | Yes | ✅ Correct |

## ✅ Settings/Number Management APIs
| Frontend Call | Backend Route | Method | Auth Required | Status |
|--------------|---------------|--------|---------------|--------|
| `/setting/get-balance` | `/api/setting/get-balance` | POST | Yes | ✅ Correct |
| `/setting/get-number` | `/api/setting/get-number` | POST | No | ✅ Correct |
| `/setting/create` | `/api/setting/create` | POST | Yes | ✅ Correct |
| `/setting/delete-key` | `/api/setting/delete-key` | POST | Yes | ✅ Correct |
| `/setting/send-sms` | `/api/setting/send-sms` | POST | Yes | ✅ Correct |
| `/setting/message-list` | `/api/setting/message-list` | POST | Yes | ✅ Correct |

## ✅ Profile APIs
| Frontend Call | Backend Route | Method | Auth Required | Status |
|--------------|---------------|--------|---------------|--------|
| `/profile/getdata` | `/api/profile/getdata` | POST | Yes | ✅ Correct |
| `/profile/delete-profile` | `/api/profile/delete-profile` | POST | Yes | ⚠️ NOT USED (replaced with /setting/delete-key) |

## ✅ Contact APIs
| Frontend Call | Backend Route | Method | Auth Required | Status |
|--------------|---------------|--------|---------------|--------|
| `/contact/get-all` | `/api/contact/get-all` | GET | Yes | ✅ Correct |
| `/contact/create` | `/api/contact/create` | POST | Yes | ✅ Correct |
| `/contact/update` | `/api/contact/update` | POST | Yes | ✅ Correct |
| `/contact/delete` | `/api/contact/delete` | POST | Yes | ✅ Correct |

## Environment Variables

### Frontend (.env)
```env
VITE_API_URL=                       # Empty = use Vite proxy (recommended)
VITE_SOCKET_URL=http://localhost:3001
VITE_APP_NAME=VoIP Suite
VITE_ENVIRONMENT=development
VITE_DEBUG=true
```

### Backend (development.env)
```env
DB='mongodb://...'
PORT=3001
BASE_URL='https://your-ngrok.app'
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
ALLOWED_COUNTRIES=US
MAX_NUMBERS_PER_USER=2
COOKIE_KEY=...
COOKIE_KEY2=...
```

## Data Flow Architecture

```
┌─────────────────┐
│   Database      │ ← Source of Truth
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Backend API    │ ← Express + MongoDB
└────────┬────────┘
         │
         ↓ (JWT Authentication)
         │
┌─────────────────┐
│  AuthContext    │ ← React Context (fetches user from API)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Components     │ ← Use user from context (no direct localStorage access)
└─────────────────┘

localStorage = Token + User cache only (NOT source of truth)
```

## Configuration Points

### Configurable in Frontend:
- API base URL (`VITE_API_URL`)
- Socket URL (`VITE_SOCKET_URL`)
- App name (`VITE_APP_NAME`)
- Debug mode (`VITE_DEBUG`)

### Configurable in Backend:
- Database connection
- Server port
- Twilio credentials
- Allowed countries
- Max numbers per user
- Session keys
- Base URL (for webhooks)

## Summary
All API calls have been verified against the backend routes. The frontend correctly:
- Uses environment variables for configuration
- Authenticates via JWT tokens
- Fetches all data from the database via API
- Uses localStorage only for token caching
- Gets user data from AuthContext (not localStorage directly)
