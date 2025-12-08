# VoIP SaaS Backend

This project is a **Node.js/Express** backend for a multi-tenant SaaS VoIP application. It manages a centralized inventory of Twilio phone numbers and assigns them to users, abstracting the complexity of Twilio credentials from the end-user.

## 🏗 Architecture

### Master Account Model
Unlike traditional VoIP apps where users bring their own credentials, this system uses a **Single Master Twilio Account**.
*   **Global Inventory**: The backend fetches available numbers from the Master Account.
*   **User Assignment**: Users "claim" numbers from this pool. The backend links the number to the user internally.
*   **Isolation**: Users only see their assigned numbers. They do not have access to the Master Account SIDs or Auth Tokens.

### Key Components
*   **Inventory System**: `app/controller/setting.controller.js` filters the global list of numbers to show only unassigned ones.
*   **Singleton TwiML App**: A single "VoIP Suite Master App" (TwiML App) handles voice routing for ALL users. This simplifies webhook management.
*   **Regional Filtering**: Inventory can be filtered by country (e.g., `US`, `GB`) via `ALLOWED_COUNTRIES` in `.env`.
*   **Limits**: `MAX_NUMBERS_PER_USER` enforces strict quota limits on number assignment.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js v14+ (v16 Recommended)
*   MongoDB

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure Environment Variables:
    Create a `.env` file in the root:
    ```env
    # DB
    DB_URL=mongodb://localhost:27017/voip_saas

    # Twilio Master Account
    TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_AUTH_TOKEN=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
    
    # SaaS Config
    ALLOWED_COUNTRIES=US,CA,GB
    MAX_NUMBERS_PER_USER=2
    BASE_URL=https://your-server-url.com

    # Security
    JWT_SECRET=your_super_secret_key
    COOKIE_KEY=cookie_secret_1
    COOKIE_KEY2=cookie_secret_2
    
    # App
    PORT=3001
    NODE_ENV=development
    ```
4.  Run the Server:
    ```bash
    npm run dev
    ```

---

## 📚 API Documentation (Swagger)

A fully interactive **Swagger UI** is available at the root URL:
> **http://localhost:3001/**

Use this UI to explore endpoints, view request schemas, and test APIs directly.

### Core Endpoints
*   **POST /api/auth/signin**: Login (Returns JWT).
*   **POST /api/setting/get-number**: List available numbers (Inventory).
*   **POST /api/setting/create**: Assign a number to the current user.
*   **POST /api/setting/delete-key**: Release a number back to the pool.

---

## 🧪 Testing

The project uses **Jest** and **Supertest** for automated testing.
The test suite covers:
1.  **Authentication**: Verifying API protection.
2.  **Inventory**: Mocking Twilio to verify number filtering.
3.  **Assignment**: verifying quota limits and successful number claiming.
4.  **Release**: Verifying cleanup logic (unlinking numbers without deleting the Master TwiML App).

To run tests:
```bash
npm test
```

---

## 🛡 Security Notes

*   **API Keys**: User-specific API Keys are generated for Voice Tokens, but they are managed by the backend.
*   **Voice Tokens**: The backend generates ephemeral JWT Access Tokens for the Twilio Voice SDK, ensuring users never see the master credentials.
*   **Cleanup**: When a number is released, its webhooks are cleared, and the associated API keys are revoked to prevent misuse.

---

## 📂 Project Structure

*   `app.js`: Main entry point. Exports generic `app` for testing.
*   `app/controller/`: Business logic.
    *   `setting.controller.js`: Core Inventory & Assignment logic.
    *   `twilio.helper.js`: Shared library for Twilio API interaction.
*   `test/`: Unit and Integration tests.
*   `swagger.yaml`: OpenAPI Specification.
