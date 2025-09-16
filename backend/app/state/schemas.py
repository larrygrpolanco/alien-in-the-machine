from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from enum import Enum

class ActionSpeed(str, Enum):
    """Action speed categories for turn-based gameplay"""
    SLOW = "slow"
    FAST = "fast"

class ActionIntent(BaseModel):
    """Represents an AI Actor's intended action"""
    verb: str = Field(..., description="The action verb (REPAIR, MOVE, USE, etc.)")
    target: str = Field(..., description="What the action is targeting")
    using: Optional[str] = Field(None, description="Tool or item being used")
    speed: ActionSpeed = Field(..., description="Action speed (slow/fast)")
    rationale: str = Field(..., description="Why the character chose this action")

class CharacterAttributes(BaseModel):
    """Character core attributes"""
    might: int = Field(default=0, ge=0, le=5)
    agility: int = Field(default=0, ge=0, le=5)
    wits: int = Field(default=0, ge=0, le=5)
    empathy: int = Field(default=0, ge=0, le=5)

class CharacterSkills(BaseModel):
    """Character specialized skills"""
    comtech: int = Field(default=0, ge=0, le=5)
    heavy_machinery: int = Field(default=0, ge=0, le=5)
    stamina: int = Field(default=0, ge=0, le=5)
    close_combat: int = Field(default=0, ge=0, le=5)
    ranged_combat: int = Field(default=0, ge=0, le=5)
    piloting: int = Field(default=0, ge=0, le=5)
    command: int = Field(default=0, ge=0, le=5)
    manipulation: int = Field(default=0, ge=0, le=5)
    medical_aid: int = Field(default=0, ge=0, le=5)
    mobility: int = Field(default=0, ge=0, le=5)
    observation: int = Field(default=0, ge=0, le=5)
    survival: int = Field(default=0, ge=0, le=5)

class CharacterStatus(BaseModel):
    """Character current condition"""
    health: str = Field(default="healthy")
    stress: int = Field(default=0, ge=0)
    conditions: List[str] = Field(default_factory=list)

class Character(BaseModel):
    """Complete character definition"""
    name: str
    attributes: CharacterAttributes
    skills: CharacterSkills
    inventory: List[str] = Field(default_factory=list)
    agenda: str = Field(..., description="Character's driving motivation")
    status: CharacterStatus = Field(default_factory=CharacterStatus)
    current_zone: str = Field(..., description="ID of zone character is in")

class ZoneExit(BaseModel):
    """An exit from a zone to another location"""
    to: str = Field(..., description="Zone ID this exit leads to")
    status: str = Field(default="open", description="locked, open, blocked, etc.")
    description: Optional[str] = Field(None, description="How the exit appears")
    requirements: List[str] = Field(default_factory=list, description="What's needed to use this exit")

class ZoneObject(BaseModel):
    """An interactive object within a zone"""
    name: str
    description: str
    status: str = Field(default="normal")
    properties: Dict[str, Any] = Field(default_factory=dict)
    can_interact: bool = Field(default=True)

class Zone(BaseModel):
    """A location in the game world"""
    id: str = Field(..., description="Unique zone identifier")
    name: str
    description: str
    exits: Dict[str, ZoneExit] = Field(default_factory=dict)
    objects: Dict[str, ZoneObject] = Field(default_factory=dict)
    atmosphere: Optional[str] = Field(None, description="Mood/ambiance description")

class TurnResult(BaseModel):
    """Result of processing one game turn"""
    helmet_cam_feed: str = Field(..., description="Narrative description for Commander")
    character_speech: str = Field(..., description="What the character said")
    state_changes: Dict[str, Any] = Field(default_factory=dict, description="Changes made to game state")
    turn_number: int
    active_character: str

class CommanderCommand(BaseModel):
    """Command input from the player (Commander)"""
    text: str = Field(..., description="The command text")
    target_character: Optional[str] = Field(None, description="Specific character to command")
    timestamp: Optional[str] = Field(None)

class GameState(BaseModel):
    """Master game state container"""
    characters: Dict[str, Character] = Field(default_factory=dict)
    zones: Dict[str, Zone] = Field(default_factory=dict)
    current_turn: int = Field(default=1)
    active_character_id: str = Field(..., description="ID of character whose turn it is")
    turn_order: List[str] = Field(default_factory=list, description="Character IDs in turn order")
    commander_commands: List[CommanderCommand] = Field(default_factory=list)
    game_log: List[TurnResult] = Field(default_factory=list)
    mission_status: Dict[str, Any] = Field(default_factory=dict)

class ActorResponse(BaseModel):
    """Response from an AI Actor"""
    thoughts: str = Field(..., description="Character's internal thoughts (for Commander)")
    speech: str = Field(..., description="What the character says aloud")
    action_intent: ActionIntent = Field(..., description="What the character wants to do")

class DirectorResult(BaseModel):
    """Result from the Director processing an action"""
    skill_check_needed: bool = Field(default=False)
    skill_used: Optional[str] = Field(None)
    difficulty: Optional[str] = Field(None)
    success: Optional[bool] = Field(None)
    narration: str = Field(..., description="Descriptive outcome")
    state_updates: Dict[str, Any] = Field(default_factory=dict)
