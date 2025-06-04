// Quiz system logic
const resources = [
    {
        id: 'management_information',
        title: 'Management Information (Video)',
        filename: 'management_information.mp4',
        icon: '📹'
    },
    {
        id: 'introduction_to_management_information',
        title: 'Introduction to Management Information (PDF)',
        filename: 'introduction_to_management_information.pdf',
        icon: '📄'
    },
    {
        id: 'world_of_information_systems',
        title: 'The World of Information Systems (PDF)',
        filename: 'the_world_of_information_systems.pdf',
        icon: '📄'
    },
    {
        id: 'ted_talk_on_MI',
        title: 'TED Talk on Management Information (Video)',
        filename: 'ted_talk_on_MI.mp4',
        icon: '📹'
    }
];

// --- Timer settings per level ---
const TIMER_SETTINGS = {
    easy: { total: 90, color: '#22c55e' }, // 90s, green
    medium: { total: 60, color: '#f59e42' }, // 60s, orange
    hard: { total: 30, color: '#ef4444' } // 30s, red
};

const resourceList = document.querySelector('.resource-list');
const levelSelection = document.getElementById('level-selection');
const quizInterface = document.getElementById('quiz-interface');
const quizCard = document.getElementById('quiz-card');
const quizProgress = document.getElementById('quiz-progress');
const quizResult = document.getElementById('quiz-result');
const timerDisplay = document.getElementById('time-left');
let selectedResource = null;
let selectedLevel = null;
let quizData = [];
let currentQuestion = 0;
let userAnswers = [];
let timer = null;
let timeLeft = 0;
let timerProgressBar = null;

// -- Randomize questions ----
function shuffle(array){
    for (let i = array.length -1; i> 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- Gamification & Analytics ---
let analytics = JSON.parse(localStorage.getItem('quizAnalytics') || '{}');
let points = 0;
let streak = 0;
let badges = [];

function saveAnalytics(resource, level, score, total, timeSpent) {
    const key = `${resource}_${level}`;
    if (!analytics[key]) analytics[key] = { attempts: 0, best: 0, totalScore: 0, totalTime: 0 };
    analytics[key].attempts++;
    analytics[key].totalScore += score;
    analytics[key].totalTime += timeSpent;
    if (score > analytics[key].best) analytics[key].best = score;
    localStorage.setItem('quizAnalytics', JSON.stringify(analytics));
}

function showAnalytics() {
    resultViewStack.push(showAnalytics);
    let html = '<h2>Quiz Analytics</h2><div class="analytics-list">';
    for (const key in analytics) {
        const a = analytics[key];
        html += `<div class="analytics-card"><b>${key.replace(/_/g, ' ').toUpperCase()}</b><br>
        Attempts: ${a.attempts}<br>Best Score: ${a.best}<br>Avg Score: ${(a.totalScore/a.attempts).toFixed(2)}<br>Avg Time: ${(a.totalTime/a.attempts).toFixed(1)}s</div>`;
    }
    html += '</div><button class="back-result-btn">Back</button>';
    quizResult.innerHTML = html;
    quizResult.style.display = 'block';
    setTimeout(() => {
        document.querySelector('.back-result-btn').onclick = popResultView;
    }, 0);
}

// --- Helper: Detect question type ---
function getQuestionType(q) {
    if (q.type === 'text') return 'text';
    if (q.type === 'boolean') return 'boolean';
    if (q.type === 'matching') return 'matching';
    if (Array.isArray(q.correct_answer)) return 'checkbox';
    if (Array.isArray(q.options)) return 'radio';
    return 'unknown';
}

// --- Review Answers ---
function showReview() {
    resultViewStack.push(showReview);
    let html = '<h2>Review Answers</h2>';
    const correctnessArr = window._quizCorrectnessArr || [];
    quizData.forEach((q, i) => {
        const type = getQuestionType(q);
        const user = userAnswers[i];
        let correctIdx;
        if (type === 'checkbox' && Array.isArray(q.options)) {
            correctIdx = Array.isArray(q.correct_answer) ? q.correct_answer.map(a => q.options.indexOf(a)).filter(idx => idx !== -1) : [];
        } else if (type === 'radio' && Array.isArray(q.options)) {
            correctIdx = q.options.indexOf(q.correct_answer);
        } else {
            correctIdx = null;
        }
        html += `<div class="review-block">
            <div class="review-qnum">Question ${i+1}</div>
            <div class="review-question">${q.question}</div>
            <div class="review-options">`;
        if (type === 'radio' && Array.isArray(q.options)) {
            html += q.options.map((opt, j) => {
                let cls = '';
                if (j === correctIdx) cls = 'correct';
                if (j === user && j !== correctIdx) cls = 'incorrect';
                return `<span class="review-option ${cls}">${opt}</span>`;
            }).join('');
        } else if (type === 'checkbox' && Array.isArray(q.options)) {
            html += q.options.map((opt, j) => {
                let cls = '';
                if (correctIdx.includes(j)) cls = 'correct';
                if ((user || []).includes(j) && !correctIdx.includes(j)) cls = 'incorrect';
                return `<span class="review-option ${cls}">${opt}</span>`;
            }).join('');
        } else if (type === 'text') {
            let cls = correctnessArr[i] ? 'correct' : 'incorrect';
            html += `<span class="review-option ${cls}">${user || '<i>No answer</i>'}</span>`;
        } else if (type === 'boolean') {
            let userVal = user === 'True' || user === true || user === 1 || user === '1' ? 'True' : 'False';
            let correctVal = q.correct_answer === true || q.correct_answer === 'True' || q.correct_answer === 1 || q.correct_answer === '1' ? 'True' : 'False';
            let cls = userVal === correctVal ? 'correct' : 'incorrect';
            html += `<span class="review-option ${cls}">${userVal}</span>`;
            html += `<span class="review-correct">Correct: <b>${correctVal}</b></span>`;
        } else if (type === 'matching' && q.options && typeof q.options === 'object') {
            // Matching review UI
            const userMatch = user || {};
            const correctMatch = q.correct_answer || {};
            const categories = Object.keys(q.options);
            html += '<div class="review-matching">';
            categories.forEach(cat => {
                html += `<div class="review-matching-cat"><b>${cat}</b>:`;
                const userItems = (userMatch[cat] || []);
                const correctItems = (correctMatch[cat] || []);
                // Show user answer with correct/incorrect feedback
                if (userItems.length === 0) {
                    html += ' <span class="review-option incorrect"><i>No answer</i></span>';
                } else {
                    userItems.forEach(item => {
                        const isCorrect = correctItems.includes(item);
                        html += `<span class="review-option ${isCorrect ? 'correct' : 'incorrect'}">${item}</span>`;
                    });
                }
                // Show correct answer if any incorrect
                if (userItems.length !== correctItems.length || userItems.some(item => !correctItems.includes(item))) {
                    html += `<br><span class="review-correct">Correct: <b>${correctItems.join(', ')}</b></span>`;
                }
                html += '</div>';
            });
            html += '</div>';
        }
        html += `</div><div class="review-meta">`;
        if (type === 'radio' && Array.isArray(q.options)) {
            html += `<span class="review-your">Your answer: <b>${q.options && user !== undefined ? q.options[user] : 'None'}</b></span><span class="review-correct">Correct: <b>${q.correct_answer}</b></span>`;
        } else if (type === 'checkbox' && Array.isArray(q.options)) {
            html += `<span class="review-your">Your answer: <b>${(user||[]).map(idx => q.options && q.options[idx]).join(', ') || 'None'}</b></span><span class="review-correct">Correct: <b>${q.correct_answer && q.correct_answer.join ? q.correct_answer.join(', ') : ''}</b></span>`;
        } else if (type === 'text') {
            html += `<span class="review-your">Your answer: <b>${user || 'None'}</b></span><span class="review-correct">Model answer: <b>${q.model_answer || 'N/A'}</b></span>`;
        }
        html += `</div><div class="review-explanation">
                <b>Explanation:</b> ${q.explanation ? q.explanation : 'For more information, review the related resource or consult your course material.'}
            </div>
        </div>`;
    });
    html += '<button class="back-result-btn">Back</button>';
    quizResult.innerHTML = html;
    quizResult.style.display = 'block';
    setTimeout(() => {
        document.querySelector('.back-result-btn').onclick = popResultView;
    }, 0);
}

// --- Gamification: Points, Streaks, Badges ---
function updateGamification(correct, total, timeSpent) {
    points += correct * 10;
    // Only add badges for this quiz attempt, not accumulate duplicates
    let newBadges = [];
    if (correct === total && !badges.includes('Perfect Score')) newBadges.push('Perfect Score');
    if (timeSpent < total * 20 && !badges.includes('Fast Finisher')) newBadges.push('Fast Finisher');
    if (streak + 1 >= 3 && !badges.includes('Quiz Streak')) newBadges.push('Quiz Streak');
    if (correct === total) {
        streak++;
    } else {
        streak = 0;
    }
    badges = [...badges, ...newBadges];
    badges = [...new Set(badges)]; // Remove any accidental duplicates
    localStorage.setItem('quizPoints', points);
    localStorage.setItem('quizBadges', JSON.stringify(badges));
    localStorage.setItem('quizStreak', streak);
}

function showGamification() {
    resultViewStack.push(showGamification);
    let html = `<h2>Gamification</h2><div>Points: ${points}</div><div>Streak: ${streak}</div><div>Badges: ${badges.join(', ') || 'None'}</div>`;
    html += '<button class="back-result-btn">Back</button>';
    quizResult.innerHTML = html;
    quizResult.style.display = 'block';
    document.querySelector('.back-result-btn').onclick = popResultView;
}

function popResultView() {
    resultViewStack.pop(); // Remove current view
    if (resultViewStack.length > 0) {
        // Show previous view
        resultViewStack[resultViewStack.length - 1]();
    } else {
        // If stack is empty, go to main result screen
        finishQuiz(true);
    }
}

// --- UI/UX: Progress Bar, Animations ---
function updateProgressBar() {
    let bar = document.getElementById('progress-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'progress-bar';
        bar.style.height = '8px';
        bar.style.background = '#3b82f6';
        bar.style.borderRadius = '4px';
        bar.style.transition = 'width 0.3s';
        quizInterface.insertBefore(bar, quizInterface.firstChild);
    }
    bar.style.width = `${((currentQuestion+1)/quizData.length)*100}%`;
}

// --- Render resource cards dynamically
function renderResources() {
    resourceList.innerHTML = '';
    resources.forEach(res => {
        const card = document.createElement('div');
        card.className = 'resource-card';
        card.dataset.resource = res.id;
        card.innerHTML = `
            <div class="resource-icon">${res.icon}</div>
            <div class="resource-title">${res.title}</div>
            <div class="resource-filename">${res.filename}</div>
        `;
        card.onclick = () => selectResource(res.id);
        resourceList.appendChild(card);
    });
}

function selectResource(resourceId) {
    selectedResource = resourceId;
    document.querySelectorAll('.resource-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.resource === resourceId);
    });
    resourceList.style.display = 'none';
    levelSelection.style.display = 'flex';
    levelSelection.scrollIntoView({ behavior: 'smooth' });
}

document.querySelectorAll('.level-btn').forEach(btn => {
    btn.onclick = () => selectLevel(btn.dataset.level);
});

function selectLevel(level) {
    selectedLevel = level;
    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.level === level);
    });
    startQuiz();
}

function startQuiz() {
    // Dynamically load the quiz file based on selected resource and level
    const quizFile = `quizzes/${selectedResource}_${selectedLevel}.json`;
    resourceList.style.display = 'none';
    levelSelection.style.display = 'none';
    // Only show quiz interface after data is loaded and valid
    fetch(quizFile)
        .then(res => {
            if (!res.ok) {
                console.error('Quiz file fetch failed:', quizFile, res.status, res.statusText);
                throw new Error('Quiz file not found');
            }
            return res.json();
        })
        .then(data => {
            if (!data.quiz || !Array.isArray(data.quiz) || data.quiz.length === 0) {
                console.error('Quiz data invalid or empty:', data);
                return restartQuiz();
            }
            quizData = shuffle([...data.quiz]);
            currentQuestion = 0;
            userAnswers = [];
            timeLeft = TIMER_SETTINGS[selectedLevel].total;
            quizInterface.style.display = 'flex';
            showQuiz();
            startTimer();
        })
        .catch((err) => {
            console.error('Quiz data load error:', err);
            return restartQuiz();
        });
}

function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `${timeLeft}s`;
        updateTimerProgressBar();
        if (timeLeft <= 0) {
            clearInterval(timer);
            finishQuiz();
        }
    }, 1000);
    timerDisplay.textContent = `${timeLeft}s`;
    updateTimerProgressBar();
}

function updateTimerProgressBar() {
    if (!timerProgressBar) {
        timerProgressBar = document.createElement('div');
        timerProgressBar.id = 'timer-progress-bar';
        timerProgressBar.style.height = '12px';
        timerProgressBar.style.borderRadius = '6px';
        timerProgressBar.style.marginTop = '10px';
        timerProgressBar.style.transition = 'width 0.3s linear, background 0.3s';
        document.getElementById('timer').appendChild(timerProgressBar);
    }
    const total = TIMER_SETTINGS[selectedLevel].total;
    timerProgressBar.style.width = `${(timeLeft / total) * 100}%`;
    timerProgressBar.style.background = TIMER_SETTINGS[selectedLevel].color;
}

// --- Update showQuiz to support all types ---
function showQuiz() {
    if (!quizData || quizData.length === 0) return;
    quizProgress.textContent = `Question ${currentQuestion + 1} of ${quizData.length}`;
    updateProgressBar();
    const q = quizData[currentQuestion];
    let optionsHtml = '';
    const type = getQuestionType(q);
    if (type === 'radio') {
        optionsHtml = q.options.map((opt, i) => `<div class="quiz-option" data-idx="${i}">${opt}</div>`).join('');
    } else if (type === 'checkbox') {
        optionsHtml = q.options.map((opt, i) => `<label class="quiz-option"><input type="checkbox" data-idx="${i}">${opt}</label>`).join('');
    } else if (type === 'text') {
        optionsHtml = `<textarea class="quiz-textarea" rows="4" placeholder="Type your answer here..."></textarea>`;
    } else if (type === 'boolean') {
        optionsHtml = ['True', 'False'].map((opt, i) => `<div class="quiz-option" data-idx="${opt}">${opt}</div>`).join('');
    } else if (type === 'matching' && q.options && typeof q.options === 'object') {
        // Improved drag-and-drop style UI for matching using SortableJS
        const categories = Object.keys(q.options);
        const items = categories.flatMap(cat => q.options[cat]);
        // Shuffle items for randomness
        const shuffledItems = [...items].sort(() => Math.random() - 0.5);
        optionsHtml = `
            <div class="matching-instructions"><b>Drag each item to the correct category:</b></div>
            <div class="matching-ui">
                <div class="matching-categories">
                    ${categories.map(cat => `
                        <div class="matching-category" data-cat="${cat}">
                            <div class="matching-category-title">${cat}</div>
                            <div class="matching-dropzone" data-cat="${cat}"></div>
                        </div>
                    `).join('')}
                </div>
                <div class="matching-items" id="matching-pool">
                    ${shuffledItems.map(item => `<div class="matching-item" data-item="${item}">${item}</div>`).join('')}
                </div>
            </div>
        `;
    }
    quizCard.innerHTML = `
        <div class="quiz-question">${q.question}</div>
        <div class="quiz-options" style="overflow-x:auto; max-width:100%;">${optionsHtml}</div>
    `;
    setTimeout(() => {
        document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.style.opacity = 0;
            setTimeout(() => { opt.style.transition = 'opacity 0.3s'; opt.style.opacity = 1; }, 100);
        });
    }, 10);
    if (type === 'radio') {
        document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.onclick = () => selectOption(opt.dataset.idx);
        });
        if (userAnswers[currentQuestion] !== undefined) selectOption(userAnswers[currentQuestion]);
    } else if (type === 'checkbox') {
        const saved = userAnswers[currentQuestion] || [];
        document.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => {
            cb.checked = saved.includes(i);
            cb.onchange = () => {
                let arr = Array.from(document.querySelectorAll('input[type="checkbox"]')).map((c, idx) => c.checked ? idx : null).filter(x => x !== null);
                userAnswers[currentQuestion] = arr;
            };
        });
    } else if (type === 'text') {
        const ta = document.querySelector('.quiz-textarea');
        ta.value = userAnswers[currentQuestion] || '';
        ta.oninput = () => { userAnswers[currentQuestion] = ta.value; };
    } else if (type === 'boolean') {
        document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.onclick = () => {
                userAnswers[currentQuestion] = opt.dataset.idx;
                document.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
            };
        });
        if (userAnswers[currentQuestion] !== undefined) {
            document.querySelectorAll('.quiz-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.idx === userAnswers[currentQuestion]);
            });
        }
    } else if (type === 'matching' && q.options && typeof q.options === 'object') {
        // Use SortableJS for drag-and-drop
        const categories = Object.keys(q.options);
        // Pool
        const pool = document.getElementById('matching-pool');
        const dropzones = Array.from(document.querySelectorAll('.matching-dropzone'));
        // Remove any native drag event handlers (SortableJS handles all)
        document.querySelectorAll('.matching-item').forEach(item => {
            item.ondragstart = null;
            item.ondragend = null;
        });
        // Restore previous answer if any
        if (userAnswers[currentQuestion]) {
            const answer = userAnswers[currentQuestion];
            Object.entries(answer).forEach(([cat, arr]) => {
                arr.forEach(item => {
                    const el = document.querySelector(`.matching-item[data-item="${item}"]`);
                    const dz = document.querySelector(`.matching-dropzone[data-cat="${cat}"]`);
                    if (el && dz) dz.appendChild(el);
                });
            });
        }
        // Pool Sortable
        Sortable.create(pool, {
            group: { name: 'matching', put: true, pull: true },
            animation: 150,
            sort: false,
            onAdd: saveMatchingAnswer,
            onRemove: saveMatchingAnswer
        });
        // Category dropzones Sortable
        dropzones.forEach(dz => {
            Sortable.create(dz, {
                group: { name: 'matching', put: true, pull: true },
                animation: 150,
                sort: true,
                onAdd: saveMatchingAnswer,
                onRemove: saveMatchingAnswer
            });
        });
        // Save answer on every drop
        function saveMatchingAnswer() {
            const result = {};
            document.querySelectorAll('.matching-dropzone').forEach(dz => {
                const cat = dz.dataset.cat;
                result[cat] = Array.from(dz.querySelectorAll('.matching-item')).map(i => i.dataset.item);
            });
            userAnswers[currentQuestion] = result;
        }
    }
    document.getElementById('prev-question').disabled = currentQuestion === 0;
    document.getElementById('next-question').textContent = currentQuestion === quizData.length - 1 ? 'Finish' : 'Next';
    document.getElementById('next-question').disabled = false;
}

function selectOption(idx) {
    userAnswers[currentQuestion] = Number(idx);
    document.querySelectorAll('.quiz-option').forEach((opt, i) => {
        opt.classList.toggle('selected', i == idx);
    });
}

function saveCurrentInput() {
    const q = quizData[currentQuestion];
    const type = getQuestionType(q);
    if (type === 'text') {
        const ta = document.querySelector('.quiz-textarea');
        if (ta) userAnswers[currentQuestion] = ta.value;
    } else if (type === 'checkbox') {
        userAnswers[currentQuestion] = Array.from(document.querySelectorAll('input[type="checkbox"]')).map((c, idx) => c.checked ? idx : null).filter(x => x !== null);
    } else if (type === 'radio') {
        if (typeof userAnswers[currentQuestion] === 'string') {
            userAnswers[currentQuestion] = Number(userAnswers[currentQuestion]);
        }
    } else if (type === 'boolean') {
        // Already handled by click
    }
}

function finishQuiz(isFromStack) {
    clearInterval(timer);
    quizInterface.style.display = 'none';
    let correct = 0;
    let correctnessArr = [];
    quizData.forEach((q, i) => {
        const type = getQuestionType(q);
        let isCorrect = false;
        if (type === 'radio') {
            isCorrect = q.options[userAnswers[i]] === q.correct_answer;
        } else if (type === 'checkbox') {
            const ans = userAnswers[i] || [];
            const correctIdxs = q.correct_answer.map(a => q.options.indexOf(a)).filter(x => x !== -1);
            isCorrect = ans.length === correctIdxs.length && ans.every(idx => correctIdxs.includes(idx));
        } else if (type === 'text') {
            const val = (userAnswers[i] || '').toLowerCase();
            if (q.keywords && Array.isArray(q.keywords)) {
                let found = 0;
                q.keywords.forEach(kw => { if (val.includes(kw.toLowerCase())) found++; });
                isCorrect = found >= (q.min_keywords || 1);
            } else {
                isCorrect = val === (q.correct_answer || '').toLowerCase();
            }
        } else if (type === 'boolean') {
            let userVal = userAnswers[i] === 'True' || userAnswers[i] === true || userAnswers[i] === 1 || userAnswers[i] === '1' ? 'True' : 'False';
            let correctVal = q.correct_answer === true || q.correct_answer === 'True' || q.correct_answer === 1 || q.correct_answer === '1' ? 'True' : 'False';
            isCorrect = userVal === correctVal;
        } else if (type === 'matching') {
            const userMatch = userAnswers[i] || {};
            const correctMatch = q.correct_answer || {};
            let allCorrect = true;
            for (const cat of Object.keys(q.options)) {
                const userItems = userMatch[cat] || [];
                const correctItems = correctMatch[cat] || [];
                if (userItems.length !== correctItems.length || userItems.some(item => !correctItems.includes(item))) {
                    allCorrect = false;
                    break;
                }
            }
            isCorrect = allCorrect;
        }
        if (isCorrect) correct++;
        correctnessArr[i] = isCorrect;
    });
    window._quizCorrectnessArr = correctnessArr; // for review
    const timeSpent = TIMER_SETTINGS[selectedLevel].total - timeLeft;
    saveAnalytics(selectedResource, selectedLevel, correct, quizData.length, timeSpent);
    updateGamification(correct, quizData.length, timeSpent);
    if (!isFromStack) resultViewStack = [];
    quizResult.innerHTML = `
        <div class="score">${correct} / ${quizData.length}</div>
        <div>${correct === quizData.length ? 'Excellent! 🎉' : correct > quizData.length/2 ? 'Good job!' : 'Keep practicing!'}</div>
        <div class="gamification">Points: ${points} | Streak: ${streak} | Badges: ${badges.join(', ') || 'None'}</div>
        <button class="review-btn">Review Answers</button>
        <button class="analytics-btn">Analytics</button>
        <button class="gamification-btn">Gamification</button>
        <button class="restart-btn">Restart</button>
    `;
    quizResult.style.display = 'block';
    document.querySelector('.restart-btn').onclick = restartQuiz;
    document.querySelector('.review-btn').onclick = showReview;
    document.querySelector('.analytics-btn').onclick = showAnalytics;
    document.querySelector('.gamification-btn').onclick = showGamification;
}

function restartQuiz() {
    quizResult.style.display = 'none';
    resourceList.style.display = 'flex';
    renderResources();
    selectedResource = null;
    selectedLevel = null;
    quizData = [];
    currentQuestion = 0;
    userAnswers = [];
    timeLeft = 0;
    timer = null;
    levelSelection.style.display = 'none';
    quizInterface.style.display = 'none';
    if (timerProgressBar) {
        timerProgressBar.remove();
        timerProgressBar = null;
    }
}

document.querySelector('.back-btn').onclick = () => {
    levelSelection.style.display = 'none';
    resourceList.style.display = 'flex';
    selectedResource = null;
    document.querySelectorAll('.resource-card').forEach(card => card.classList.remove('selected'));
};

// --- On load, restore gamification state ---
(function restoreGamification() {
    points = parseInt(localStorage.getItem('quizPoints') || '0');
    badges = JSON.parse(localStorage.getItem('quizBadges') || '[]');
    streak = parseInt(localStorage.getItem('quizStreak') || '0');
})();

// Initial render
renderResources();

document.getElementById('prev-question').onclick = function() {
    saveCurrentInput();
    if (currentQuestion > 0) {
        currentQuestion--;
        showQuiz();
    }
};
document.getElementById('next-question').onclick = function() {
    saveCurrentInput();
    // Always advance, even if answer is blank or undefined
    if (currentQuestion < quizData.length - 1) {
        currentQuestion++;
        showQuiz();
    } else {
        finishQuiz();
    }
};
