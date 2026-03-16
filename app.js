require('dotenv').config();

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'Rkwb8E9UKieaukOmvcedyD0VkFy30gLxGxxDecJNkvGDhnO1fcJrikje5B2q3l6N', // Change this to a secure secret
  resave: false,
  saveUninitialized: false
}));

// Load users from environment variables
const users = {
  [process.env.ADMIN_USERNAME]: { password: process.env.ADMIN_PASSWORD, role: process.env.ADMIN_ROLE },
  [process.env.USER_USERNAME]: { password: process.env.USER_PASSWORD, role: process.env.USER_ROLE }
};

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect('/');
  }
}

// Middleware to check admin role
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'Admin') {
    return next();
  } else {
    res.status(403).send('Access denied');
  }
}

// Routes
app.get('/', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (user && user.password === password) {
    req.session.user = { username, role: user.role };
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Invalid credentials' });
  }
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

app.get('/profile', requireAuth, (req, res) => {
  res.render('profile', { user: req.session.user });
});

app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  res.render('admin', { user: req.session.user });
});

app.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
  const userList = Object.keys(users).map(username => ({
    username,
    role: users[username].role
  }));
  res.render('admin-users', { user: req.session.user, users: userList });
});

app.post('/admin/users/add', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;

  // Basic validation
  if (!username || !password || !role) {
    return res.status(400).send('All fields are required');
  }

  if (users[username]) {
    return res.status(400).send('User already exists');
  }

  if (!['Admin', 'User'].includes(role)) {
    return res.status(400).send('Invalid role');
  }

  // Add to users object
  users[username] = { password, role };

  // Persist to .env
  const envPath = path.join(__dirname, '.env');
  const envEntry = `\n${username.toUpperCase()}_USERNAME=${username}\n${username.toUpperCase()}_PASSWORD=${password}\n${username.toUpperCase()}_ROLE=${role}\n`;
  fs.appendFileSync(envPath, envEntry);

  res.redirect('/admin/users');
});

app.get('/admin/logs', requireAuth, requireAdmin, (req, res) => {
  res.render('admin-logs', { user: req.session.user });
});

app.get('/admin/settings', requireAuth, requireAdmin, (req, res) => {
  res.render('admin-settings', { user: req.session.user });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));