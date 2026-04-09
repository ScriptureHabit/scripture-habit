# 📚 60-Day Mastery Journal: Scripture Habit

Welcome to your 60-day journey to mastering this project! 🚀
Each day, we will learn one specific thing and record it here. By Day 60, you'll be the master of this codebase.

---

## 🗺️ The 60-Day Roadmap

### Phase I: The Skeleton (Architecture & Tooling) - Days 1–10
- [x] **Day 1: High-Level Architecture** (The "Triangle": Frontend, Backend, Database)
- [ ] **Day 2: The UI Stack** (React 19 + Vite 7 + Vanilla CSS)
- [ ] **Day 3: The Backend Stack** (Node.js/Express + Vercel Functions)
- [ ] **Day 4: The Database Stack** (Firestore + Security Rules)
- [ ] **Day 5: Directory Structure Walkthrough** (What lives where and why?)
- [ ] ... (Remaining days will be filled as we progress)

### Phase II: The Data (Days 11–20)
*Coming Soon: Firestore relationships, Types, and Security.*

---

## 📝 Daily Log

### 📅 Day 1: 2026-04-09
**Topic:** The "Triangle" Architecture (How parts talk to each other)

**1. The Players in Action:**
*   **Frontend (The Action):** `src/components/newnote/NewNote.tsx`
    *   Where the user clicks "Submit" (Actual logic is in `hooks/useNoteSubmission.ts`).
*   **API (The Gatekeeper):** `api_internal/routes/messages.ts`
    *   Where the request is received, authenticated (`authenticate`), and validated (`postNoteSchema`).
*   **Backend Service (The Engine):** `api_internal/services/note-service.ts`
    *   Where the database logic, streak calculations, and transactions happen.

**2. How they communicate:**
*   **Frontend → API**: Sends a JSON bundle with your note content.
*   **API → Service**: After passing security checks, the API hands the data to a specialized "Service" class.
*   **Service → Firestore**: The service performs an "atomic write" (all or nothing) to keep the database consistent.

**3. Key Discoveries:**
*   The API isn't just a tunnel; it's a **security checkpoint**.
*   We use **Zod (`postNoteSchema`)** to ensure data quality before it ever touches the database.
*   Real-time sync means we write once to the DB, and the DB tells everyone who needs to know immediately.

**Key Takeaway:**
> "By separating security (API) from business logic (Service), the code stays clean and safe. Action flows 'up' to the server, and data flows 'down' live from Firestore."

---

---
