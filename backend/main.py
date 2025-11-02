import uvicorn
import os
import google.generativeai as genai
import requests
import json
import asyncio
from typing import List, Dict, Optional

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from rag_utils.processor import (
    embed_model, 
    retrieve_context, 
    generate_and_save_embeddings,
    extract_text_from_file
)

# --- 1. Load API Keys ---
load_dotenv()
GOOGLE_GEMINI_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# --- 2. Initialize Clients ---
genai.configure(api_key=GOOGLE_GEMINI_API_KEY)
model = genai.GenerativeModel('models/gemini-flash-latest') 

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Supabase URL or Service Key missing from backend/.env file")
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# --- 3. Define API Data Models ---
class ResearchRequest(BaseModel):
    query: str
    user_id: str
    # --- THIS WAS THE FIX ---
    # Changed from Optional[str] to Optional[int] to match the database
    conversation_id: Optional[int] = None 

# --- 4. Create FastAPI App & Configure CORS ---
app = FastAPI(title="AI Researcher Backend")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.109:3000"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 5. Web Search Function (Unchanged) ---
def search_web(query: str):
    url = "https://google.serper.dev/search"
    payload = json.dumps({"q": query})
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}
    try:
        response = requests.request("POST", url, headers=headers, data=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error during web search for '{query}': {e}")
        return {"error": f"Search failed for '{query}': {str(e)}"}

# --- NEW: Function to load message history ---
def load_messages(conversation_id: int): # <-- THIS WAS THE FIX (changed from str to int)
    """Loads previous messages for context."""
    if not conversation_id:
        return []
    
    try:
        messages_response = supabase_client.table('messages').select('role, content') \
            .eq('conversation_id', conversation_id) \
            .order('created_at', desc=False).execute() # Correct syntax
            
        if messages_response.data:
            history = []
            for msg in messages_response.data:
                history.append({
                    'role': 'user' if msg['role'] == 'user' else 'model',
                    'parts': [msg['content']]
                })
            return history
    except Exception as e:
        print(f"Error loading history: {e}")
        return []
    return []

# --- NEW: Function to format sources ---
def format_search_sources(search_results: Dict) -> str:
    """Extracts titles and links from top search results for the prompt."""
    if not isinstance(search_results, dict):
        return "No valid search results found."
        
    organic_results = search_results.get('organic', [])
    
    formatted_sources = "--- TOP WEB SOURCES ---\n"
    
    for i, result in enumerate(organic_results[:5]): # Get top 5
        title = result.get('title', 'No Title')
        link = result.get('link', '#')
        formatted_sources += f"{i+1}. [{title}]({link})\n"
        
    if not organic_results:
        return "No specific web results available."
        
    return formatted_sources

# --- 6. Core Streaming Logic (MODIFIED FOR CHAT CONTINUITY & SOURCES) ---
async def stream_research_report(query: str, user_id: str, conversation_id: Optional[int] = None):
    full_report_content = ""
    
    history = load_messages(conversation_id)
    
    retrieved_context = ""
    try:
        query_embedding = embed_model.encode([query])[0].tolist() 
        context_chunks = retrieve_context(query_embedding, user_id, supabase_client)
        if context_chunks:
            retrieved_context = "\n---\n".join(context_chunks)
            print(f"RAG: Retrieved {len(context_chunks)} chunks for context.")
    except Exception as e:
        print(f"CRITICAL RAG ERROR during retrieval: {e}")

    if not conversation_id:
        try:
            insert_response = supabase_client.table('conversations').insert({
                'user_id': user_id,
                'query_text': query,
            }).execute()
            
            if insert_response.data and len(insert_response.data) > 0:
                conversation_id = insert_response.data[0]['id']
            else:
                yield "Error: Could not save initial conversation record.\n"
                return
        except Exception as e:
            yield f"Error initiating conversation save: {e}\n"
            return
            
    try:
        supabase_client.table('messages').insert({
            'conversation_id': conversation_id,
            'user_id': user_id,
            'role': 'user',
            'content': query
        }).execute()
    except Exception as e:
        print(f"Error saving user message to history: {e}")
        yield f"Warning: Could not save message to history.\n"

    search_results = search_web(query)
    formatted_sources_list = format_search_sources(search_results)
    
    rag_section = ""
    if retrieved_context:
        rag_section = f"""
        --- USER DOCUMENT CONTEXT (RAG) ---
        The following information was retrieved from the user's uploaded private documents. PRIORITIZE THIS INFORMATION:
        {retrieved_context}
        --- END USER DOCUMENT CONTEXT ---
        """
        
    system_instruction = f"""
    You are a professional AI Research Agent and Chatbot. Your goal is to provide a comprehensive, well-structured, and helpful response to the user's LATEST query.

    Instructions:
    1.  Analyze the user's latest query in the context of the CHAT HISTORY.
    2.  Prioritize information from the USER DOCUMENT CONTEXT (RAG) above all other sources.
    3.  Supplement your answer using the provided Web Search Results.
    4.  Format your entire output using clean Markdown.
    5.  CRITICAL: You MUST include the full list of "TOP WEB SOURCES" at the very end of your response under a "### Sources" heading, using the provided Markdown links.

    CHAT HISTORY:
    {"[No history]" if not history else "See chat contents."}
    
    {rag_section}
    
    Web Search Results (for synthesis):
    {json.dumps(search_results.get('knowledge_graph', {}), indent=2)}
    {json.dumps(search_results.get('answer_box', {}), indent=2)}

    {formatted_sources_list}
    """
    
    try:
        chat_session = model.start_chat(history=history)
        
        response_stream = chat_session.send_message(
            f"{system_instruction}\n\nUSER'S LATEST QUERY: {query}",
            stream=True
        )
        
        for chunk in response_stream:
            if chunk.text:
                yield chunk.text
                full_report_content += chunk.text

    except Exception as e:
        error_message = f"Error during report generation: {str(e)}\n"
        print(error_message)
        yield f"Sorry, an error occurred while generating the report.\n"
        full_report_content = f"Error during generation: {str(e)}"

    if conversation_id and full_report_content and not full_report_content.startswith("Error"):
        try:
            supabase_client.table('messages').insert({
                'conversation_id': conversation_id,
                'user_id': user_id,
                'role': 'ai',
                'content': full_report_content
            }).execute()
            
            print(f"Successfully saved AI response for conversation ID: {conversation_id}")
        except Exception as e:
            print(f"Exception updating history tables: {e}")


# --- 7. NEW: Endpoint for retrieving a full conversation ---
@app.get("/conversation/{conversation_id}")
async def get_conversation_history(conversation_id: int): # <-- THIS WAS THE FIX (changed from str to int)
    """Retrieves all messages for a given conversation ID."""
    try:
        messages_response = supabase_client.table('messages').select('role, content') \
            .eq('conversation_id', conversation_id) \
            .order('created_at', desc=False).execute() # Correct syntax
        
        if messages_response.data:
            return messages_response.data
        
        return []
        
    except Exception as e:
        print(f"Error getting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- 8. The /research endpoint (MODIFIED) ---
@app.post("/research")
async def run_research(request: ResearchRequest):
    if not request.user_id:
         raise HTTPException(status_code=400, detail="User ID is missing from request")
         
    return StreamingResponse(
        stream_research_report(request.query, request.user_id, request.conversation_id),
        media_type="text/event-stream"
    )

# --- 9. File Upload Endpoint (Unchanged) ---
@app.post("/upload_document")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = "placeholder" 
):
    if user_id == "placeholder":
         raise HTTPException(status_code=400, detail="User ID must be provided")

    print(f"Received file '{file.filename}' for user {user_id}")

    try:
        file_content = await file.read()
        raw_text = extract_text_from_file(file_content, file.filename)

        if raw_text.startswith("ERROR"):
            raise HTTPException(status_code=500, detail=raw_text)

        result = generate_and_save_embeddings(
            raw_text,
            user_id,
            file.filename,
            supabase_client
        )
        
        if result[0].get("error"):
             raise HTTPException(status_code=500, detail=result[0]["error"])

        return {"status": "success", "message": result[0]["success"]}

    except Exception as e:
        print(f"Error processing file: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"File processing failed. Error: {str(e)}"
        )

# --- 10. The "Hello World" root ---
@app.get("/")
def read_root():
    return {"message": "AI Researcher API is running!"}

# --- 11. Run the Server (Unchanged) ---
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8888, reload=True)