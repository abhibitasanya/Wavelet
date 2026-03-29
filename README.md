# 🎵 Wavelet — Music Streaming Web App

Wavelet is a Spotify-inspired music streaming web application that allows users to discover, play, and manage music seamlessly.
It integrates with the Jamendo API to stream global tracks and delivers a smooth, responsive user experience.

---

## 🌐 Live Demo

👉 https://wavelet-music.netlify.app

---

## ✨ Features

* 🎧 Stream global music using Jamendo API
* ⏯ Play, Pause, Next, Previous controls
* 🔍 Smart search (case-insensitive, supports spaces)
* ❤️ Like songs and manage favorites
* 📂 Create and manage playlists
* 📱 Fully responsive UI

---

## 🛠 Tech Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Frontend   | HTML, CSS, JavaScript                |
| Backend    | Python (Flask), Gunicorn             |
| API        | Jamendo Music API                    |
| Deployment | Netlify (Frontend), Render (Backend) |

---

## 📁 Project Structure

client/   → Frontend (UI & interactions)
server/   → Backend (API & logic)

---

## ⚙️ Run Locally

### 1. Clone the repository

git clone https://github.com/abhibitasanya/Wavelet.git
cd Wavelet

### 2. Start backend

cd server
pip install -r requirements.txt
python app.py

### 3. Run frontend

cd ../client
Open index.html in your browser

---

## 🔗 How It Works

User → Frontend → Backend → Jamendo API

The frontend sends requests to the backend, which processes them and fetches music data from the API before returning it to the UI.

---

## 💡 Notes

* Backend runs in the background and is connected internally
* Only the frontend link is exposed for users
* Data files are included to ensure the project runs smoothly

---

## 🚀 Future Improvements

* 🔐 User authentication
* 🎯 Personalized recommendations
* ☁️ Cloud database integration
* 🎨 UI/UX enhancements

---

## 👨‍💻 Author

Developed as a full-stack project demonstrating frontend, backend, and API integration skills.
