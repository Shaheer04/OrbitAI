import { getAIResponse } from "../ai-logic.js";

const circle = document.getElementById("central-circle");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const messageDisplay = document.getElementById("message-display");

let isSpeaking = false;
let isListening = false;
let isDarkTheme = false; // Default to light theme
let conversationContext = ""; // Store the conversation context
let currentUtterance = null; // to interrupt ongoing speech
let busy = false; // <-- NEW

circle.addEventListener("click", () => {
  if (currentUtterance || isSpeaking) {
    window.speechSynthesis.cancel();
    busy = false; // release the lock
    setTimeout(startAIInteraction, 50); // queue next run
  } else if (!busy) {
    startAIInteraction();
  }
});

settingsToggle.addEventListener("click", toggleSettings);

async function speak(text) {
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel(); //stop any previous speech
    currentUtterance = new SpeechSynthesisUtterance(text);

    currentUtterance.onstart = () => {
      console.log("Speech synthesis started");
    };

    currentUtterance.onend = () => {
      console.log("Speech synthesis ended");
      currentUtterance = null;
      resolve();
    };

    currentUtterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      currentUtterance = null;
      reject(event);
    };

    window.speechSynthesis.speak(currentUtterance);
  });
}

async function listen() {
  return new Promise((resolve, reject) => {
    const rec = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;

    let finalText = "";
    let silenceTimer;

    const resetTimer = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => rec.stop(), 5000);
    };

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      resetTimer();
    };

    rec.onend = () => resolve(finalText.trim());
    rec.onerror = reject;

    rec.start();
    resetTimer(); // kick off first timer
  });
}

async function startAIInteraction() {
  if (busy) return; // ignore second click
  busy = true;

  try {
    simulateListening();
    messageDisplay.textContent = "Listening…";

    const userInput = await listen();
    const aiResponse = await getAIResponse(userInput, conversationContext);

    if (aiResponse) {
      //simulateSpeaking();
      messageDisplay.textContent = "Speaking…";
      await speak(aiResponse);
      conversationContext = `User: ${userInput}\nAI: ${aiResponse}`;
    }
  } catch (err) {
    console.error(err);
    messageDisplay.textContent =
      err.name === "AbortError"
        ? "" // user cancelled
        : "An error occurred.";
  } finally {
    busy = false;
    isListening = false;
    circle.classList.remove("listening", "speaking");
    messageDisplay.textContent = "Tap the circle to begin.";
  }
}

function simulateSpeaking() {
  isSpeaking = true;
  isListening = false;
  circle.classList.add("speaking");
  circle.classList.remove("listening");

  setTimeout(() => {
    isSpeaking = false;
    circle.classList.remove("speaking");
    messageDisplay.textContent = "Tap the circle to begin.";
  }, 10000);
}

function simulateListening() {
  isListening = true;
  isSpeaking = false;
  circle.classList.add("listening");
  circle.classList.remove("speaking");
  messageDisplay.textContent = "Listening...";
}

function toggleSettings() {
  settingsPanel.classList.toggle("active");
}

function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  updateTheme();
}

function updateTheme() {
  if (isDarkTheme) {
    document.body.style.background = "#0f0f0f";
    document.getElementById("bg-animation").style.filter =
      "blur(120px) saturate(1.5)";
  } else {
    document.body.style.background = "#f5f7fa";
    document.getElementById("bg-animation").style.filter =
      "blur(120px) saturate(.8) hue-rotate(40deg)";
  }
}

// Expose theme functions to global scope for inline onclick
window.updateTheme = updateTheme;
window.toggleTheme = toggleTheme;

updateTheme();
