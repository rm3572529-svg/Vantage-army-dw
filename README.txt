════════════════════════════════════════════════
  VANTAGE DOWNLOAD SITE
  Professional Google Drive Link Converter
  Version 1.0.0
════════════════════════════════════════════════

OVERVIEW
--------
VantageDown converts Google Drive public sharing links into clean,
professional download pages with direct download buttons, QR codes,
analytics, and more.

No file hosting. No size limits. Just clean links.


FILES INCLUDED
--------------
  index.html        → Main homepage with link generator
  download.html     → Download page (shown to file recipients)
  login.html        → Sign In / Register page
  dashboard.html    → User dashboard (links, analytics, profile)
  admin.html        → Admin panel (hidden, role-protected)
  server.html       → Developer/deployment documentation
  manufacturer.html → About developer page
  terms.html        → Terms of Service
  privacy.html      → Privacy Policy
  contact.html      → Contact page with form & FAQ
  style.css         → All site styles (single unified CSS)
  app.js            → Core application logic
  firebase.js       → Firebase config & all DB helpers
  robots.txt        → Search engine crawler rules
  sitemap.xml       → SEO sitemap
  README.txt        → This file


QUICK START
-----------
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database and Authentication
3. Enable Google and Email/Password auth providers
4. Open firebase.js and fill in your FIREBASE_CONFIG object
5. Upload all files to any static web host
6. Register an account, then set role="admin" in Firestore manually
7. Access the admin panel at /admin.html


FIREBASE SETUP
--------------
In firebase.js, replace FIREBASE_CONFIG with values from:
Firebase Console → Project Settings → Your apps → Web app → Config

Required Firestore Collections:
  users    → User profiles (auto-created on registration)
  links    → Generated links (auto-created when user generates a link)
  config   → Site settings (created when admin saves settings)


ADMIN PANEL
-----------
URL: /admin.html (can be renamed for extra security)

Protected by Firebase role-based access. You MUST:
  1. Register an account via the normal login page
  2. Go to Firestore Console → users → your UID document
  3. Change role field from "user" to "admin"
  4. Refresh and visit /admin.html

Admin capabilities:
  - View all users and manage roles
  - View all generated links and delete them
  - Toggle social unlock system ON/OFF
  - Toggle direct downloads ON/OFF
  - Toggle monetization (AdSense) ON/OFF
  - Set YouTube, Instagram, WhatsApp links
  - View site-wide analytics


USER SYSTEM
-----------
  Free users:   25 links
  After social tasks: 75 links total (+50 bonus)
  Admin users:  Unlimited links


SOCIAL TASK SYSTEM
------------------
When enabled by admin, users must complete 3 tasks before downloading:
  1. Subscribe on YouTube
  2. Follow on Instagram
  3. Join WhatsApp group

Tasks are verified client-side (honor system). Links are configured
by the admin via the Admin Panel → Social Tasks tab.

When disabled by admin: download starts instantly with no tasks.


GOOGLE DRIVE COMPATIBILITY
--------------------------
Supported link formats:
  https://drive.google.com/file/d/FILE_ID/view
  https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  https://drive.google.com/open?id=FILE_ID
  https://docs.google.com/...

Files MUST be set to "Anyone with the link can view" in Google Drive.


DEPLOYMENT OPTIONS
------------------
  Firebase Hosting  → firebase deploy (recommended)
  Netlify           → Drag & drop the folder
  Vercel            → Connect GitHub repo
  GitHub Pages      → Push to gh-pages branch
  Any web server    → Upload files via FTP/SFTP


SEO
---
  robots.txt  → Blocks admin/server pages from indexing
  sitemap.xml → Update domain name from vantagedown.com to yours
  Meta tags   → Already included in all pages


CUSTOMIZATION
-------------
  Colors:       Edit CSS variables in :root block in style.css
  Social links: Set via Admin Panel → Social Tasks
  Site name:    Find/replace "VantageDown" across HTML files
  Domain:       Update sitemap.xml with your real domain
  AdSense:      Replace .ad-slot divs with your AdSense code


SECURITY NOTES
--------------
  - Firestore Security Rules are required (see server.html)
  - Rate limiting is implemented client-side (10 requests/minute)
  - Admin access is enforced server-side via Firestore role check
  - All sensitive actions require authenticated session


SUPPORT
-------
  Contact: support@vantagedown.com
  Docs:    /server.html
  About:   /manufacturer.html


LICENSE
-------
  This project is provided for personal and commercial use.
  Modify and deploy freely. Attribution appreciated but not required.

════════════════════════════════════════════════
  Built with HTML5 · CSS3 · Firebase · Vanilla JS
════════════════════════════════════════════════
