# VoIP Suite Backend (Self-Hosted)

A lightweight, self-hosted VoIP backend built with **Node.js, Express, and MongoDB**. This application acts as a personal telecom operator node, allowing you to manage your own Twilio numbers, handle calls/SMS/MMS, and keep 100% control over your data and budget.

## 🎯 Purpose
Unlike SaaS solutions where you pay a markup on every minute or text, **VoIP Suite** connects directly to **your** Twilio account. You pay the carrier rates directly. This backend manages the "plumbing" code required to route calls and texts to your frontend clients.

---

## 🏗 Architecture

### 1. The "Master" Model
The application uses your personal **Twilio Account SID & Auth Token** as the master credentials.
*   **Inventory**: Fetches numbers directly from your Twilio subaccount.
*   **Webhooks**: Automatically configures your numbers to point to this server.
*   **Routing**: Uses a single **TwiML App** pattern to handle all outgoing call routing.

### 2. Core Modules

#### A. Authentication (`app/controller/user.controller.js`)
*   **JWT-based**: Uses JSON Web Tokens for stateless session management.
*   **MFA**: Built-in support for Two-Factor Authentication (TOTP/Google Authenticator).
*   **Socket.io**: Authenticates socket connections for real-time updates.

#### B. Inventory & Settings (`app/controller/setting.controller.js`)
This is the heart of the telecom logic:
*   **`GET /get-number`**: Lists numbers available in your Twilio account that are *not yet assigned* to a local user. Uses `libphonenumber-js` for robust country detection.
*   **`POST /create` (Assign Number)**: 
    *   Claims a number for a specific user profile.
    *   **Auto-Configuration**: Updates Twilio's webhook URLs for that specific number to point to your server (e.g., `https://your-server.com/api/call/incoming`).
    *   **Creation**: Generates necessary API Keys and TwiML Apps on the fly.
*   **`GET /get-balance`**: Returns the real-time balance of your Twilio Master Account so you can track spending.

#### C. Communication Engine (`app/helper/twilio.helper.js`)
A wrapper around the official `twilio` SDK that handles:
*   **Singleton TwiML App**: Ensures only one "VoIP Suite Master App" exists in your Twilio account to avoid clutter.
*   **Smart Filtering**: Filters inventory based on your `ALLOWED_COUNTRIES` env var.
*   **Balance Checking**: Real-time ledger lookup.

#### D. SMS & MMS (`app/controller/setting.controller.js`)
*   **Ingress**: Receives webhooks at `/receive-sms/twilio`.
*   **Media Handling**: detect MMS attachments -> Downloads file to local `./uploads` directory -> Generates local URL -> Saves to MongoDB -> Pushes to UI via Socket.io.
*   **Egress**: Sends messages via the Master Account credentials.

#### E. Voice (`app/controller/call.controller.js`)
*   **Ingress (`/incoming`)**: Receives a call -> Looks up User -> Returns TwiML `<Dial><Client>user_id</Client></Dial>` to ring your frontend.
*   **Egress (`/make-call`)**: Receives request -> Returns TwiML `<Dial>+1555...</Dial>` to connect to the outside world.
*   **Token Generation**: Mints short-lived Access Tokens for the Frontend Voice SDK.

---

## 🚀 Getting Started

### Prerequisites
*   **Node.js** v16+
*   **MongoDB** (Local or Atlas)
*   **Twilio Account** (SID & Auth Token)
*   **Ngrok** (For local development/testing)

### Installation
1.  **Clone & Install**:
    ```bash
    git clone [repo]
    cd voip-backend
    npm install
    ```

2.  **Environment Setup**:
    Create `development.env` (or copy `.env.example`):
    ```env
    # Database
    DB='mongodb://user:pass@127.0.0.1:27017/voipsuite?authSource=admin'
    
    # Server
    PORT=3001
    BASE_URL='https://your-ngrok-url.app/'  # Must be HTTPS!

    # Security
    COOKIE_KEY=random_string_1
    COOKIE_KEY2=random_string_2
    
    # Twilio Credentials (Required)
    TWILIO_ACCOUNT_SID=AC...
    TWILIO_AUTH_TOKEN=...
    
    # Configuration
    ALLOWED_COUNTRIES=US,GB
    MAX_NUMBERS_PER_USER=2
    ```

3.  **Run Locally**:
    ```bash
    npm run dev
    ```

4.  **Swagger Documentation**:
    Visit `http://localhost:3001/` to see the interactive API docs.

---

## 🛡 Security & Best Practices

1.  **Webhooks**: The server verifies that incoming webhook requests actually come from Twilio (signature validation is recommended for production).
2.  **Self-Hosted Safety**: Since you host this, valid SSL (HTTPS) is **mandatory** for Twilio webhooks to work (handled by Ngrok locally, or Nginx/LetsEncrypt in production).
3.  **Data Privacy**: All call logs, SMS history, and contacts are stored in **your** local MongoDB. No third-party data mining.

## 🤝 Contributing
Issues and Pull Requests are welcome! Please ensure you verify changes with `npm run dev` before submitting.
