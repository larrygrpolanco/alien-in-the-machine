"""
Pydantic data models for the game state.
These define the structure of our JSON data files and API responses.
Pydantic ensures type safety, validation, and easy serialization/deserialization.
This is crucial for preventing data corruption in the "Living World" JSON files
and for FastAPI to auto-generate API docs and validate inputs/outputs.
"""

from pydantic import BaseModel
from typing import List, Dict, Optional
from enum import Enum

# Character-related models
class CharacterAttributes(BaseModel):
    wits: int  # Core attribute for problem-solving, perception

class CharacterSkills(BaseModel):
    comtech: int  # Communications/tech skill, relevant for hacking panels, etc.

class CharacterStatus(BaseModel):
    health: str  # e.g., "healthy", "wounded", "critical"
    stress: int  # Accumulates from failures/complications; can affect decisions

class Character(BaseModel):
    name: str
    attributes: CharacterAttributes
    skills: CharacterSkills
    inventory: List[str]  # Items like "multitool", "pistol"
    agenda: str  # Driving motivation, influences Actor AI behavior
    status: CharacterStatus

# Zone-related models
class Exit(BaseModel):
    to: str  # Destination zone, e.g., "corridor_3"
    status: str  # e.g., "locked", "open", "jammed"
    panel: str  # e.g., "smashed", "intact" – interactable element
    extra_properties: Dict[str, str] = {}  # Seed for complex plan: Emergent details like "sparks: true"

class Zone(BaseModel):
    name: str  # Unique identifier, e.g., "Medbay B"
    description: str  # Atmospheric text for immersion
    exits: Dict[str, Exit]  # Directions like "north_door" mapping to Exit objects

# Log-related models for the "Radio Log" narrative feed
class MessageType(str, Enum):
    SYSTEM = "system"      # Server messages, errors
    COMMANDER = "commander"  # Player inputs
    AI_THOUGHTS = "ai_thoughts"  # Actor internal reasoning (debug/optional)
    AI_DIALOGUE = "ai_dialogue"  # Spoken words
    AI_ACTION = "ai_action"      # Director narration of events

class LogEntry(BaseModel):
    turn: int  # Current game turn number
    type: MessageType
    content: str  # The message text
    author: str  # e.g., "Commander", "Vanessa Miller", "System"

class GameLogState(BaseModel):
    log: List[LogEntry]
    current_turn: int
