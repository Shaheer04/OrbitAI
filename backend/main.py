from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

app = FastAPI()

# CORS configuration to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins.  In production, restrict this!
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Define a data model for the request body
class UserMessage(BaseModel):
    message: str
    context: str = ""  # Optional context

# Configure the Gemini API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("No GOOGLE_API_KEY set.  Please set it in your .env file.")

genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash') #or any other gemini models


# AI Prompt
THERAPIST_PROMPT = """You are a compassionate and supportive AI friend. Your goal is to listen to the user's concerns, acknowledge their feelings, and offer helpful and encouraging words.

When responding, keep the following in mind:
- Be empathetic, understanding and concise.
- Acknowledge the user's emotions (e.g., "It sounds like you're feeling [emotion]").
- Offer practical advice or coping mechanisms when appropriate.
- Don't offer the same advice again if the user has already received it.
- Be concise and avoid giving medical advice. If the user requires professional medical help, advise them to seek a professional
- Avoid repeating the same advice if the user has already received it.      
Now, respond to the following user input:
    """

# Route to handle user messages and generate AI responses
@app.post("/ai-therapy/")
async def ai_therapy_endpoint(user_message: UserMessage):
    try:
        # Construct the full prompt with user message and context
        prompt_text = f"""{THERAPIST_PROMPT}

        Current conversation context: {user_message.context}

        User: {user_message.message}
        AI Therapist: """  # Expecting the model to continue as the AI Therapist

        # Generate content using Gemini
        response = model.generate_content(prompt_text)

        # Check for safety issues
        if response.prompt_feedback and response.prompt_feedback.block_reason:
            raise HTTPException(status_code=400, detail=f"Blocked due to: {response.prompt_feedback.block_reason}")

        return {"response": response.text}

    except Exception as e:
        print(f"Error during AI processing: {e}")  # Log the error
        raise HTTPException(status_code=500, detail=str(e))

# Run the FastAPI application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)