const initSqlJs = require('sql.js');

/**
 * VULNERABLE seed database.
 * Same schema/data as the secure app, on purpose — the only difference
 * between the two demos is how queries are built (server.js), not the data.
 */
async function createDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.run(`INSERT INTO users (username, password) VALUES ('admin', 'sup3rSecret!');`);
  db.run(`INSERT INTO users (username, password) VALUES ('alice', 'alicepw123');`);

  db.run(`INSERT INTO comments (author, body, created_at) VALUES
    ('alice', 'Excited to try the new build!', '2026-07-10 09:12'),
    ('bob', 'Looks great so far, nice work team.', '2026-07-10 10:03');`);

  return db;
}

module.exports = { createDb };
