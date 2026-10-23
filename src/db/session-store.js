const session = require("express-session");

class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.getStmt = db.prepare("SELECT sess, expire FROM sessions WHERE sid = ?");
    this.setStmt = db.prepare(
      "INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire"
    );
    this.destroyStmt = db.prepare("DELETE FROM sessions WHERE sid = ?");
    this.touchStmt = db.prepare("UPDATE sessions SET expire = ? WHERE sid = ?");
    this.purgeStmt = db.prepare("DELETE FROM sessions WHERE expire < ?");
  }

  get(sid, callback) {
    try {
      const row = this.getStmt.get(sid);
      if (!row) {
        return callback(null, null);
      }
      if (row.expire < Date.now()) {
        this.destroyStmt.run(sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.sess));
    } catch (error) {
      return callback(error);
    }
  }

  set(sid, sess, callback) {
    try {
      const expire = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000;
      this.setStmt.run(sid, JSON.stringify(sess), expire);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback) {
    try {
      this.destroyStmt.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sess, callback) {
    try {
      const expire = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 7 * 24 * 60 * 60 * 1000;
      this.touchStmt.run(expire, sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  purgeExpired() {
    this.purgeStmt.run(Date.now());
  }
}

module.exports = { SqliteSessionStore };
