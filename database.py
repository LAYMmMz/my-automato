import os
from dotenv import load_dotenv
import re
import fireworks.client
from pinecone import Pinecone


class MemoryVault:
    def __init__(self, pinecone_api_key: str, fireworks_api_key: str, index_name: str):
        """
        Initializes the MemoryVault using Fireworks AI for cloud-based embeddings
        and Pinecone for vector storage.
        """
        # 1. Initialize Pinecone
        self.pc = Pinecone(api_key=pinecone_api_key)
        self.index = self.pc.Index(index_name)

        # 2. Initialize Fireworks AI
        fireworks.client.api_key = fireworks_api_key
        # Nomic 1.5 is ideal for this; 768 dimensions.
        self.model_id = "nomic-ai/nomic-embed-text-v1.5"

        print(f"✅ MemoryVault initialized. Using Fireworks model: {self.model_id}")

    def _get_embedding(self, text: str) -> list:
        """
        Private helper to fetch embeddings from Fireworks AI.
        """
        # Prefixing for Nomic 1.5 retrieval optimization
        input_text = f"search_document: {text}"

        response = fireworks.client.Embedding.create(
            model=self.model_id,
            input=input_text
        )
        return response.data[0].embedding

    def create_template(self, template_name: str, text_rules: str, workflow_name: str = None,
                        step_number: int = None) -> str:
        """
        Embeds semantic rules and upserts to Pinecone with normalized coordinate logic
        and sequential playbook metadata.
        """
        # Generate embedding vector
        embedding = self._get_embedding(text_rules)

        # Create a safe, Pinecone-compatible vector ID
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', template_name)
        vector_id = f"tmpl_{safe_name}"

        # Prepare metadata - keeping text_rules as the source of truth for the AI
        metadata = {
            "template_name": template_name,
            "text_rules": text_rules,
            "model_used": self.model_id,
            "coord_format": "normalized_percentage"
        }

        # Inject sequential playbook metadata if provided
        if workflow_name is not None:
            metadata["workflow_name"] = workflow_name
        if step_number is not None:
            metadata["step_number"] = step_number

        # Upsert to Pinecone
        self.index.upsert(vectors=[{
            "id": vector_id,
            "values": embedding,
            "metadata": metadata
        }])

        print(f"✅ Template '{template_name}' stored with Semantic Rules.")
        return vector_id

    def get_template_rules(self, template_name: str) -> str:
        """
        Queries Pinecone using metadata filtering to find the exact match
        for template_name and extracts the 'text_rules'.
        """
        # Query requires a dummy vector of 768 dims for Nomic 1.5
        query_response = self.index.query(
            vector=[0.0] * 768,
            filter={
                "template_name": {"$eq": template_name}
            },
            top_k=1,
            include_metadata=True
        )

        if query_response and query_response['matches']:
            match = query_response['matches'][0]
            # Extract the semantic rules string from metadata
            return match.get('metadata', {}).get('text_rules')

        print(f"⚠️ No template found for: {template_name}")
        return None

    def get_workflow_step(self, workflow_name: str, step_number: int) -> str:
        """
        Queries Pinecone to find the specific semantic rules for a given
        step in a designated workflow playbook.
        """
        # Query requires a dummy vector of 768 dims for Nomic 1.5
        query_response = self.index.query(
            vector=[0.0] * 768,
            filter={
                "$and": [
                    {"workflow_name": {"$eq": workflow_name}},
                    {"step_number": {"$eq": step_number}}
                ]
            },
            top_k=1,
            include_metadata=True
        )

        if query_response and query_response['matches']:
            match = query_response['matches'][0]
            # Extract the semantic rules string from metadata
            return match.get('metadata', {}).get('text_rules')

        print(f"⚠️ No step found for Workflow: '{workflow_name}', Step: {step_number}")
        return None


# ==========================================
# Implementation & Usage
# ==========================================
if __name__ == "__main__":
    # Load the passwords from your AI.env file
    load_dotenv("AI.env")

    # CONFIGURATION
    PINECONE_KEY = os.getenv("PINECONE_API_KEY")
    FIREWORKS_KEY = os.getenv("FIREWORKS_API_KEY")
    INDEX_NAME = "memory-vault-index"

    vault = MemoryVault(
        pinecone_api_key=PINECONE_KEY,
        fireworks_api_key=FIREWORKS_KEY,
        index_name=INDEX_NAME
    )

    semantic_rules = (
        "Target: Invoice Total. Visual Anchor: Scan the bottom right quadrant "
        "for the final billing amount. Common labels include 'Total', 'Amount Due', or 'Balance'. "
        "IMPORTANT: Calculate output X/Y coordinates as a percentage (0.0 to 1.0) of total "
        "image dimensions to ensure compatibility across different screen resolutions."
    )

    vault.create_template(
        template_name="generic_invoice_v1",
        text_rules=semantic_rules
    )

    # --- TASK 1: DAY 3 DEMO RULES ---
    vault.create_template(
        template_name="invoice_generic",
        text_rules="Scan the bottom right quadrant for the final billing amount. Calculate output X/Y coordinates as a percentage (0.0 to 1.0)."
    )

    vault.create_template(
        template_name="invoice_left_sidebar",
        text_rules="Look inside a colored sidebar on the left side of the page and ignore the right side. Calculate output X/Y coordinates as a percentage (0.0 to 1.0)."
    )

    vault.create_template(
        template_name="invoice_top_header",
        text_rules="Look at the very top right corner, right next to the vendor logo. Calculate output X/Y coordinates as a percentage (0.0 to 1.0)."
    )

    # --- TASK 2: DAY 4 SCALING RULES ---
    vault.create_template(
        template_name="receipt_restaurant",
        text_rules="Look for handwritten tip and total numbers near the bottom of a narrow receipt."
    )

    vault.create_template(
        template_name="w2_tax_form",
        text_rules="Scan the standard W-2 grid layout specifically for Box 1 labeled 'Wages, tips, other comp'."
    )

    # --- TASK 3: SEQUENTIAL PLAYBOOK DEMO ---
    print("\n--- Testing Sequential Playbook Metadata ---")
    vault.create_template(
        template_name="invoice_pipeline_step_1",
        text_rules="Step 1: Extract vendor name from the top header.",
        workflow_name="Invoice Pipeline",
        step_number=1
    )
    vault.create_template(
        template_name="invoice_pipeline_step_2",
        text_rules="Step 2: Locate line items in the center table and parse totals.",
        workflow_name="Invoice Pipeline",
        step_number=2
    )

    retrieved_step_2 = vault.get_workflow_step("Invoice Pipeline", 2)
    if retrieved_step_2:
        print(f"🔗 Successfully chained Step 2: {retrieved_step_2}")

    # 2. Retrieving the Rules for the "Muscle" layer
    retrieved_rules = vault.get_template_rules("generic_invoice_v1")

    if retrieved_rules:
        print("\n--- RETRIEVED SEMANTIC RULES ---")
        print(retrieved_rules)
        print("--------------------------------\n")
