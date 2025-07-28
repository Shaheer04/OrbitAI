// ai-logic.js
const API_ENDPOINT = "http://127.0.0.1:8000/ai-therapy/";

// NEW: shared state between front-end and back-end
let mode = "chat"; // 'chat' | 'listen' | 'care'

// tiny helper
const prompts = {
  chat: `You are a compassionate friend. Reply briefly, empathically, and avoid medical advice.`,
  listen: `You are now in pure listening mode. Reply only with neutral acknowledgments like “I hear you,” or “mm-hmm.” No advice.`,
  care: `You are in extra-caring mode. Be warm, validating, and gently check in.`,
};

export async function getAIResponse(userMessage, context = "") {
  // choose prompt
  const base = prompts[mode] || prompts.chat;
  const promptText = `${base}\n\nContext:\n${context}\nUser: ${userMessage}\nAI:`;

  try {
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: promptText }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { response } = await res.json();
    return response;
  } catch (err) {
    console.error(err);
    return "I'm having trouble connecting to the server. Please try again later.";
  }
}

// let the front-end change modes
export function setMode(newMode) {
  mode = ['chat', 'listen', 'care'].includes(newMode) ? newMode : 'chat';
}