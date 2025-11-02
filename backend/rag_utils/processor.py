import os
import io
import google.generativeai as genai # NEW
from PIL import Image
from typing import List, Dict
from supabase import Client
from langchain_text_splitters import RecursiveCharacterTextSplitter
import pytesseract
from pdf2image import convert_from_bytes
from dotenv import load_dotenv # NEW

# --- CONFIGURATION ---

# 1. Load API Key for embedding model
load_dotenv()
GOOGLE_GEMINI_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
if not GOOGLE_GEMINI_API_KEY:
    raise ValueError("GOOGLE_GEMINI_API_KEY is not set in environment")
genai.configure(api_key=GOOGLE_GEMINI_API_KEY)

# 2. Define the embedding model we'll use from the API
EMBEDDING_MODEL = "models/embedding-001"

# 3. Text Splitter (Unchanged)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", " ", ""]
)

# --- CORE RAG FUNCTIONS ---

def extract_text_from_file(file_content: bytes, file_name: str) -> str:
    """
    Extracts text from various file types, using OCR for images and PDFs.
    """
    print(f"Extracting text from: {file_name}")
    mime_type = file_name.split('.')[-1].lower()
    text = ""
    
    if mime_type in ['png', 'jpg', 'jpeg']:
        image = Image.open(io.BytesIO(file_content))
        text = pytesseract.image_to_string(image)
        
    elif mime_type == 'pdf':
        try:
             # Remove poppler_path for Linux compatibility
             pages = convert_from_bytes(file_content) 
        except Exception as e:
             print(f"PDF ERROR: Poppler processing failed. Details: {e}")
             return f"ERROR: Poppler/PDF processing failed. {e}"

        for page in pages:
            text += pytesseract.image_to_string(page) + "\n\n"
            
    elif mime_type in ['txt', 'md']:
        text = file_content.decode('utf-8')
        
    else:
        return f"ERROR: Unsupported file type: {mime_type}"
    
    return text.strip()


def generate_and_save_embeddings(
    raw_text: str, 
    user_id: str, 
    file_name: str, 
    supabase_client: Client
) -> List[Dict]:
    """
    Splits text, generates embeddings via API, and saves chunks to Supabase.
    """
    if raw_text.startswith("ERROR"):
        return [{"error": raw_text}]
    
    chunks = text_splitter.split_text(raw_text)
    print(f"Text split into {len(chunks)} chunks.")
    
    data_to_insert = []
    for chunk in chunks:
        try:
            # 2. Generate embedding for each chunk via API
            embedding_response = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=chunk,
                task_type="RETRIEVAL_DOCUMENT" # Critical for RAG
            )
            embedding = embedding_response['embedding']

            # 3. Prepare data for Supabase insert
            data_to_insert.append({
                'user_id': user_id,
                'file_name': file_name,
                'content': chunk,
                'embedding': embedding
            })
        except Exception as e:
            print(f"Error embedding chunk: {e}")
            # Skip this chunk and continue
            pass 
        
    # 4. Save to Supabase
    try:
        if not data_to_insert:
             return [{"error": "No text could be embedded from the file."}]
             
        response = supabase_client.table('documents').insert(data_to_insert).execute()

        if response.data:
            return [{"success": f"Successfully processed and saved {len(response.data)} chunks."}]
        else:
            return [{"error": f"Failed to insert chunks. DB response: {response.error if hasattr(response, 'error') else 'Unknown'}"}]
            
    except Exception as e:
        return [{"error": f"Critical Database Insert Error: {e}"}]


def retrieve_context(query: str, user_id: str, supabase_client: Client, top_k: int = 5) -> List[str]:
    """
    Generates embedding for the query via API and performs vector search.
    """
    print(f"Retrieving context for user {user_id}...")
    
    try:
        # 1. Generate embedding for the user's query via API
        query_embedding_response = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=query,
            task_type="RETRIEVAL_QUERY" # Critical for RAG
        )
        query_embedding = query_embedding_response['embedding']
        
        # 2. Perform vector search
        rag_query = supabase_client.rpc(
            'match_documents',
            {
                'query_embedding': query_embedding,
                'match_count': top_k,
                'user_id_param': user_id 
            }
        ).execute()
        
        if rag_query.data:
            context = [doc['content'] for doc in rag_query.data]
            return context
        else:
            print("No relevant documents found in RAG.")
            return []
            
    except Exception as e:
        print(f"Error during RAG retrieval: {e}")
        return []