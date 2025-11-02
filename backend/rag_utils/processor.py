import os
import io
from PIL import Image
from typing import List, Dict
from supabase import Client
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import pytesseract
from pdf2image import convert_from_bytes
import nest_asyncio

# Apply nest_asyncio (needed for async DB calls inside sync FastAPI context)
nest_asyncio.apply()

# --- CONFIGURATION ---

# Tesseract executable path (REQUIRED if not in PATH)
# Use the exact path you found during installation
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Configuration for Poppler (REQUIRED for PDF processing if not in PATH)
# Use the exact path to the Poppler 'bin' directory
# POPPLER_PATH = r'C:\poppler\poppler-25.07.0\Library\bin' 

# The Sentence Transformer model we will use (768 dimensions)
EMBEDDING_MODEL = "sentence-transformers/multi-qa-mpnet-base-dot-v1"
EMBEDDING_DIM = 768
CHUNKING_SIZE = 1000
CHUNKING_OVERLAP = 200

# Initialize the embedding model (This will download ~400MB the first time!)
try:
    # This will either load from cache or download the 400MB model
    embed_model = SentenceTransformer(EMBEDDING_MODEL)
    # Force an encoding to trigger download/initialization
    embed_model.encode(["test query to force download"]) 
    print(f"Loaded embedding model: {EMBEDDING_MODEL}")
except FileNotFoundError as e:
    # Catches Tesseract FileNotFoundError if path is wrong
    print(f"FATAL RAG ERROR: {e}")
    raise
except Exception as e:
    # Catches SentenceTransformer download errors or general load issues
    print(f"FATAL RAG ERROR: Could not initialize embedding model.")
    print(f"DETAILS: {e}")
    raise

# Initialize Text Splitter
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNKING_SIZE,
    chunk_overlap=CHUNKING_OVERLAP,
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
        # Process image file using OCR
        image = Image.open(io.BytesIO(file_content))
        text = pytesseract.image_to_string(image)
        
    elif mime_type == 'pdf':
        # Process PDF using pdf2image and OCR
        try:
             # Pass the Poppler path
             pages = convert_from_bytes(file_content)
        except Exception as e:
             # Check for common Poppler error
             print(f"PDF ERROR: Poppler processing failed. Ensure POPPLER_PATH is correct. Details: {e}")
             return f"ERROR: Poppler/PDF processing failed. {e}"

        for page in pages:
            text += pytesseract.image_to_string(page) + "\n\n"
            
    elif mime_type in ['txt', 'md']:
        # Process plain text/markdown file
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
    Splits text, generates embeddings, and saves chunks to Supabase.
    """
    if raw_text.startswith("ERROR"):
        return [{"error": raw_text}]
    
    # 1. Split the raw text into chunks
    chunks = text_splitter.split_text(raw_text)
    print(f"Text split into {len(chunks)} chunks.")
    
    # 2. Generate embeddings for all chunks
    embeddings = embed_model.encode(chunks)
    
    # 3. Prepare data for Supabase insert
    data_to_insert = []
    for i, chunk in enumerate(chunks):
        data_to_insert.append({
            'user_id': user_id,
            'file_name': file_name,
            'content': chunk,
            'embedding': embeddings[i].tolist() # Convert numpy array to Python list
        })
        
    # 4. Save to Supabase (synchronous API call)
    try:
        response = supabase_client.table('documents').insert(data_to_insert).execute()

        if response.data and len(response.data) == len(data_to_insert):
            return [{"success": f"Successfully processed and saved {len(response.data)} chunks."}]
        else:
            return [{"error": f"Failed to insert all chunks. DB response: {response.error if hasattr(response, 'error') else 'Unknown'}"}]
            
    except Exception as e:
        return [{"error": f"Critical Database Insert Error: {e}"}]


def retrieve_context(query_embedding: List[float], user_id: str, supabase_client: Client, top_k: int = 5) -> List[Dict]:
    """
    Performs vector similarity search against the user's documents using the RPC.
    """
    print(f"Retrieving context for user {user_id}...")
    
    embedding_str = str(query_embedding)
    
    # Define the RAG query: Find the nearest vectors using the RPC function
    rag_query = supabase_client.rpc(
        'match_documents',
        {
            'query_embedding': embedding_str,
            'match_count': top_k,
            'user_id_param': user_id 
        }
    ).execute()
    
    if rag_query.data:
        # Extract just the content of the relevant documents
        context = [doc['content'] for doc in rag_query.data]
        return context
    else:
        print("No relevant documents found in RAG.")
        return []