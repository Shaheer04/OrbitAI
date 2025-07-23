// ai-logic.js
const API_ENDPOINT = 'http://127.0.0.1:8000/ai-therapy/'; // Replace if needed

export async function getAIResponse(userMessage, context = "") {  // Add context parameter
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: userMessage, context: context }) // Send message and context
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.response; // Assuming the backend returns { response: "AI reply" }
    } catch (error) {
        console.error('Error fetching AI response:', error);
        return "I'm having trouble connecting to the server. Please try again later.";
    }
}