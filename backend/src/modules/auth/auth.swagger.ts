/**
 * Swagger Documentation
 */

/**
     * @swagger
     * /auth/login:
     *   post:
     *     summary: Login user
     *     operationId: authLogin
     *     description: |
     *       ### 🔐 What is this API?
     *       Authenticates a user using their Email and Password. Returns a JSON Web Token (JWT) required to access protected routes.
     *       
     *       ### ⚙️ Under The Hood (Architecture & Security)
     *       - **Redis Rate-Limiting:** This endpoint is heavily protected by Redis. If an attacker tries to guess passwords (Brute Force attack), their IP is automatically blocked after a few failed attempts.
     *       - **Zod Validation:** The email payload is strictly sanitized before it ever touches the database, completely preventing NoSQL Injection attacks.
     *       - **Bcrypt Hashing:** Passwords are NEVER stored in plain text. We use industry-standard bcrypt hashing with salt. Even database admins cannot read user passwords.
     *       - **Short-Lived JWT:** The token returned expires in 15 minutes. This minimizes the risk window if a token is ever intercepted.
     *       
     *       ### 🧪 How to test?
     *       1. Provide your registered email and password in the body on the right.
     *       2. Click **"Test Request"**.
     *       3. Copy the `accessToken` from the response to use in the Authorization tab!
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - password
     *             properties:
     *               email:
     *                 type: string
     *                 example: user@example.com
     *               password:
     *                 type: string
     *                 example: password123
     *               scope:
     *                 type: string
     *                 enum: [customer, admin]
     *                 default: customer
     *                 description: Portal scope. Customer form rejects staff roles; Admin Portal rejects customers.
     *     responses:
     *       200:
     *         description: Logged in successfully
     *       403:
     *         description: Account role is not permitted for the requested portal scope
     */

/**
     * @swagger
     * /auth/send-register-otp:
     *   post:
     *     summary: Send 6-digit email verification OTP for registration
     *     operationId: authSendRegisterOtp
     *     description: Sends a single-use 6-digit verification OTP to the provided email address (valid for 10 minutes, 60s resend cooldown).
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *                 example: newuser@example.com
     *     responses:
     *       200:
     *         description: Verification code sent to email
     *       409:
     *         description: Email already in use
     *       429:
     *         description: Cooldown or rate limit exceeded
     */

/**
     * @swagger
     * /auth/register:
     *   post:
     *     summary: Register a new user (with Email OTP verification)
     *     operationId: authRegister
     *     description: |
     *       1. Call `POST /auth/send-register-otp` first to receive the 6-digit OTP on your email.
     *       2. Provide the received `otp` along with your account details below.
     *       
     *       **Note:** If you click "Send" multiple times without changing the email, you will get a **409 Conflict Error** once that email is registered.
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - firstName
     *               - email
     *               - password
     *               - otp
     *             properties:
     *               firstName:
     *                 type: string
     *                 minLength: 2
     *                 maxLength: 50
     *                 description: "First name of the user (Min: 2, Max: 50 characters)"
     *                 example: John
     *               lastName:
     *                 type: string
     *                 maxLength: 50
     *                 description: "Last name of the user (Optional, Max: 50 characters)"
     *                 example: Doe
     *               email:
     *                 type: string
     *                 format: email
     *                 description: "Valid email address. Used for login and communications."
     *                 example: newuser@example.com
     *               password:
     *                 type: string
     *                 minLength: 8
     *                 description: "Strong password (Minimum 8 characters required)"
     *                 example: SecurePass!123
     *               phone:
     *                 type: string
     *                 description: "Mobile number (Optional)"
     *                 example: "+919876543210"
     *               otp:
     *                 type: string
     *                 pattern: "^\\d{6}$"
     *                 description: "6-digit email verification OTP"
     *                 example: "123456"
     *     responses:
     *       201:
     *         description: Registered successfully
     *       400:
     *         description: Invalid or expired OTP
     */

/**
     * @swagger
     * /auth/refresh:
     *   post:
     *     summary: Refresh access token
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               refreshToken:
     *                 type: string
     *     responses:
     *       200:
     *         description: Token refreshed
     */

/**
     * @swagger
     * /auth/logout:
     *   post:
     *     summary: Logout user
     *     tags: [Auth]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Logged out
     */

/**
     * @swagger
     * /auth/me:
     *   get:
     *     summary: Verify current session and return authenticated user profile
     *     tags: [Auth]
     *     parameters:
     *       - in: query
     *         name: scope
     *         schema:
     *           type: string
     *           enum: [customer, admin]
     *         description: Optional portal scope to enforce during verification.
     *     security:
     *       - bearerAuth: []
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Active session verified
     *       401:
     *         description: Unauthenticated or session revoked
     *       403:
     *         description: Portal scope mismatch or disabled account
     */

// Fix for TypeScript isolatedModules error
export {};
