import { getAIResponse, setMode as setAIMode } from "../backend/ai-logic.js";

const circle = document.getElementById("central-circle");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const messageDisplay = document.getElementById("message-display");
const modeLabel = document.getElementById("modeLabel");
const careBtn = document.getElementById("careBtn");
const ventingBtn = document.getElementById("ventingBtn");
const chatBtn = document.getElementById("chatBtn");
const sendListenBtn = document.getElementById("sendListenBtn");
const ventingNotebook = document.getElementById("venting-notebook");
const transcriptList = document.getElementById("transcript-list");
const modes = ["chat", "listen", "care"];
let mode = "chat";
let ventingTranscripts = []; // Store all transcripts for venting/listen mode
let lastTranscript = ""; // Moved to proper scope

function updateModeUI(newMode) {
  mode = newMode;
  setAIMode(newMode);
  if (modeLabel) modeLabel.textContent = `Mode: ${newMode}`;
  document.body.setAttribute("data-mode", newMode);

  // Hide send button and reset message display on mode change
  if (sendListenBtn) sendListenBtn.style.display = "none";
  if (messageDisplay) {
    messageDisplay.textContent = "Tap the circle to begin.";
    messageDisplay.classList.remove("notebook-text"); // Remove by default
  }
  if (circle) circle.classList.remove("listening-highlight");

  // Handle notebook display for listen/venting mode
  if (ventingNotebook) {
    ventingNotebook.style.display = newMode === "listen" ? "flex" : "none";
  }

  // Reset transcript list when switching away from listen mode
  if (transcriptList && newMode !== "listen") {
    transcriptList.innerHTML = "";
    ventingTranscripts = []; // Clear transcripts
    lastTranscript = ""; // Reset the last transcript
  }
}

// initial paint
updateModeUI(mode);

if (careBtn) {
  careBtn.addEventListener("click", () => updateModeUI("care"));
}
if (ventingBtn) {
  ventingBtn.addEventListener("click", () => updateModeUI("listen")); // Venting is listen mode
}
if (chatBtn) {
  chatBtn.addEventListener("click", () => updateModeUI("chat"));
}

let isSpeaking = false;
let isListening = false;
let isDarkTheme = false; // Default to light theme
let conversationContext = ""; // Store the conversation context
let currentUtterance = null; // to interrupt ongoing speech
let busy = false;

circle.addEventListener("click", () => {
  if (currentUtterance || isSpeaking) {
    window.speechSynthesis.cancel();
    busy = false;
    // Always call startListenMode in listen mode, even after interrupt
    if (mode === "listen") {
      setTimeout(startListenMode, 50);
    } else {
      setTimeout(startAIInteraction, 50);
    }
  } else if (!busy) {
    if (mode === "listen") {
      startListenMode();
    } else {
      startAIInteraction();
    }
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
    rec.interimResults = true; // Enable interim results for real-time updates

    let silenceTimer;
    const timeoutDuration = mode === "listen" ? 8000 : 5000;
    const resetTimer = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => rec.stop(), timeoutDuration);
    };

    let lastLi = null;
    let lastTranscriptBeforeEnd = "";
    let transcript = "";

    rec.onresult = (e) => {
      transcript = "";
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        transcript += e.results[i][0].transcript.trim();
      }
      if (mode === "listen" && transcriptList) {
        if (!lastLi) {
          lastLi = document.createElement("li");
          transcriptList.appendChild(lastLi);
        }
        lastLi.textContent = transcript;
        lastTranscript = transcript;
        lastTranscriptBeforeEnd = transcript;
      }
      resetTimer();
    };

    rec.onend = () => {
      // Only keep the last transcript visible in listen mode
      if (
        mode === "listen" &&
        transcriptList &&
        lastLi &&
        lastTranscriptBeforeEnd
      ) {
        lastLi.textContent = lastTranscriptBeforeEnd;
        lastTranscript = lastTranscriptBeforeEnd;
        resolve(lastTranscriptBeforeEnd.trim());
      } else {
        // For chat/care modes, just resolve the transcript
        resolve(transcript.trim());
      }
    };
    rec.onerror = reject;

    rec.start();
    resetTimer(); // kick off first timer
  });
}

async function startAIInteraction() {
  if (busy) return;
  busy = true;
  try {
    simulateListening();
    messageDisplay.textContent = "Listening…";
    const userInput = await listen();
    if (mode === "listen") {
      lastTranscript = userInput;
      messageDisplay.textContent = userInput
        ? userInput
        : "(No speech detected)";
      if (sendListenBtn) sendListenBtn.style.display = "block";
      if (circle) circle.classList.add("listening-highlight");
      busy = false;
      return;
    }
    const aiResponse = await getAIResponse(userInput, conversationContext);
    if (aiResponse) {
      messageDisplay.textContent = "Speaking…";
      await speak(aiResponse);
      conversationContext = `User: ${userInput}\nAI: ${aiResponse}`;
    }
  } catch (err) {
    console.error(err);
    messageDisplay.textContent =
      err.name === "AbortError" ? "" : "An error occurred.";
  } finally {
    if (mode !== "listen") {
      busy = false;
      isListening = false;
      circle.classList.remove("listening", "speaking");
      messageDisplay.textContent = "Tap the circle to begin.";
    }
  }
}

// Listen mode: record, show transcript in notebook, wait for send
async function startListenMode() {
  if (busy) return;
  busy = true;
  try {
    simulateListening();
    messageDisplay.textContent = "Listening... Share what's on your mind.";
    const userInput = await listen();
    // Do NOT add a new <li> here; real-time transcript already handled
    lastTranscript = userInput;
    if (userInput) {
      messageDisplay.textContent = "Tap to continue, or send to AI.";
    } else {
      messageDisplay.textContent = "(No speech detected)";
    }
    if (sendListenBtn) sendListenBtn.style.display = "block";
    if (circle) circle.classList.add("listening-highlight");
  } catch (err) {
    console.error(err);
    messageDisplay.textContent =
      err.name === "AbortError" ? "" : "An error occurred.";
  } finally {
    busy = false;
    isListening = false;
  }
}

// Handle Send button in listen mode (ONLY ONE LISTENER - REMOVED THE DUPLICATE)
if (sendListenBtn) {
  sendListenBtn.style.display = "none"; // Initially hidden
  sendListenBtn.addEventListener("click", async () => {
    // Use either lastTranscript or combine all venting transcripts
    let contentToSend = lastTranscript;
    if (mode === "listen" && ventingTranscripts.length > 0) {
      contentToSend = ventingTranscripts.join("\n");
    }

    if (!contentToSend) {
      messageDisplay.textContent = "No message to send.";
      return;
    }

    sendListenBtn.style.display = "none";
    messageDisplay.textContent = "Sending…";
    circle.classList.remove("listening-highlight");
    busy = true;
    try {
      const aiResponse = await getAIResponse(
        contentToSend,
        conversationContext
      );
      if (aiResponse) {
        messageDisplay.textContent = "Speaking…";
        await speak(aiResponse);
        conversationContext = `User: ${contentToSend}\nAI: ${aiResponse}`;

        // Clear the notebook after sending
        ventingTranscripts = [];
        if (transcriptList) transcriptList.innerHTML = "";
      }
    } catch (err) {
      console.error(err);
      messageDisplay.textContent = "An error occurred.";
    } finally {
      busy = false;
      isListening = false;
      lastTranscript = "";
      messageDisplay.textContent = "Tap the circle to begin.";
    }
  });
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
  // Extra highlight for listen mode
  if (mode === "listen") {
    circle.classList.add("listening-highlight");
  }
  // Don't automatically set messageDisplay text for listen mode
  if (mode !== "listen") {
    messageDisplay.textContent = "Listening...";
  }
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
