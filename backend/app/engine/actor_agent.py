"""
Actor Agent: Handles the character's decision-making.
This is the "AI Actor" that interprets the commander's suggestion through the character's lens (agenda, status).
Uses a simple LangChain chain: PromptTemplate -> LLM -> JsonOutputParser for structured JSON output.
This keeps it modular—easy to swap prompts or add tools later (seeding complex plan).
"""

import json
from pathlib import Path
from typing import Dict, Any

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from dotenv import load_dotenv
import os

load_dotenv()  # Load .env for API key and model

def get_actor_intent(
    character_data: Dict[str, Any],
    zone_data: Dict[str, Any],
    commander_suggestion: str,
    prompts_dir: str = "../prompts"
) -> Dict[str, Any]:
    """
    Get the Actor's intent based on character agenda and situation.
    
    Args:
        character_data: Dict from Character.model_dump()
        zone_data: Dict from Zone.model_dump()
        commander_suggestion: Player's command string
        prompts_dir: Path to prompts directory
    
    Returns:
        Dict with 'thoughts', 'speech', 'action', 'target' from LLM JSON output.
    
    Concepts:
    - LangChain Chain: Composes components (prompt + LLM + parser) for reusable AI flows.
    - JsonOutputParser: Ensures LLM responds in valid JSON; fails gracefully if not.
    - Temperature=0.7: Balances creativity (for flavorful thoughts) with consistency (structured JSON).
    - Model: deepseek/deepseek-chat-v3.1:free – efficient free tier for learning/experimentation.
    """
    # Initialize LLM with OpenRouter (via langchain_openai) and specified free model
    model = os.getenv("DEFAULT_MODEL", "deepseek/deepseek-chat-v3.1:free")
    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        model=model,
        temperature=0.7  # Moderate creativity for character flavor without chaos
    )
    
    # Load Actor prompt template from .txt file for easy editing
    prompt_file = Path(prompts_dir) / "actor.txt"
    if not prompt_file.exists():
        raise FileNotFoundError(f"Actor prompt not found: {prompt_file}")
    with open(prompt_file, "r") as f:
        prompt_text = f.read()
    
    # Create chain: Template (with variables) -> LLM -> JSON Parser
    prompt_template = PromptTemplate.from_template(prompt_text)
    parser = JsonOutputParser()  # Expects JSON like {"thoughts": "...", "action": "..."}
    chain = prompt_template | llm | parser
    
    # Invoke chain with context
    try:
        result = chain.invoke({
            "character_name": character_data["name"],
            "agenda": character_data["agenda"],
            "zone_name": zone_data["name"],
            "zone_description": zone_data["description"],
            "command": commander_suggestion,
            "character_status": json.dumps(character_data["status"])  # JSON string for prompt
        })
        return result  # e.g., {"thoughts": "I need to fix this quickly...", "action": "repair"}
    except Exception as e:
        # Handle parsing errors (e.g., invalid JSON from LLM)
        return {"error": f"Actor intent failed: {str(e)}", "thoughts": "", "speech": "", "action": "", "target": ""}
