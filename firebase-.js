// ============================================
// VANTAGE DOWNLOAD SITE - firebase.js
// Firebase v9 Compat SDK (CDN-loaded)
// ============================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCynjRnayg2lCHCBDrLNhw8zREwswVifMg",
  authDomain:        "vantage-share.firebaseapp.com",
  databaseURL:       "https://vantage-share-default-rtdb.firebaseio.com",
  projectId:         "vantage-share",
  storageBucket:     "vantage-share.firebasestorage.app",
  messagingSenderId: "670971388059",
  appId:             "1:670971388059:web:c9fa7089671543092a263e"
};

// ── Initialize ──────────────────────────────────
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── Enable Offline Persistence (fixes "client is offline" error) ──
db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
  if (err.code === 'failed-precondition') {
    console.warn('[Vantage] Offline persistence: multiple tabs open, disabled for this tab.');
  } else if (err.code === 'unimplemented') {
    console.warn('[Vantage] Offline persistence not supported in this browser.');
  }
});

// ── Set Firestore network timeout settings ──
db.settings({ experimentalForceLongPolling: true, merge: true });

// ── Collection References ───────────────────────
const USERS_COL  = "users";
const LINKS_COL  = "links";
const CONFIG_COL = "config";

// ══════════════════════════════════════════════════
// AUTH HELPERS
// ══════════════════════════════════════════════════
const Auth = {
  async signInGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    await Auth._ensureUserDoc(result.user);
    return result.user;
  },
  async signInEmail(email, password) {
    const result = await auth.signInWithEmailAndPassword(email, password);
    return result.user;
  },
  async registerEmail(email, password, displayName) {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName });
    await Auth._ensureUserDoc(result.user, displayName);
    return result.user;
  },
  async signOut() {
    await auth.signOut();
    window.location.href = "index.html";
  },
  async resetPassword(email) {
    await auth.sendPasswordResetEmail(email);
  },
  async _ensureUserDoc(user, displayName) {
    const ref = db.collection(USERS_COL).doc(user.uid);
    // Retry up to 3 times in case of connectivity issues
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const snap = await ref.get();
        if (!snap.exists) {
          await ref.set({
            uid:         user.uid,
            email:       user.email,
            displayName: displayName || user.displayName || "User",
            photoURL:    user.photoURL || null,
            role:        "user",
            linksUsed:   0,
            linksLimit:  25,
            socialDone:  false,
            createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin:   firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          await ref.update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() });
        }
        return; // success, exit retry loop
      } catch (err) {
        console.warn(`[Vantage] _ensureUserDoc attempt ${attempt} failed:`, err.message);
        if (attempt === 3) throw err; // throw on final attempt
        await new Promise(r => setTimeout(r, 1000 * attempt)); // wait 1s, 2s
      }
    }
  },
  async getProfile(uid) {
    try {
      // Try server first for fresh data, fall back to cache
      const snap = await db.collection(USERS_COL).doc(uid).get({ source: 'server' });
      return snap.exists ? snap.data() : null;
    } catch (err) {
      // If server fetch fails (offline), try cache
      try {
        const snap = await db.collection(USERS_COL).doc(uid).get({ source: 'cache' });
        return snap.exists ? snap.data() : null;
      } catch (cacheErr) {
        console.error('[Vantage] getProfile failed:', cacheErr.message);
        return null;
      }
    }
  },
  async isAdmin(uid) {
    const profile = await Auth.getProfile(uid);
    return profile?.role === "admin";
  },
  onAuthChange(callback) {
    return auth.onAuthStateChanged(callback);
  }
};

// ══════════════════════════════════════════════════
// LINKS HELPERS
// ══════════════════════════════════════════════════
const Links = {
  _shortId(len = 8) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  },
  _toDirect(url) {
    let fileId = null;
    const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) fileId = m1[1];
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) fileId = m2[1];
    const m3 = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
    if (m3) fileId = m3[1];
    if (!fileId) return null;
    return {
      fileId,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      previewUrl:  `https://drive.google.com/file/d/${fileId}/preview`,
      viewUrl:     `https://drive.google.com/file/d/${fileId}/view`
    };
  },
  _validateGDrive(url) {
    return url.includes("drive.google.com") || url.includes("docs.google.com");
  },
  async create(uid, gdriveUrl, options = {}) {
    if (!Links._validateGDrive(gdriveUrl)) throw new Error("Invalid Google Drive URL");
    const parsed = Links._toDirect(gdriveUrl);
    if (!parsed) throw new Error("Could not extract file ID from link");
    const profile = await Auth.getProfile(uid);
    if (profile.role !== "admin") {
      if (profile.linksUsed >= profile.linksLimit) {
        throw new Error("Link limit reached. Complete social tasks to unlock more.");
      }
    }
    const shortId = options.customId || Links._shortId();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const linkData = {
      shortId,
      uid,
      gdriveUrl,
      fileId:      parsed.fileId,
      downloadUrl: parsed.downloadUrl,
      previewUrl:  parsed.previewUrl,
      fileName:    options.fileName || "File",
      fileSize:    options.fileSize || "Unknown",
      fileType:    options.fileType || "file",
      clicks:      0,
      downloads:   0,
      createdAt:   now,
      active:      true
    };
    const batch  = db.batch();
    const linkRef = db.collection(LINKS_COL).doc(shortId);
    batch.set(linkRef, linkData);
    if (profile.role !== "admin") {
      const userRef = db.collection(USERS_COL).doc(uid);
      batch.update(userRef, { linksUsed: firebase.firestore.FieldValue.increment(1) });
    }
    await batch.commit();
    return linkData;
  },
  async get(shortId) {
    const snap = await db.collection(LINKS_COL).doc(shortId).get();
    return snap.exists ? snap.data() : null;
  },
  async getUserLinks(uid) {
    const snap = await db.collection(LINKS_COL)
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return snap.docs.map(d => d.data());
  },
  async trackClick(shortId, type = "click") {
    const ref   = db.collection(LINKS_COL).doc(shortId);
    const field = type === "download" ? "downloads" : "clicks";
    await ref.update({ [field]: firebase.firestore.FieldValue.increment(1) });
    const statsRef = db.collection(CONFIG_COL).doc("global_stats");
    await statsRef.set({
      [field]:     firebase.firestore.FieldValue.increment(1),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },
  async delete(shortId, uid) {
    const link    = await Links.get(shortId);
    if (!link)    throw new Error("Link not found");
    const profile = await Auth.getProfile(uid);
    if (link.uid !== uid && profile.role !== "admin") throw new Error("Unauthorized");
    await db.collection(LINKS_COL).doc(shortId).delete();
  },
  async adminGetAll(limitN = 50) {
    const snap = await db.collection(LINKS_COL)
      .orderBy("createdAt", "desc")
      .limit(limitN)
      .get();
    return snap.docs.map(d => d.data());
  }
};

// ══════════════════════════════════════════════════
// CONFIG / ADMIN SETTINGS
// Default social links are pre-filled with your accounts
// ══════════════════════════════════════════════════
const Config = {
  _ref: () => db.collection(CONFIG_COL).doc("settings"),
  async get() {
    const snap = await Config._ref().get();
    if (!snap.exists) {
      return {
        socialUnlockEnabled:   true,
        directDownloadEnabled: true,
        monetizationEnabled:   true,
        youtubeLink:   "https://youtube.com/@vantageytgamer?si=qODPsiPXp9wz6ZPp",
        instagramLink: "https://www.instagram.com/vantageytgamer?igsh=MmpweW00enVha2V3",
        whatsappLink:  "https://whatsapp.com/channel/0029Vb6ZkXmJ3jv1PQ6CZs33",
        siteTitle:     "Vantage Download",
        siteTagline:   "Fast, free file sharing"
      };
    }
    return snap.data();
  },
  async update(data) {
    await Config._ref().set(data, { merge: true });
  }
};

// ══════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════
const Analytics = {
  async getGlobal() {
    const snap = await db.collection(CONFIG_COL).doc("global_stats").get();
    return snap.exists ? snap.data() : { clicks: 0, downloads: 0 };
  },
  async getTotalUsers() {
    const snap = await db.collection(USERS_COL).get();
    return snap.size;
  },
  async getTotalLinks() {
    const snap = await db.collection(LINKS_COL).get();
    return snap.size;
  },
  async getTopLinks(limitN = 10) {
    const snap = await db.collection(LINKS_COL)
      .orderBy("downloads", "desc")
      .limit(limitN)
      .get();
    return snap.docs.map(d => d.data());
  }
};

// ══════════════════════════════════════════════════
// SOCIAL TASKS
// ══════════════════════════════════════════════════
const Social = {
  async markDone(uid) {
    const userRef = db.collection(USERS_COL).doc(uid);
    await userRef.update({ socialDone: true, linksLimit: 75 });
  },
  async getStatus(uid) {
    const profile = await Auth.getProfile(uid);
    return {
      done:      profile?.socialDone || false,
      linksUsed: profile?.linksUsed  || 0,
      limit:     profile?.linksLimit || 25
    };
  }
};

// ══════════════════════════════════════════════════
// ADMIN USER MANAGEMENT
// ══════════════════════════════════════════════════
const Admin = {
  async getAllUsers(limitN = 100) {
    const snap = await db.collection(USERS_COL)
      .orderBy("createdAt", "desc")
      .limit(limitN)
      .get();
    return snap.docs.map(d => d.data());
  },
  async setRole(uid, role) {
    await db.collection(USERS_COL).doc(uid).update({ role });
  },
  async resetUserLinks(uid) {
    await db.collection(USERS_COL).doc(uid).update({ linksUsed: 0 });
  },
  async deleteUser(uid) {
    const snap = await db.collection(LINKS_COL).where("uid", "==", uid).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection(USERS_COL).doc(uid));
    await batch.commit();
  }
};

window.VantageDB = { Auth, Links, Config, Analytics, Social, Admin };
console.log("[Vantage] Firebase initialized — Project: vantage-share");
