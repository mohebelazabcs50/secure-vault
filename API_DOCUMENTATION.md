# SecureVault - Production API Documentation

This document describes the REST API endpoints provided by the SecureVault backend.

## Base URL
* Local development: `http://localhost:5000/api`
* Production: Configure behind a TLS reverse proxy (e.g., Nginx).

---

## 1. Authentication Endpoints (`/auth`)

### 1.1 User Registration
* **Endpoint**: `POST /auth/register`
* **Rate Limit**: 10 requests per 15 minutes.
* **Payload**:
  ```json
  {
    "email": "alex@example.com",
    "username": "Alex Mercer",
    "masterPassword": "master_password_must_be_min_12_chars"
  }
  ```
* **Response (201 Created)**:
  Sets HTTP-Only secure cookies: `access_token`, `refresh_token`.
  ```json
  {
    "message": "Registration successful.",
    "user": {
      "id": "e2f073f1-d009-4670-87a3-1dc00db2c608",
      "email": "alex@example.com",
      "username": "Alex Mercer"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR..."
  }
  ```

### 1.2 User Login
* **Endpoint**: `POST /auth/login`
* **Rate Limit**: 10 requests per 15 minutes.
* **Payload**:
  ```json
  {
    "email": "alex@example.com",
    "masterPassword": "your_master_password"
  }
  ```
* **Response (200 OK - No 2FA)**:
  Sets HTTP-Only secure cookies.
  ```json
  {
    "message": "Login successful.",
    "user": {
      "id": "e2f073f1-d009-4670-87a3-1dc00db2c608",
      "email": "alex@example.com",
      "username": "Alex Mercer"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR..."
  }
  ```
* **Response (200 OK - 2FA Required)**:
  If user has active Two-Factor Authentication, a temporary session token is returned.
  ```json
  {
    "twoFactorRequired": true,
    "tempToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "message": "Two-factor authentication required."
  }
  ```

### 1.3 Verify 2FA TOTP
* **Endpoint**: `POST /auth/verify-2fa`
* **Payload**:
  ```json
  {
    "tempToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "code": "123456"
  }
  ```
* **Response (200 OK)**:
  Sets full session HTTP-Only cookies. Returns access token.

### 1.4 Refresh JWT Session
* **Endpoint**: `POST /auth/refresh`
* **Cookies Required**: `refresh_token`
* **Response (200 OK)**:
  Sets new HTTP-Only access and refresh tokens.
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR...",
    "user": { ... }
  }
  ```

### 1.5 User Logout
* **Endpoint**: `POST /auth/logout`
* **Authentication**: Required
* **Response (200 OK)**:
  Clears session cookies and revokes refresh tokens on the database.

---

## 2. Vault Endpoints (`/vault`)
*All requests require valid JWT Session Authorization.*

### 2.1 Get Vault Items
* **Endpoint**: `GET /vault/items`
* **Query Parameters**:
  - `category` (optional): Filter by: Social Media, Banking, Work, Gaming, Shopping, Crypto.
  - `search` (optional): Filter matching text.
* **Response (200 OK)**:
  Returns list of decrypted records.
  ```json
  {
    "items": [
      {
        "id": "76495b9c-705a-4933-bfad-1d227c62b489",
        "websiteName": "Google",
        "url": "https://accounts.google.com",
        "username": "alex.mercer",
        "email": "alex@gmail.com",
        "password": "plainTextDecryptedPassword",
        "notes": "Backup recovery code: XYZ123",
        "category": "Social Media",
        "securityScore": 90,
        "createdAt": "2026-05-31T12:00:00.000Z"
      }
    ]
  }
  ```

### 2.2 Add Vault Item
* **Endpoint**: `POST /vault/items`
* **Payload**:
  ```json
  {
    "websiteName": "Google",
    "url": "https://accounts.google.com",
    "username": "alex.mercer",
    "email": "alex@gmail.com",
    "password": "securePlainTextPassword",
    "notes": "Some notes",
    "category": "Social Media",
    "securityScore": 90
  }
  ```
* **Response (210 Created)**:
  Returns the saved item metadata (excluding database GCM tags).

### 2.3 Edit Vault Item
* **Endpoint**: `PUT /vault/items/:id`
* **Payload**: Any fields from 2.2 (optional).
* **Response (200 OK)**:
  `{ "message": "Credential updated successfully.", "id": "..." }`

### 2.4 Delete Vault Item
* **Endpoint**: `DELETE /vault/items/:id`
* **Response (200 OK)**:
  `{ "message": "Credential deleted successfully." }`

---

## 3. Vault & Security Settings (`/vault`)

### 3.1 Rotate Master Password (Zero-Knowledge Re-keying)
* **Endpoint**: `POST /vault/change-master`
* **Payload**:
  ```json
  {
    "oldMasterPassword": "current_password",
    "newMasterPassword": "new_strong_master_password"
  }
  ```
* **Response (200 OK)**:
  `{ "message": "Master password updated successfully." }`

### 3.2 Password Breach Check (Have I Been Pwned)
* **Endpoint**: `POST /vault/check-breach`
* **Payload**:
  ```json
  {
    "password": "password_to_verify"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "leaked": true,
    "count": 1245
  }
  ```
