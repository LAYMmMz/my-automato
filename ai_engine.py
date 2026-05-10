import requests
import json
import base64
from PIL import Image
import os
import io
from dotenv import load_dotenv
from pinecone import Pinecone

# Load the secret variables
load_dotenv("AI.env")

# ==========================================
# 1. API CONFIGURATION
# ==========================================
API_URL = "https://api.fireworks.ai/inference/v1/chat/completions"
API_KEY = os.getenv("FIREWORKS_API_KEY")
MODEL_NAME = "accounts/fireworks/models/qwen3p6-plus"

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = "memory-vault-index" 

# ==========================================
# 2. HELPER FUNCTIONS (WITH SPEED COMPRESSION)
# ==========================================
from PIL import Image
import io
import base64

def compress_base64_image(base64_string, max_size=(600, 600), quality=40):
    """
    Hackathon-Optimized Compression:
    Shrinks the image to 600px and drops quality to 40% for lightning-fast API uploads.
    """
    # Decode the base64 string
    img_data = base64.b64decode(base64_string)
    img = Image.open(io.BytesIO(img_data))
    
    # Convert to RGB (removes alpha channel to save space)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
        
    # Resize keeping aspect ratio
    img.thumbnail(max_size, Image.Resampling.LANCZOS)
    
    # Save with aggressive compression
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=quality)
    
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

def call_vision_model(base64_image, system_prompt):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Process this image according to your system instructions."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                ]
            }
        ],
        "temperature": 0.1 
    }

    response = requests.post(API_URL, headers=headers, json=payload)
    if response.status_code != 200:
        raise Exception(f"API Error {response.status_code}: {response.text}")
    
    raw_output = response.json()['choices'][0]['message']['content']
    clean_json_string = raw_output.replace('```json\n', '').replace('```json', '').replace('```', '').strip()
    return json.loads(clean_json_string)

# ==========================================
# 3. THE CLOUD RETRIEVER
# ==========================================
def retrieve_agentic_rules_from_memory(document_type):
    print(f"   [Searching Cloud Memory Vault for '{document_type}'...]")
    
    query_text = f"search_query: {document_type}"
    
    embed_url = "https://api.fireworks.ai/inference/v1/embeddings"
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    payload = {"input": query_text, "model": "nomic-ai/nomic-embed-text-v1.5"}
    
    res = requests.post(embed_url, headers=headers, json=payload)
    if res.status_code != 200:
        raise Exception(f"Fireworks Embedding Error: {res.text}")
        
    query_vector = res.json()['data'][0]['embedding']
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX_NAME)
    
    search_results = index.query(vector=query_vector, top_k=3, include_metadata=True)
    
    if search_results['matches']:
        print(f"   -> Found {len(search_results['matches'])} possible layout rules in Pinecone.")
        return "\n---\n".join([match['metadata']['text_rules'] for match in search_results['matches']])
            
    print("   -> No exact memory found in Pinecone. Proceeding with default extraction.")
    return "Fallback Rule: Extract all visible fields as best as you can."

# ==========================================
# 4. THE MASTER PIPELINE (WITH STATE & FORMATTING)
# ==========================================
def run_pipeline(raw_base64_img, instruction, clipboard=None):
    if clipboard is None:
        clipboard = {}

    print("1. Optimizing Image for Speed...")
    optimized_img_b64 = compress_base64_image(raw_base64_img)

    print("2. Running Vision Classification...")
    classifier_prompt = """You are a document classification engine. Look at the image. 
    Output ONLY a raw JSON object with a single key 'document_type'. 
    Example values: 'invoice', 'tax_form', 'customer_email', 'canva_ui', 'excel_ui'."""
    
    classification_result = call_vision_model(optimized_img_b64, classifier_prompt)
    doc_type = classification_result.get('document_type', 'unknown')
    print(f"   -> Classified as: {doc_type}")
    
    print("3. Retrieving Semantic Rules from Cloud...")
    retrieved_rules = retrieve_agentic_rules_from_memory(doc_type)
    
    print("4. Evaluating Layout & Generating Final Execution Payload...")
    
    # Token Minimization: Stripped of all unnecessary strings to force faster generation
    target_schema = """
    {
      "task_status": "success",
      "confidence_score": 0.00,
      "document_type": "invoice",
      "extracted_data": {
          "vendor_name": "Example Corp",
          "invoice_date": "2024-01-01",
          "total_amount": "123.45"
      }, 
      "actions_to_take": [
        {
          "step": 1, 
          "action_type": "type_text", 
          "payload": "Example Corp", 
          "target_app_keywords": ["Excel", "Sheets", "Chrome"]
        },
        {
          "step": 2, 
          "action_type": "press_key", 
          "payload": "tab"
        },
        {
          "step": 3, 
          "action_type": "type_text", 
          "payload": "2024-01-01", 
          "target_app_keywords": ["Excel", "Sheets", "Chrome"]
        },
        {
          "step": 4, 
          "action_type": "press_key", 
          "payload": "tab"
        },
        {
          "step": 5, 
          "action_type": "type_text", 
          "payload": "123.45", 
          "target_app_keywords": ["Excel", "Sheets", "Chrome"]
        },
        {
          "step": 6, 
          "action_type": "press_key", 
          "payload": "enter"
        }
      ]
    }
    """

    commander_prompt = f"""You are an expert Robotic Process Automation (RPA) agent. 
    Analyze the provided image and evaluate these POSSIBLE RULES retrieved from memory:
    {retrieved_rules}

    CURRENT CLIPBOARD STATE:
    {json.dumps(clipboard)}

    USER INSTRUCTION:
    {instruction}

    INSTRUCTIONS:
    1. Complete the USER INSTRUCTION above.
    2. Select the ONE retrieved rule that best matches this layout.
    3. Coordinates MUST be NORMALIZED PERCENTAGES (0.0 to 1.0).
    4. 'payload' MUST contain the specific text or data value you extracted for that step.    
    5. 'target_app_keywords' must be an array of OS window titles to search for. IMPORTANT: If the extracted data belongs in a spreadsheet, ALWAYS output exactly ["Excel", "Sheets", "Chrome"] to allow auto-detection.
    6. Output MUST match this exact JSON schema: {target_schema}
    7. Output ONLY valid JSON. Keep output as short as mathematically possible to save generation time.
    8. IGNORE THE TOOLBAR: Do not interact with the browser address bar, triple-dot menus, extensions, or window controls (X, minimize). These are typically located at $y < 0.15$.
    9. GRID FOCUS: When interacting with a spreadsheet, the data grid typically starts at $y > 0.20$. Ensure all target_coordinates for typing data are within the white grid area.
    10. MAPPING RULE: For every key found in extracted_data, you MUST create a corresponding type_text action followed by a press_key: tab action. Do not skip any data fields. The final action should be press_key: enter to move to the next row.
    11. DATA DICTIONARY RULE: The keys in the extracted_data JSON MUST be generic, descriptive column headers (e.g., 'vendor_name', 'invoice_date', 'total_amount'). NEVER use the actual extracted data values as the keys."""
    
    max_retries = 2
    for attempt in range(max_retries):
        final_commands = call_vision_model(optimized_img_b64, commander_prompt)
        extracted = final_commands.get("extracted_data", {})
        
        # 🌟 THE VALIDATION CHECK: Did it find at least 3 fields?
        if len(extracted.keys()) >= 3:
            print("✅ Brain extracted complete data.")
            break
        else:
            print(f"⚠️ Brain was lazy (Attempt {attempt + 1}). Retrying...")
            # Optional: Add a tiny delay before hitting the API again
            time.sleep(1) 
            
    final_commands['document_type'] = doc_type 
    return final_commands
