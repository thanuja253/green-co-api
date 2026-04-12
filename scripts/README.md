# MongoDB Upload Scripts

## Quick Start

### Option 1: Use HTML Upload Page (Easiest) 🌐

1. **Open the HTML file in your browser:**
   ```
   scripts/upload-proposal-simple.html
   ```

2. **Get your JWT Token:**
   - Open your frontend app
   - Open browser console (F12)
   - Run: `localStorage.getItem('greenco_token')`
   - Copy the token

3. **Get your Project ID:**
   - From browser console: `localStorage.getItem('greenco_project_id')`
   - Or from Quickview API response

4. **Fill the form and upload!**

---

### Option 2: Use Node.js Script 📜

1. **Install MongoDB driver:**
   ```bash
   npm install mongodb
   ```

2. **Set your MongoDB connection string:**
   ```bash
   # Windows PowerShell
   $env:MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/greenco_db"
   
   # Linux/Mac
   export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/greenco_db"
   ```

3. **Run the script:**
   ```bash
   node scripts/upload-proposal-document.js <projectId> <filePath>
   ```

   **Example:**
   ```bash
   node scripts/upload-proposal-document.js 6994af7e1c64cedc200bd8ca ./proposal.pdf
   ```

---

### Option 3: Direct MongoDB Update 🗄️

See `MONGODB_DIRECT_UPLOAD_GUIDE.md` for detailed MongoDB commands.

---

## Files

- `upload-proposal-document.js` - Node.js script for uploading proposal documents
- `upload-proposal-simple.html` - Simple HTML page for uploading via API
- `MONGODB_DIRECT_UPLOAD_GUIDE.md` - Complete guide for all methods

---

## What Gets Updated

When you upload a proposal document:

1. ✅ File copied to `uploads/proposals/{projectId}/`
2. ✅ `companyprojects.proposal_document` field updated
3. ✅ Milestone 3 logged: "CII Uploaded Proposal Document"
4. ✅ `next_activities_id` updated to 4
5. ✅ Company `reg_id` generated if missing
6. ✅ Notification created

---

## Troubleshooting

### Script can't connect to MongoDB
- Check your `MONGODB_URI` environment variable
- Make sure your IP is whitelisted in MongoDB Atlas
- Verify your connection string includes the database name

### File not found error
- Use absolute path: `C:\path\to\file.pdf`
- Or relative path from project root: `./proposal.pdf`

### Permission denied
- Make sure `uploads/proposals/` directory is writable
- On Windows, run as administrator if needed

---

## Local company / admin UI + Nest API (ports 3001 vs 3002)

The Nest app listens on **`PORT`** (default **3019** in `src/main.ts`, unless you set `PORT=3001`).

If the browser shows **`http://localhost:3002/...`** but API calls go to **`http://localhost:3002/api/...`**, those requests hit the **Next.js server on 3002**, not Nest, unless you add a **rewrite/proxy** to Nest.

**Fix:** In the **frontend** repo `next.config.js` (or env), proxy API traffic to Nest, for example:

```js
// next.config.js — rewrites (example)
async rewrites() {
  const api = process.env.NEST_API_URL || 'http://localhost:3019';
  return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
}
```

Set **`NEST_API_URL=http://localhost:3001`** (or whatever port you run Nest on). Then “use 3001” means: **Nest listens on 3001**, and **Next must forward `/api/*` to that host**.

Launch & Training read endpoints on this backend:

- `GET /api/admin/projects/:id/launch-training-program` (canonical)
- `GET /api/admin/projects/:id/launch-training` (same JSON, alias)

Quickview (open, no company JWT): `GET /api/company/projects/:id/quickview`

---

**Choose the method that works best for you!** ✅
