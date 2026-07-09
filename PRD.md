# Product Requirements Document (PRD)
## BillingSys: DHA Phase 5 App

**Document Version:** 1.0
**Product Name:** BillingSys (DHA Phase 5 Lift & Billing Application)
**Target Platform:** Web (Desktop & Mobile, PWA supported)

---

## 1. Introduction

### 1.1 Purpose
BillingSys is a comprehensive internal management application designed specifically for DHA Phase 5. Its primary purpose is to digitize and streamline the generation of monthly utility and service bills (General and Lift expenses), securely track payment receipts, and manage building-wide expense configurations across multiple floors.

### 1.2 Target Audience
*   **System Administrators (Admins):** Personnel responsible for defining global settings, managing expense limits, user accounts, and overseeing all generated documents and logs.
*   **Standard Users (Staff/Residents):** Individuals tasked with generating floor-specific bills, uploading payment receipts, and tracking their own generated historical data.

---

## 2. Core Features & Functions

### 2.1 Authentication & Security
*   **PIN-Based Login:** Users authenticate using a Username and a secure 4-digit PIN.
*   **Role-Based Access Control (RBAC):** The system strictly enforces 'admin' and 'user' roles. Admins have global access to all settings, logs, and billing history. Regular users are restricted to their own billing history and generation tools.
*   **Auto-Logout / Session Expiry:** To ensure security on shared devices, user sessions automatically expire.

### 2.2 Dashboard
*   **Quick Metrics:** Displays total bills generated, recent activity, system messages, and quick actions based on user roles.
*   **Global Messaging:** Displays a "Dashboard Message" set by Admins to broadcast important updates (e.g., "Electricity rates updated for June").
*   **Visual Analytics:** Interactive charts indicating expense trends and billing categories over time.

### 2.3 General Bill Generation
*   **Floor & Date Selection:** Generates bills tied to specific floors, tracking billing month/year and specific due dates.
*   **Dynamic Categories:** Automatically populates expense lines (e.g., Water, Guard Salary, Garbage) based on Admin configurations.
*   **Diesel Month Control:** Specific expense categories (like Generator Diesel) automatically appear only during authorized months (e.g., May to August) as defined by the Admin.
*   **Expense Limits & Additions:** Users specify amounts constrained by global limits. Additional, unpredicted expenses can be added as custom line items (Pending/Approved).

### 2.4 Lift Bill Generation
*   **Specialized Lift Expenses:** A dedicated billing tool for Lift-specific maintenance and operations (e.g., Lift Maintenance, Parts, Operations).
*   **Floor Targetting:** Like general bills, these can be targeted to specific floors to distribute costs accurately.

### 2.5 Receipt Management
*   **Payment Tracking:** Users can upload digital copies (images/PDFs) of payment receipts.
*   **Categorization:** Receipts are tagged by Category, Floor, and Date Paid.
*   **Cloud Storage:** Encoded securely in base64 within Firestore to prevent data loss. 

### 2.6 History & PDF Export
*   **Historical Ledger:** A complete index of all previously generated bills. Admins see all bills, users see only what they generated.
*   **PDF Generation:** Immediate generation of professional PDF invoices/bills styled for print, detailing expenses, generated dates, and due dates.
*   **Document Editing:** Admins can edit previously generated bills (modifying line items and amounts) to correct human error without generating new documents.

### 2.7 Analytics & Reporting
*   **Data Visualization:** Incorporates `recharts` for bar charts and pie charts indicating spending distributions.
*   **Aggregations:** Calculates monthly and categorised financial totals across general and lift systems.

---

## 3. Administrative Panel (System Settings)

The Admin Page acts as the operational brain of the application. It includes:

### 3.1 Global Restrictions
*   **Max Bills Control:** Hard limit on the number of bills a user can generate per month per type to prevent spam/duplicate billing.
*   **Diesel Months Toggle:** Defines which months are "Diesel Active", automatically enabling specific expense categories across the system.
*   **Payment Methods:** Centrally defines accepted payment methods (e.g., "M. Zafar - EasyPaisa").

### 3.2 Floor Management
*   **Dynamic Floor Generation:** Admins can add, rename, or delete floors (e.g., "Ground Floor", "First Floor", "Basement").

### 3.3 Expense Category Management
*   **Dual Ledgers:** Separate administration for General Categories and Lift Categories.
*   **Granular Toggles:**
    *   **Title & Hard Limits:** Set maximum rupee amounts per category per month.
    *   **Enabled Status:** Instantly activate or deactivate legacy categories.
    *   **Floor Targeting:** *[New Feature]* Restrict specific expenses so they only apply to selected floors.
    *   **Diesel Flag:** Marks an expense as bound to the "Diesel Months" schedule.

### 3.4 Activity Logs
*   **Audit Trail:** Secure, immutable tracking of user actions including LOGINS, LOGOUTS, BILL_GENERATED events, and system edits.

---

## 4. Technical Architecture & Constraints

### 4.1 Technology Stack
*   **Frontend Framework:** React 18+ (Vite).
*   **Styling:** Tailwind CSS (Utility-first, responsive, dark/light mode enabled).
*   **Database & Backend:** Firebase / Cloud Firestore (NoSQL cloud persistence).
*   **State Management:** React hooks combined with a custom `store.ts` for unified schemas and local caching.
*   **PDF Generation:** Client-side generation utilizing `jspdf` and `jspdf-autotable`.

### 4.2 Data Models & Structure
The system relies on denormalized data collections optimized for fast reads:
1.  **Users:** Tracks login credentials and RBAC.
2.  **Settings:** Global configurations synced across all clients via snapshot listeners.
3.  **Bills:** Historical snapshots of generated invoices.
4.  **Receipts:** Uploaded proof of payments.
5.  **Activity Logs:** Rolling chronological events.

### 4.3 Restrictions & Hard Constraints
1.  **Container Port Restrictions:** The preview environment is strictly sandboxed. Vite runs on `0.0.0.0` over Port `3000`.
2.  **Strict Typing:** The codebase enforces rigorous TypeScript interfaces. Partial or malformed updates to Firestore will drop.
3.  **Client-Side Realtime Sync:** Utilizes Firestore `onSnapshot` for instantaneous, real-time GUI updates when Admins modify settings or limits.

---

## 5. User Interface (UI) & Design Philosophy

*   **Aesthetics:** Modern, "glassmorphism" aesthetic with a primary focus on clean typography (Inter/Space Grotesk) and high-contrast readable elements.
*   **Fluid Responsiveness:** Entirely mobile responsive. On mobile devices, data tables switch to stacked views and interactive elements (touch targets) expand dynamically.
*   **Animations:** Powered by `framer-motion` (via `motion/react`), providing subtle entrance animations, modal drops, and transition feedback.
*   **Progressive Web App (PWA):** Installs securely on iOS/Android home screens acting as a native-feel application with caching benefits.

---
*Generated by AI Studio*
