# Bygge App - Strategic Enhancement Plan
**Version:** 1.0
**Focus:** Roles, Collaboration, Subscriptions, and Internationalization (i18n).

---

## 1. Role-Based Access Control (RBAC) & Hierarchy

We will transition from a single-user model to an **Organization/Workspace** model. This reflects the reality of construction companies where a "Master" (Mester) employs "Journeymen" (Svende) and manages specific sites.

### 1.1 Defined Roles

| Role | Internal ID | Description | Key Permissions |
| :--- | :--- | :--- | :--- |
| **Owner (Mester)** | `admin` | The subscription holder. Owns all data. | • Create/Delete Projects<br>• Manage Team & Roles<br>• Billing & Subscription<br>• View Financials (Budget) |
| **Manager (Formand)** | `manager` | Runs specific projects. | • Create/Edit Tasks<br>• Approve Time Logs<br>• Invite Viewers<br>• Upload Contracts |
| **Worker (Svend)** | `worker` | Executes tasks on-site. | • View Assigned Tasks<br>• Log Hours<br>• Checklists & Punch Lists<br>• **No** Delete access<br>• **No** Budget access |
| **Viewer (Bygherre)** | `viewer` | External stakeholder (Client). | • Read-only access to Timeline<br>• View Handover Reports<br>• **No** Internal comments<br>• **No** Financials |

### 1.2 Implementation Strategy
*   **Data Structure:** Add `organizationId`, `role`, and `permissions[]` to the User profile.
*   **UI Logic:** Create a `<RequirePermission permission="delete_project">` wrapper component to hide/disable buttons based on the logged-in user's role.

---

## 2. Collaboration & Workflow

The goal is to turn the app from a personal tool into a team synchronization engine without cluttering the UI.

### 2.1 The "Assignment" Loop
1.  **Manager** creates a Task ("Mount Windows") and assigns it to **Worker**.
2.  **Worker** receives a Notification (In-app bell + Push).
3.  **Worker** completes the task, uploads a photo via "Punch List" (Quality Assurance), and marks status as "Review".
4.  **Manager** receives notification, reviews the photo, and marks as "Completed".

### 2.2 Shared Source of Truth
*   **Syncing:** Currently, the app uses LocalStorage (offline-first). To enable collaboration, we must implement a sync strategy (e.g., syncing LocalStorage to a cloud DB like Firebase/Supabase when online).
*   **Conflict Resolution:** "Last write wins" for simple fields; Append-only for logs/comments.

---

## 3. Subscription & Monetization

We will adopt a **"Host Pays" (Workspace)** model. This reduces friction for onboarding workers.

### 3.1 Tiers

| Feature | Free (Solo) | Pro (Solo) | Business (Team) |
| :--- | :--- | :--- | :--- |
| **Projects** | 1 Active | Unlimited | Unlimited |
| **Users** | 1 (Self) | 1 (Self) | 5+ Seats |
| **Calculators** | Basic | Advanced (Static/Energy) | All |
| **AI Tokens** | Daily Limit | High Limit | Shared Pool |
| **Reports** | Standard | Branded PDF | Custom + Export |

### 3.2 Gatekeeping Logic
*   **Access Check:** `if (organization.plan === 'free' && projectCount >= 1) return showUpgradeModal();`
*   **Worker Access:** Workers invited to a Business Workspace inherit "Pro" features *within that workspace* but remain "Free" users for their personal projects.

---

## 4. Internationalization (i18n) & Localization

The app will support multiple languages to accommodate diverse workforces in the construction industry.

### 4.1 Target Languages
1.  🇩🇰 **Danish** (Primary/Default)
2.  🇬🇧 **English** (International)
3.  🇸🇪 **Swedish** (Nordic market)
4.  🇳🇴 **Norwegian** (Nordic market)
5.  🇩🇪 **German** (Cross-border workers)
6.  🇫🇷 **French** (Expansion/EU standard)

### 4.2 Implementation Areas

#### A. UI Translation (Static Text)
*   **Technology:** Use a library like `react-i18next`.
*   **Structure:** JSON files for each language (`da.json`, `en.json`, etc.).
    *   *Example:* `nav.projects`: "Projekter" (DA) / "Projects" (EN).
*   **User Preference:** Saved in User Profile settings. Defaults to Browser Language.

#### B. AI Localization (Dynamic Content)
The AI (Gemini) must be context-aware of the user's preferred language.
*   **System Prompt Injection:**
    *   *Current:* "You are a Danish construction expert..."
    *   *New:* "You are a construction expert. The user's language is **[UserLanguage]**. Always reply in **[UserLanguage]**, even if the source material (like BR18) is in Danish."
*   **Regulatory Translation:**
    *   If a Polish worker asks (in English) about a Danish rule, the AI reads the Danish regulation (BR18) and explains it *in English*. This is a high-value feature for mixed teams.

#### C. Data Localization (User Content)
*   *Challenge:* A manager writes a task in Danish: "Monter gips". A German worker sees "Monter gips".
*   *Phase 1 Solution:* Keep user content raw.
*   *Phase 2 Solution:* Add a "Translate" button next to descriptions that uses the AI to translate the specific text block on demand.

### 4.3 Formats & Units
*   **Dates:** Use `Intl.DateTimeFormat` (e.g., DD/MM/YYYY for DK, YYYY-MM-DD for ISO/SE).
*   **Numbers:** Handling decimal commas vs. points (1.200,50 vs 1,200.50).
*   **Units:** The app currently focuses on Metric (m, mm, kg). This remains constant across the selected languages (UK/US would require Imperial toggle, but not in scope yet).

---

## 5. Implementation Roadmap (Phases)

1.  **Foundation:** Setup `i18n` framework and create language JSONs.
2.  **Context:** Update `Gemini Service` to accept language parameters.
3.  **Data Schema:** Update Types to support `Role` and `OrganizationId`.
4.  **UI Updates:** Add Language Switcher in Settings & Permission Guards on buttons.
5.  **Sync:** (Backend task) Implement cloud sync for multi-user collaboration.
