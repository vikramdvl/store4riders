/**
 * Swagger Documentation
 */

/**
   * @swagger
   * /user/me:
   *   get:
   *     summary: Get my profile
   *     description: |
   *       ### 👤 What is the purpose of this API?
   *       Returns the logged-in user's complete profile, including their saved shipping addresses.
   *       
   *       ### 🛍️ Real-World Business Cases:
   *       - **Checkout Autocomplete:** When a user goes to the Checkout page, the frontend calls this API to pre-fill their saved addresses, saving them from typing it all over again.
   *       - **Account Dashboard:** Used to display the user's name and details in the "My Account" section.
   *       
   *       ### 🔒 Security Layers:
   *       - **Strict Authorization:** This API does not take an ID in the URL. It strictly extracts the user ID directly from the secure JWT token. This makes it impossible for "User A" to hack the URL and view "User B's" profile.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile
   *   put:
   *     summary: Update profile
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *               phone:
   *                 type: string
   *     responses:
   *       200:
   *         description: Profile updated
   */

/**
   * @swagger
   * /user/me/addresses:
   *   post:
   *     summary: Add a new shipping address
   *     operationId: addUserAddress
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *                 example: "Home"
   *               addressLine1:
   *                 type: string
   *                 example: "123 Main Street"
   *               city:
   *                 type: string
   *                 example: "Mumbai"
   *               state:
   *                 type: string
   *                 example: "Maharashtra"
   *               country:
   *                 type: string
   *                 example: "India"
   *               pincode:
   *                 type: string
   *                 example: "400001"
   *     responses:
   *       201:
   *         description: Address added
   */

/**
   * @swagger
   * /users/me/password:
   *   put:
   *     summary: Change password and rotate sessions
   *     description: Verifies the current password, updates the password hash, revokes all prior access/refresh sessions via tokenVersion and blacklist invalidation, and issues fresh HttpOnly session cookies for the current session.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *             properties:
   *               currentPassword:
   *                 type: string
   *               newPassword:
   *                 type: string
   *     responses:
   *       200:
   *         description: Password changed and current session rotated
   *       400:
   *         description: Invalid current password or validation failure
   *       401:
   *         description: Authentication failed or account disabled
   */

// Fix for TypeScript isolatedModules error
export {};
