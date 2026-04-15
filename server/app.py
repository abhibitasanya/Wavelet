import os
import sqlite3
import time
from datetime import datetime

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired


app = Flask(__name__)
from flask_cors import CORS

CORS(app, resources={r"/api/*": {"origins": [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://wavelet-music.netlify.app"
    "https://wavelet-6qht.onrender.com"
]}})


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "wavelet.db")

# ------------ CONFIG ------------
SECRET_KEY = os.getenv("WAVELET_SECRET_KEY", "wavelet_dev_secret_change_me")
TOKEN_EXPIRES_SECONDS = 60 * 60 * 24 * 7  # 7 days

JAMENDO_CLIENT_ID = os.getenv("JAMENDO_CLIENT_ID", "d25ddb4e")
JAMENDO_BASE = "https://api.jamendo.com/v3.0"

serializer = URLSafeTimedSerializer(SECRET_KEY)

# --------- tiny in-memory cache ----------
CACHE = {}
CACHE_TTL_SECONDS = 60


def cache_get(key):
    item = CACHE.get(key)
    if not item:
        return None
    expires_at, data = item
    if time.time() > expires_at:
        CACHE.pop(key, None)
        return None
    return data


def cache_set(key, data, ttl=CACHE_TTL_SECONDS):
    CACHE[key] = (time.time() + ttl, data)


# ---------------- DB ----------------
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    conn = db()
    cur = conn.cursor()

    # USERS
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
    """)

    # USER LIKES (per-user)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_likes (
      user_id INTEGER NOT NULL,
      track_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, track_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # USER PLAYLISTS (per-user)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)

    # PLAYLIST TRACKS (per-user playlists)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS user_playlist_tracks (
      playlist_id INTEGER NOT NULL,
      track_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      PRIMARY KEY (playlist_id, track_id),
      FOREIGN KEY (playlist_id) REFERENCES user_playlists(id) ON DELETE CASCADE
    )
    """)

    conn.commit()
    conn.close()


# --------- AUTH HELPERS ----------
def make_token(user_id: int, username: str):
    return serializer.dumps({"uid": int(user_id), "u": username})


def read_token(token: str):
    return serializer.loads(token, max_age=TOKEN_EXPIRES_SECONDS)


def get_bearer_token():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return auth.split(" ", 1)[1].strip()


def require_user():
    token = get_bearer_token()
    if not token:
        return None
    try:
        payload = read_token(token)
        uid = payload.get("uid")
        if not uid:
            return None
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT id, username FROM users WHERE id = ?", (int(uid),))
        user = cur.fetchone()
        conn.close()
        return user
    except (BadSignature, SignatureExpired):
        return None
    except Exception:
        return None


# --------- JAMENDO HELPERS ----------
def jamendo_request(endpoint, params):
    params = dict(params or {})
    params["client_id"] = JAMENDO_CLIENT_ID
    params["format"] = "json"
    url = f"{JAMENDO_BASE}/{endpoint}"
    try:
        r = requests.get(url, params=params, timeout=20)
        data = r.json()
        if "headers" in data and isinstance(data["headers"], dict):
            if data["headers"].get("status") == "failed":
                return None, {
                    "error": "Jamendo request failed",
                    "jamendo_headers": data.get("headers"),
                    "hint": "Your JAMENDO_CLIENT_ID may be invalid/unapproved or rate-limited."
                }
        return data, None
    except Exception as e:
        return None, {"error": "Jamendo fetch failed", "details": str(e)}


def normalize_track(t):
    return {
        "id": str(t.get("id", "")),
        "title": t.get("name") or "",
        "artist": t.get("artist_name") or "",
        "audio_url": t.get("audio") or "",
        "cover_url": (t.get("album_image") or t.get("image") or ""),
        "duration": t.get("duration"),
        "album": t.get("album_name") or "",
        "tags": t.get("tags") or ""
    }


# ---------------- BASIC ----------------
@app.get("/health")
def health():
    return jsonify({"ok": True})


# ---------------- AUTH ----------------
@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    pw_hash = generate_password_hash(password)

    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users(username, password_hash, created_at) VALUES (?, ?, ?)",
            (username, pw_hash, datetime.utcnow().isoformat())
        )
        conn.commit()
        uid = cur.lastrowid
        conn.close()

        token = make_token(uid, username)
        return jsonify({"ok": True, "token": token, "user": {"id": str(uid), "username": username}})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Username already exists"}), 400


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()

    conn = db()
    cur = conn.cursor()
    cur.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,))
    user = cur.fetchone()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    token = make_token(user["id"], user["username"])
    return jsonify({"ok": True, "token": token, "user": {"id": str(user["id"]), "username": user["username"]}})


@app.get("/api/auth/me")
def me():
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"ok": True, "user": {"id": str(user["id"]), "username": user["username"]}})


# ---------------- SONGS ----------------
@app.get("/api/songs")
def api_songs():
    limit = int(request.args.get("limit", 30))
    offset = int(request.args.get("offset", 0))
    order = request.args.get("order", "popularity_total")

    cache_key = f"songs:{limit}:{offset}:{order}"
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    data, err = jamendo_request("tracks", {
        "limit": limit,
        "offset": offset,
        "order": order,
        "audioformat": "mp31"
    })
    if err:
        return jsonify(err), 400

    out = [normalize_track(t) for t in (data.get("results", []) if data else [])]
    cache_set(cache_key, out)
    return jsonify(out)


@app.get("/api/songs/search")
def api_songs_search():
    q = (request.args.get("q") or "").strip()
    limit = int(request.args.get("limit", 30))
    offset = int(request.args.get("offset", 0))
    if not q:
        return jsonify([])

    cache_key = f"search:{q.lower()}:{limit}:{offset}"
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    data, err = jamendo_request("tracks", {
        "search": q,
        "limit": limit,
        "offset": offset,
        "audioformat": "mp31"
    })
    if err:
        return jsonify(err), 400

    out = [normalize_track(t) for t in (data.get("results", []) if data else [])]
    cache_set(cache_key, out)
    return jsonify(out)


# ---------------- LIKES (PER USER) ----------------
@app.get("/api/likes")
def get_likes():
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = db()
    cur = conn.cursor()
    cur.execute(
        "SELECT track_id FROM user_likes WHERE user_id = ? ORDER BY created_at DESC",
        (int(user["id"]),)
    )
    rows = cur.fetchall()
    conn.close()
    return jsonify([row["track_id"] for row in rows])


@app.post("/api/likes/<track_id>")
def like_track(track_id):
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = db()
    cur = conn.cursor()
    cur.execute(
        "INSERT OR IGNORE INTO user_likes(user_id, track_id, created_at) VALUES (?, ?, ?)",
        (int(user["id"]), str(track_id), datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.delete("/api/likes/<track_id>")
def unlike_track(track_id):
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = db()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM user_likes WHERE user_id = ? AND track_id = ?",
        (int(user["id"]), str(track_id))
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------------- PLAYLISTS (PER USER) ----------------
def playlist_tracks(conn, playlist_id: int):
    cur = conn.cursor()
    cur.execute(
        "SELECT track_id FROM user_playlist_tracks WHERE playlist_id = ? ORDER BY added_at DESC",
        (playlist_id,)
    )
    return [row["track_id"] for row in cur.fetchall()]


@app.get("/api/playlists")
def get_playlists():
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, name FROM user_playlists WHERE user_id = ? ORDER BY created_at DESC",
        (int(user["id"]),)
    )
    pls = cur.fetchall()

    out = []
    for p in pls:
        pid = int(p["id"])
        out.append({"id": str(pid), "name": p["name"], "tracks": playlist_tracks(conn, pid)})

    conn.close()
    return jsonify(out)


@app.post("/api/playlists")
def create_playlist():
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Playlist name required"}), 400

    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO user_playlists(user_id, name, created_at) VALUES (?, ?, ?)",
            (int(user["id"]), name, datetime.utcnow().isoformat())
        )
        conn.commit()
        pid = str(cur.lastrowid)
        conn.close()
        return jsonify({"ok": True, "id": pid, "name": name})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Playlist name already exists"}), 400


@app.patch("/api/playlists/<playlist_id>")
def rename_playlist(playlist_id):
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "New name required"}), 400

    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE user_playlists SET name = ? WHERE id = ? AND user_id = ?",
            (name, int(playlist_id), int(user["id"]))
        )
        conn.commit()
        if cur.rowcount == 0:
            conn.close()
            return jsonify({"error": "Playlist not found"}), 404
        conn.close()
        return jsonify({"ok": True})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Playlist name already exists"}), 400


@app.delete("/api/playlists/<playlist_id>")
def delete_playlist(playlist_id):
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = db()
    cur = conn.cursor()

    cur.execute("SELECT id FROM user_playlists WHERE id = ? AND user_id = ?", (int(playlist_id), int(user["id"])))
    if cur.fetchone() is None:
        conn.close()
        return jsonify({"error": "Playlist not found"}), 404

    cur.execute("DELETE FROM user_playlist_tracks WHERE playlist_id = ?", (int(playlist_id),))
    cur.execute("DELETE FROM user_playlists WHERE id = ? AND user_id = ?", (int(playlist_id), int(user["id"])))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.post("/api/playlists/<playlist_id>/tracks/<track_id>")
def add_track_to_playlist(playlist_id, track_id):
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM user_playlists WHERE id = ? AND user_id = ?", (int(playlist_id), int(user["id"])))
    if cur.fetchone() is None:
        conn.close()
        return jsonify({"error": "Playlist not found"}), 404

    cur.execute(
        "INSERT OR IGNORE INTO user_playlist_tracks(playlist_id, track_id, added_at) VALUES (?, ?, ?)",
        (int(playlist_id), str(track_id), datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.delete("/api/playlists/<playlist_id>/tracks/<track_id>")
def remove_track_from_playlist(playlist_id, track_id):
    user = require_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    conn = db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM user_playlists WHERE id = ? AND user_id = ?", (int(playlist_id), int(user["id"])))
    if cur.fetchone() is None:
        conn.close()
        return jsonify({"error": "Playlist not found"}), 404

    cur.execute(
        "DELETE FROM user_playlist_tracks WHERE playlist_id = ? AND track_id = ?",
        (int(playlist_id), str(track_id))
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

