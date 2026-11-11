/**
 * SyllabusTrack - University Syllabus & Exam Tracking Application
 * Modern responsive single page app with vanilla JavaScript & TailwindCSS
 */

// Preset subject color palettes
const SUBJECT_COLORS = [
  { name: 'Indigo', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-800' },
  { name: 'Emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800' },
  { name: 'Amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' },
  { name: 'Purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800' },
  { name: 'Rose', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-800' },
  { name: 'Cyan', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-800' },
];

class SyllabusTrackerApp {
  constructor() {
    this.STORAGE_KEY_EXAM = 'syllabustrack_exam';
    this.STORAGE_KEY_ITEMS = 'syllabustrack_items';
    this.STORAGE_KEY_DAILY = 'syllabustrack_daily_target';
    this.STORAGE_KEY_HISTORY = 'syllabustrack_history';

    // Application state
    this.exam = null;
    this.items = [];
    this.dailyTarget = {
      date: '',
      targetItemIds: [],
      targetCount: 0,
      completedCount: 0
    };

    // Wizard temporary state
    this.wizard = {
      currentStep: 1,
      maxSteps: 5,
      subjectCount: 4,
      subjects: [],
      tempLectures: {}, // { [subjectId]: [items] }
      tempTutorials: {}, // { [subjectId]: [items] }
      activeLectureSubjectIndex: 0,
      activeTutorialSubjectIndex: 0
    };

    // Active Dashboard UI Filters
    this.filters = {
      subjectId: 'all',
      type: 'all', // 'all' | 'lecture' | 'tutorial'
      status: 'all', // 'all' | 'daily' | 'pending' | 'completed' | 'revision'
      searchQuery: ''
    };

    this.activeNoteItemId = null;
  }

  init() {
    this.loadFromStorage();
    this.setupDropzones();
    this.render();

    // Check if new day started to prompt daily target
    if (this.exam && !this.exam.isArchived) {
      this.checkDailyTargetPrompt();
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // ================= STORAGE MANAGEMENT =================
  loadFromStorage() {
    try {
      const savedExam = localStorage.getItem(this.STORAGE_KEY_EXAM);
      const savedItems = localStorage.getItem(this.STORAGE_KEY_ITEMS);
      const savedDaily = localStorage.getItem(this.STORAGE_KEY_DAILY);

      if (savedExam) {
        this.exam = JSON.parse(savedExam);
      }
      if (savedItems) {
        this.items = JSON.parse(savedItems);
      }
      if (savedDaily) {
        this.dailyTarget = JSON.parse(savedDaily);
      }
    } catch (e) {
      console.error('Failed to load data from localStorage', e);
    }
  }

  saveToStorage() {
    try {
      if (this.exam) {
        localStorage.setItem(this.STORAGE_KEY_EXAM, JSON.stringify(this.exam));
      } else {
        localStorage.removeItem(this.STORAGE_KEY_EXAM);
      }
      localStorage.setItem(this.STORAGE_KEY_ITEMS, JSON.stringify(this.items));
      localStorage.setItem(this.STORAGE_KEY_DAILY, JSON.stringify(this.dailyTarget));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }

  getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ================= WIZARD CONTROLS =================
  setExamNamePreset(name) {
    const input = document.getElementById('input-exam-name');
    if (input) {
      input.value = name;
      input.focus();
    }
  }

  changeSubjectCount(delta) {
    let count = this.wizard.subjectCount + delta;
    if (count < 1) count = 1;
    if (count > 12) count = 12;
    this.setSubjectCount(count);
  }

  setSubjectCount(count) {
    this.wizard.subjectCount = count;
    const display = document.getElementById('display-subject-count');
    if (display) {
      display.textContent = count;
    }
    // Update active highlight on quick pick buttons if present
    document.querySelectorAll('.btn-subject-preset').forEach(btn => {
      const btnCount = parseInt(btn.dataset.count || btn.textContent);
      if (btnCount === count) {
        btn.className = "btn-subject-preset py-2.5 rounded-xl text-sm font-semibold border border-brand-300 bg-brand-50 text-brand-700 font-bold transition";
      } else {
        btn.className = "btn-subject-preset py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition";
      }
    });
  }

  nextWizardStep() {
    if (this.wizard.currentStep === 1) {
      const examNameInput = document.getElementById('input-exam-name');
      const name = examNameInput ? examNameInput.value.trim() : '';
      if (!name) {
        this.showToast('Please enter an exam title to continue', 'warning');
        examNameInput?.focus();
        return;
      }
      this.wizard.currentStep = 2;
    } else if (this.wizard.currentStep === 2) {
      this.generateSubjectInputRows();
      this.wizard.currentStep = 3;
    } else if (this.wizard.currentStep === 3) {
      // Validate subjects
      const subjects = this.collectSubjectsFromInputs();
      if (subjects.length === 0) {
        this.showToast('Please add at least one subject with a valid name', 'warning');
        return;
      }
      this.wizard.subjects = subjects;
      
      // Initialize temp lecture and tutorial buckets if not already
      subjects.forEach(s => {
        if (!this.wizard.tempLectures[s.id]) this.wizard.tempLectures[s.id] = [];
        if (!this.wizard.tempTutorials[s.id]) this.wizard.tempTutorials[s.id] = [];
      });

      this.renderWizardLectureTabs();
      this.wizard.currentStep = 4;
    } else if (this.wizard.currentStep === 4) {
      this.renderWizardTutorialTabs();
      this.wizard.currentStep = 5;
    } else if (this.wizard.currentStep === 5) {
      this.finalizeExamSetup();
      return;
    }

    this.updateWizardUI();
  }

  prevWizardStep() {
    if (this.wizard.currentStep > 1) {
      this.wizard.currentStep--;
      this.updateWizardUI();
    }
  }

  updateWizardUI() {
    const totalSteps = 5;
    const step = this.wizard.currentStep;

    // Update progress bar & badge
    const progressBar = document.getElementById('wizard-progress-bar');
    const badge = document.getElementById('wizard-step-badge');
    const title = document.getElementById('wizard-title');
    const backBtn = document.getElementById('btn-wizard-back');
    const nextBtn = document.getElementById('btn-wizard-next');

    if (progressBar) progressBar.style.width = `${(step / totalSteps) * 100}%`;
    if (badge) badge.textContent = `Step ${step} of ${totalSteps}`;

    // Titles
    const titles = [
      "Let's set up your exam",
      "Subject count",
      "Course & subject details",
      "Lecture materials",
      "Tutorials & assignments"
    ];
    if (title) title.textContent = titles[step - 1];

    if (backBtn) {
      backBtn.disabled = step === 1;
    }

    if (nextBtn) {
      if (step === 5) {
        nextBtn.innerHTML = `<span>Finish & Launch Dashboard</span> <i data-lucide="sparkles" class="w-4 h-4"></i>`;
        nextBtn.className = "px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition flex items-center gap-2 shadow-md shadow-emerald-500/25";
      } else {
        nextBtn.innerHTML = `<span>Next</span> <i data-lucide="arrow-right" class="w-4 h-4"></i>`;
        nextBtn.className = "px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition flex items-center gap-2 shadow-md shadow-brand-500/25";
      }
    }

    // Step labels highlight
    for (let i = 1; i <= totalSteps; i++) {
      const lbl = document.getElementById(`step-label-${i}`);
      if (lbl) {
        if (i === step) {
          lbl.className = "text-brand-700 font-bold";
        } else if (i < step) {
          lbl.className = "text-emerald-600 font-semibold";
        } else {
          lbl.className = "text-slate-400 font-medium";
        }
      }

      // Hide or show step panes
      const stepPane = document.getElementById(`wizard-step-${i}`);
      if (stepPane) {
        if (i === step) {
          stepPane.classList.remove('hidden');
        } else {
          stepPane.classList.add('hidden');
        }
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  // Generate dynamic subject rows for Step 3
  generateSubjectInputRows() {
    const container = document.getElementById('subject-inputs-container');
    if (!container) return;

    // Collect existing values if any were already typed
    const existingValues = [];
    container.querySelectorAll('.subject-input-row').forEach(row => {
      const nameInput = row.querySelector('.input-subject-name');
      const codeInput = row.querySelector('.input-subject-code');
      const colorInput = row.querySelector('.input-subject-color');
      if (nameInput) {
        existingValues.push({
          name: nameInput.value,
          code: codeInput ? codeInput.value : '',
          colorIdx: colorInput ? parseInt(colorInput.value) : 0
        });
      }
    });

    // Standard university course suggestions
    const defaultSuggestions = [
      { name: 'Data Structures & Algorithms', code: 'CS201' },
      { name: 'Operating Systems', code: 'CS204' },
      { name: 'Database Management Systems', code: 'CS206' },
      { name: 'Computer Networks', code: 'CS208' },
      { name: 'Discrete Mathematics', code: 'MA201' },
      { name: 'Digital Logic & Architecture', code: 'CS203' }
    ];

    container.innerHTML = '';
    const count = this.wizard.subjectCount;

    for (let i = 0; i < count; i++) {
      const existing = existingValues[i];
      const suggestion = existing || defaultSuggestions[i] || { name: `Subject ${i + 1}`, code: `COURSE${i + 1}`, colorIdx: i % SUBJECT_COLORS.length };
      const colorIndex = existing ? existing.colorIdx : (i % SUBJECT_COLORS.length);

      const row = document.createElement('div');
      row.className = 'subject-input-row p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition space-y-3';
      row.id = `subject-row-${i}`;
      row.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">${i + 1}</span>
            <span class="text-xs font-semibold uppercase text-slate-500">Subject #${i + 1}</span>
          </div>
          ${count > 1 ? `
            <button type="button" onclick="app.removeSubjectRow(${i})" class="text-xs text-rose-500 hover:text-rose-700 font-medium">Remove</button>
          ` : ''}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-2">
            <label class="block text-xs font-medium text-slate-600 mb-1">Subject Name <span class="text-rose-500">*</span></label>
            <input type="text" class="input-subject-name w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 outline-none" 
              placeholder="e.g. ${defaultSuggestions[i]?.name || 'Course Name'}" value="${this.escapeHtml(suggestion.name)}" required />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Course Code</label>
            <input type="text" class="input-subject-code w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 outline-none" 
              placeholder="e.g. ${defaultSuggestions[i]?.code || 'CODE'}" value="${this.escapeHtml(suggestion.code)}" />
          </div>
        </div>
        <input type="hidden" class="input-subject-color" value="${colorIndex}" />
      `;
      container.appendChild(row);
    }
  }

  addNewSubjectRow() {
    this.wizard.subjectCount++;
    const display = document.getElementById('display-subject-count');
    if (display) display.textContent = this.wizard.subjectCount;
    this.generateSubjectInputRows();
  }

  removeSubjectRow(index) {
    if (this.wizard.subjectCount > 1) {
      this.wizard.subjectCount--;
      const display = document.getElementById('display-subject-count');
      if (display) display.textContent = this.wizard.subjectCount;
      this.generateSubjectInputRows();
    }
  }

  collectSubjectsFromInputs() {
    const rows = document.querySelectorAll('.subject-input-row');
    const subjects = [];

    rows.forEach((row, idx) => {
      const nameInput = row.querySelector('.input-subject-name');
      const codeInput = row.querySelector('.input-subject-code');
      const colorInput = row.querySelector('.input-subject-color');

      const name = nameInput ? nameInput.value.trim() : '';
      if (name) {
        const code = codeInput ? codeInput.value.trim().toUpperCase() : `SUBJ${idx + 1}`;
        const colorIdx = parseInt(colorInput ? colorInput.value : idx) % SUBJECT_COLORS.length;
        subjects.push({
          id: `subj_${Date.now()}_${idx}`,
          name: name,
          code: code || `S${idx + 1}`,
          colorIdx: colorIdx
        });
      }
    });

    return subjects;
  }

  // ================= STEP 4: LECTURES HANDLING =================
  renderWizardLectureTabs() {
    const tabsContainer = document.getElementById('wizard-lecture-subject-tabs');
    if (!tabsContainer || !this.wizard.subjects.length) return;

    tabsContainer.innerHTML = '';
    this.wizard.subjects.forEach((subj, idx) => {
      const isActive = idx === this.wizard.activeLectureSubjectIndex;
      const count = (this.wizard.tempLectures[subj.id] || []).length;
      const tabBtn = document.createElement('button');
      tabBtn.type = 'button';
      tabBtn.onclick = () => this.switchLectureSubjectTab(idx);
      tabBtn.className = `px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
        isActive 
          ? 'bg-brand-600 text-white shadow-sm' 
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
      }`;
      tabBtn.innerHTML = `
        <span>${subj.code || subj.name}</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}">${count}</span>
      `;
      tabsContainer.appendChild(tabBtn);
    });

    this.renderWizardLectureList();
  }

  switchLectureSubjectTab(index) {
    this.wizard.activeLectureSubjectIndex = index;
    this.renderWizardLectureTabs();
  }

  renderWizardLectureList() {
    const currentSubj = this.wizard.subjects[this.wizard.activeLectureSubjectIndex];
    if (!currentSubj) return;

    const heading = document.getElementById('lecture-preview-heading');
    const container = document.getElementById('lecture-items-preview-list');
    const items = this.wizard.tempLectures[currentSubj.id] || [];

    if (heading) {
      heading.textContent = `Compiled Lectures for ${currentSubj.name} (${items.length})`;
    }

    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No lecture PDFs or topics added yet for this subject. Upload PDFs above or type topic names.
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    items.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs';
      el.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">${idx + 1}</span>
          <div class="truncate">
            <span class="font-medium text-slate-800">${this.escapeHtml(item.title)}</span>
            ${item.pages ? `<span class="ml-1.5 text-[10px] text-slate-400">(${item.pages} pages)</span>` : ''}
          </div>
        </div>
        <button type="button" onclick="app.removeTempLecture('${currentSubj.id}', ${idx})" class="text-slate-400 hover:text-rose-500 p-1">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;
      container.appendChild(el);
    });

    if (window.lucide) lucide.createIcons();
  }

  addManualLecture() {
    const input = document.getElementById('manual-lecture-input');
    const currentSubj = this.wizard.subjects[this.wizard.activeLectureSubjectIndex];
    if (!input || !currentSubj) return;

    const title = input.value.trim();
    if (!title) return;

    if (!this.wizard.tempLectures[currentSubj.id]) {
      this.wizard.tempLectures[currentSubj.id] = [];
    }

    this.wizard.tempLectures[currentSubj.id].push({
      id: `item_lec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subjectId: currentSubj.id,
      title: title,
      type: 'lecture',
      pages: 15,
      status: 'pending',
      completedAt: null,
      needsRevision: false,
      revisionCount: 0,
      notes: '',
      priority: 'medium'
    });

    input.value = '';
    this.renderWizardLectureTabs();
  }

  removeTempLecture(subjId, index) {
    if (this.wizard.tempLectures[subjId]) {
      this.wizard.tempLectures[subjId].splice(index, 1);
      this.renderWizardLectureTabs();
    }
  }

  // ================= STEP 5: TUTORIALS HANDLING =================
  renderWizardTutorialTabs() {
    const tabsContainer = document.getElementById('wizard-tutorial-subject-tabs');
    if (!tabsContainer || !this.wizard.subjects.length) return;

    tabsContainer.innerHTML = '';
    this.wizard.subjects.forEach((subj, idx) => {
      const isActive = idx === this.wizard.activeTutorialSubjectIndex;
      const count = (this.wizard.tempTutorials[subj.id] || []).length;
      const tabBtn = document.createElement('button');
      tabBtn.type = 'button';
      tabBtn.onclick = () => this.switchTutorialSubjectTab(idx);
      tabBtn.className = `px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
        isActive 
          ? 'bg-amber-600 text-white shadow-sm' 
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
      }`;
      tabBtn.innerHTML = `
        <span>${subj.code || subj.name}</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}">${count}</span>
      `;
      tabsContainer.appendChild(tabBtn);
    });

    this.renderWizardTutorialList();
  }

  switchTutorialSubjectTab(index) {
    this.wizard.activeTutorialSubjectIndex = index;
    this.renderWizardTutorialTabs();
  }

  renderWizardTutorialList() {
    const currentSubj = this.wizard.subjects[this.wizard.activeTutorialSubjectIndex];
    if (!currentSubj) return;

    const heading = document.getElementById('tutorial-preview-heading');
    const container = document.getElementById('tutorial-items-preview-list');
    const items = this.wizard.tempTutorials[currentSubj.id] || [];

    if (heading) {
      heading.textContent = `Compiled Tutorials for ${currentSubj.name} (${items.length})`;
    }

    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No tutorial sheets or lab problem PDFs added yet. Upload PDFs above or add manually (optional).
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    items.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs';
      el.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">${idx + 1}</span>
          <div class="truncate">
            <span class="font-medium text-slate-800">${this.escapeHtml(item.title)}</span>
            ${item.pages ? `<span class="ml-1.5 text-[10px] text-slate-400">(${item.pages} problems/pages)</span>` : ''}
          </div>
        </div>
        <button type="button" onclick="app.removeTempTutorial('${currentSubj.id}', ${idx})" class="text-slate-400 hover:text-rose-500 p-1">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;
      container.appendChild(el);
    });

    if (window.lucide) lucide.createIcons();
  }

  addManualTutorial() {
    const input = document.getElementById('manual-tutorial-input');
    const currentSubj = this.wizard.subjects[this.wizard.activeTutorialSubjectIndex];
    if (!input || !currentSubj) return;

    const title = input.value.trim();
    if (!title) return;

    if (!this.wizard.tempTutorials[currentSubj.id]) {
      this.wizard.tempTutorials[currentSubj.id] = [];
    }

    this.wizard.tempTutorials[currentSubj.id].push({
      id: `item_tut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subjectId: currentSubj.id,
      title: title,
      type: 'tutorial',
      pages: 10,
      status: 'pending',
      completedAt: null,
      needsRevision: false,
      revisionCount: 0,
      notes: '',
      priority: 'medium'
    });

    input.value = '';
    this.renderWizardTutorialTabs();
  }

  removeTempTutorial(subjId, index) {
    if (this.wizard.tempTutorials[subjId]) {
      this.wizard.tempTutorials[subjId].splice(index, 1);
      this.renderWizardTutorialTabs();
    }
  }

  // ================= SETUP DRAG & DROP AND FILE PROCESSING =================
  setupDropzones() {
    const lectureDropzone = document.getElementById('lecture-dropzone');
    const lectureInput = document.getElementById('lecture-file-input');
    const tutorialDropzone = document.getElementById('tutorial-dropzone');
    const tutorialInput = document.getElementById('tutorial-file-input');

    if (lectureInput) {
      lectureInput.addEventListener('change', (e) => {
        if (e.target.files) this.processPdfFiles(e.target.files, 'lecture');
      });
    }

    if (tutorialInput) {
      tutorialInput.addEventListener('change', (e) => {
        if (e.target.files) this.processPdfFiles(e.target.files, 'tutorial');
      });
    }

    // Drag-over styling
    [lectureDropzone, tutorialDropzone].forEach(dropzone => {
      if (!dropzone) return;
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dropzone-dragover');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dropzone-dragover');
        }, false);
      });
    });
  }

  async processPdfFiles(files, type) {
    const isLecture = type === 'lecture';
    const subjIndex = isLecture ? this.wizard.activeLectureSubjectIndex : this.wizard.activeTutorialSubjectIndex;
    const currentSubj = this.wizard.subjects[subjIndex];

    if (!currentSubj) {
      this.showToast('Please select a subject first', 'warning');
      return;
    }

    this.showToast(`Processing ${files.length} PDF(s)...`, 'info');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let cleanTitle = file.name
        .replace(/\.[^/.]+$/, "") // Remove .pdf
        .replace(/[_-]+/g, " ")  // Replace dashes and underscores with space
        .trim();

      let pageCount = null;

      // Extract page count via PDF.js if available
      if (window.pdfjsLib && file.type === 'application/pdf') {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          pageCount = pdf.numPages;
        } catch (err) {
          console.warn('Could not read PDF metadata for', file.name, err);
        }
      }

      const item = {
        id: `item_${type}_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        subjectId: currentSubj.id,
        title: cleanTitle,
        fileName: file.name,
        type: type,
        pages: pageCount || 20,
        status: 'pending',
        completedAt: null,
        needsRevision: false,
        revisionCount: 0,
        notes: '',
        priority: 'medium'
      };

      if (isLecture) {
        if (!this.wizard.tempLectures[currentSubj.id]) this.wizard.tempLectures[currentSubj.id] = [];
        this.wizard.tempLectures[currentSubj.id].push(item);
      } else {
        if (!this.wizard.tempTutorials[currentSubj.id]) this.wizard.tempTutorials[currentSubj.id] = [];
        this.wizard.tempTutorials[currentSubj.id].push(item);
      }
    }

    if (isLecture) {
      this.renderWizardLectureTabs();
    } else {
      this.renderWizardTutorialTabs();
    }

    this.showToast(`Added ${files.length} ${type} item(s) to ${currentSubj.code || currentSubj.name}`, 'success');
  }

  // ================= FINALIZE WIZARD & LAUNCH DASHBOARD =================
  finalizeExamSetup() {
    const examNameInput = document.getElementById('input-exam-name');
    const examDateInput = document.getElementById('input-exam-date');

    const examTitle = examNameInput ? examNameInput.value.trim() : 'Endsem 2026';
    const examDate = examDateInput ? examDateInput.value : '';

    this.exam = {
      id: `exam_${Date.now()}`,
      name: examTitle,
      startDate: examDate,
      subjects: this.wizard.subjects,
      createdAt: new Date().toISOString(),
      lastActiveDate: this.getTodayString(),
      streak: 1,
      isArchived: false
    };

    // Combine all lectures and tutorials into the main items array
    const compiledItems = [];
    this.wizard.subjects.forEach(subj => {
      const lecs = this.wizard.tempLectures[subj.id] || [];
      const tuts = this.wizard.tempTutorials[subj.id] || [];

      // If user didn't upload any PDFs, add sensible starter modules so their to-do list isn't empty!
      if (lecs.length === 0) {
        lecs.push(
          { id: `item_lec_${Date.now()}_1_${subj.id}`, subjectId: subj.id, title: `Module 1: Foundations & Core Concepts`, type: 'lecture', pages: 24, status: 'pending', completedAt: null, needsRevision: false, revisionCount: 0, notes: '', priority: 'high' },
          { id: `item_lec_${Date.now()}_2_${subj.id}`, subjectId: subj.id, title: `Module 2: Key Algorithms & Applications`, type: 'lecture', pages: 30, status: 'pending', completedAt: null, needsRevision: false, revisionCount: 0, notes: '', priority: 'medium' }
        );
      }

      compiledItems.push(...lecs, ...tuts);
    });

    this.items = compiledItems;
    this.dailyTarget = {
      date: this.getTodayString(),
      targetItemIds: [],
      targetCount: 0,
      completedCount: 0
    };

    this.saveToStorage();
    this.showToast('Exam setup complete! Welcome to your syllabus dashboard.', 'success');
    this.triggerConfetti();

    this.render();

    // Automatically prompt today's daily target
    setTimeout(() => {
      this.openDailyTargetModal();
    }, 600);
  }

  // ================= DAILY TARGET SYSTEM =================
  checkDailyTargetPrompt() {
    const today = this.getTodayString();
    
    // Check if new day
    if (this.dailyTarget.date !== today) {
      // Calculate streak
      if (this.exam.lastActiveDate) {
        const last = new Date(this.exam.lastActiveDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr - last) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          this.exam.streak = (this.exam.streak || 1) + 1;
        } else if (diffDays > 1) {
          this.exam.streak = 1;
        }
      }
      this.exam.lastActiveDate = today;

      // Reset daily target for the new day WITHOUT modifying or losing any completed syllabus items!
      this.dailyTarget = {
        date: today,
        targetItemIds: [],
        targetCount: 0,
        completedCount: 0
      };
      this.saveToStorage();

      // Show daily target modal prompt automatically
      setTimeout(() => {
        this.openDailyTargetModal();
      }, 700);
    }
  }

  openDailyTargetModal() {
    const modal = document.getElementById('modal-daily-target');
    const dateLabel = document.getElementById('modal-daily-target-date');
    const container = document.getElementById('modal-target-items-list');

    if (dateLabel) {
      const today = new Date();
      dateLabel.textContent = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (container) {
      container.innerHTML = '';
      const pendingItems = this.items.filter(item => item.status !== 'completed');

      if (pendingItems.length === 0) {
        container.innerHTML = `<p class="p-4 text-center text-xs text-slate-500">All syllabus items are completed! Great job.</p>`;
      } else {
        pendingItems.forEach(item => {
          const subj = this.exam.subjects.find(s => s.id === item.subjectId);
          const isSelected = this.dailyTarget.targetItemIds.includes(item.id);

          const row = document.createElement('label');
          row.className = 'flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/80 hover:bg-slate-50 cursor-pointer text-xs transition';
          row.innerHTML = `
            <input type="checkbox" value="${item.id}" ${isSelected ? 'checked' : ''} onchange="app.updateSelectedTargetCount()" class="target-checkbox rounded text-amber-600 focus:ring-amber-500">
            <div class="flex-1 min-w-0">
              <span class="font-medium text-slate-800">${this.escapeHtml(item.title)}</span>
              <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                <span class="font-semibold text-slate-600">${subj ? (subj.code || subj.name) : 'Subject'}</span>
                <span>&bull;</span>
                <span class="capitalize">${item.type}</span>
                ${item.pages ? `<span>&bull; ${item.pages} pages</span>` : ''}
              </div>
            </div>
          `;
          container.appendChild(row);
        });
      }
    }

    this.updateSelectedTargetCount();
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeDailyTargetModal() {
    const modal = document.getElementById('modal-daily-target');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  updateSelectedTargetCount() {
    const checked = document.querySelectorAll('.target-checkbox:checked');
    const label = document.getElementById('modal-selected-target-count');
    if (label) {
      label.textContent = `${checked.length} selected`;
    }
  }

  saveDailyTarget() {
    const checked = Array.from(document.querySelectorAll('.target-checkbox:checked')).map(cb => cb.value);
    
    // Calculate how many of the selected target items are already completed today
    const completedSelected = checked.filter(id => {
      const itm = this.items.find(i => i.id === id);
      return itm && itm.status === 'completed';
    }).length;

    this.dailyTarget = {
      date: this.getTodayString(),
      targetItemIds: checked,
      targetCount: checked.length,
      completedCount: completedSelected
    };

    this.saveToStorage();
    this.closeDailyTargetModal();
    this.showToast(`Today's target set: ${checked.length} tasks to conquer!`, 'success');
    this.render();
  }

  // ================= TO-DO LIST ITEM ACTIONS =================
  toggleItemStatus(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    if (item.status === 'completed') {
      item.status = 'pending';
      item.completedAt = null;
    } else {
      item.status = 'completed';
      item.completedAt = new Date().toISOString();
      this.triggerMicroConfetti();
    }

    // Update daily target completed count if item is in today's target
    this.syncDailyTargetCompletion();

    this.saveToStorage();
    this.render();
  }

  syncDailyTargetCompletion() {
    if (this.dailyTarget.targetItemIds && this.dailyTarget.targetItemIds.length > 0) {
      const completedToday = this.dailyTarget.targetItemIds.filter(id => {
        const itm = this.items.find(i => i.id === id);
        return itm && itm.status === 'completed';
      }).length;

      const wasIncomplete = this.dailyTarget.completedCount < this.dailyTarget.targetCount;
      this.dailyTarget.completedCount = completedToday;

      if (wasIncomplete && completedToday >= this.dailyTarget.targetCount && this.dailyTarget.targetCount > 0) {
        this.triggerConfetti();
        this.showToast("Awesome! You completed all of today's study targets!", 'success');
      }
    }
  }

  toggleDailyTargetItem(itemId) {
    const exists = this.dailyTarget.targetItemIds.includes(itemId);
    if (exists) {
      this.dailyTarget.targetItemIds = this.dailyTarget.targetItemIds.filter(id => id !== itemId);
      this.showToast("Removed from today's target", 'info');
    } else {
      this.dailyTarget.targetItemIds.push(itemId);
      this.showToast("Added to today's target!", 'success');
    }

    this.dailyTarget.targetCount = this.dailyTarget.targetItemIds.length;
    this.syncDailyTargetCompletion();
    this.saveToStorage();
    this.render();
  }

  toggleNeedsRevision(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    item.needsRevision = !item.needsRevision;
    if (item.needsRevision) {
      item.revisionCount = (item.revisionCount || 0) + 1;
      this.showToast('Marked for revision', 'info');
    } else {
      this.showToast('Revision completed', 'success');
    }

    this.saveToStorage();
    this.render();
  }

  deleteItem(itemId) {
    if (confirm('Are you sure you want to delete this syllabus topic?')) {
      this.items = this.items.filter(i => i.id !== itemId);
      this.dailyTarget.targetItemIds = this.dailyTarget.targetItemIds.filter(id => id !== itemId);
      this.dailyTarget.targetCount = this.dailyTarget.targetItemIds.length;
      this.syncDailyTargetCompletion();
      this.saveToStorage();
      this.render();
      this.showToast('Item deleted', 'info');
    }
  }

  // ================= ITEM NOTES MODAL =================
  openItemNotes(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    this.activeNoteItemId = itemId;
    const modal = document.getElementById('modal-item-notes');
    const title = document.getElementById('modal-notes-item-title');
    const textarea = document.getElementById('modal-notes-textarea');
    const revisionCheck = document.getElementById('modal-notes-revision-check');
    const revisionCounter = document.getElementById('modal-notes-revision-counter');

    if (title) title.textContent = item.title;
    if (textarea) textarea.value = item.notes || '';
    if (revisionCheck) revisionCheck.checked = Boolean(item.needsRevision);
    if (revisionCounter) revisionCounter.textContent = `Revised: ${item.revisionCount || 0} times`;

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeItemNotesModal() {
    const modal = document.getElementById('modal-item-notes');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.activeNoteItemId = null;
  }

  saveItemNotes() {
    if (!this.activeNoteItemId) return;
    const item = this.items.find(i => i.id === this.activeNoteItemId);
    if (!item) return;

    const textarea = document.getElementById('modal-notes-textarea');
    const revisionCheck = document.getElementById('modal-notes-revision-check');

    item.notes = textarea ? textarea.value.trim() : '';
    item.needsRevision = revisionCheck ? revisionCheck.checked : false;

    this.saveToStorage();
    this.closeItemNotesModal();
    this.showToast('Notes saved', 'success');
    this.render();
  }

  // ================= ADD NEW ITEM MODAL =================
  openAddItemModal() {
    if (!this.exam) return;
    const modal = document.getElementById('modal-add-item');
    const select = document.getElementById('new-item-subject-id');

    if (select) {
      select.innerHTML = '';
      this.exam.subjects.forEach(subj => {
        const opt = document.createElement('option');
        opt.value = subj.id;
        opt.textContent = `${subj.code || ''} - ${subj.name}`;
        select.appendChild(opt);
      });
      if (this.filters.subjectId !== 'all') {
        select.value = this.filters.subjectId;
      }
    }

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeAddItemModal() {
    const modal = document.getElementById('modal-add-item');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  handleSaveNewItem(e) {
    e.preventDefault();
    const subjectId = document.getElementById('new-item-subject-id').value;
    const type = document.querySelector('input[name="new-item-type"]:checked').value;
    const title = document.getElementById('new-item-title').value.trim();
    const pages = parseInt(document.getElementById('new-item-pages').value) || 20;
    const priority = document.getElementById('new-item-priority').value;

    if (!title) return;

    const newItem = {
      id: `item_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subjectId: subjectId,
      title: title,
      type: type,
      pages: pages,
      status: 'pending',
      completedAt: null,
      needsRevision: false,
      revisionCount: 0,
      notes: '',
      priority: priority
    };

    this.items.push(newItem);
    this.saveToStorage();
    this.closeAddItemModal();
    document.getElementById('form-add-item').reset();
    this.showToast('New topic added to syllabus!', 'success');
    this.render();
  }

  // ================= EXAM OVER & NEW EXAM =================
  triggerExamOverModal() {
    const modal = document.getElementById('modal-exam-over');
    if (!modal) return;

    const total = this.items.length;
    const completed = this.items.filter(i => i.status === 'completed').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const lectures = this.items.filter(i => i.type === 'lecture' && i.status === 'completed').length;
    const tutorials = this.items.filter(i => i.type === 'tutorial' && i.status === 'completed').length;

    const pctEl = document.getElementById('modal-summary-percentage');
    const lecEl = document.getElementById('modal-summary-lectures');
    const tutEl = document.getElementById('modal-summary-tutorials');

    if (pctEl) pctEl.textContent = `${pct}%`;
    if (lecEl) lecEl.textContent = lectures;
    if (tutEl) tutEl.textContent = tutorials;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    this.triggerConfetti();
  }

  closeExamOverModal() {
    const modal = document.getElementById('modal-exam-over');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  startNewExamFromModal() {
    this.closeExamOverModal();
    this.confirmNewExam();
  }

  confirmNewExam() {
    const confirmed = confirm(
      'Are you ready to finish this exam session and start a new exam registration?\n\nYour current exam progress will be archived, and you can setup your next exam or semester step-by-step.'
    );

    if (!confirmed) return;

    // Archive current exam into history
    if (this.exam) {
      try {
        const history = JSON.parse(localStorage.getItem(this.STORAGE_KEY_HISTORY) || '[]');
        history.push({
          exam: this.exam,
          itemsCount: this.items.length,
          completedCount: this.items.filter(i => i.status === 'completed').length,
          archivedAt: new Date().toISOString()
        });
        localStorage.setItem(this.STORAGE_KEY_HISTORY, JSON.stringify(history));
      } catch (e) {
        console.error(e);
      }
    }

    // Reset state
    this.exam = null;
    this.items = [];
    this.dailyTarget = {
      date: this.getTodayString(),
      targetItemIds: [],
      targetCount: 0,
      completedCount: 0
    };
    this.saveToStorage();

    // Reset wizard
    this.wizard = {
      currentStep: 1,
      maxSteps: 5,
      subjectCount: 4,
      subjects: [],
      tempLectures: {},
      tempTutorials: {},
      activeLectureSubjectIndex: 0,
      activeTutorialSubjectIndex: 0
    };

    const examNameInput = document.getElementById('input-exam-name');
    if (examNameInput) examNameInput.value = '';

    this.showToast('Starting a new exam setup', 'info');
    this.render();
  }

  // ================= SEARCH & FILTERS =================
  setSubjectFilter(subjId) {
    this.filters.subjectId = subjId;
    this.render();
  }

  setTypeFilter(type) {
    this.filters.type = type;
    document.querySelectorAll('.filter-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `filter-type-${type}`);
      btn.classList.toggle('bg-slate-900', btn.id === `filter-type-${type}`);
      btn.classList.toggle('text-white', btn.id === `filter-type-${type}`);
    });
    this.render();
  }

  setStatusFilter(status) {
    this.filters.status = status;
    document.querySelectorAll('.filter-status-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `filter-status-${status}`);
    });
    this.render();
  }

  handleSearch(query) {
    this.filters.searchQuery = query.toLowerCase().trim();
    this.renderItemListOnly();
  }

  resetFilters() {
    this.filters = {
      subjectId: 'all',
      type: 'all',
      status: 'all',
      searchQuery: ''
    };
    const searchInput = document.getElementById('dashboard-search-input');
    if (searchInput) searchInput.value = '';
    this.setTypeFilter('all');
    this.setStatusFilter('all');
    this.render();
  }

  // ================= MAIN RENDER =================
  render() {
    const viewWizard = document.getElementById('view-wizard');
    const viewDashboard = document.getElementById('view-dashboard');
    const headerPill = document.getElementById('header-active-exam-pill');
    const headerDailyBtn = document.getElementById('btn-header-daily-target');
    const headerActions = document.getElementById('header-dashboard-actions');
    const btnQuickDemo = document.getElementById('btn-quick-demo');

    if (!this.exam || this.exam.isArchived) {
      // Show Wizard View
      if (viewWizard) viewWizard.classList.remove('hidden');
      if (viewDashboard) viewDashboard.classList.add('hidden');
      if (headerPill) headerPill.classList.add('hidden');
      if (headerDailyBtn) headerDailyBtn.classList.add('hidden');
      if (headerActions) headerActions.classList.add('hidden');
      if (btnQuickDemo) btnQuickDemo.classList.remove('hidden');
      this.updateWizardUI();
    } else {
      // Show Dashboard View
      if (viewWizard) viewWizard.classList.add('hidden');
      if (viewDashboard) viewDashboard.classList.remove('hidden');
      if (headerPill) {
        headerPill.classList.remove('hidden');
        headerPill.classList.add('flex');
      }
      if (headerDailyBtn) {
        headerDailyBtn.classList.remove('hidden');
        headerDailyBtn.classList.add('sm:flex');
      }
      if (headerActions) {
        headerActions.classList.remove('hidden');
        headerActions.classList.add('flex');
      }
      if (btnQuickDemo) btnQuickDemo.classList.add('hidden');

      this.renderDashboardHeader();
      this.renderDailyTargetCard();
      this.renderQuickStats();
      this.renderSubjectFilterPills();
      this.renderItemListOnly();
    }

    if (window.lucide) lucide.createIcons();
  }

  renderDashboardHeader() {
    const headerName = document.getElementById('header-exam-name');
    const heroTitle = document.getElementById('hero-exam-title');
    const heroCountdown = document.getElementById('hero-countdown-text');
    const headerCountdown = document.getElementById('header-exam-countdown');

    if (headerName) headerName.textContent = this.exam.name;
    if (heroTitle) heroTitle.textContent = this.exam.name;

    // Calculate days remaining
    if (this.exam.startDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const examDate = new Date(this.exam.startDate);
      const diffTime = examDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let text = '';
      if (diffDays > 0) {
        text = `${diffDays} day${diffDays === 1 ? '' : 's'} until exam`;
      } else if (diffDays === 0) {
        text = `Exam is Today! Good luck!`;
      } else {
        text = `Exam period active`;
      }

      if (heroCountdown) heroCountdown.textContent = text;
      if (headerCountdown) headerCountdown.textContent = text;
    } else {
      if (heroCountdown) heroCountdown.textContent = 'Exam on schedule';
      if (headerCountdown) headerCountdown.textContent = 'Active Exam';
    }

    // Overall Progress Ring
    const total = this.items.length;
    const completed = this.items.filter(i => i.status === 'completed').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const ring = document.getElementById('hero-progress-ring');
    const pctLabel = document.getElementById('hero-progress-percentage');
    const statCompleted = document.getElementById('hero-stat-completed');
    const statTotal = document.getElementById('hero-stat-total');
    const statRemaining = document.getElementById('hero-stat-remaining');

    if (ring) ring.setAttribute('stroke-dasharray', `${pct}, 100`);
    if (pctLabel) pctLabel.textContent = `${pct}%`;
    if (statCompleted) statCompleted.textContent = completed;
    if (statTotal) statTotal.textContent = total;
    if (statRemaining) statRemaining.textContent = `${total - completed} tasks remaining`;
  }

  renderDailyTargetCard() {
    const today = new Date();
    const dateDisplay = document.getElementById('daily-target-date-display');
    const completedCountEl = document.getElementById('daily-completed-count');
    const totalGoalEl = document.getElementById('daily-total-goal');
    const progressBar = document.getElementById('daily-target-progress-bar');
    const statusTag = document.getElementById('daily-target-status-tag');
    const quoteEl = document.getElementById('daily-target-quote');
    const badgeDailyHeader = document.getElementById('badge-daily-target-count');
    const btnLabel = document.getElementById('btn-daily-target-label');

    if (dateDisplay) {
      dateDisplay.textContent = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    const targetTotal = this.dailyTarget.targetCount || 0;
    const targetDone = this.dailyTarget.completedCount || 0;
    const pct = targetTotal > 0 ? Math.round((targetDone / targetTotal) * 100) : 0;

    if (completedCountEl) completedCountEl.textContent = targetDone;
    if (totalGoalEl) totalGoalEl.textContent = targetTotal;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (badgeDailyHeader) badgeDailyHeader.textContent = `${targetDone}/${targetTotal}`;

    if (targetTotal === 0) {
      if (statusTag) {
        statusTag.textContent = 'Not Set';
        statusTag.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700';
      }
      if (quoteEl) quoteEl.textContent = 'Choose 2 to 5 syllabus topics to conquer today to maintain steady progress.';
      if (btnLabel) btnLabel.textContent = 'Set Today\'s Target';
    } else if (targetDone >= targetTotal) {
      if (statusTag) {
        statusTag.textContent = 'Goal Reached!';
        statusTag.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800';
      }
      if (quoteEl) quoteEl.textContent = '🎉 All daily targets achieved for today! You are building great momentum.';
      if (btnLabel) btnLabel.textContent = 'Edit Target';
    } else {
      if (statusTag) {
        statusTag.textContent = `${pct}% Finished`;
        statusTag.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800';
      }
      if (quoteEl) quoteEl.textContent = `Keep going! ${targetTotal - targetDone} target task${(targetTotal - targetDone) === 1 ? '' : 's'} remaining for today.`;
      if (btnLabel) btnLabel.textContent = 'Update Target';
    }
  }

  renderQuickStats() {
    const lectureDone = this.items.filter(i => i.type === 'lecture' && i.status === 'completed').length;
    const lectureTotal = this.items.filter(i => i.type === 'lecture').length;
    const tutDone = this.items.filter(i => i.type === 'tutorial' && i.status === 'completed').length;
    const tutTotal = this.items.filter(i => i.type === 'tutorial').length;
    const revisionCount = this.items.filter(i => i.needsRevision).length;

    const elLecDone = document.getElementById('stat-lecture-done');
    const elLecTotal = document.getElementById('stat-lecture-total');
    const elTutDone = document.getElementById('stat-tutorial-done');
    const elTutTotal = document.getElementById('stat-tutorial-total');
    const elRevCount = document.getElementById('stat-revision-count');
    const elStreak = document.getElementById('stat-streak-count');

    if (elLecDone) elLecDone.textContent = lectureDone;
    if (elLecTotal) elLecTotal.textContent = lectureTotal;
    if (elTutDone) elTutDone.textContent = tutDone;
    if (elTutTotal) elTutTotal.textContent = tutTotal;
    if (elRevCount) elRevCount.textContent = revisionCount;
    if (elStreak) elStreak.textContent = this.exam.streak || 1;
  }

  renderSubjectFilterPills() {
    const container = document.getElementById('dashboard-subject-pills');
    if (!container || !this.exam) return;

    container.innerHTML = '';

    // 'All Subjects' pill
    const isAll = this.filters.subjectId === 'all';
    const allBtn = document.createElement('button');
    allBtn.onclick = () => this.setSubjectFilter('all');
    allBtn.className = `px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
      isAll 
        ? 'bg-brand-600 text-white shadow-sm' 
        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
    }`;
    allBtn.textContent = `All Subjects (${this.items.length})`;
    container.appendChild(allBtn);

    // Individual Subject Pills
    this.exam.subjects.forEach(subj => {
      const isSubjActive = this.filters.subjectId === subj.id;
      const count = this.items.filter(i => i.subjectId === subj.id).length;
      const color = SUBJECT_COLORS[subj.colorIdx || 0];

      const btn = document.createElement('button');
      btn.onclick = () => this.setSubjectFilter(subj.id);
      btn.className = `px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
        isSubjActive 
          ? 'bg-brand-600 text-white shadow-sm' 
          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
      }`;
      btn.innerHTML = `
        <span class="w-2 h-2 rounded-full ${color.bg.replace('-50', '-500')}"></span>
        <span>${subj.code || subj.name}</span>
        <span class="text-[10px] opacity-75 font-normal">(${count})</span>
      `;
      container.appendChild(btn);
    });
  }

  renderItemListOnly() {
    const container = document.getElementById('syllabus-items-list');
    const emptyState = document.getElementById('syllabus-empty-state');
    if (!container) return;

    // Filter items
    let filtered = this.items.filter(item => {
      // Subject filter
      if (this.filters.subjectId !== 'all' && item.subjectId !== this.filters.subjectId) {
        return false;
      }
      // Type filter
      if (this.filters.type !== 'all' && item.type !== this.filters.type) {
        return false;
      }
      // Status filter
      if (this.filters.status === 'pending' && item.status === 'completed') {
        return false;
      }
      if (this.filters.status === 'completed' && item.status !== 'completed') {
        return false;
      }
      if (this.filters.status === 'revision' && !item.needsRevision) {
        return false;
      }
      if (this.filters.status === 'daily' && !this.dailyTarget.targetItemIds.includes(item.id)) {
        return false;
      }
      // Search filter
      if (this.filters.searchQuery) {
        const query = this.filters.searchQuery;
        const subj = this.exam.subjects.find(s => s.id === item.subjectId);
        const subjText = subj ? `${subj.name} ${subj.code}`.toLowerCase() : '';
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchNotes = (item.notes || '').toLowerCase().includes(query);
        const matchSubj = subjText.includes(query);
        if (!matchTitle && !matchNotes && !matchSubj) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    container.innerHTML = '';

    filtered.forEach(item => {
      const isCompleted = item.status === 'completed';
      const isTarget = this.dailyTarget.targetItemIds.includes(item.id);
      const subj = this.exam.subjects.find(s => s.id === item.subjectId) || { name: 'Course', code: 'SUBJ', colorIdx: 0 };
      const color = SUBJECT_COLORS[subj.colorIdx || 0];

      const itemCard = document.createElement('div');
      itemCard.className = `todo-card group p-3.5 sm:p-4 rounded-xl transition-all ${
        isCompleted ? 'completed bg-slate-50/70 border border-slate-100' : 'bg-white hover:bg-slate-50/50 border border-slate-200'
      } flex items-start sm:items-center justify-between gap-3 mb-2`;

      itemCard.innerHTML = `
        <!-- Left: Checkbox & Title -->
        <div class="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <!-- Checkbox -->
          <button type="button" onclick="app.toggleItemStatus('${item.id}')"
            class="mt-0.5 sm:mt-0 w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
              isCompleted 
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                : 'border-slate-300 hover:border-brand-500 text-transparent'
            }">
            <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
          </button>

          <!-- Content Details -->
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <!-- Subject Badge -->
              <span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${color.badge} border ${color.border}">
                ${subj.code || subj.name}
              </span>

              <!-- Type Badge -->
              <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                item.type === 'lecture' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
              }">
                <i data-lucide="${item.type === 'lecture' ? 'file-text' : 'clipboard-list'}" class="w-3 h-3 inline mr-1"></i>
                ${item.type === 'lecture' ? 'Lecture' : 'Tutorial'}
              </span>

              <!-- Daily Target Badge -->
              ${isTarget ? `
                <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-1">
                  <i data-lucide="target" class="w-3 h-3"></i> Today's Target
                </span>
              ` : ''}

              <!-- Revision Badge -->
              ${item.needsRevision ? `
                <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <i data-lucide="refresh-cw" class="w-3 h-3"></i> Needs Revision (${item.revisionCount || 1})
                </span>
              ` : ''}
            </div>

            <!-- Item Title -->
            <h4 class="item-title font-semibold text-sm sm:text-base text-slate-800 break-words">
              ${this.escapeHtml(item.title)}
            </h4>

            <!-- Secondary details: Notes snippet, pages, date completed -->
            <div class="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
              ${item.pages ? `<span>${item.pages} pages</span>` : ''}
              ${item.notes ? `
                <span class="text-indigo-600 font-medium flex items-center gap-1">
                  <i data-lucide="message-square" class="w-3 h-3"></i> Has Notes
                </span>
              ` : ''}
              ${isCompleted && item.completedAt ? `
                <span class="text-emerald-600 font-medium">Completed on ${new Date(item.completedAt).toLocaleDateString()}</span>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Right: Action Buttons -->
        <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          
          <!-- Today Target Pin Button -->
          <button type="button" onclick="app.toggleDailyTargetItem('${item.id}')"
            title="${isTarget ? 'Remove from today\'s target' : 'Pin to today\'s target'}"
            class="p-1.5 sm:p-2 rounded-xl border text-xs transition ${
              isTarget 
                ? 'bg-amber-100 border-amber-300 text-amber-800' 
                : 'border-slate-200 text-slate-400 hover:text-amber-600 hover:bg-amber-50'
            }">
            <i data-lucide="target" class="w-4 h-4"></i>
          </button>

          <!-- Revision Toggle -->
          <button type="button" onclick="app.toggleNeedsRevision('${item.id}')"
            title="${item.needsRevision ? 'Mark as revised' : 'Mark for revision'}"
            class="p-1.5 sm:p-2 rounded-xl border text-xs transition ${
              item.needsRevision 
                ? 'bg-rose-100 border-rose-300 text-rose-800' 
                : 'border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
            }">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          </button>

          <!-- Notes Button -->
          <button type="button" onclick="app.openItemNotes('${item.id}')"
            title="Add notes, doubts, or formulas"
            class="p-1.5 sm:p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition">
            <i data-lucide="pencil" class="w-4 h-4"></i>
          </button>

          <!-- Delete Button -->
          <button type="button" onclick="app.deleteItem('${item.id}')"
            title="Delete this topic"
            class="p-1.5 sm:p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>

        </div>
      `;

      container.appendChild(itemCard);
    });

    if (window.lucide) lucide.createIcons();
  }

  showDashboardIfActive() {
    if (this.exam && !this.exam.isArchived) {
      this.resetFilters();
    }
  }

  // ================= SAMPLE DEMO DATA =================
  loadSampleData() {
    const confirmed = confirm('Load sample engineering semester data (Data Structures, OS, DBMS & Maths) to test the app?');
    if (!confirmed) return;

    const subjects = [
      { id: 'subj_demo_1', name: 'Data Structures & Algorithms', code: 'CS201', colorIdx: 0 },
      { id: 'subj_demo_2', name: 'Operating Systems', code: 'CS204', colorIdx: 1 },
      { id: 'subj_demo_3', name: 'Database Management Systems', code: 'CS206', colorIdx: 2 },
      { id: 'subj_demo_4', name: 'Discrete Mathematics', code: 'MA201', colorIdx: 3 }
    ];

    const todayStr = this.getTodayString();

    const sampleItems = [
      // DSA
      { id: 'itm_1', subjectId: 'subj_demo_1', title: 'Lec 01: Asymptotic Notations & Recurrence Relations', type: 'lecture', pages: 28, status: 'completed', completedAt: todayStr, needsRevision: false, revisionCount: 1, notes: 'Master Theorem cases are very important for quiz', priority: 'high' },
      { id: 'itm_2', subjectId: 'subj_demo_1', title: 'Lec 02: Binary Search Trees & AVL Balance Rotations', type: 'lecture', pages: 34, status: 'completed', completedAt: todayStr, needsRevision: false, revisionCount: 0, notes: '', priority: 'high' },
      { id: 'itm_3', subjectId: 'subj_demo_1', title: 'Lec 03: Graph Traversals: BFS, DFS & Topological Sort', type: 'lecture', pages: 32, status: 'pending', completedAt: null, needsRevision: true, revisionCount: 0, notes: 'Revise cycle detection algorithm in directed graph', priority: 'high' },
      { id: 'itm_4', subjectId: 'subj_demo_1', title: 'Lec 04: Dynamic Programming: 0/1 Knapsack & LCS', type: 'lecture', pages: 40, status: 'pending', completedAt: null, needsRevision: false, revisionCount: 0, notes: '', priority: 'high' },
      { id: 'itm_5', subjectId: 'subj_demo_1', title: 'Tutorial Sheet 01: Advanced Tree Problems', type: 'tutorial', pages: 12, status: 'completed', completedAt: todayStr, needsRevision: false, revisionCount: 0, notes: '', priority: 'medium' },
      { id: 'itm_6', subjectId: 'subj_demo_1', title: 'Tutorial Sheet 02: Dynamic Programming Matrix Chains', type: 'tutorial', pages: 10, status: 'pending', completedAt: null, needsRevision: false, revisionCount: 0, notes: '', priority: 'medium' },

      // OS
      { id: 'itm_7', subjectId: 'subj_demo_2', title: 'Lec 01: Process State Diagrams & Context Switching', type: 'lecture', pages: 22, status: 'completed', completedAt: todayStr, needsRevision: false, revisionCount: 0, notes: '', priority: 'medium' },
      { id: 'itm_8', subjectId: 'subj_demo_2', title: 'Lec 02: CPU Scheduling Algorithms (SJF, Round Robin)', type: 'lecture', pages: 26, status: 'pending', completedAt: null, needsRevision: false, revisionCount: 0, notes: '', priority: 'medium' },
      { id: 'itm_9', subjectId: 'subj_demo_2', title: 'Lec 03: Process Synchronization & Dining Philosophers', type: 'lecture', pages: 35, status: 'pending', completedAt: null, needsRevision: true, revisionCount: 0, notes: '', priority: 'high' },
      { id: 'itm_10', subjectId: 'subj_demo_2', title: 'Tutorial Sheet 01: Semaphore & Mutex Deadlock Proofs', type: 'tutorial', pages: 8, status: 'pending', completedAt: null, needsRevision: false, revisionCount: 0, notes: '', priority: 'medium' },

      // DBMS
      { id: 'itm_11', subjectId: 'subj_demo_3', title: 'Lec 01: Relational Algebra & Calculus Expressions', type: 'lecture', pages: 25, status: 'completed', completedAt: todayStr, needsRevision: false, revisionCount: 0, notes: '', priority: 'medium' },
      { id: 'itm_12', subjectId: 'subj_demo_3', title: 'Lec 02: Normalization (1NF, 2NF, 3NF & BCNF Proofs)', type: 'lecture', pages: 38, status: 'pending', completedAt: null, needsRevision: false, revisionCount: 0, notes: 'Lossless join & dependency preservation', priority: 'high' },
      { id: 'itm_13', subjectId: 'subj_demo_3', title: 'Tutorial Sheet 01: Complex SQL Queries & Joins', type: 'tutorial', pages: 15, status: 'pending', completedAt: null, needsRevision: false, revisionCount: 0, notes: '', priority: 'medium' },

      // Maths
      { id: 'itm_14', subjectId: 'subj_demo_4', title: 'Lec 01: Propositional Logic & Quantifiers', type: 'lecture', pages: 20, status: 'completed', completedAt: todayStr, needsRevision: false, revisionCount: 0, notes: '', priority: 'low' },
      { id: 'itm_15', subjectId: 'subj_demo_4', title: 'Lec 02: Generating Functions & Recurrence Solving', type: 'lecture', pages: 30, status: 'pending', completedAt: null, needsRevision: true, revisionCount: 0, notes: '', priority: 'high' },
      { id: 'itm_16', subjectId: 'subj_demo_4', title: 'Tutorial Sheet 01: Graph Isomorphism & Coloring', type: 'tutorial', pages: 12, status: 'pending', completedAt: null, needsRevision: false, revisionCount: 0, notes: '', priority: 'medium' }
    ];

    // Pick 3 items for today's target
    const dailyTargetItemIds = ['itm_3', 'itm_8', 'itm_12'];

    this.exam = {
      id: 'exam_demo_2026',
      name: 'Endsem Examinations 2026',
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days later
      subjects: subjects,
      createdAt: new Date().toISOString(),
      lastActiveDate: todayStr,
      streak: 3,
      isArchived: false
    };

    this.items = sampleItems;
    this.dailyTarget = {
      date: todayStr,
      targetItemIds: dailyTargetItemIds,
      targetCount: dailyTargetItemIds.length,
      completedCount: 0
    };

    this.saveToStorage();
    this.showToast('Sample university syllabus loaded successfully!', 'success');
    this.render();
  }

  // ================= UTILITIES: TOASTS & CELEBRATIONS =================
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
      info: 'bg-slate-900 text-white',
      success: 'bg-emerald-600 text-white',
      warning: 'bg-amber-600 text-white',
      error: 'bg-rose-600 text-white'
    };

    toast.className = `toast-item pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  triggerConfetti() {
    if (window.confetti) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  triggerMicroConfetti() {
    if (window.confetti) {
      confetti({
        particleCount: 25,
        spread: 45,
        origin: { y: 0.7 }
      });
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate and initialize on DOM ready
const app = new SyllabusTrackerApp();
window.app = app;

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
