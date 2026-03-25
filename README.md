#  FocusGuard — Fake Effort Detector

**FocusGuard** is a modern, browser-based productivity monitoring application that evaluates whether a user is genuinely working or displaying inactive behavior. It leverages real-time activity tracking to compute a dynamic productivity score and provides intelligent feedback through warnings and visual indicators.

Built with **React (Vite)** and **JavaScript (ES6+)**, the application operates entirely on the client side using browser APIs and localStorage.

---

##  Overview

FocusGuard analyzes user interaction patterns such as typing activity, mouse movement, tab switching, and idle time. Based on these signals, it determines productivity levels and proactively alerts users when inactivity is detected.

This project demonstrates real-time state management, event handling, UI responsiveness, and behavior-driven analytics without relying on a backend.

---

##  Key Features

### 1. Activity Tracking

* Monitors keyboard input via `keydown` events
* Tracks mouse movement activity
* Detects tab visibility changes using `visibilitychange`
* Identifies idle state after 5 seconds of inactivity

---

### 2. Productivity Analysis

* Computes a **productivity score (0–100%)** based on:

  * Typing frequency
  * Ratio of active vs idle time
  * Tab switching behavior
* Categorizes user state:

  * **Highly Productive**
  * **Moderate**
  * **Distracted**

---

### 3. Intelligent Warning System

* Triggers a warning after 5 seconds of inactivity
* Displays a non-intrusive popup notification
* Maintains a persistent warning count
* Escalates after 3 warnings:

  * Displays a critical alert message
  * Switches UI to a **danger state (red theme)**
* Warning data is stored and restored using `localStorage`

---

### 4. Interactive Dashboard

* Real-time visualization of:

  * Typing count
  * Active time
  * Idle time
  * Tab switches
  * Productivity score
  * Warning count
* Includes charts powered by **Recharts / Chart.js**
* Uses modular and reusable UI components

---

### 5. Data Persistence

* All activity metrics and warnings are stored in `localStorage`
* State is restored automatically on reload

---

##  Architecture

The application follows a modular component-based structure:

```
src/
│
├── components/
│   ├── Dashboard.jsx        # Main UI container
│   ├── Tracker.jsx          # Activity tracking logic
│   ├── WarningPopup.jsx     # Warning notifications
│   ├── StatsCard.jsx        # Reusable metric display
│   └── ActivityChart.jsx    # Data visualization
│
├── App.jsx
├── main.jsx
└── styles.css
```

---

##  Technology Stack

* **Frontend Framework:** React (Vite)
* **Language:** JavaScript (ES6+)
* **State Management:** React Hooks (`useState`, `useEffect`)
* **Visualization:** Recharts / Chart.js
* **Browser APIs:**

  * `keydown`
  * `mousemove`
  * `visibilitychange`
* **Storage:** localStorage

---

##  Productivity Scoring Logic

The productivity score is derived from multiple behavioral factors:

* Increased typing activity improves the score
* Higher active time relative to idle time increases efficiency
* Frequent tab switching negatively impacts the score
* Idle periods significantly reduce the score

---

##  Getting Started

### Prerequisites

* Node.js (v16 or higher)
* npm or yarn

---

### Installation

```bash
git clone https://github.com/your-username/FocusGuard.git
cd workpulse
npm install
npm run dev
```

---

##  UI/UX Highlights

* Real-time updates with smooth rendering
* Animated warning popups
* Dynamic color feedback:

  * Green → Productive
  * Yellow → Moderate
  * Red → Distracted
* Progress bar for productivity visualization
* Clean and responsive dashboard layout

---

##  Future Enhancements

* Dark mode support
* Audio alerts for warnings
* Team-based monitoring system
* Backend integration for analytics and reports
* Exportable productivity reports

---

##  Limitations

* Operates only within the browser environment
* Cannot track activity outside the active tab
* Productivity is inferred from behavioral signals, not actual task completion

---

##  Use Cases

* Personal productivity tracking
* Academic project demonstration
* Behavioral analytics research
* Portfolio project for frontend development

---

##  Author

**Mutthuram**

