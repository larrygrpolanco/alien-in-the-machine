<script lang="ts">
  import { onMount } from 'svelte';
  import LogEntry from './LogEntry.svelte';
  import { filteredGameLog, activeFilters, toggleFilter, resetFilters, currentTurn } from '$lib/store';
  import type { MessageType } from '$lib/types';

  let logContainer: HTMLDivElement;
  let autoScroll = true;

  // Filter buttons data: All types with labels/icons
  const filterOptions = [
    { type: MessageType.COMMANDER, label: 'Commands', icon: '📡' },
    { type: MessageType.AI_DIALOGUE, label: 'Dialogue', icon: '💬' },
    { type: MessageType.AI_ACTION, label: 'Actions', icon: '🎬' },
    { type: MessageType.AI_THOUGHTS, label: 'Thoughts', icon: '🧠' },
    { type: MessageType.SYSTEM, label: 'System', icon: '⚠️' }
  ];

  // Scroll to bottom after updates if enabled
  $: if (logContainer && autoScroll && $filteredGameLog.length > 0) {
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function handleToggle(type: MessageType) {
    toggleFilter(type);
  }
</script>

<div class="radio-log">
  <!-- Header with turn and controls -->
  <header class="header">
    <h1 class="title">
      🛸 MEDBAY ESCAPE - RADIO LOG
      <span class="turn">Turn {$currentTurn}</span>
    </h1>
    
    <!-- Filter controls -->
    <div class="controls">
      <div class="filters">
        {#each filterOptions as option}
          <button
            class:active={$activeFilters.has(option.type)}
            on:click={() => handleToggle(option.type)}
            title={`Toggle ${option.label}`}
          >
            {option.icon} {option.label}
          </button>
        {/each}
        <button class="reset" on:click={resetFilters} title="Reset filters">Reset</button>
      </div>
      
      <!-- Auto-scroll toggle -->
      <label class="autoscroll">
        <input type="checkbox" bind:checked={autoScroll} />
        Auto-scroll
      </label>
    </div>
  </header>

  <!-- Scrollable log container -->
  <div bind:this={logContainer} class="log-container">
    {#if $filteredGameLog.length === 0}
      <div class="no-entries">Awaiting first command...</div>
    {:else}
      {#each $filteredGameLog as entry (entry.turn + entry.type + entry.author)}
        <LogEntry {entry} />
      {/each}
    {/if}
  </div>
</div>

<style>
  .radio-log {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #1a1a1a;
    color: #00ff00;
    font-family: 'Courier New', monospace;
  }

  .header {
    padding: 1rem;
    border-bottom: 2px solid #333;
    background: #000;
  }

  .title {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    text-align: center;
  }

  .turn {
    font-size: 1rem;
    opacity: 0.8;
    margin-left: 1rem;
  }

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filters button {
    padding: 0.5rem 0.75rem;
    background: #333;
    color: #00ff00;
    border: 1px solid #555;
    border-radius: 0.25rem;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    opacity: 0.7;
  }

  .filters button.active {
    background: #00ff00;
    color: #000;
    opacity: 1;
    border-color: #00ff00;
  }

  .filters button:hover:not(.active) {
    opacity: 1;
    border-color: #00ff00;
  }

  .reset {
    background: #555;
    font-size: 0.8rem;
  }

  .reset:hover {
    background: #ff9900;
    color: #000;
  }

  .autoscroll {
    font-size: 0.85rem;
    opacity: 0.7;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .autoscroll input {
    accent-color: #00ff00;
  }

  .log-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    background: #000;
    border: 2px solid #00ff00;
    border-radius: 0.5rem;
    margin: 1rem;
    max-height: calc(100vh - 200px);
  }

  .no-entries {
    text-align: center;
    opacity: 0.5;
    padding: 2rem;
    font-style: italic;
  }

  /* Scrollbar styling for theme */
  .log-container::-webkit-scrollbar {
    width: 8px;
  }

  .log-container::-webkit-scrollbar-track {
    background: #1a1a1a;
  }

  .log-container::-webkit-scrollbar-thumb {
    background: #00ff00;
    border-radius: 4px;
  }

  .log-container::-webkit-scrollbar-thumb:hover {
    background: #00cc00;
  }

  /* Responsive: Full height on small screens */
  @media (max-width: 600px) {
    .radio-log {
      height: 100vh;
    }

    .header {
      padding: 0.75rem;
    }

    .title {
      font-size: 1.25rem;
    }

    .controls {
      flex-direction: column;
      align-items: stretch;
    }

    .filters {
      justify-content: center;
    }

    .log-container {
      margin: 0.5rem;
      max-height: calc(100vh - 150px);
    }
  }
</style>
