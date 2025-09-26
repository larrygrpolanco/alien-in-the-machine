<script lang="ts">
  import { onMount } from 'svelte';
  import { eventStore } from '$lib/stores/eventStore';
  import { messageStore } from '$lib/stores/messageStore';
  import { agentStore } from '$lib/stores/agentStore';
  import { worldStore } from '$lib/stores/worldStore';
  import { advanceTurn } from '$lib/services/turnService';
  import Map from '$lib/components/Map.svelte';
  import MessageStream from '$lib/components/MessageStream.svelte';
  import AgentStatus from '$lib/components/AgentStatus.svelte';
  import type { Message } from '$lib/stores/messageStore';
  import type { Entities } from '$lib/models/entities';
  import type { AgentsState } from '$lib/stores/agentStore';
  
  let commanderInput = '';
  let messages: Message[] = [];
  let worldState: Entities;
  let agents: AgentsState;
  let events: any[] = [];
  let isProcessingTurn = false;
  
  // Subscribe to stores on mount
  onMount(() => {
    const unsubscribeMessages = messageStore.subscribe((value) => {
      messages = value;
    });
    
    const unsubscribeWorld = worldStore.subscribe((value) => {
      worldState = value;
    });
    
    const unsubscribeAgents = agentStore.subscribe((value) => {
      agents = value;
    });
    
    const unsubscribeEvents = eventStore.subscribe((value) => {
      events = value;
    });
    
    return () => {
      unsubscribeMessages();
      unsubscribeWorld();
      unsubscribeAgents();
      unsubscribeEvents();
    };
  });
  
  // Handle commander input
  const handleCommanderInput = (event: KeyboardEvent | MouseEvent) => {
    if (event instanceof KeyboardEvent && event.key !== 'Enter') return;
    if (commanderInput.trim()) {
      // Add commander message to stream
      messageStore.update(msgs => [...msgs, {
        sender: 'COMMANDER',
        content: commanderInput.trim(),
        timestamp: Date.now()
      }]);
      
      // Store for next turn
      const nextTurnMsg = commanderInput.trim();
      commanderInput = '';
      
      // Advance turn with commander message
      advanceTurnWithMessage(nextTurnMsg);
    }
  };
  
  // Advance turn with optional commander message
  const advanceTurnWithMessage = async (msg: string) => {
    if (isProcessingTurn) return;
    
    isProcessingTurn = true;
    try {
      await advanceTurn(msg);
    } catch (error) {
      console.error('Turn advancement failed:', error);
      messageStore.update(msgs => [...msgs, {
        sender: 'SYSTEM',
        content: `Turn failed: ${error}`,
        timestamp: Date.now()
      }]);
    } finally {
      isProcessingTurn = false;
    }
  };
  
  // Next Turn button handler
  const handleNextTurn = () => {
    advanceTurnWithMessage('');
  };
</script>

<svelte:head>
  <title>Alien in the Machine</title>
  <meta name="description" content="1980s-style tactical AI command interface" />
</svelte:head>

<div class="terminal-container">
  <!-- Header -->
  <header class="terminal-header">
    <h1>ALIEN IN THE MACHINE - MISSION CONTROL</h1>
    <div class="status-bar">
      <span>Turn: {events.length ? Math.max(...events.map(e => e.tick)) : 0}</span>
      <span>Status: {isProcessingTurn ? 'PROCESSING...' : 'READY'}</span>
      <span>Survivors: {agents ? agents.marines.filter(m => m.health > 0).length : 0}/2</span>
    </div>
  </header>
  
  <main class="terminal-main">
    <!-- Left Panel: Map -->
    <section class="panel map-panel">
      <h2>TACTICAL MAP</h2>
      {#if worldState}
        <Map {worldState} />
      {:else}
        <div class="loading">Initializing map...</div>
      {/if}
    </section>
    
    <!-- Center Panel: Message Stream -->
    <section class="panel message-panel">
      <h2>COMMUNICATIONS</h2>
      <MessageStream {messages} />
    </section>
    
    <!-- Right Panel: Agent Status -->
    <section class="panel agent-panel">
      <h2>AGENT STATUS</h2>
      <AgentStatus {agents} />
    </section>
  </main>
  
  <!-- Bottom Panel: Input -->
  <footer class="terminal-footer">
    <div class="input-section">
      <label for="commander-input">Commander Orders:</label>
      <input
        id="commander-input"
        type="text"
        bind:value={commanderInput}
        placeholder="Enter orders for marines..."
        on:keydown={handleCommanderInput}
        disabled={isProcessingTurn}
        class="commander-input"
      />
      <button 
        on:click={handleNextTurn} 
        disabled={isProcessingTurn}
        class="next-turn-btn"
      >
        NEXT TURN
      </button>
    </div>
    
    <div class="input-help">
      <small>
        Enter commander orders and press Enter, or click NEXT TURN to advance without orders.
        Orders will be broadcast to all active marines.
      </small>
    </div>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #000;
    color: #00ff00;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.4;
  }
  
  .terminal-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #000;
  }
  
  .terminal-header {
    background: #001100;
    padding: 10px 20px;
    border-bottom: 2px solid #00ff00;
    text-align: center;
  }
  
  .terminal-header h1 {
    margin: 0 0 8px 0;
    color: #00ff00;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-size: 18px;
  }
  
  .status-bar {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    opacity: 0.8;
  }
  
  .status-bar span {
    background: #003300;
    padding: 2px 6px;
    border: 1px solid #00ff00;
    border-radius: 2px;
  }
  
  .terminal-main {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    grid-template-rows: 1fr;
    gap: 2px;
    padding: 10px;
    background: #000;
    height: calc(100vh - 120px);
  }
  
  .panel {
    background: #001100;
    border: 1px solid #00ff00;
    padding: 10px;
    overflow-y: auto;
  }
  
  .panel h2 {
    margin: 0 0 10px 0;
    color: #00ff00;
    text-transform: uppercase;
    font-size: 12px;
    letter-spacing: 1px;
    border-bottom: 1px solid #003300;
    padding-bottom: 5px;
  }
  
  .map-panel {
    grid-column: 1;
  }
  
  .message-panel {
    grid-column: 2;
    display: flex;
    flex-direction: column;
  }
  
  .agent-panel {
    grid-column: 3;
  }
  
  .terminal-footer {
    background: #001100;
    padding: 15px 20px;
    border-top: 2px solid #00ff00;
  }
  
  .input-section {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .input-section label {
    color: #00ff00;
    font-size: 12px;
    min-width: 120px;
  }
  
  .commander-input {
    flex: 1;
    background: #000;
    border: 1px solid #00ff00;
    color: #00ff00;
    padding: 8px 12px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
  }
  
  .commander-input:focus {
    outline: none;
    border-color: #00cc00;
    box-shadow: 0 0 5px #00ff00;
  }
  
  .commander-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .next-turn-btn {
    background: #003300;
    border: 1px solid #00ff00;
    color: #00ff00;
    padding: 8px 16px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    text-transform: uppercase;
    cursor: pointer;
    min-width: 100px;
  }
  
  .next-turn-btn:hover:not(:disabled) {
    background: #004400;
    border-color: #00cc00;
  }
  
  .next-turn-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .input-help {
    text-align: center;
    color: #00cc00;
    font-size: 11px;
    opacity: 0.7;
  }
  
  .loading {
    color: #00cc00;
    text-align: center;
    padding: 20px;
    font-style: italic;
  }
  
  /* Scrollbar styling for terminal feel */
  .panel::-webkit-scrollbar {
    width: 8px;
  }
  
  .panel::-webkit-scrollbar-track {
    background: #000;
  }
  
  .panel::-webkit-scrollbar-thumb {
    background: #003300;
    border: 1px solid #00ff00;
  }
  
  .panel::-webkit-scrollbar-thumb:hover {
    background: #004400;
  }
</style>
