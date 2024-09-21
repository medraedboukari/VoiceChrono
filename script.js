// Import jsPDF from the global namespace
const { jsPDF } = window.jspdf;

// Stopwatch variables
let stopwatchInterval;
let startTime;
let elapsedTime = 0;

// DOM Elements
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const downloadButton = document.getElementById('downloadButton');
const exportPdfButton = document.getElementById('exportPdfButton');
const stopwatchDisplay = document.getElementById('stopwatch');
const transcriptionDiv = document.getElementById('transcription');
const languageSelect = document.getElementById('language');
const indicator = document.getElementById('indicator');
const errorMessage = document.getElementById('errorMessage');
const wordCountDisplay = document.getElementById('wordCount');
const speakingSpeedDisplay = document.getElementById('speakingSpeed');
const historyList = document.getElementById('historyList');
const darkModeToggle = document.getElementById('darkModeToggle');
const liveToast = new bootstrap.Toast(document.getElementById('liveToast'));

// Speech Recognition Setup
let recognition;
let isRecording = false;
let isPaused = false;
let finalTranscript = '';
let recordingStartTime;

// Real-Time Analytics
let wordsTyped = 0;

// Initialize Speech Recognition
function initializeRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep recognizing even if user pauses
        recognition.interimResults = true; // Show results even if not final
        recognition.lang = languageSelect.value; // Set language based on selection

        recognition.onstart = () => {
            isRecording = true;
            indicator.classList.remove('d-none');
            errorMessage.classList.add('d-none');
            recordingStartTime = new Date();
            showToast('Transcription started.');
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript + ' ';
                } else {
                    interimTranscript += result[0].transcript;
                }
            }
            transcriptionDiv.textContent = finalTranscript + interimTranscript;
            transcriptionDiv.scrollTop = transcriptionDiv.scrollHeight;
            updateAnalytics();
        };

        recognition.onerror = (event) => {
            console.error('Speech Recognition Error:', event.error);
            displayError(`Error: ${event.error}`);
            showToast(`Error: ${event.error}`, 'bg-danger');
            stopAll();
        };

        recognition.onend = () => {
            isRecording = false;
            indicator.classList.add('d-none');
            if (!isPaused && elapsedTime > 0) {
                // Automatically restart recognition if not paused and stopwatch is running
                try {
                    recognition.start();
                } catch (error) {
                    console.error('Recognition Restart Error:', error);
                }
            }
        };
    } else {
        displayError('Sorry, your browser does not support Speech Recognition.');
        disableControls();
    }
}

// Function to display error messages
function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('d-none');
}

// Function to disable controls if Speech Recognition is not supported
function disableControls() {
    startButton.disabled = true;
    pauseButton.disabled = true;
    downloadButton.disabled = true;
    exportPdfButton.disabled = true;
}

// Function to start the stopwatch
function startStopwatch() {
    startTime = Date.now() - elapsedTime;
    stopwatchInterval = setInterval(updateStopwatch, 1000);
}

// Function to update the stopwatch display
function updateStopwatch() {
    elapsedTime = Date.now() - startTime;
    const totalSeconds = Math.floor(elapsedTime / 1000);

    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');

    stopwatchDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}

// Function to start speech recognition
function startRecognition() {
    try {
        recognition.lang = languageSelect.value; // Update language before starting
        recognition.start();
        isRecording = true;
        indicator.classList.remove('d-none');
        startButton.textContent = 'Stop';
        pauseButton.disabled = false;
        downloadButton.disabled = false;
        exportPdfButton.disabled = false;
        recordingStartTime = new Date();
    } catch (error) {
        console.error('Recognition Start Error:', error);
        displayError('Failed to start speech recognition.');
        showToast('Failed to start speech recognition.', 'bg-danger');
    }
}

// Function to stop speech recognition
function stopRecognition() {
    if (recognition && isRecording) {
        recognition.stop();
        isRecording = false;
        indicator.classList.add('d-none');
        startButton.textContent = 'Start';
    }
}

// Function to pause both stopwatch and recognition
function pauseAll() {
    clearInterval(stopwatchInterval);
    elapsedTime = Date.now() - startTime;
    stopRecognition();
    isPaused = true;
    pauseButton.textContent = 'Resume';
    showToast('Transcription paused.');
    updateAnalytics(); // Final update on pause
}

// Function to resume both stopwatch and recognition
function resumeAll() {
    startStopwatch();
    startRecognition();
    isPaused = false;
    pauseButton.textContent = 'Pause';
    showToast('Transcription resumed.');
}

// Function to stop all activities and reset
function stopAll() {
    clearInterval(stopwatchInterval);
    elapsedTime = 0;
    stopwatchDisplay.textContent = '00:00:00';
    finalTranscript = '';
    transcriptionDiv.textContent = '';
    stopRecognition();
    pauseButton.textContent = 'Pause';
    pauseButton.disabled = true;
    downloadButton.disabled = true;
    exportPdfButton.disabled = true;
    isPaused = false;
    wordsTyped = 0;
    wordCountDisplay.textContent = '0';
    speakingSpeedDisplay.textContent = '0';
    saveTranscription(); // Save the transcription to history
}

// Function to download transcription as a text file
function downloadTranscription() {
    const text = transcriptionDiv.textContent.trim();
    if (!text) {
        displayError('No transcription available to download.');
        showToast('No transcription available to download.', 'bg-warning');
        return;
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // Create a temporary link to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.txt`;
    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Transcription downloaded as TXT.', 'bg-success');
}

// Function to export transcription as PDF
function exportTranscriptionAsPDF() {
    const text = transcriptionDiv.textContent.trim();
    if (!text) {
        displayError('No transcription available to export.');
        showToast('No transcription available to export.', 'bg-warning');
        return;
    }

    const doc = new jsPDF();
    const lines = doc.splitTextToSize(text, 180); // Adjust width as needed
    doc.text(lines, 10, 10);
    doc.save(`transcription_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.pdf`);

    showToast('Transcription exported as PDF.', 'bg-success');
}

// Function to update real-time analytics
function updateAnalytics() {
    const text = transcriptionDiv.textContent.trim();
    wordsTyped = text.split(/\s+/).filter(word => word.length > 0).length;
    wordCountDisplay.textContent = wordsTyped;

    // Calculate speaking speed (words per minute)
    if (recordingStartTime) {
        const now = new Date();
        const minutes = (now - recordingStartTime) / 60000; // milliseconds to minutes
        const wpm = minutes > 0 ? Math.round(wordsTyped / minutes) : 0;
        speakingSpeedDisplay.textContent = wpm;
    }
}

// Function to show Bootstrap Toast notifications
function showToast(message, bgClass = 'bg-primary') {
    const toastElement = document.getElementById('liveToast');
    const toastBody = toastElement.querySelector('.toast-body');
    toastBody.textContent = message;

    // Remove existing background classes
    toastElement.classList.remove('bg-primary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info');

    // Add the specified background class
    toastElement.classList.add(bgClass);

    liveToast.show();
}

// Function to save transcription to history
function saveTranscription() {
    if (!finalTranscript.trim()) return; // Do not save empty transcriptions

    const transcription = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        content: finalTranscript.trim()
    };

    let history = JSON.parse(localStorage.getItem('transcriptionHistory')) || [];
    history.unshift(transcription); // Add to the beginning
    localStorage.setItem('transcriptionHistory', JSON.stringify(history));

    loadHistory();
    showToast('Transcription saved to history.', 'bg-success');
}

// Function to load transcription history
function loadHistory() {
    let history = JSON.parse(localStorage.getItem('transcriptionHistory')) || [];
    historyList.innerHTML = '';

    history.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'history-item');
        li.dataset.id = item.id;
        li.innerHTML = `<strong>${item.timestamp}</strong>: ${item.content.substring(0, 50)}${item.content.length > 50 ? '...' : ''}`;
        historyList.appendChild(li);
    });
}

// Function to load a transcription from history
function loadTranscriptionFromHistory(id) {
    let history = JSON.parse(localStorage.getItem('transcriptionHistory')) || [];
    const item = history.find(entry => entry.id === parseInt(id));
    if (item) {
        finalTranscript = item.content + ' ';
        transcriptionDiv.textContent = finalTranscript;
        updateAnalytics();
        showToast('Transcription loaded from history.', 'bg-info');
    }
}

// Event Listener for Start/Stop Button
startButton.addEventListener('click', () => {
    if (!isRecording) {
        // Start stopwatch and speech recognition
        finalTranscript = ''; // Reset transcription
        transcriptionDiv.textContent = '';
        wordsTyped = 0;
        wordCountDisplay.textContent = '0';
        speakingSpeedDisplay.textContent = '0';
        startStopwatch();
        startRecognition();
    } else {
        // Stop stopwatch and speech recognition
        stopAll();
    }
});

// Event Listener for Pause/Resume Button
pauseButton.addEventListener('click', () => {
    if (!isPaused) {
        pauseAll();
    } else {
        resumeAll();
    }
});

// Event Listener for Download Button
downloadButton.addEventListener('click', downloadTranscription);

// Event Listener for Export as PDF Button
exportPdfButton.addEventListener('click', exportTranscriptionAsPDF);

// Event Listener for Language Selection
languageSelect.addEventListener('change', () => {
    if (isRecording) {
        // Restart recognition with new language
        recognition.stop();
        // recognition.onend will handle restarting if not paused
    }
});

// Event Listener for History List
historyList.addEventListener('click', (e) => {
    if (e.target && e.target.matches('li.history-item')) {
        const id = e.target.dataset.id;
        loadTranscriptionFromHistory(id);
    }
});

// Event Listener for Dark Mode Toggle
darkModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
    // Save preference to localStorage
    if (darkModeToggle.checked) {
        localStorage.setItem('darkMode', 'enabled');
    } else {
        localStorage.setItem('darkMode', 'disabled');
    }
});

// Function to load dark mode preference
function loadDarkModePreference() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }
}

// Initialize the application
function initializeApp() {
    initializeRecognition();
    loadHistory();
    loadDarkModePreference();
}

// Initialize the Speech Recognition on page load
initializeApp();
