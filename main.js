document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Check for saved theme in localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.className = savedTheme;
    } else {
        // Default to dark mode if system prefers it
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            body.className = 'dark-mode';
        } else {
            body.className = 'light-mode';
        }
    }

    themeToggle.addEventListener('click', () => {
        if (body.classList.contains('light-mode')) {
            body.classList.replace('light-mode', 'dark-mode');
            localStorage.setItem('theme', 'dark-mode');
        } else {
            body.classList.replace('dark-mode', 'light-mode');
            localStorage.setItem('theme', 'light-mode');
        }
        // Repaint Tetris if the function is available (defined later in scope)
        if (typeof draw === 'function') {
            try { draw(); } catch (e) { /* canvas not ready */ }
        }
    });

    // Mobile Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            body.classList.toggle('menu-open');
        });

        // Close menu when clicking links
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                body.classList.remove('menu-open');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
                navLinks.classList.remove('active');
                body.classList.remove('menu-open');
            }
        });
    }

    // Simple scroll reveal
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.days-section').forEach(section => {
        section.classList.add('pre-reveal');
        observer.observe(section);
    });

    // Update Schedule Highlighting
    function updateScheduleHighlighting() {
        const now = new Date();
        const currentDay = now.getDay(); // 0 (Sun) to 6 (Sat)
        const currentTime = now.getHours() * 60 + now.getMinutes();

        // Remove old highlights
        document.querySelectorAll('.schedule-item').forEach(item => {
            item.classList.remove('current-lesson', 'next-lesson');
        });

        let currentLessonFound = false;
        let nextLessonFound = false;

        // First pass: look for current lesson
        document.querySelectorAll('.schedule-day').forEach(dayElement => {
            const dayIndex = parseInt(dayElement.dataset.day);
            if (dayIndex !== currentDay) return;

            const items = dayElement.querySelectorAll('.schedule-item[data-start]');
            items.forEach(item => {
                const [startH, startM] = item.dataset.start.split(':').map(Number);
                const [endH, endM] = item.dataset.end.split(':').map(Number);
                const startTime = startH * 60 + startM;
                const endTime = endH * 60 + endM;

                if (currentTime >= startTime && currentTime <= endTime) {
                    item.classList.add('current-lesson');
                    currentLessonFound = true;
                }
            });
        });

        // Second pass: look for next lesson ONLY if no current lesson exists
        if (!currentLessonFound) {
            document.querySelectorAll('.schedule-day').forEach(dayElement => {
                const dayIndex = parseInt(dayElement.dataset.day);
                const items = dayElement.querySelectorAll('.schedule-item[data-start]');

                items.forEach(item => {
                    const [startH, startM] = item.dataset.start.split(':').map(Number);
                    const startTime = startH * 60 + startM;

                    if (dayIndex === currentDay) {
                        if (currentTime < startTime && !nextLessonFound) {
                            item.classList.add('next-lesson');
                            nextLessonFound = true;
                        }
                    } else if (dayIndex > currentDay && !nextLessonFound) {
                        item.classList.add('next-lesson');
                        nextLessonFound = true;
                    }
                });
            });

            // If it's weekend or late Friday, highlight Monday morning
            if (!nextLessonFound) {
                 const firstMondayLesson = document.querySelector('.schedule-day[data-day="1"] .schedule-item[data-start]');
                 if (firstMondayLesson) firstMondayLesson.classList.add('next-lesson');
            }
        }
    }

    updateScheduleHighlighting();
    setInterval(updateScheduleHighlighting, 60000);

    // Kanban Logic
    const kanbanData = JSON.parse(localStorage.getItem('kanbanTasksV2')) || {
        todo: [],
        doing: [],
        done: []
    };

    // Flatpickr Initialization
    const datePicker = flatpickr("#task-deadline", {
        altInput: true,
        altFormat: "F j, Y",
        dateFormat: "Y-m-d",
        locale: {
            firstDayOfWeek: 1,
            weekdays: {
                shorthand: ["Sv", "Pr", "Ot", "Tr", "Ce", "Pk", "Se"],
                longhand: ["Svētdiena", "Pirmdiena", "Otrdiena", "Trešdiena", "Ceturtdiena", "Piektdiena", "Sestdiena"]
            },
            months: {
                shorthand: ["Jan", "Feb", "Mar", "Apr", "Mai", "Jūn", "Jūl", "Aug", "Sep", "Okt", "Nov", "Dec"],
                longhand: ["Janvāris", "Februāris", "Marts", "Aprīlis", "Maijs", "Jūnijs", "Jūlijs", "Augusts", "Septembris", "Oktobris", "Novembris", "Decembris"]
            }
        }
    });

    const modal = document.getElementById('task-modal');
    const openModalBtn = document.getElementById('open-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const saveTaskBtn = document.getElementById('save-task');
    const clearAllBtn = document.getElementById('clear-all');

    let editingCard = null;

    function saveTasks() {
        const data = { todo: [], doing: [], done: [] };
        document.querySelectorAll('.kanban-column').forEach(col => {
            const list = col.querySelector('.task-list');
            if (list) {
                Array.from(list.children).forEach(card => {
                    const titleEl = card.querySelector('.task-title');
                    const prioEl = card.querySelector('.tag-prio');
                    const compEl = card.querySelector('.tag-comp');
                    const deadlineEl = card.querySelector('.card-deadline');
                    
                    if (titleEl && prioEl && compEl) {
                        data[col.id].push({
                            title: titleEl.innerText,
                            priority: prioEl.innerText,
                            complexity: compEl.innerText,
                            deadline: deadlineEl ? deadlineEl.innerText.replace('Termiņš: ', '') : ''
                        });
                    }
                });
            }
        });
        localStorage.setItem('kanbanTasksV2', JSON.stringify(data));
    }

    function openEditModal(card) {
        editingCard = card;
        const title = card.querySelector('.task-title').innerText;
        const priority = card.querySelector('.tag-prio').innerText;
        const complexity = card.querySelector('.tag-comp').innerText;
        const deadlineText = card.querySelector('.card-deadline')?.innerText || '';

        document.getElementById('task-title').value = title;
        document.getElementById('task-priority').value = priority;
        document.getElementById('task-complexity').value = complexity;
        
        const deadline = deadlineText.replace('Termiņš: ', '');
        if (deadline) {
            datePicker.setDate(deadline);
        } else {
            datePicker.clear();
        }
        
        modal.querySelector('h3').innerText = 'Rediģēt uzdevumu';
        modal.classList.add('active');
    }

    function createTaskElement(task) {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        
        // Ensure we don't have duplicate "Termiņš:" prefixes in the data
        const cleanDeadline = task.deadline ? task.deadline.replace('Termiņš: ', '').trim() : '';

        card.innerHTML = `
            <span class="task-title">${task.title}</span>
            <button class="delete-btn">×</button>
            <div class="card-meta">
                <span class="tag tag-prio tag-prio-${task.priority.toLowerCase()}">${task.priority}</span>
                <span class="tag tag-comp">${task.complexity}</span>
            </div>
            ${cleanDeadline ? `<span class="card-deadline">Termiņš: ${cleanDeadline}</span>` : ''}
        `;
        
        card.ondblclick = () => openEditModal(card);

        card.ondragstart = (e) => {
            window.draggedItem = card;
            setTimeout(() => card.style.display = 'none', 0);
        };

        card.ondragend = () => {
            card.style.display = 'block';
            saveTasks();
        };

        card.querySelector('.delete-btn').onclick = (e) => {
            e.stopPropagation();
            card.remove();
            saveTasks();
        };

        return card;
    }

    openModalBtn.onclick = () => {
        editingCard = null;
        modal.querySelector('h3').innerText = 'Jauns uzdevums';
        document.getElementById('task-title').value = '';
        datePicker.clear();
        modal.classList.add('active');
    };

    closeModalBtn.onclick = () => modal.classList.remove('active');

    saveTaskBtn.onclick = () => {
        const title = document.getElementById('task-title').value;
        const priority = document.getElementById('task-priority').value;
        const complexity = document.getElementById('task-complexity').value;
        const deadline = document.getElementById('task-deadline').value;

        if (title) {
            const task = { title, priority, complexity, deadline };
            
            if (editingCard) {
                // Update existing card
                editingCard.querySelector('.task-title').innerText = title;
                const prioTag = editingCard.querySelector('.tag-prio');
                prioTag.innerText = priority;
                prioTag.className = `tag tag-prio tag-prio-${priority.toLowerCase()}`;
                editingCard.querySelector('.tag-comp').innerText = complexity;
                
                const existingDeadline = editingCard.querySelector('.card-deadline');
                if (deadline) {
                    if (existingDeadline) {
                        existingDeadline.innerText = `Termiņš: ${deadline}`;
                    } else {
                        const deadlineSpan = document.createElement('span');
                        deadlineSpan.className = 'card-deadline';
                        deadlineSpan.innerText = `Termiņš: ${deadline}`;
                        editingCard.appendChild(deadlineSpan);
                    }
                } else if (existingDeadline) {
                    existingDeadline.remove();
                }
            } else {
                // Create new card
                document.querySelector('#todo .task-list').appendChild(createTaskElement(task));
            }
            
            saveTasks();
            modal.classList.remove('active');
        } else {
            alert('Lūdzu, ievadi nosaukumu!');
        }
    };

    clearAllBtn.onclick = () => {
        if (confirm('Vai tiešām vēlies izdzēst visus uzdevumus?')) {
            document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
            saveTasks();
        }
    };

    window.allowDrop = (e) => e.preventDefault();

    window.drop = (e) => {
        e.preventDefault();
        const column = e.target.closest('.kanban-column');
        if (column && window.draggedItem) {
            column.querySelector('.task-list').appendChild(window.draggedItem);
            
            // Confetti effect if dropped into Done: firing from sides
            if (column.id === 'done') {
                const count = 200;
                const defaults = {
                    origin: { y: 0.7 },
                    colors: ['#4d8df0', '#2454c7', '#0b2a6b', '#ffffff']
                };

                function fire(particleRatio, opts) {
                    confetti({
                        ...defaults,
                        ...opts,
                        particleCount: Math.floor(count * particleRatio)
                    });
                }

                fire(0.25, { spread: 26, startVelocity: 55, origin: { x: 0, y: 0.7 }, angle: 60 });
                fire(0.25, { spread: 26, startVelocity: 55, origin: { x: 1, y: 0.7 }, angle: 120 });
                fire(0.2, { spread: 60, origin: { x: 0, y: 0.7 }, angle: 60 });
                fire(0.2, { spread: 60, origin: { x: 1, y: 0.7 }, angle: 120 });
            }
            
            saveTasks();
        }
    };

    // Load initial tasks
    Object.keys(kanbanData).forEach(col => {
        const list = document.querySelector(`#${col} .task-list`);
        if (list) {
            kanbanData[col].forEach(task => {
                list.appendChild(createTaskElement(task));
            });
        }
    });

    // Stats Animation Logic
    const animateCounters = () => {
        const counters = document.querySelectorAll('.stat-value');
        const duration = 2500;

        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            let startTime = null;

            const updateCount = (currentTime) => {
                if (!startTime) startTime = currentTime;
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const currentCount = Math.floor(easeOut * target);

                counter.innerText = currentCount;

                if (progress < 1) {
                    requestAnimationFrame(updateCount);
                } else {
                    counter.innerText = target;
                }
            };
            requestAnimationFrame(updateCount);
        });
    };

    // Lightbox Elements
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');

    if (lightbox) {
        document.querySelector('.lightbox-close').onclick = () => {
            lightbox.classList.remove('active');
        };

        lightbox.onclick = (e) => {
            if (e.target === lightbox) lightbox.classList.remove('active');
        };
    }

    // Gallery Album Logic
    const galleryData = {
        pirmdiena: [
            { type: 'large', img: 'pirmdiena.png', tag: 'Studijas', title: 'Pirmdienas agrais kods' },
            { type: '', img: 'hero.png', tag: 'Vide', title: 'Kārtojam darba vietu' },
            { type: '', img: 'otrdiena.png', tag: 'Resursi', title: 'Grāmatu kalni' }
        ],
        otrdiena: [
            { type: 'wide', img: 'otrdiena.png', tag: 'Lekcija', title: 'Algoritmu nodaļas telpā' },
            { type: '', img: 'pirmdiena.png', tag: 'Atpūta', title: 'Kafijas pauze' },
            { type: 'tall', img: 'hero.png', tag: 'Komanda', title: 'Grupas darba sesija' }
        ],
        tresdiena: [
            { type: 'tall', img: 'otrdiena.png', tag: 'Projekts', title: 'Tīmekļa dizaina demo' },
            { type: 'wide', img: 'pirmdiena.png', tag: 'Analīze', title: 'Testēšanas fāze' }
        ],
        ceturtdiena: [
            { type: '', img: 'pirmdiena.png', tag: 'Sports', title: 'Galda teniss' },
            { type: 'large', img: 'otrdiena.png', tag: 'Kods', title: 'Vēlā ceturtdienas debug' }
        ],
        piektdiena: [
            { type: 'large', img: 'otrdiena.png', tag: 'Brīvība', title: 'Nedēļas finišs' },
            { type: '', img: 'hero.png', tag: 'Atmosfēra', title: 'Saulriets pie LU' }
        ]
    };

    const daySelectionView = document.getElementById('day-selection-view');
    const albumView = document.getElementById('album-view');
    const albumGrid = document.getElementById('album-grid');
    const currentDayTitle = document.getElementById('current-day-title');
    const backBtn = document.querySelector('.back-btn');

    function openAlbum(day) {
        const photos = galleryData[day];
        if (!photos) return;

        albumGrid.innerHTML = '';
        currentDayTitle.innerText = day.charAt(0).toUpperCase() + day.slice(1);

        photos.forEach(photo => {
            const item = document.createElement('div');
            item.className = `bento-item ${photo.type}`;
            item.style.backgroundImage = `url('${photo.img}')`;
            item.innerHTML = `
                <div class="bento-overlay">
                    <span class="bento-tag">${photo.tag}</span>
                    <h3>${photo.title}</h3>
                </div>
            `;
            
            item.onclick = () => {
                const title = item.querySelector('h3').innerText;
                const tag = item.querySelector('.bento-tag').innerText;
                lightboxImg.src = photo.img;
                lightboxCaption.innerText = `${tag}: ${title}`;
                lightbox.classList.add('active');
            };

            albumGrid.appendChild(item);
        });

        daySelectionView.classList.add('hidden');
        albumView.classList.remove('hidden');
        window.location.hash = 'galerija';
    }

    document.querySelectorAll('.day-folder').forEach(folder => {
        folder.addEventListener('click', () => {
            openAlbum(folder.dataset.day);
        });
    });

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            albumView.classList.add('hidden');
            daySelectionView.classList.remove('hidden');
        });
    }

    // Stats Counter Animation
    const statsSection = document.querySelector('#dati');
    if (statsSection) {
        const observerStats = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                animateCounters();
                observerStats.unobserve(statsSection);
            }
        }, { threshold: 0.2 });
        observerStats.observe(statsSection);
    }
    // Human-like Typing Animation
    const codeContainer = document.getElementById('typing-code');
    const codeSnippet = [
        { text: 'const student = {', delay: 500, correct: 'const student = {' },
        { text: '  name: "Marta Karīna Skrastiņa",', delay: 300, correct: '  name: "Marta Karīna Skrastiņa",' },
        { text: '  major: "Computer Scienc",', typo: true, correct: '  major: "Computer Science",', delay: 400 },
        { text: '  university: "LU",', delay: 200, correct: '  university: "LU",' },
        { text: '  status: "Coding...",', delay: 300, correct: '  status: "Coding...",' },
        { text: '  isProductive: () => true', delay: 500, correct: '  isProductive: () => true' },
        { text: '};', delay: 200, correct: '};' }
    ];

    let isTyping = false;

    const highlightCode = (text) => {
        // Safe highlighting: prevents matching inside already created HTML tags
        let html = text.replace(/(".+?")/g, '<span class="code-str">$1</span>');
        html = html.replace(/\b(const|true|false)\b(?![^<]*>)/g, '<span class="code-kw">$1</span>');
        html = html.replace(/\b(\w+)(?=:)(?![^<]*>)/g, '<span class="code-var">$1</span>');
        html = html.replace(/(\w+)(?=\s*\()(?![^<]*>)/g, '<span class="code-func">$1</span>');
        return html;
    };

    const typeLine = async (lineData) => {
        const fullText = lineData.text;
        const currentDiv = document.createElement('div');
        codeContainer.appendChild(currentDiv);
        
        // Type the initial text (with potential typo)
        for (let i = 0; i <= fullText.length; i++) {
            currentDiv.innerHTML = highlightCode(fullText.substring(0, i)) + '<span class="cursor"></span>';
            await new Promise(r => setTimeout(r, 30 + Math.random() * 40));
        }

        // If it's a typo, wait, backspace, and correct
        if (lineData.typo) {
            await new Promise(r => setTimeout(r, 800));
            const mistakeChars = 7; // Number of chars to delete
            for (let i = fullText.length; i >= fullText.length - mistakeChars; i--) {
                currentDiv.innerHTML = highlightCode(fullText.substring(0, i)) + '<span class="cursor"></span>';
                await new Promise(r => setTimeout(r, 60));
            }
            
            await new Promise(r => setTimeout(r, 300));
            const correctText = lineData.correct;
            const startCorrectPos = fullText.length - mistakeChars;
            
            for (let i = startCorrectPos; i <= correctText.length; i++) {
                currentDiv.innerHTML = highlightCode(correctText.substring(0, i)) + '<span class="cursor"></span>';
                await new Promise(r => setTimeout(r, 80));
            }
        }

        // Finalize line
        currentDiv.innerHTML = highlightCode(lineData.correct || fullText);
        await new Promise(r => setTimeout(r, lineData.delay));
    };

    const startTypingSequence = async () => {
        if (!codeContainer) return;
        codeContainer.innerHTML = '';
        for (const line of codeSnippet) {
            await typeLine(line);
        }
        const finalCursor = document.createElement('span');
        finalCursor.className = 'cursor';
        codeContainer.appendChild(finalCursor);
    };

    const authorSection = document.querySelector('#autors');
    if (authorSection && codeContainer) {
        const observerAuthor = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isTyping) {
                isTyping = true;
                startTypingSequence();
                observerAuthor.unobserve(authorSection);
            }
        }, { threshold: 0.2 });
        observerAuthor.observe(authorSection);
    }

    // Scroll Progress Bar
    const progressBar = document.getElementById('scroll-progress');
    window.onscroll = () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        if (progressBar) progressBar.style.width = scrolled + "%";
    };

    // --- GRAND QUIZ LOGIC ---
    const grandQuizData = [
        {
            question: "Kāds ir labākais veids, kā sākt rītu pie Raiņa 19?",
            options: ["Kafija no automāta 1. stāvā", "Lekcija pulksten 8:30", "Mēģināt atrast brīvu rozeti bibliotēkā", "Gulēt mājās un skatīties ierakstu"],
            answer: 0
        },
        {
            question: "Kur Datorikas nodaļas students pavada visvairāk laika pirms sesijas?",
            options: ["Kafejnīcā 'Lulu'", "LU Bibliotēkā vai 3. stāva gaitenī", "Sporta zālē", "Mākslas muzejā"],
            answer: 1
        },
        {
            question: "Ko nozīmē Git komanda 'git commit'?",
            options: ["Izdzēst visas kļūdas kodā", "Nosūtīt kodu uzreiz pasniedzējam", "Piefiksēt izmaiņas un pievienot aprakstu", "Izslēgt datoru un iet gulēt"],
            answer: 2
        },
        {
            question: "Kura ir datorstudentu vissvarīgākā vietne kļūdu meklēšanai?",
            options: ["TikTok", "Stack Overflow", "Wikipedia", "Latvijas Vēstnesis"],
            answer: 1
        },
        {
            question: "Kā sauc sistēmu, kurā apskatāmas gala atzīmes?",
            options: ["Instagram", "E-klase", "LUIS", "LinkedIn"],
            answer: 2
        }
    ];

    let currentQuestionIndex = 0;
    let score = 0;

    const quizStartView = document.getElementById('quiz-start-view');
    const quizQuestionView = document.getElementById('quiz-question-view');
    const quizResultView = document.getElementById('quiz-result-view');
    const quizStartBtn = document.getElementById('start-grand-quiz');
    const quizRestartBtn = document.getElementById('restart-quiz');
    const optionsGrid = document.getElementById('grand-quiz-options');
    const questionText = document.getElementById('grand-quiz-question');
    const questionBadge = document.getElementById('question-number');
    const quizProgressBar = document.getElementById('quiz-progress-bar');

    function showQuestion() {
        const q = grandQuizData[currentQuestionIndex];
        questionText.innerText = q.question;
        questionBadge.innerText = `Jautājums ${currentQuestionIndex + 1} / ${grandQuizData.length}`;
        
        // Update bar
        const progress = ((currentQuestionIndex) / grandQuizData.length) * 100;
        quizProgressBar.style.width = progress + "%";

        optionsGrid.innerHTML = '';
        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.innerText = opt;
            btn.onclick = () => handleAnswer(idx);
            optionsGrid.appendChild(btn);
        });
    }

    function handleAnswer(selectedIndex) {
        const correctIndex = grandQuizData[currentQuestionIndex].answer;
        const allBtns = optionsGrid.querySelectorAll('.quiz-option-btn');
        allBtns.forEach(b => b.disabled = true);

        if (selectedIndex === correctIndex) {
            allBtns[selectedIndex].classList.add('correct');
            score++;
            confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
        } else {
            allBtns[selectedIndex].classList.add('wrong');
            allBtns[correctIndex].classList.add('correct');
        }

        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex < grandQuizData.length) {
                showQuestion();
            } else {
                showResult();
            }
        }, 1500);
    }

    function showResult() {
        quizQuestionView.classList.add('hidden');
        quizResultView.classList.remove('hidden');
        quizProgressBar.style.width = "100%";
        
        document.getElementById('final-score').innerText = score;
        document.getElementById('total-questions').innerText = grandQuizData.length;

        const resultIcon = document.getElementById('result-icon');
        const resultTitle = document.getElementById('result-title');
        const resultDesc = document.getElementById('result-description');

        if (score === grandQuizData.length) {
            resultIcon.innerText = "🏆";
            resultTitle.innerText = "Izcili! Esi gatavs sesijai!";
            resultDesc.innerText = "Tu pārzini Datorikas fakultāti kā savus piecus pirkstus. Programmētāja gods ir drošībā!";
            confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        } else if (score >= 3) {
            resultIcon.innerText = "🥈";
            resultTitle.innerText = "Labs darbs!";
            resultDesc.innerText = "Tev ir labas zināšanas par studentu dzīvi. Mazliet vēl jāpatrenējas un būsi pro!";
        } else {
            resultIcon.innerText = "🥉";
            resultTitle.innerText = "Ir kur augt!";
            resultDesc.innerText = "Iespējams, esi vēl pirmajā kursā vai par maz laika pavadi LU bibliotēkā. Turpini mācīties!";
        }
    }

    if (quizStartBtn) {
        quizStartBtn.onclick = () => {
            quizStartView.classList.add('hidden');
            quizQuestionView.classList.remove('hidden');
            currentQuestionIndex = 0;
            score = 0;
            showQuestion();
        };
    }

    if (quizRestartBtn) {
        quizRestartBtn.onclick = () => {
            quizResultView.classList.add('hidden');
            quizStartView.classList.remove('hidden');
        };
    }

    // --- FOCUS CENTER LOGIC ---
    const mainDisplay = document.getElementById('main-display');
    const focusTabs = document.querySelectorAll('.focus-tab');
    const timerPresets = document.getElementById('timer-presets');
    const timerControls = document.getElementById('timer-controls');
    const timerStartBtn = document.getElementById('timer-start');
    const timerPauseBtn = document.getElementById('timer-pause');
    const timerResetBtn = document.getElementById('timer-reset');

    let currentMode = 'clock'; // clock, timer, stopwatch
    let timerInterval = null;
    let timeRemaining = 0; // for timer
    let stopwatchTime = 0; // for stopwatch

    function formatTime(ms, showMs = false) {
        const totalSeconds = Math.floor(ms / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        
        const hStr = h.toString().padStart(2, '0');
        const mStr = m.toString().padStart(2, '0');
        const sStr = s.toString().padStart(2, '0');

        if (showMs) {
            const milliseconds = Math.floor((ms % 1000) / 10);
            return `${mStr}:${sStr}:${milliseconds.toString().padStart(2, '0')}`;
        }
        return `${hStr}:${mStr}:${sStr}`;
    }

    function updateDisplay() {
        if (currentMode === 'clock') {
            const now = new Date();
            mainDisplay.innerText = now.toLocaleTimeString('lv-LV', { hour12: false });
        } else if (currentMode === 'timer') {
            mainDisplay.innerText = formatTime(timeRemaining * 1000);
        } else if (currentMode === 'stopwatch') {
            mainDisplay.innerText = formatTime(stopwatchTime);
        }
    }

    function stopLogic() {
        clearInterval(timerInterval);
        timerInterval = null;
        timerStartBtn.classList.remove('hidden');
        timerPauseBtn.classList.add('hidden');
    }

    focusTabs.forEach(tab => {
        tab.onclick = () => {
            focusTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;
            
            stopLogic();
            timerResetBtn.classList.add('hidden');
            
            if (currentMode === 'clock') {
                timerPresets.classList.add('hidden');
                timerControls.classList.add('hidden');
                timerInterval = setInterval(updateDisplay, 1000);
            } else if (currentMode === 'timer') {
                timerPresets.classList.remove('hidden');
                timerControls.classList.remove('hidden');
                timeRemaining = 25 * 60;
                timerResetBtn.classList.remove('hidden');
            } else if (currentMode === 'stopwatch') {
                timerPresets.classList.add('hidden');
                timerControls.classList.remove('hidden');
                stopwatchTime = 0;
                timerResetBtn.classList.remove('hidden');
            }
            updateDisplay();
        };
    });

    timerStartBtn.onclick = () => {
        timerStartBtn.classList.add('hidden');
        timerPauseBtn.classList.remove('hidden');
        timerResetBtn.classList.remove('hidden');

        if (currentMode === 'timer') {
            const startTime = Date.now();
            const initialRemaining = timeRemaining;
            timerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                timeRemaining = initialRemaining - elapsed;
                if (timeRemaining <= 0) {
                    timeRemaining = 0;
                    stopLogic();
                    alert('Fokusa sesija beigusies!');
                }
                updateDisplay();
            }, 1000);
        } else if (currentMode === 'stopwatch') {
            const startTime = Date.now() - stopwatchTime;
            timerInterval = setInterval(() => {
                stopwatchTime = Date.now() - startTime;
                updateDisplay();
            }, 50);
        }
    };

    timerPauseBtn.onclick = stopLogic;

    timerResetBtn.onclick = () => {
        stopLogic();
        if (currentMode === 'timer') {
            timeRemaining = 25 * 60;
        } else if (currentMode === 'stopwatch') {
            stopwatchTime = 0;
        }
        updateDisplay();
    };

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
            stopLogic();
            timeRemaining = parseInt(btn.dataset.time) * 60;
            updateDisplay();
        };
    });

    // Initialize clock mode
    timerInterval = setInterval(updateDisplay, 1000);

    // --- KONAMI CODE & TETRIS EASTER EGG ---
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;

    document.addEventListener('keydown', (e) => {
        if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                activateEasterEgg();
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0;
        }
    });

    const tetrisOverlay = document.getElementById('tetris-overlay');
    const tetrisCanvas = document.getElementById('tetris-canvas');
    const tetrisCtx = tetrisCanvas.getContext('2d');
    const tetrisScoreEl = document.getElementById('tetris-score');
    const startTetrisBtn = document.getElementById('start-tetris');
    const closeTetrisBtn = document.getElementById('close-tetris');

    let scoreValue = 0;
    let grid = createMatrix(12, 20);
    let player = {
        pos: { x: 0, y: 0 },
        matrix: null,
        score: 0
    };

    function createMatrix(w, h) {
        const matrix = [];
        while (h--) {
            matrix.push(new Array(w).fill(0));
        }
        return matrix;
    }

    function createPiece(type) {
        if (type === 'I') {
            return [
                [0, 1, 0, 0],
                [0, 1, 0, 0],
                [0, 1, 0, 0],
                [0, 1, 0, 0],
            ];
        } else if (type === 'L') {
            return [
                [0, 2, 0],
                [0, 2, 0],
                [0, 2, 2],
            ];
        } else if (type === 'J') {
            return [
                [0, 3, 0],
                [0, 3, 0],
                [3, 3, 0],
            ];
        } else if (type === 'O') {
            return [
                [4, 4],
                [4, 4],
            ];
        } else if (type === 'Z') {
            return [
                [5, 5, 0],
                [0, 5, 5],
                [0, 0, 0],
            ];
        } else if (type === 'S') {
            return [
                [0, 6, 6],
                [6, 6, 0],
                [0, 0, 0],
            ];
        } else if (type === 'T') {
            return [
                [0, 7, 0],
                [7, 7, 7],
                [0, 0, 0],
            ];
        }
    }

    function getTetrisTheme() {
        const isDark = document.body.classList.contains('dark-mode');
        const css = getComputedStyle(document.body);
        const accent = css.getPropertyValue('--accent-color').trim() || '#2454c7';
        const accentDeep = css.getPropertyValue('--accent-deep').trim() || '#0b2a6b';
        const accentBright = css.getPropertyValue('--accent-bright').trim() || '#4d8df0';
        if (isDark) {
            return {
                bg: '#02050e',
                grid: '#0a142b',
                stroke: '#050a1a',
                blocks: [null, '#9bc1ff', accentBright, accent, '#f9e2af', '#a6e3a1', '#cba6f7', '#89dceb']
            };
        }
        return {
            bg: '#f3f6fc',
            grid: '#e4eaf4',
            stroke: '#ffffff',
            blocks: [null, accent, '#ff8a3d', accentDeep, '#e8b339', '#3aa56b', '#7a3acc', accentBright]
        };
    }

    function draw() {
        const theme = getTetrisTheme();
        tetrisCtx.fillStyle = theme.bg;
        tetrisCtx.fillRect(0, 0, tetrisCanvas.width, tetrisCanvas.height);
        // subtle grid
        tetrisCtx.strokeStyle = theme.grid;
        tetrisCtx.lineWidth = 1;
        for (let x = 0; x <= tetrisCanvas.width; x += 20) {
            tetrisCtx.beginPath();
            tetrisCtx.moveTo(x, 0); tetrisCtx.lineTo(x, tetrisCanvas.height);
            tetrisCtx.stroke();
        }
        for (let y = 0; y <= tetrisCanvas.height; y += 20) {
            tetrisCtx.beginPath();
            tetrisCtx.moveTo(0, y); tetrisCtx.lineTo(tetrisCanvas.width, y);
            tetrisCtx.stroke();
        }
        drawMatrix(grid, { x: 0, y: 0 }, theme);
        drawMatrix(player.matrix, player.pos, theme);
    }

    function drawMatrix(matrix, offset, theme) {
        const colors = (theme || getTetrisTheme()).blocks;
        const stroke = (theme || getTetrisTheme()).stroke;

        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    tetrisCtx.fillStyle = colors[value];
                    tetrisCtx.fillRect((x + offset.x) * 20, (y + offset.y) * 20, 20, 20);
                    tetrisCtx.strokeStyle = stroke;
                    tetrisCtx.lineWidth = 2;
                    tetrisCtx.strokeRect((x + offset.x) * 20 + 1, (y + offset.y) * 20 + 1, 18, 18);
                }
            });
        });
    }

    function merge(grid, player) {
        player.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    grid[y + player.pos.y][x + player.pos.x] = value;
                }
            });
        });
    }

    function collide(grid, player) {
        const [m, o] = [player.matrix, player.pos];
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && (grid[y + o.y] && grid[y + o.y][x + o.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    function gridSweep() {
        let rowCount = 1;
        outer: for (let y = grid.length - 1; y > 0; --y) {
            for (let x = 0; x < grid[y].length; ++x) {
                if (grid[y][x] === 0) {
                    continue outer;
                }
            }
            const row = grid.splice(y, 1)[0].fill(0);
            grid.unshift(row);
            ++y;

            player.score += rowCount * 10;
            rowCount *= 2;
        }
        updateScore();
    }

    function playerDrop() {
        player.pos.y++;
        if (collide(grid, player)) {
            player.pos.y--;
            merge(grid, player);
            playerReset();
            gridSweep();
        }
        dropCounter = 0;
    }

    function playerMove(dir) {
        player.pos.x += dir;
        if (collide(grid, player)) {
            player.pos.x -= dir;
        }
    }

    function playerRotate(dir) {
        const pos = player.pos.x;
        let offset = 1;
        rotate(player.matrix, dir);
        while (collide(grid, player)) {
            player.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > player.matrix[0].length) {
                rotate(player.matrix, -dir);
                player.pos.x = pos;
                return;
            }
        }
    }

    function rotate(matrix, dir) {
        for (let y = 0; y < matrix.length; ++y) {
            for (let x = 0; x < y; ++x) {
                [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
            }
        }
        if (dir > 0) {
            matrix.forEach(row => row.reverse());
        } else {
            matrix.reverse();
        }
    }

    function playerReset() {
        const pieces = 'ILJOTSZ';
        player.matrix = createPiece(pieces[pieces.length * Math.random() | 0]);
        player.pos.y = 0;
        player.pos.x = (grid[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
        if (collide(grid, player)) {
            grid.forEach(row => row.fill(0));
            player.score = 0;
            updateScore();
            alert('SPĒLE BEIGUSIES!');
        }
    }

    function updateScore() {
        tetrisScoreEl.innerText = player.score;
    }

    let dropCounter = 0;
    let dropInterval = 1000;
    let lastTime = 0;
    let gameRunning = false;

    function update(time = 0) {
        if (!gameRunning) return;
        const deltaTime = time - lastTime;
        lastTime = time;

        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }

        draw();
        requestAnimationFrame(update);
    }

    function activateEasterEgg() {
        tetrisOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        playerReset();
        updateScore();
        draw();
    }

    startTetrisBtn.onclick = () => {
        if (!gameRunning) {
            gameRunning = true;
            lastTime = performance.now();
            update();
            startTetrisBtn.innerText = 'Pauzēt';
        } else {
            gameRunning = false;
            startTetrisBtn.innerText = 'Turpināt';
        }
    };

    closeTetrisBtn.onclick = () => {
        gameRunning = false;
        tetrisOverlay.classList.add('hidden');
        document.body.style.overflow = 'auto';
        startTetrisBtn.innerText = 'Sākt Spēli';
    };

    document.addEventListener('keydown', (e) => {
        if (!gameRunning) return;
        if (e.key === 'ArrowLeft') {
            playerMove(-1);
        } else if (e.key === 'ArrowRight') {
            playerMove(1);
        } else if (e.key === 'ArrowDown') {
            playerDrop();
        } else if (e.key === 'ArrowUp') {
            playerRotate(1);
        }
    });

    const openTetrisBtn = document.getElementById('open-tetris-btn');
    if (openTetrisBtn) {
        openTetrisBtn.onclick = activateEasterEgg;
    }

    // --- CUSTOM CURSOR LOGIC ---
    const cursorDot = document.getElementById('cursor-dot');
    const cursorOutline = document.getElementById('cursor-outline');

    if (cursorDot && cursorOutline) {
        window.addEventListener('mousemove', (e) => {
            const posX = e.clientX;
            const posY = e.clientY;

            // Immediate position for dot
            cursorDot.style.left = `${posX}px`;
            cursorDot.style.top = `${posY}px`;

            // Slightly delayed position for outline (smooth effect)
            cursorOutline.animate({
                left: `${posX}px`,
                top: `${posY}px`
            }, { duration: 500, fill: "forwards" });
        });

        // Expand cursor on interactive elements
        const interactives = 'a, button, .day-folder, .bento-item, .stat-card, input, select';
        document.querySelectorAll(interactives).forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-active'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));
        });
    }

    // --- HERO INTERACTIVE LOGIC ---
    const heroSection = document.querySelector('.hero');
    const floatItems = document.querySelectorAll('.float-item');
    const magneticBtn = document.querySelector('.magnetic');

    if (heroSection) {
        heroSection.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            // Parallax for float items
            floatItems.forEach((item, index) => {
                const speed = (index + 1) * 20;
                const x = (centerX - clientX) / speed;
                const y = (centerY - clientY) / speed;
                item.style.transform = `translate(${x}px, ${y}px) rotate(${x/2}deg)`;
            });

            // Magnetic button
            if (magneticBtn) {
                const rect = magneticBtn.getBoundingClientRect();
                const btnCenterX = rect.left + rect.width / 2;
                const btnCenterY = rect.top + rect.height / 2;
                
                const distanceX = clientX - btnCenterX;
                const distanceY = clientY - btnCenterY;
                const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

                if (distance < 100) {
                    magneticBtn.style.transform = `translate(${distanceX * 0.3}px, ${distanceY * 0.3}px)`;
                } else {
                    magneticBtn.style.transform = `translate(0, 0)`;
                }
            }
        });

        heroSection.addEventListener('mouseleave', () => {
            floatItems.forEach(item => item.style.transform = `translate(0, 0) rotate(0)`);
            if (magneticBtn) magneticBtn.style.transform = `translate(0, 0)`;
        });
    }

});
