require('dotenv').config();

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

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

app.get('/playmaker', requireAuth, (req, res) => {
  res.render('playmaker', { user: req.session.user });
});

app.get('/playtracker', requireAuth, (req, res) => {
  res.render('playtracker', { user: req.session.user });
});

app.get('/reports', requireAuth, (req, res) => {
  res.render('reports', { user: req.session.user });
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

const playsFile = path.join(__dirname, 'plays.json');

// API routes for plays
app.get('/api/plays', requireAuth, (req, res) => {
  try {
    const plays = JSON.parse(fs.readFileSync(playsFile, 'utf8'));
    res.json(plays);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/plays', requireAuth, (req, res) => {
  const plays = JSON.parse(fs.readFileSync(playsFile, 'utf8'));
  const newPlay = { id: Date.now(), ...req.body };
  plays.push(newPlay);
  fs.writeFileSync(playsFile, JSON.stringify(plays, null, 2));
  res.json(newPlay);
});

app.put('/api/plays/:id', requireAuth, (req, res) => {
  const plays = JSON.parse(fs.readFileSync(playsFile, 'utf8'));
  const id = parseInt(req.params.id);
  const index = plays.findIndex(p => p.id === id);
  if (index !== -1) {
    plays[index] = { ...plays[index], ...req.body };
    fs.writeFileSync(playsFile, JSON.stringify(plays, null, 2));
    res.json(plays[index]);
  } else {
    res.status(404).json({ error: 'Play not found' });
  }
});

app.delete('/api/plays/:id', requireAuth, (req, res) => {
  const plays = JSON.parse(fs.readFileSync(playsFile, 'utf8'));
  const id = parseInt(req.params.id);
  const filtered = plays.filter(p => p.id !== id);
  if (filtered.length < plays.length) {
    fs.writeFileSync(playsFile, JSON.stringify(filtered, null, 2));
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Play not found' });
  }
});

// Route for importing HUDL CSV
app.post('/api/plays/import', requireAuth, upload.single('hudlFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // Remove empty rows
      const filteredResults = results.filter(row => Object.values(row).some(val => val && val.trim() !== ''));

      // Transform to match the expected format
      const plays = filteredResults.map((row, index) => ({
        id: Date.now() + index,
        playNumber: row['PLAY #'] ? parseInt(row['PLAY #']) : null,
        odk: row['ODK'] || '',
        dn: row['DN'] ? parseInt(row['DN']) : null,
        dist: row['DIST'] ? parseInt(row['DIST']) : null,
        hash: row['HASH'] || '',
        yardLn: row['YARD LN'] ? parseInt(row['YARD LN']) : null,
        playType: row['PLAY TYPE'] || '',
        result: row['RESULT'] || '',
        gnLs: row['GN/LS'] || '',
        offForm: row['OFF FORM'] || '',
        offPlay: row['OFF PLAY'] || '',
        offStr: row['OFF STR'] || '',
        playDir: row['PLAY DIR'] || '',
        gap: row['GAP'] || '',
        passZone: row['PASS ZONE'] || '',
        defFront: row['DEF FRONT'] || '',
        coverage: row['COVERAGE'] || '',
        blitz: row['BLITZ'] || '',
        qtr: row['QTR'] ? parseInt(row['QTR']) : null
      }));

      // Load existing plays
      let existingPlays = [];
      try {
        existingPlays = JSON.parse(fs.readFileSync(playsFile, 'utf8'));
      } catch (err) {
        // File doesn't exist or is empty
      }

      // Append new plays
      const updatedPlays = existingPlays.concat(plays);
      fs.writeFileSync(playsFile, JSON.stringify(updatedPlays, null, 2));

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({ success: true, imported: plays.length });
    })
    .on('error', (err) => {
      res.status(500).json({ error: 'Error parsing CSV' });
    });
});

const gamesFile = path.join(__dirname, 'games.json');

// API routes for games
app.get('/api/games', requireAuth, (req, res) => {
  try {
    const games = JSON.parse(fs.readFileSync(gamesFile, 'utf8'));
    res.json(games);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/games', requireAuth, (req, res) => {
  const games = JSON.parse(fs.readFileSync(gamesFile, 'utf8'));
  const newGame = { id: Date.now(), ...req.body };
  games.push(newGame);
  fs.writeFileSync(gamesFile, JSON.stringify(games, null, 2));
  res.json({ success: true, game: newGame });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));