// Get the modal and its elements
const modal = document.getElementById("pdf-modal");
const closeModal = document.getElementById("close-modal");
const recommendations = document.querySelectorAll('#recommendations a');
const pdfContainer = document.getElementById("pdf-container");
const viewAllBtn = document.getElementById("view-all-btn");
const goBackBtn = document.getElementById("go-back-btn");

// Path to your resource file (can be PDF, DOCX, PPTX, etc.)
const defaultResourceUrl = "chapter_11_Modern ERP_select, implement, and use today's advanced business systems.pdf"; // Replace with your actual file path

let currentRange = null; // Track the current page range
let allPagesRendered = false; // Track if all pages are rendered
let currentResourceUrl = null; // Track the current resource file

// Helper: Get file extension
function getFileExtension(filename) {
    // If it's a Google Drive or Google Slides link, treat as pptx
    if (filename.includes('docs.google.com/presentation')) {
        return 'pptx';
    }
    return filename.split('.').pop().toLowerCase();
}

// Function to open the resource in the modal (PDF, DOCX, PPTX)
function openResourcePageRange(resourceUrl, pageRange) {
    modal.style.display = "block";
    renderResourcePageRange(resourceUrl, pageRange);
    currentRange = pageRange;
    currentResourceUrl = resourceUrl;
    allPagesRendered = false;
    viewAllBtn.style.display = "block";
    goBackBtn.style.display = "none";
}

// Function to close the modal
closeModal.onclick = function() {
    modal.style.display = "none";
    // Clear the content when closing the modal
    pdfContainer.innerHTML = '';
    viewAllBtn.style.display = "none"; // Hide the "View All Pages" button
    goBackBtn.style.display = "none"; // Hide the "Go Back" button
}

// Click on a recommendation link to open the relevant page range
recommendations.forEach(link => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        const pageRange = link.getAttribute('data-page');
        const resourceUrl = link.getAttribute('data-file');
        openResourcePageRange(resourceUrl, pageRange);
    });
});

// Main render function for all resource types
function renderResourcePageRange(resourceUrl, pageRange) {
    pdfContainer.innerHTML = '';
    const ext = getFileExtension(resourceUrl);
    if (ext === 'pdf') {
        renderPdfPageRange(resourceUrl, pageRange);
    } else if (ext === 'docx') {
        renderDocx(resourceUrl, pageRange);
    } else if (ext === 'pptx') {
        renderPptx(resourceUrl, pageRange);
    } else {
        pdfContainer.innerHTML = '<p>Unsupported file type.</p>';
    }
}

// Function to render a range of pages from PDF
function renderPdfPageRange(resourceUrl, pageRange) {
    // Parse the page range (start page - end page)
    const [startPage, endPage] = pageRange.split('-').map(Number);

    // Load the PDF document
    pdfjsLib.getDocument(resourceUrl).promise.then(pdf => {
        // Loop through the page range
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
            renderPage(pdf, pageNum);
        }
    }).catch(error => {
        console.error('Error loading PDF:', error);
    });
}

// Function to render each page on the canvas
function renderPage(pdf, pageNum) {
    pdf.getPage(pageNum).then(page => {
        const viewport = page.getViewport({ scale: 1 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Append the canvas to the modal's content
        pdfContainer.appendChild(canvas);

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        // Render the page and log if it's successful
        page.render(renderContext).catch(error => {
            console.error(`Error rendering page ${pageNum}:`, error);
        });
    }).catch(error => {
        console.error(`Error loading page ${pageNum}:`, error);
    });
}

// DOCX rendering using mammoth.js with section/paragraph range support
function renderDocx(url, pageRange) {
    const encodedUrl = encodeURI(url);
    fetch(encodedUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} (${response.statusText})`);
            }
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            pdfContainer.innerHTML = '';
            mammoth.convertToHtml({arrayBuffer: arrayBuffer})
                .then(result => {
                    // Split by paragraphs or headings
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = result.value;
                    let elements = Array.from(tempDiv.querySelectorAll('h1, h2, h3, p'));
                    if (pageRange) {
                        const [start, end] = pageRange.split('-').map(Number);
                        // Clamp range
                        const startIdx = Math.max(0, start - 1);
                        const endIdx = Math.min(elements.length, end);
                        elements = elements.slice(startIdx, endIdx);
                        if (elements.length === 0) {
                            pdfContainer.innerHTML = '<p>No content in this range.</p>';
                            return;
                        }
                        pdfContainer.innerHTML = '';
                        elements.forEach(el => pdfContainer.appendChild(el));
                        // Add a note for users
                        const note = document.createElement('div');
                        note.style.fontSize = '0.9em';
                        note.style.color = '#888';
                        note.style.marginTop = '1em';
                        note.innerText = 'DOCX files do not have true pages. This range is based on paragraphs/headings.';
                        pdfContainer.appendChild(note);
                    } else {
                        pdfContainer.innerHTML = result.value;
                    }
                })
                .catch(err => {
                    pdfContainer.innerHTML = `<p>Failed to render DOCX file.<br>${err}</p>`;
                    console.error('Mammoth render error:', err);
                });
        })
        .catch(err => {
            pdfContainer.innerHTML = `<p>Failed to load DOCX file.<br>${err}</p>`;
            console.error('DOCX fetch error:', err);
        });
}

// PPTX rendering using Microsoft Office Online Viewer (slide range not supported)
function renderPptx(url, pageRange) {
    // Check if running on localhost or 127.0.0.1
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
        pdfContainer.innerHTML = '<p style="color: #b00;">PowerPoint preview is only available for files hosted on a public server. Please upload your PPTX to a public URL to use the preview feature.</p>';
        return;
    }
    const encodedUrl = encodeURIComponent(window.location.origin + '/' + url);
    pdfContainer.innerHTML = `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}" width="100%" height="600px" frameborder="0"></iframe>`;
    const note = document.createElement('div');
    note.style.fontSize = '0.9em';
    note.style.color = '#888';
    note.style.marginTop = '1em';
    note.innerText = 'Note: Slide range is not supported for PPTX files. The entire presentation is shown.';
    pdfContainer.appendChild(note);
}

// Function to render all pages when the button is clicked
viewAllBtn.addEventListener('click', () => {
    if (currentRange && currentResourceUrl) {
        const ext = getFileExtension(currentResourceUrl);
        if (ext === 'pdf') {
            pdfjsLib.getDocument(currentResourceUrl).promise.then(pdf => {
                // Loop through all the pages of the PDF
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    renderPage(pdf, pageNum);
                }
            }).catch(error => {
                console.error('Error loading PDF:', error);
            });
        } else {
            // For DOCX and PPTX, just re-render the whole file
            renderResourcePageRange(currentResourceUrl);
        }
        viewAllBtn.style.display = "none"; // Hide the "View All Pages" button
        goBackBtn.style.display = "block"; // Show the "Go Back" button to revert to the specified range
        allPagesRendered = true; // Mark that all pages have been rendered
    }
});

// Go back to the original range
goBackBtn.addEventListener('click', () => {
    if (currentRange && currentResourceUrl) {
        pdfContainer.innerHTML = '';
        renderResourcePageRange(currentResourceUrl, currentRange); // Re-render the specified range
        goBackBtn.style.display = "none"; // Hide the "Go Back" button
        viewAllBtn.style.display = "block"; // Show the "View All Pages" button again
        allPagesRendered = false; // Reset flag to indicate not all pages are rendered
    }
});
