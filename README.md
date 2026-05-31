# 🛡️ SecureVault - Production-Ready Glassmorphic Password Manager

SecureVault is a high-grade, zero-knowledge full-stack Password Manager application. Featuring a stunning **iOS 26** inspired Glassmorphic interface with `backdrop-filter: blur(40px)`, custom spring animations, and multi-layer cryptographic protection.

---

## 🚀 Folder Structure

```text
secure-vault/
├── backend/                  # Node.js + Express + TS REST API
│   ├── prisma/               # Prisma schema & SQL migrations
│   ├── src/                  # Express controllers, routes, and services
│   │   ├── services/         # Cryptography, TOTP, and leak checking
│   │   └── middleware/       # Rate limiting, auth cookies, Helmet, Zod
│   ├── Dockerfile
│   └── package.json
├── frontend/                 # Next.js 15 + React 19 Client
│   ├── app/                  # App Router views & layouts
│   ├── components/ui/        # iOS Glassmorphic controls, Password Generator
│   ├── store/                # Zustand global stores (Auth & Auto-Lock, Vault)
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml        # Orchestrates Postgres database, backend, frontend
├── README.md                 # Complete launch & audit guide
└── API_DOCUMENTATION.md      # Full REST endpoint payloads & specifications
```

---

## 🛠️ Security Architecture Model

1. **Master Password Hashing**: Done using **Argon2id** (memory cost: 64MB, iterations: 3, parallelism: 4) on the backend via the `argon2` node package. Plain text master passwords are never stored.
2. **Zero-Knowledge User Keys**: When a user registers, a 256-bit cryptographically secure random **User Key** is generated. This key is encrypted with AES-256-GCM using a key derived from the user's master password (via PBKDF2) + a server-side `SERVER_PEPPER` secret, and stored in the database.
3. **Vault Encryption**: Individual website credentials are encrypted on-the-fly with **AES-256-GCM** using the decrypted User Key. The database only stores `ciphertext`, `iv`, and `authTag`.
4. **HttpOnly Cookie Sessions**: JWT authentication tokens are strictly stored inside signed `HttpOnly`, `Secure`, `SameSite=Strict` cookies, preventing XSS-based session hijacking.
5. **Privacy-Preserving Leak Check**: Integrating Have I Been Pwned API via k-Anonymity privacy model (transmitting only the first 5 characters of SHA-1 hash to fetch suffix listings).

---

## 📦 Quick Launch Guide (Docker Compose)

The easiest way to boot up the database, Express backend, and Next.js frontend is via Docker:

### 1. Requirements
* Docker installed on your host machine.
* Docker Compose v2+ active.

### 2. Startup Command
In the root directory of `secure-vault`, run:
```bash
docker-compose up --build
```
This builds all containers:
* PostgreSQL on port `5432`
* Express backend REST API on port `5000`
* Next.js 15 production server on port `3000`

---

## 💻 Manual Scaffolding Launch (Development)

If running directly on your Windows host:

### 1. PostgreSQL Database
Ensure a local PostgreSQL instance is active. Create a database named `secure-vault`.

### 2. Scaffolding the Backend
1. Open the backend folder:
   ```bash
   cd backend
   ```
2. Copy environment template and adjust values:
   ```bash
   cp .env.example .env
   ```
3. Install modules:
   ```bash
   npm install
   ```
4. Push Prisma database tables:
   ```bash
   npx prisma db push
   ```
5. Spin up Express in hot-reload mode:
   ```bash
   npm run dev
   ```

### 3. Scaffolding the Frontend
1. Open the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install client modules:
   ```bash
   npm install
   ```
3. Boot up Next.js client development server:
   ```bash
   npm run dev
   ```
4. Access the web portal at `http://localhost:3000`!

---

## 🔒 Production Deployment Specifications

When deploying SecureVault to a live production cluster:
1. **Reverse Proxy (Nginx / Cloudflare)**: Configure a robust reverse proxy block. Direct Nginx to handle HTTPS (TLS 1.3) termination and map headers:
   ```nginx
   proxy_set_header X-Forwarded-Proto https;
   proxy_cookie_path / "/; HTTPOnly; Secure; SameSite=Strict";
   ```
2. **CSP Configurations**: Set strict Helmet Content Security Policies restricting scripting injection vectors.
3. **Database Secrets**: Store `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `SERVER_PEPPER` inside enterprise vaults (AWS Secret Manager or HashiCorp Vault) as 64-byte random hashes.

---

## 🧪 Production Security Audit Checklist

Verify the following check-gates before releasing live:

* [ ] **SSL/TLS Active**: Run scanning (e.g. Qualys SSL Labs) to verify only TLS 1.2 and TLS 1.3 are enabled with strict HSTS policies.
* [ ] **Signed Cookie Integrity**: Check that cookie variables are encrypted and use `HttpOnly`, `Secure`, and `SameSite=Strict` fields.
* [ ] **Cross-Site Request Forgery (CSRF)**: Validate that JWT payloads are only refreshed via authenticated routes and standard actions require proper headers.
* [ ] **SQL Injection**: Zod request schema validation is active on all endpoints, sanitizing queries and preventing arbitrary DB pushes.
* [ ] **Rate-Limiting active**: Authentication routes block access attempts exceeding 10 hits per 15 minutes to counter brute force.
* [ ] **Auto-Lock timeout validation**: App triggers lock and wipes local state on mouse/key inactivity.
