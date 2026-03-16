# Node.js Webapp

A simple Node.js web application using Express.js, EJS templating, Bootstrap for styling, and express-session for session management.

## Features

- User authentication with session management
- Role-based access (Admin and User roles)
- Credentials stored in .env file
- Responsive UI with Bootstrap

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Configure environment variables in `.env`:
   - ADMIN_USERNAME
   - ADMIN_PASSWORD
   - ADMIN_ROLE
   - USER_USERNAME
   - USER_PASSWORD
   - USER_ROLE

3. Start the server:
   ```
   npm start
   ```

   Or for development with auto-restart:
   ```
   npm run dev
   ```

4. Open your browser and go to `http://localhost:3000`

## Usage

- Login with username "Admin" and password "adminpass" for admin access
- Login with username "User" and password "userpass" for user access
- After login, you'll be redirected to the dashboard showing your role
- Logout to end the session

## Technologies Used

- Node.js
- Express.js
- EJS
- Bootstrap
- express-session
- dotenv