import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn

# Import local modules
import ai_engine
import rpa_executor

app = FastAPI(title="Automato - Local Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# DATA MODELS
# ==========================================
class WorkflowStep(BaseModel):
    step_number: int
    image_base64: str
    instruction: str


class WorkflowPayload(BaseModel):
    workflow_name: str
    steps: List[WorkflowStep]


class BatchPayload(BaseModel):
    batch_name: str
    workflows: List[WorkflowPayload]


# ==========================================
# ENDPOINTS
# ==========================================

@app.post("/create-workflow")
async def create_workflow(payload: WorkflowPayload):
    """Saves a dynamic array of UI steps to the Pinecone Vector Database."""
    try:
        import updated_memory_db
        vault = updated_memory_db.MemoryVault(
            pinecone_api_key=ai_engine.PINECONE_API_KEY,
            fireworks_api_key=ai_engine.API_KEY,
            index_name=ai_engine.PINECONE_INDEX_NAME
        )

        for step in payload.steps:
            template_name = f"{payload.workflow_name}_step_{step.step_number}"
            vault.create_template(template_name=template_name, text_rules=step.instruction)

        return {"status": "success", "message": f"Saved {len(payload.steps)} steps to Memory Vault."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run-agent")
async def run_agent(payload: WorkflowPayload):
    """Executes a single sequential playbook with persistent clipboard memory."""
    return await execute_playbook(payload)


@app.post("/run-batch")
async def run_batch(payload: BatchPayload):
    """
    Enterprise Batching:
    Phase 1: Processes all AI vision tasks simultaneously in the cloud (Maximum Speed).
    Phase 2: Executes the physical mouse/keyboard actions sequentially (OS Safety).
    """
    print(f"\n📂 STARTING BATCH PROCESS: {payload.batch_name} ({len(payload.workflows)} items)")

    # --- PHASE 1: PARALLEL BRAIN PROCESSING ---
    print("\n--- PHASE 1: Asynchronous Cloud Processing ---")

    async def fetch_brain_data(workflow):
        clipboard_state = {}
        brain_output = {}
        for step in workflow.steps:
            # asyncio.to_thread runs the synchronous AI call in the background
            # so it doesn't block the server, allowing all images to process at once!
            brain_output = await asyncio.to_thread(
                ai_engine.run_pipeline, step.image_base64, step.instruction, clipboard_state
            )
            extracted = brain_output.get("extracted_data", {})
            if extracted:
                clipboard_state.update(extracted)
        return {"workflow": workflow, "brain_output": brain_output}

    # Fire ALL workflows to the Fireworks API at the exact same millisecond
    brain_tasks = [fetch_brain_data(wf) for wf in payload.workflows]
    batch_results = await asyncio.gather(*brain_tasks, return_exceptions=True)

    # --- PHASE 2: SEQUENTIAL MUSCLE EXECUTION ---
    print("\n--- PHASE 2: Sequential OS Execution ---")

    # Dynamic Setup Phase!
    print("📝 Generating Dynamic Spreadsheet Headers...")

    # Find the first successful extraction to use as our column headers
    first_success = next((res for res in batch_results if not isinstance(res, Exception) and res.get("brain_output")),
                         None)

    if first_success:
        extracted_keys = list(first_success["brain_output"].get("extracted_data", {}).keys())

        if extracted_keys:
            setup_actions = []
            setup_actions.append({
                "action_type": "press_key", 
                "payload": "esc",
                "target_app_keywords": ["Excel", "Sheets", "Chrome"]
            })
            for key in extracted_keys:
                formatted_header = str(key).replace("_", " ").title()

                setup_actions.append({
                    "action_type": "type_text",
                    "payload": formatted_header,
                    "target_app_keywords": ["Excel", "Sheets", "Chrome"]
                })
                setup_actions.append({
                    "action_type": "press_key",
                    "payload": "tab"
                })

            # Change the very last "tab" to an "enter" so it drops to the next row
            if setup_actions:
                setup_actions[-1] = {"action_type": "press_key", "payload": "enter"}

            setup_payload = {"actions_to_take": setup_actions}

            try:
                rpa_executor.execute_actions(setup_payload)
            except Exception as e:
                print(f"❌ Failed to write dynamic headers: {e}")
    else:
        print("⚠️ No successful data extracted in this batch to create headers.")

    # Now the normal batch loop continues...
    results = []

    for i, task_result in enumerate(batch_results):
        print(f"\nExecuting Batch Item {i + 1}...")

        if isinstance(task_result, Exception):
            print(f"❌ Brain failed on item {i + 1}: {task_result}")
            results.append({"item": i + 1, "status": "failed"})
            continue

        brain_output = task_result.get("brain_output", {})

        try:
            if brain_output:
                rpa_executor.execute_actions(brain_output)
            results.append({"item": i + 1, "status": "success"})
        except Exception as e:
            print(f"❌ Muscle failed on item {i + 1}: {e}")
            results.append({"item": i + 1, "status": "failed", "error": str(e)})

    return {"status": "batch_complete", "summary": results}


# ==========================================
# INTERNAL EXECUTION LOGIC
# ==========================================
async def execute_playbook(payload: WorkflowPayload):
    print(f"\n🚀 STARTING PLAYBOOK: {payload.workflow_name}")
    clipboard_state = {}
    headers_written = False # 🌟 Crucial: Track if we've set up the sheet

    for step in payload.steps:
        # 1. Ask the Brain
        brain_output = ai_engine.run_pipeline(
            raw_base64_img=step.image_base64,
            instruction=step.instruction,
            clipboard=clipboard_state
        )

        # 🌟 NEW: Setup Headers on the very first successful extraction
        extracted = brain_output.get("extracted_data", {})
        if extracted and not headers_written:
            print("📝 Writing Dynamic Spreadsheet Headers...")
            setup_actions = []
            
            # Start by clearing any accidental browser menus
            setup_actions.append({"action_type": "press_key", "payload": "esc"})
            
            for key in extracted.keys():
                # This guarantees "vendor_name" becomes "Vendor Name"
                formatted_header = str(key).replace("_", " ").title()
                setup_actions.append({
                    "action_type": "type_text", 
                    "payload": formatted_header,
                    "target_app_keywords": ["Excel", "Sheets", "Chrome"]
                })
                # 🌟 FIX 3: Add the target keywords to the tab presses too!
                setup_actions.append({
                    "action_type": "press_key", 
                    "payload": "tab",
                    "target_app_keywords": ["Excel", "Sheets", "Chrome"]
                })
            
            # Use 'enter' at the end to move the cursor to Row 2 for the actual data
            if setup_actions:
                setup_actions[-1] = {"action_type": "press_key", "payload": "enter"}
                rpa_executor.execute_actions({"actions_to_take": setup_actions})
                headers_written = True

        # 2. Update Clipboard State
        if extracted:
            clipboard_state.update(extracted)
            print(f"💾 Saved to Clipboard: {extracted}")

        # 3. Fire the Muscle for the actual data entry
        rpa_executor.execute_actions(brain_output)
        
    return {"workflow": payload.workflow_name, "final_clipboard": clipboard_state}


if __name__ == "__main__":
    print("🟢 Starting Automato API...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
