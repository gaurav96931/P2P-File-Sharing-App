import express from 'express';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import passport from 'passport';
import { Strategy } from 'passport-local';
import pg from 'pg';
import session from 'express-session';
import env from 'dotenv';
import axios from 'axios';
import getLocalIpAddress from './utility.js';

env.config();

// Constants
const port = process.env.CLIENT_PORT | 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = 'uploads';
const downloadDir = 'downloads';
// Express App Initialization
const app = express();
// to store the ipv4 address of system
let ipaddr;
let errormsg;
let message;

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 30 // 30 minutes session
    }
  })
);

// Middleware Setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT
});
db.connect();

const api = axios.create({
  baseURL: process.env.SERVER_URL
});

// Multer Setup for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save files to the 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + file.originalname); // Rename file with timestamp
  }
});
const upload = multer({ storage });

// Check if Upload and Download Directory Exists, Create if Not
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

// Route Definitions

// EJS files serving routes
app.get('/', (req, res) => {
  res.render('home.ejs');
});

app.get('/login', (req, res) => {
  res.render('login.ejs', { errormsg });
  errormsg = null;
});

app.get('/register', (req, res) => {
  res.render('register.ejs', { errormsg, message });
  errormsg = null;
  message = null;
});

app.get('/client', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('client.ejs', { username: req.user.username, errormsg, message });
    errormsg = null;
    message = null;
  } else {
    res.redirect('/login');
  }
});

// searching files on server
app.get('/search', async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const filename = req.query.keyword;
      const result = await api.get('/api/search', {
        params: {
          keyword: filename
        }
      });
      // console.log(result.data);
      res.render('client.ejs', { result: result.data, username: req.user.username });
    } catch (err) {
      console.log(err);
      errormsg = 'Error in finding file(s)';
      res.redirect('/client');
    }
  } else {
    res.redirect('/login');
  }
});

// login route
app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/client',
    failureRedirect: '/login'
  })
);

// logout route
app.post('/logout', (req, res, next) => {
  const id = req.user.id;
  req.logout(async function (err) {
    if (err) return next(err);
    // for logout delete activeuser from server
    try {
      await api.delete(`/api/activeuser/${id}`);
      console.log('Logged out successfully');
      res.redirect('/');
    } catch (error) {
      errormsg = 'Error in logging out';
      console.error(errormsg, error);
      res.redirect('/client');
    }
  });
});

// register route
app.post('/register', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  // to register, send a post request to '/api/newuser' route
  try {
    await api.post('/api/newuser', { username, password });
    console.log('New user regsitered: ', username);
    message = 'Registered successfully';
    res.redirect('/register');
  } catch (err) {
    if (err.status === 409) {
      // username already exists error
      errormsg = 'Username already exists, try to login';
      console.log(errormsg);
    } else {
      errormsg = 'Error in registering user';
      console.error(errormsg, err);
    }
    res.redirect('/register');
  }
});

app.post('/files', upload.any(), async (req, res) => {
  if (req.isAuthenticated()) {
    if (!req.files) {
      errormsg = 'Error in uploading file(s)';
      res.status(400).redirect('/client');
    }
    // to work on msg -> update
    // update on db
    const files = req.files.map((file) => {
      return file.filename;
    });

    try {
      await api.post('/api/files', { files, clientid: req.user.id });
      message = 'File(s) uploaded successfully';
      console.log(message);
    } catch (err) {
      errormsg = 'Error in uploading file(s)';
      console.log(errormsg, err);
    }
    res.redirect('/client');
  } else {
    res.redirect('/login');
  }
});

app.get('/download/:fileid', async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const fileid = req.params.fileid;
      const response = await api.get(`/api/files/${fileid}`);
      const { ipPeerToConnect, filename } = response.data;
      const filepath = path.join(__dirname, downloadDir, filename);
      const writer = fs.createWriteStream(filepath);
      axios({
        method: 'get',
        url: `http://${ipPeerToConnect}:${5000}/files/${filename}`,
        responseType: 'stream'
      }).then((response) => {
        response.data.pipe(writer);
      });
      writer.on('finish', () => {
        message = `File ${filename} downloaded successfully.`;
        console.log(message);
      });
      writer.on('error', (err) => {
        throw err;
      });
    } catch (err) {
      errormsg = 'Error in getting file';
      console.log(errormsg, err);
    }
  } else {
    res.redirect('/login');
  }
  res.redirect('/client');
});

app.get('/files/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(__dirname, uploadDir, fileName);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.error(`Requested file ${fileName} does not exist`);
    res.sendStatus(404);
  }
});

passport.use(
  new Strategy(async function verify (username, password, cb) {
    try {
      const response = await api.post('/api/user', {
        auth: { username, password },
        clientip: ipaddr
      });
      const user = response.data;
      console.log(user);
      message = 'Login success';
      console.log(message);
      return cb(null, user);
    } catch (err) {
      if (err.status === 401) {
        errormsg = 'Invalid Credentials, login failed.';
        console.log(errormsg);
      } else if (err.status === 409) {
        errormsg = 'User already logged in';
        console.log(errormsg);
      } else {
        errormsg = 'Authentication failed';
        console.error(errormsg, err);
      }
      return cb(null, false);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

// Start Server
try {
  // const ipaddr = getLocalIpAddress();
  ipaddr = '127.0.0.1';
  app.listen(port, ipaddr, () => {
    console.log(`Client listening on ${ipaddr}:${port}`);
  });
} catch (error) {
  console.error(error.message);
}
