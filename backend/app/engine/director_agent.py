"""
Director Agent: Resolves actions and narrates outcomes using a simple LangGraph workflow.
This is the "AI Director" – creative storyteller that sets difficulty, resolves via threshold,
and updates the world. Uses a single node for simplicity, but seeded for complex plan's
multi-node breakdown: interpret_action -> resolve_action -> narrate_and_update.
LangGraph allows stateful flows; here, it's minimal but expandable (e.g., add branches for checks).
"""

import json
from typing import Dict, Any, TypedDict
from pathlib import Path

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langgraph.graph import StateGraph, END

from dotenv import load_dotenv
import os

load_dotenv()  # Load .env for API key and model

class DirectorState(TypedDict):
    """
    State passed through the Director graph.
    Seeded for complex: Add more fields like 'interpretation', 'resolution' for multi-node.
    """
    action_intent: Dict[str, Any]  # From Actor: thoughts, speech, action, target
    character_data: Dict[str, Any]  # Full character dict
    zone_data: Dict[str, Any]       # Full zone dict
    skill_total: int                # wits + comtech for threshold
    director_result: Dict[str, Any] # Output: difficulty, outcome, narration, world_updates
    error: str                      # For error handling

class DirectorAgent:
    def __init__(self, prompts_dir: str = "../prompts"):
        """
        Initialize DirectorAgent with LLM and compiled LangGraph.
        """
        self.prompts_dir = Path(prompts_dir)
        self.llm = self._get_llm()
        self.graph = self._create_graph()
    
    def _get_llm(self) -> ChatOpenAI:
        """Initialize LLM with free model via OpenRouter."""
        model = os.getenv("DEFAULT_MODEL", "deepseek/deepseek-chat-v3.1:free")
        return ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            model=model,
            temperature=0.7  # Creative narration with consistent structure
        )
    
    def _load_prompt(self, prompt_name: str) -> str:
        """Load Director prompt from .txt for easy iteration."""
        prompt_file = self.prompts_dir / f"{prompt_name}.txt"
        if not prompt_file.exists():
            raise FileNotFoundError(f"Director prompt not found: {prompt_file}")
        with open(prompt_file, "r") as f:
            return f.read()
    
    def _director_node(self, state: DirectorState) -> DirectorState:
        """
        Single node: Interprets action, sets difficulty, resolves threshold, narrates, updates.
        Concepts:
        - Threshold System: Difficulty (0-4) vs skill_total; AI chooses creatively.
        - Creative Authority: Director can add complications (e.g., success but stress++).
        - Seeded for Complex: Split this into separate nodes (interpret -> resolve -> narrate)
          with edges/branches (e.g., if requires_check, go to resolve_node).
        - JsonOutputParser: Ensures structured output for easy parsing into state.
        """
        try:
            # Load and setup chain
            prompt_text = self._load_prompt("director")
            prompt_template = PromptTemplate.from_template(prompt_text)
            parser = JsonOutputParser()
            chain = prompt_template | self.llm | parser
            
            # Prepare inputs
            action_intent_json = json.dumps(state["action_intent"])
            
            result = chain.invoke({
                "action_intent": action_intent_json,
                "character_name": state["character_data"]["name"],
                "skill_total": state["skill_total"],
                "zone_data": json.dumps(state["zone_data"]),
                "character_data": json.dumps(state["character_data"])
            })
            
            state["director_result"] = result  # e.g., {"difficulty": 2, "outcome": "success", "narration": "...", "world_updates": {...}}
            state["error"] = ""
            return state
            
        except Exception as e:
            state["error"] = f"Director node error: {str(e)}"
            state["director_result"] = {}
            return state
    
    def _create_graph(self):
        """
        Create simple LangGraph: Entry -> director_node -> END.
        Seeded for Complex: Add more nodes like:
        - interpret_node: Classify action (requires_check? skill?)
        - resolve_node: Threshold comparison
        - narrate_node: Generate story based on outcome
        Then: set_entry("interpret") -> conditional_edge -> "resolve" -> "narrate" -> END
        """
        workflow = StateGraph(DirectorState)
        workflow.add_node("director", self._director_node)
        workflow.set_entry_point("director")
        workflow.add_edge("director", END)
        return workflow.compile()
    
    def run_director(self, action_intent: Dict[str, Any], character_data: Dict[str, Any], zone_data: Dict[str, Any], skill_total: int) -> Dict[str, Any]:
        """
        Run the Director graph for a full resolution.
        
        Returns:
            {"director_result": {...}, "error": str}
        """
        initial_state = DirectorState(
            action_intent=action_intent,
            character_data=character_data,
            zone_data=zone_data,
            skill_total=skill_total,
            director_result={},
            error=""
        )
        final_state = self.graph.invoke(initial_state)
        return {
            "director_result": final_state["director_result"],
            "error": final_state["error"]
        }
