require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const User = require('./models/user');
const Diary = require('./models/diary');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/register.html');
});

app.get('/home', (req, res) => {
  res.sendFile(__dirname + '/home.html');
});

app.get('/write-diary', (req, res) => {
  if (req.session.userId) {
    res.sendFile(__dirname + '/write-diary.html');
  } else {
    res.status(401).send('You must be logged in to write a diary entry.');
  }
});
app.get('/logout', (req, res) => {
  
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error during logout.");
    }
    
    res.redirect('/index.html');
  });
});


app.post('/register', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send('Passwords do not match. Please try again.');
  }

  try {
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).send('User already exists. Please log in.');
    }

    const newUser = new User({ username, email, password });
    await newUser.save();
    console.log('User registered successfully');
    res.status(201).send('User registered successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error registering user');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
      console.log('Login successful');
      req.session.userId = user._id;
      res.status(200).send('Login successful');
    } else {
      res.status(401).send('Invalid username or password. Please try again.');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error logging in');
  }
});

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    req.user = { _id: req.session.userId };
    next();
  } else {
    res.status(401).send('You must be logged in to access this resource.');
  }
};

app.post('/write-diary', isAuthenticated, async (req, res) => {
  const { entry } = req.body;
  const userId = req.user._id;

  if (!entry) {
    return res.status(400).send('Diary entry is required.');
  }

  try {
    const newDiaryEntry = new Diary({ userId, entry });
    await newDiaryEntry.save();
    res.status(201).send('Diary entry added successfully!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saving diary entry.');
  }
});

app.get('/view-diary', (req, res) => {
  res.sendFile(__dirname + '/view-diary.html');
});


app.get('/api/view-diary', async (req, res) => {
  try {
      const diaryEntries = await Diary.find({ userId: req.session.userId }).sort({ date: -1 });
      res.json(diaryEntries);
  } catch (error) {
      console.error("Error retrieving diary entries:", error);
      res.status(500).json({ error: "Failed to retrieve diary entries" });
  }
});




app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
