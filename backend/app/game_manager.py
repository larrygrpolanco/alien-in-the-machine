# GameManager: Central state management class.
# Loads/saves the "Living World" from JSON files using Pydantic models for validation.
# Manages game log for the radio feed and applies AI-driven updates to state.
# This is the single source of truth for game state, making it easy to persist and query.
# Seeded for complex plan: Can extend to load multiple zones/characters from data/ dir.

import json
from pathlib import Path
from typing import Dict, Any, List
from app.schemas import Character, Zone, LogEntry, MessageType

class GameManager:
    def __init__(self, data_dir: str = "app/data"):
        """
        Initialize GameManager.
        Loads initial character and zone state from JSON files.
        Sets up empty game log and turn counter.
        """
        self.data_dir = Path(data_dir)
        self.current_turn = 0
        self.game_log: List[LogEntry] = []
        
        # Load initial game state
        self.character = self._load_character()
        self.zone = self._load_zone()
    
    def _load_character(self) -> Character:
        """Load character data from JSON file using Pydantic for validation."""
        file_path = self.data_dir / "character_miller.json"
        if not file_path.exists():
            raise FileNotFoundError(f"Character file not found: {file_path}")
        with open(file_path, "r") as f:
            data = json.load(f)
        return Character(**data)
    
    def _load_zone(self) -> Zone:
        """Load current zone data from JSON file using Pydantic for validation."""
        file_path = self.data_dir / "zone_medbay_b.json"
        if not file_path.exists():
            raise FileNotFoundError(f"Zone file not found: {file_path}")
        with open(file_path, "r") as f:
            data = json.load(f)
        return Zone(**data)
    
    def add_log_entry(self, entry_type: MessageType, content: str, author: str):
        """Add an entry to the game log for the radio feed."""
        entry = LogEntry(
            turn=self.current_turn,
            type=entry_type,
            content=content,
            author=author
        )
        self.game_log.append(entry)
    
    def advance_turn(self):
        """Increment the turn counter after a full turn (Actor + Director)."""
        self.current_turn += 1
    
    def get_current_state(self) -> Dict[str, Any]:
        """Get the complete current game state as a dictionary for API responses."""
        return {
            "character": self.character.model_dump(),
            "zone": self.zone.model_dump(),
            "log": [entry.model_dump() for entry in self.game_log],
            "current_turn": self.current_turn
        }
    
    def apply_world_updates(self, updates: Dict[str, Any]):
        """
        Apply world state changes from Director AI.
        Updates character or zone in-memory and saves back to JSON.
        Seeded for complex: In future, handle nested updates like exits.north_door.status.
        """
        # Simple flat updates for now - extend for nested paths in complex plan
        if "zone" in updates:
            zone_updates = updates["zone"]
            for key, value in zone_updates.items():
                if hasattr(self.zone, key):
                    setattr(self.zone, key, value)
        
        if "character" in updates:
            char_updates = updates["character"]
            for key, value in char_updates.items():
                if hasattr(self.character, key):
                    setattr(self.character, key, value)
        
        # Save updated state back to files
        self._save_state()
    
    def _save_state(self):
        """Persist current state to JSON files with indentation for readability."""
        char_path = self.data_dir / "character_miller.json"
        with open(char_path, "w") as f:
            json.dump(self.character.model_dump(), f, indent=2)
        
        zone_path = self.data_dir / "zone_medbay_b.json"
        with open(zone_path, "w") as f:
            json.dump(self.zone.model_dump(), f, indent=2)
