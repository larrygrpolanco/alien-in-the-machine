import type { Agent, Zone } from '../models/entities';

// Supported event types (from EventType enum and handlers)
const handledTypes: string[] = [
	'move',
	'search',
	'interact',
	'attack',
	'cover',
	'report',
	'message',
	'sneak',
	'ambush',
	'hazard',
	'nudge',
	'hunt',
	'lurk',
	'stalk',
	'hide',
	'escalate',
	'reveal',
	'isolate',
	'panic'
];

const isHandledEventType = (action: string): boolean => {
	return handledTypes.includes(action.toLowerCase().trim());
};

const mapToHandled = (action: string): string => {
	const lowerAction = action.toLowerCase().trim();
	// Simple mapping for common unsupported to supported
	const mappings: Record<string, string> = {
		search: 'sneak', // For alien/director
		investigate: 'search', // For marine
		communicate: 'message',
		default: 'report'
	};
	return mappings[lowerAction] || mappings['default'];
};
import type { Event } from '../models/eventSchema';
import type { LLMResponse } from './llmClient';
import type { ValidatedAction } from './actionValidator';
import { MARINE_ACTIONS, ALIEN_ACTIONS, DIRECTOR_ACTIONS } from './actionValidator';
import { assemblePrompt } from './promptService';
import { validateAction } from './actionValidator';
import { callLLM } from './llmClient';

// Mock LLM integration for UI testing
const isMockMode = process.env.MOCK_LLM === 'true';
const MOCK_SEQUENCE_INDEX = { marine: 0, alien: 0, director: 0 }; // For predictable testing sequences

export const generateAgentAction = async (
	agent: Agent,
	memory: Event[],
	commanderMsg: string,
	zoneState: Zone
): Promise<ValidatedAction> => {
	// Assemble context-specific prompt
	const promptContext = { agent, memory, commanderMsg, zoneState };
	const prompt = assemblePrompt(promptContext);

	// Call LLM (automatically uses mock mode if MOCK_LLM=true)
	let llmResponse: LLMResponse = await callLLM(prompt);

	// Determine agent type for validation and mock enhancement
	let agentType: 'marine' | 'alien' | 'director';
	let personality: string | undefined;
	let stress: number | undefined;
	let agentName = '';

	if ('id' in agent && 'personality' in agent) {
		// Marine
		const marine = agent as any; // Use any to access union properties
		agentType = 'marine';
		personality = marine.personality;
		stress = marine.stress;
		agentName = marine.id;
	} else if ('position' in agent && 'hidden' in agent) {
		// Alien
		agentType = 'alien';
		agentName = 'Alien';
	} else if ('adjustments' in agent) {
		// Director
		agentType = 'director';
		agentName = 'Director';
	} else {
		throw new Error('Unknown agent type');
	}

	// Enhanced mock adjustment for UI testing: Use MOCK_LLM flag and predictable sequences
	if (isMockMode && agentType !== 'marine') {
		// For UI testing, use predictable sequences instead of random weighted actions
		const sequenceActions = {
			alien: ['sneak', 'hide', 'lurk', 'hunt'], // Cycle through stealth to aggressive
			director: ['message', 'report', 'nudge', 'escalate'] // Narrative to tension building
		};
		
		const actionsForType = sequenceActions[agentType as keyof typeof sequenceActions] || ['report'];
		const currentIndex = MOCK_SEQUENCE_INDEX[agentType];
		const selectedAction = actionsForType[currentIndex % actionsForType.length];
		
		// Update sequence index for next call (predictable testing)
		MOCK_SEQUENCE_INDEX[agentType] = (currentIndex + 1) % actionsForType.length;
		
		// Override LLM response with predictable mock for UI component testing
		llmResponse = {
			action: selectedAction,
			target: agentType === 'alien' ? 'corridor' : undefined,
			reasoning: `UI Test Sequence: ${agentType} performing ${selectedAction} (sequence position ${currentIndex + 1})`
		} as LLMResponse;
		
		console.log(`[UI MOCK SEQUENCE] ${agentName}: ${selectedAction} (test sequence ${currentIndex + 1}/${actionsForType.length})`);
		
		// Skip validation override logic since we're providing valid actions
	} else if (isMockMode && agentType === 'marine') {
		// For marines in mock mode, use simple rotation for UI testing
		const marineSequence = ['move', 'search', 'report', 'cover'];
		const marineIndex = MOCK_SEQUENCE_INDEX.marine;
		const marineAction = marineSequence[marineIndex % marineSequence.length];
		MOCK_SEQUENCE_INDEX.marine = (marineIndex + 1) % marineSequence.length;
		
		llmResponse = {
			action: marineAction,
			target: marineAction === 'move' ? 'storage' : undefined,
			reasoning: `UI Test: Marine ${marineAction} (sequence ${marineIndex + 1}/4)`
		} as LLMResponse;
		
		console.log(`[UI MOCK MARINE] ${agentName}: ${marineAction} (test sequence ${marineIndex + 1}/4)`);
	}

	// Validate and parse the response
	const validatedAction = validateAction(llmResponse, agentType, personality, stress, agentName, 0);

	// Enhanced fallback: After validation (including internal retries), ensure valid action
	if (!validatedAction.isValid) {
		let allowedActions: Set<string>;
		if (agentType === 'marine') {
			allowedActions = MARINE_ACTIONS;
		} else if (agentType === 'alien') {
			allowedActions = ALIEN_ACTIONS;
		} else if (agentType === 'director') {
			allowedActions = DIRECTOR_ACTIONS;
		} else {
			throw new Error(`Unknown agent type for fallback: ${agentType}`);
		}

		const validActionsArray = Array.from(allowedActions);
		const randomIndex = Math.floor(Math.random() * validActionsArray.length);
		const randomAction = validActionsArray[randomIndex];

		validatedAction.action = randomAction;
		validatedAction.target = undefined;
		validatedAction.reasoning = `Enhanced fallback after retries: Selected random valid ${randomAction} for ${agentName}`;
		validatedAction.isValid = true; // Now valid
		validatedAction.fallbackUsed = true;

		console.log(
			`[ENHANCED FALLBACK] ${agentName}: Selected random action '${randomAction}' after validation failure`
		);
	}

	// Validation should always succeed now due to mock adjustment and fallback enhancements
	// No additional checks needed

	console.log(
		`[${agentName}] Generated action: ${validatedAction.action}${validatedAction.target ? ` (target: ${validatedAction.target})` : ''} - Reasoning: ${validatedAction.reasoning}`
	);

	return validatedAction;
};

// Stub for test expectations
export const fallbackAgentAction = (
	agentType: 'marine' | 'alien' | 'director',
	personality?: string,
	stress?: number
): ValidatedAction => {
	// Use the validator's fallback logic
	return validateAction(
	  { action: 'report', reasoning: 'Fallback action' },
	  agentType,
	  personality,
	  stress,
	  'fallback',
	  0
	) as ValidatedAction;
};

// Stub for memory pruning test
export const pruneAgentMemory = (memory: Event[], maxEvents: number = 50): Event[] => {
	return memory.slice(-maxEvents);
};

// Stub for stress test
export const updateAgentStress = (agent: any, delta: number): void => {
	if ('stress' in agent) {
		agent.stress = Math.max(0, Math.min(10, (agent.stress || 0) + delta));
	}
};

// Stub for mission start
export const initializeAgents = (): any => {
	// Return initial agents from entities
	return {
		marines: [
			{
				id: 'hudson',
				personality: 'aggressive',
				compliance: 0.7,
				position: 'Shuttle',
				health: 10,
				stress: 0,
				inventory: []
			},
			{
				id: 'vasquez',
				personality: 'cautious',
				compliance: 0.9,
				position: 'Shuttle',
				health: 10,
				stress: 0,
				inventory: []
			}
		],
		alien: { position: 'Storage', hidden: true },
		director: { adjustments: [] }
	};
};

// Stub for action success calculation
export const calculateActionSuccess = (
	action: string,
	agentStress: number,
	compliance: number
): number => {
	return Math.random() * (1 - agentStress / 10) * compliance;
};

// Optional: Function to execute agent turn (could be used by turnService)
export const executeAgentTurn = async (
	agent: Agent,
	memory: Event[],
	commanderMsg: string,
	zoneState: Zone,
	applyEvent: (event: Event) => void // From eventService
): Promise<void> => {
	// Determine agent ID and name (shared logic)
	let agentId = '';
	let agentName = '';
	if ('id' in agent && 'personality' in agent) {
		const marine = agent as any;
		agentId = marine.id;
		agentName = marine.id;
	} else if ('position' in agent && 'hidden' in agent) {
		agentId = 'alien';
		agentName = 'Alien';
	} else if ('adjustments' in agent) {
		agentId = 'director';
		agentName = 'Director';
	}

	try {
		const action = await generateAgentAction(agent, memory, commanderMsg, zoneState);

		// Filter to ensure only supported event types are created
		let eventType = action.action;
		if (!isHandledEventType(eventType)) {
			eventType = mapToHandled(eventType);
			console.log(
				`[EVENT FILTER] Remapped unsupported action '${action.action}' to '${eventType}' for ${agentName}`
			);
		}

		// Create event from action
		const event: Event = {
			id: crypto.randomUUID(),
			tick: Date.now(),
			type: eventType as any, // Cast to match EventType
			actor: agentId,
			target: action.target || undefined,
			details: { reasoning: action.reasoning },
			result: undefined
		};

		// Apply the event to world state
		applyEvent(event);
	} catch (error) {
		console.error(`Error in agent turn for ${agentName}:`, error);
		// Fallback: defensive action
		const fallbackActor = agentId || 'unknown';
		const fallbackEvent: Event = {
			id: crypto.randomUUID(),
			tick: Date.now(),
			type: 'cover' as any,
			actor: fallbackActor,
			target: undefined,
			details: { reasoning: 'Fallback: Taking cover due to error' },
			result: undefined
		};
		applyEvent(fallbackEvent);
	}
};
