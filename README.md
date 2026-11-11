# SyllabusTrack 🎓 &bull; University Exam & Syllabus Companion

A modern, responsive, and student-focused single-page web application for tracking semester syllabi, lecture slides, tutorial sheets, and daily study targets across university examinations.

Built with **HTML5**, **Tailwind CSS**, and **Vanilla JavaScript** with 100% client-side persistence in `localStorage`.

---

## ✨ Core Features

1. **Step-by-Step Registration Wizard (Page by Page)**:
   - **Step 1: Exam Details** &mdash; Exam title (e.g., Endsem, Midsem, Finals) and optional start date for countdown tracking.
   - **Step 2: Subject Count** &mdash; Interactive counter to specify how many subjects/courses you have.
   - **Step 3: Subject & Course Codes** &mdash; Define subject names, course codes (e.g. `CS201`, `MA201`), and color palettes.
   - **Step 4: Lecture PDFs & Materials** &mdash; Drag-and-drop or upload lecture slide PDFs (parsed client-side using PDF.js for titles and page counts) or type lecture topics manually.
   - **Step 5: Tutorial & Assignment PDFs** &mdash; Upload tutorial problem sets or assignments to compile practice targets.

2. **Creative To-Do List & Syllabus Dashboard**:
   - Categorized by **Lecture vs Tutorial**.
   - Checkbox micro-interactions with completion confetti.
   - Target star button to pin items to **Today's Target**.
   - **Revision Tracker**: Mark topics needing revision with revision iteration counts.
   - **Notes Modal**: Add formulas, key theorems, or doubts directly to any topic.
   - **Filters & Search**: Filter by subject tabs, item type (all, lectures, tutorials), status (pending, completed, needs revision, today's target), and real-time keyword search.

3. **Daily Study Target System**:
   - Everyday the app asks for your daily target (modal opens automatically on each new calendar date).
   - Prominent **Today's Target** hero banner displaying remaining vs completed goals.
   - Preserves all historical syllabus progress without resetting existing tasks.
   - Daily active streak counter.

4. **Exam Over & New Exam Controls**:
   - **Exam Over Button**: Triggers a celebratory victory modal with a comprehensive completion summary (total lectures mastered, tutorials solved, and syllabus coverage percentage).
   - **New Exam Button**: Safely archives current exam progress into local history and opens a clean onboarding wizard for the next semester/exam.

5. **Sample Demo Mode**:
   - Click **"Sample Demo"** in the top navigation to test the full engineering semester flow with pre-populated subjects (DSA, OS, DBMS, Discrete Maths) in one click.

---

## 🚀 Running Locally

No npm or external backend dependencies required!

### Option 1: Direct in Browser
Simply double-click `index.html` or drag it into any web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Using a local web server (Recommended for PDF.js workers)
```bash
# Python 3
python -m http.server 8000

# or Node.js npx
npx serve .
```
Then visit `http://localhost:8000` in your browser.

---

## 📂 Project Architecture

```
SyllabusTracker/
├── index.html        # Clean single-page semantic layout with Tailwind CSS CDN
├── style.css         # Micro-interactions, custom scrollbars, animations & print styling
├── script.js         # Modular application state, wizard controller, PDF parser, & localStorage
└── README.md         # Documentation & guide
```
