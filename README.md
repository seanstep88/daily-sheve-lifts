# Fit Step by Step — Free Daily Workout Web App

A clean, mobile-first workout app designed to be hosted for free on **GitHub Pages** (or Netlify/Vercel) and saved directly as an app icon to any iPhone or Android home screen.

---

## 🚀 How to Host It for FREE (in 2 minutes on GitHub)

1. **Create a GitHub Account & Repository**:
   - Go to [GitHub.com](https://github.com) and click **New Repository**.
   - Name it `workout` (or whatever you like) and set it to **Public**.
2. **Upload these files**:
   - Upload `index.html`, `styles.css`, `app.js`, `workout.json`, and `manifest.webmanifest` to the repository.
3. **Turn on GitHub Pages**:
   - In your repo, go to **Settings** → **Pages** (in the left sidebar).
   - Under **Branch**, select `main` (or `master`) and folder `/ (root)`, then click **Save**.
   - In ~30 seconds, GitHub gives you a live link: `https://<your-username>.github.io/<repo-name>/`.

---

## 📱 How to Add It as a Phone App (No App Store needed)

### On iPhone (Safari):
1. Open your link in Safari.
2. Tap the **Share** button (the square with the arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. It will now appear on your home screen with a custom icon, opening full screen like a native app.

### On Android (Chrome):
1. Open your link in Chrome.
2. Tap the **Three Dots (⋮)** in the top right.
3. Tap **"Add to Home screen"** or **"Install app"**.

---

## 🔄 How to Update the Daily Workout

### Method 1: In the Browser (Fastest)
1. Open the website on your phone or computer.
2. Tap the **"✏️ Edit Workout"** button at the top right.
3. Fill in:
   - **Workout Label & Sets** (e.g., *Chest & Triceps | 4 Sets*)
   - **Exercises in order** with rep targets, seconds rest, and any image/GIF link (from Giphy, Imgur, Tenor, or Unsplash).
4. Tap **"💾 Save & Preview Live"**.
5. Tap **"📥 Download workout.json"** and upload the file to your GitHub repository so your friends see the exact same update!

### Method 2: Edit `workout.json` Directly on GitHub
1. Go to your GitHub repository.
2. Click [`workout.json`](workout.json:1).
3. Click the **Pencil (Edit)** icon, paste in today's exercises, and click **Commit changes**.
4. Everyone's phone updates automatically.

---

## 💡 Finding Exercise GIFs
You can paste any direct GIF or image URL into the exercise media field:
- **Giphy**: Search exercise → Click GIF → Share → Copy GIF Link (e.g., `https://media.giphy.com/media/.../giphy.gif`)
- **Imgur / Tenor / Cloudinary**: Direct image links.
