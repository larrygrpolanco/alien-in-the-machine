from .schemas import (
    GameState, Character, Zone, CharacterAttributes, CharacterSkills, 
    CharacterStatus, ZoneExit, ZoneObject
)

def create_initial_game_state() -> GameState:
    """
    Creates the initial 'Medbay Escape' scenario state
    This is our Phase 0 prototype scenario where Miller needs to escape from Medbay B
    """
    
    # Create Miller's character
    miller_attributes = CharacterAttributes(
        might=2,
        agility=2, 
        wits=2,
        empathy=1
    )
    
    miller_skills = CharacterSkills(
        comtech=1,
        heavy_machinery=0,
        stamina=1,
        close_combat=1,
        ranged_combat=2,
        piloting=0,
        command=1,
        manipulation=0,
        medical_aid=0,
        mobility=1,
        observation=1,
        survival=1
    )
    
    miller_status = CharacterStatus(
        health="healthy",
        stress=1,
        conditions=[]
    )
    
    miller = Character(
        name="Vanessa Miller",
        attributes=miller_attributes,
        skills=miller_skills,
        inventory=["multitool", "pistol", "flashlight"],
        agenda="Get the job done and get paid. Survival comes first, but the mission pays the bills.",
        status=miller_status,
        current_zone="medbay_b"
    )
    
    # Create Medbay B zone
    north_door = ZoneExit(
        to="corridor_3",
        status="locked",
        description="A heavy security door with a smashed access panel",
        requirements=["repair_panel", "unlock_mechanism"]
    )
    
    door_panel = ZoneObject(
        name="door_control_panel_north",
        description="The access control panel for the north door. Sparks occasionally from damaged circuits.",
        status="smashed",
        properties={
            "repairable": True,
            "required_skill": "comtech", 
            "difficulty": "moderate"
        },
        can_interact=True
    )
    
    medical_scanner = ZoneObject(
        name="medical_scanner",
        description="A wall-mounted diagnostic scanner, still operational",
        status="functional",
        properties={
            "power": "on",
            "last_scan": "unknown_patient"
        },
        can_interact=True
    )
    
    supply_cabinet = ZoneObject(
        name="supply_cabinet",
        description="A locked medical supply cabinet",
        status="locked",
        properties={
            "contents": ["medical_supplies", "emergency_stims"],
            "lock_type": "keycard"
        },
        can_interact=True
    )
    
    medbay_b = Zone(
        id="medbay_b",
        name="Medical Bay B",
        description="A sterile white medical facility. Emergency lighting casts everything in an amber glow. The air carries a sharp antiseptic smell mixed with ozone from damaged electronics. Sparks occasionally fly from the damaged door panel.",
        exits={
            "north_door": north_door
        },
        objects={
            "door_control_panel_north": door_panel,
            "medical_scanner": medical_scanner,
            "supply_cabinet": supply_cabinet
        },
        atmosphere="Tense and urgent. The flickering lights and damaged electronics suggest something has gone very wrong."
    )
    
    # Create the complete game state
    initial_state = GameState(
        characters={
            "miller": miller
        },
        zones={
            "medbay_b": medbay_b
        },
        current_turn=1,
        active_character_id="miller",
        turn_order=["miller"],
        commander_commands=[],
        game_log=[],
        mission_status={
            "objective": "Escape from Medical Bay B",
            "status": "active",
            "time_pressure": "moderate"
        }
    )
    
    return initial_state

# Global game state instance (for prototype - will be replaced with proper state management later)
GAME_STATE = create_initial_game_state()
