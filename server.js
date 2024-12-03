// Importing dependencies
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import getLocalIpAddress from './utility.js';
import pg from 'pg';
import env from 'dotenv';
import bcrypt from 'bcrypt';
env.config();

// Constants
const app = express();
const port = process.env.SERVER_PORT || 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const saltRounds = 12;

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT
});
db.connect();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Sample Route Handlers
app.get('/', (req, res) => {
  res.send('Hello, World!'); // Basic home route
});

// route for searching items
app.get('/api/search', async (req, res) => {
  try {
    const keyword = req.query.keyword;
    // console.log(keyword);
    const response = await db.query("SELECT * FROM files WHERE filename ILIKE '%' || $1 || '%'", [keyword]);
    // console.log(response.rows);
    res.json(response.rows);
  } catch (err) {
    console.log('Error in fetching search results:\n', err);
    res.sendStatus(500);
  }
});

app.get('/api/files/:fileid', async (req, res) => {
  try {
    const fileid = req.params.fileid;
    const response = await db.query('SELECT clientip FROM files JOIN active_users ON files.ownerid = active_users.id WHERE files.fileid = $1', [fileid]);
    const response2 = await db.query('SELECT filename FROM files WHERE fileid = $1', [fileid]);
    const userip = response.rows[0].clientip;
    const filename = response2.rows[0].filename;
    res.redirect(`http://${userip}:${5000}/files/${filename}`);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

// route to login a user
app.post('/api/user', async (req, res) => {
  const { username, password } = req.body.auth;
  const clientip = req.body.clientip;

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rowCount > 0) {
      // user found, now password verification
      const user = result.rows[0];
      const storedHashedPassword = user.password;
      bcrypt.compare(password, storedHashedPassword, async (err, valid) => {
        if (err) {
          console.error('Error in matching passwords.');
          throw err;
        }
        // no error, valid gives result of password matching
        // but check if user is already logged in
        if (valid) {
          // const checkresult = await db.query('SELECT * FROM active_users WHERE username = $1', [username]);
          // if (checkresult.rowCount > 0) {
          //   // user already logged in
          //   res.sendStatus(409);
          // } else {
            // store as active user
            const response = await db.query('INSERT INTO active_users (username, clientip) VALUES ($1, $2) RETURNING *', [username, clientip]);
            res.status(200).send(response.rows[0]);
            console.log(`New user active, Username: ${username}, IP Address: ${clientip}`);
          // }
        } else {
          // authentication failed
          res.sendStatus(401);
        }
      });
    } else {
      // user not found in db
      res.sendStatus(401);
    }
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post('/api/newuser', async (req, res) => {
  const { username, password } = req.body;
  try {
    const checkResult = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (checkResult.rowCount > 0) {
      // username already present
      res.sendStatus(409);
    } else {
      // hashing the password and saving it in the database
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error('Error hashing password:\n', err);
          res.sendStatus(500);
        } else {
          await db.query(
            'INSERT INTO users (username, password) VALUES ($1, $2)',
            [username, hash]
          );
          res.sendStatus(200);
        }
      });
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.delete('/api/activeuser/:id', async (req, res) => {
  const userID = parseInt(req.params.id);
  try {
    // delete files' metadeta of the user on server
    await db.query('DELETE FROM files WHERE ownerid = $1', [userID]);
    // delete user data
    const result = await db.query('DELETE FROM active_users WHERE id = $1 RETURNING *', [userID]);
    if (result.rowCount > 0) {
      // user existed
      res.sendStatus(200);
    } else {
      // no such user with given userid was present
      res.sendStatus(404);
    }
  } catch (err) {
    console.error('Error in deleting user');
    console.log(err);
    res.sendStatus(500);
  }
});

app.post('/api/files', (req, res) => {
  const files = req.body.files;
  const id = req.body.clientid;
  files.forEach(async (file) => {
    try {
      await db.query('INSERT INTO files (fileName, ownerID) VALUES ($1, $2)', [file, id]);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });
  res.sendStatus(200);
});

// Start Server
try {
  // const ipaddr = getLocalIpAddress();
  const ipaddr = '127.0.0.1';
  app.listen(port, ipaddr, () => {
    console.log(`Server listening on ${ipaddr}:${port}`);
  });
} catch (error) {
  console.error(error.message);
}
