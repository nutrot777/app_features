let flashcardsData = [];
let currentIndex = 0;
let bookmarks = new Set(JSON.parse(localStorage.getItem('flashcardBookmarks') || '[]'));

// Function to shuffle the flashcards array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Function to fetch and load the flashcards from the JSON file
function loadFlashcards() {
    fetch('flashcards.json') // Load the JSON file
        .then(response => response.json()) // Parse the JSON
        .then(data => {
            shuffleArray(data);
            flashcardsData = data;
            currentIndex = 0;
            renderSingleFlashcard(currentIndex);
        })
        .catch(error => console.error('Error loading flashcards:', error));
}

// Function to render the flashcards dynamically on the page
function renderSingleFlashcard(index, direction = 0) {
    const container = document.getElementById('flashcard-container');
    container.className = 'min-h-screen flex flex-col items-center justify-center';
    // Animate card exit if direction is set
    const prevCard = container.querySelector('.flashcard');
    if (prevCard && direction !== 0) {
        prevCard.classList.add(direction > 0 ? 'card-exit-left' : 'card-exit-right');
        setTimeout(() => {
            container.innerHTML = '';
            showCard();
        }, 300);
    } else {
        container.innerHTML = '';
        showCard();
    }

    function showCard() {
        if (!flashcardsData.length) return;
        const flashcard = flashcardsData[index];
        // Card wrapper
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'flex flex-col items-center justify-center w-full';
        // Card element (rectangular and centered)
        const card = document.createElement('div');
        card.className = 'flashcard flip-card relative w-[32rem] h-[20rem] cursor-pointer shadow-2xl rounded-2xl bg-white transition-transform duration-500 mb-6 card-enter';
        card.setAttribute('data-index', index);
        card.classList.remove('flipped');
        setTimeout(() => {
            card.classList.add('card-enter-active');
        }, 10);
        // Card front (question only)
        const cardFront = document.createElement('div');
        cardFront.className = 'card-front absolute w-full h-full flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-teal-50 text-slate-800 font-semibold text-2xl p-10';
        cardFront.textContent = (flashcard && flashcard.question) ? flashcard.question : 'No question';
        // Card back (answer + explanation button)
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back absolute w-full h-full flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-100 to-teal-50 text-slate-700 p-10';
        // Answer (always visible on flip)
        const answer = document.createElement('div');
        answer.className = 'answer text-xl font-bold mb-4 text-center';
        answer.textContent = (flashcard && flashcard.answer) ? flashcard.answer : 'No answer';
        cardBack.appendChild(answer);
        // Read More (explanation/resources)
        if (flashcard && (flashcard.explanation || (flashcard.resources && flashcard.resources.length))) {
            const readMoreBtn = document.createElement('button');
            readMoreBtn.className = 'read-more-btn bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1 mb-2 text-sm transition';
            readMoreBtn.textContent = 'Read More';
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'explanation text-base text-slate-700 mt-1 mb-0 hidden text-left w-full';
            if (flashcard.explanation) {
                const p = document.createElement('p');
                p.textContent = flashcard.explanation;
                explanationDiv.appendChild(p);
            }
            if (flashcard.resources && flashcard.resources.length) {
                const ul = document.createElement('ul');
                ul.className = 'list-disc pl-5 mt-2';
                flashcard.resources.forEach(resource => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = resource.url;
                    a.target = '_blank';
                    a.textContent = resource.label;
                    a.className = 'text-blue-600 underline hover:text-blue-800';
                    li.appendChild(a);
                    ul.appendChild(li);
                });
                explanationDiv.appendChild(ul);
            }
            readMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                explanationDiv.classList.toggle('hidden');
                readMoreBtn.textContent = explanationDiv.classList.contains('hidden') ? 'Read More' : 'Hide';
            });
            cardBack.appendChild(readMoreBtn);
            cardBack.appendChild(explanationDiv);
        }
        card.appendChild(cardFront);
        card.appendChild(cardBack);
        cardWrapper.appendChild(card);
        // Bookmark button
        const bookmarkBtn = document.createElement('button');
        bookmarkBtn.className = `mb-4 text-2xl self-end mr-2 transition ${bookmarks.has(index) ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`;
        bookmarkBtn.innerHTML = bookmarks.has(index) ? '★' : '☆';
        bookmarkBtn.title = bookmarks.has(index) ? 'Remove Bookmark' : 'Bookmark this card';
        bookmarkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (bookmarks.has(index)) {
                bookmarks.delete(index);
            } else {
                bookmarks.add(index);
            }
            localStorage.setItem('flashcardBookmarks', JSON.stringify(Array.from(bookmarks)));
            renderSingleFlashcard(index);
        });
        cardWrapper.appendChild(bookmarkBtn);
        // Navigation arrows
        const navWrapper = document.createElement('div');
        navWrapper.className = 'flex flex-row items-center justify-between w-full mt-2';
        const leftArrow = document.createElement('button');
        leftArrow.className = 'text-3xl px-4 py-2 text-gray-500 hover:text-blue-600 transition disabled:opacity-30';
        leftArrow.innerHTML = '⟨';
        leftArrow.disabled = index === 0;
        leftArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            if (index > 0) {
                currentIndex = index - 1;
                renderSingleFlashcard(currentIndex, 1);
            }
        });
        const rightArrow = document.createElement('button');
        rightArrow.className = 'text-3xl px-4 py-2 text-gray-500 hover:text-blue-600 transition disabled:opacity-30';
        rightArrow.innerHTML = '⟩';
        rightArrow.disabled = index === flashcardsData.length - 1;
        rightArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            if (index < flashcardsData.length - 1) {
                currentIndex = index + 1;
                renderSingleFlashcard(currentIndex, -1);
            }
        });
        navWrapper.appendChild(leftArrow);
        navWrapper.appendChild(rightArrow);
        cardWrapper.appendChild(navWrapper);
        // Flip on click
        let flipped = false;
        cardWrapper.addEventListener('click', (e) => {
            if (e.target === bookmarkBtn || e.target === leftArrow || e.target === rightArrow) return;
            flipped = !flipped;
            card.classList.toggle('flipped', flipped);
        });
        container.appendChild(cardWrapper);
    }
}

// Initialize the page by loading the flashcards
document.addEventListener('DOMContentLoaded', loadFlashcards);
