<script lang="ts">
  import { onMount } from 'svelte';
  import type { Zone } from '$lib/models/entities';
  import { getCurrentTurn } from '$lib/services/turnService';
  import { get } from 'svelte/store';
  import { agentStore } from '$lib/stores/agentStore';
  import { worldStore } from '$lib/stores/worldStore';

  let zones: Record<string, Zone> = {};
  let agents = get(agentStore);
  let worldState = get(worldStore);

  onMount(() => {
    const unsubscribeAgents = agentStore.subscribe(value => {
      agents = value;
    });
    const unsubscribeWorld = worldStore.subscribe(value => {
      worldState = value;
    });

    return () => {
      unsubscribeAgents();
      unsubscribeWorld();
    };
  });

  $: zones = Object.fromEntries(
    Object.entries(worldState.zones || {})
      .filter(([key, value]) => key && value && typeof value === 'object')
  );

  // ARIA labels for screen readers
  $: mapAriaLabel = `Interactive map showing current agent positions and zone connections. Current turn: ${getCurrentTurn()}.`;
</script>

<div class="map-container" role="figure" aria-label={mapAriaLabel} tabindex="0" aria-describedby="map-description">
  <div id="map-description" class="sr-only">
    Current game state: {agents.marines.filter(m => m.health > 0).length} surviving marines. 
    {Object.keys(zones).length} zones accessible.
    {Object.entries(zones).map(([name]) => `${name}, `)}
  </div>

  <svg class="game-map" width="800" height="600" aria-hidden="true">
    {#each Object.entries(zones) as [zoneName, zone] (zoneName)}
      {#if zoneName && zone}
        <g class="zone" data-zone={zoneName}>
        <rect 
          x={zone.x || 0} 
          y={zone.y || 0} 
          width="80" 
          height="60" 
          fill={zone.dangerous ? '#ff6b6b' : '#4ecdc4'}
          stroke="#2c3e50" 
          stroke-width="2"
          role="img" 
          aria-label={`${zoneName} zone, ${zone.items ? Object.keys(zone.items).length : 0} items`}
        />
        <text x={zone.x || 0} y={(zone.y || 0) + 20} class="zone-label">
          {zoneName}
        </text>
        
        {#if zone.connections}
          {#each zone.connections as connection}
            <line 
              x1={zone.x || 0} 
              y1={zone.y || 0} 
              x2={zones[connection]?.x || 0} 
              y2={zones[connection]?.y || 0} 
              stroke="#95a5a6" 
              stroke-width="1"
              stroke-dasharray="5,5"
              aria-hidden="true"
            />
          {/each}
        {/if}
        </g>
      {/if}
    {/each}
  </svg>

  <!-- Agent positions overlay -->
  {#each agents.marines as marine (marine.id)}
    <div 
      class="agent-marker" 
      style="left: {zones[marine.position]?.x || 0}px; top: {zones[marine.position]?.y || 0}px;"
      role="status" 
      aria-label={`${marine.id} at ${marine.position}, health: ${marine.health}/10, stress: ${marine.stress}/10`}
    >
      <div class="agent-icon" aria-label={`${marine.id} marker`}>
        {marine.id.charAt(0)}
      </div>
      <div class="agent-status sr-only">
        {marine.id}: {marine.position} (H: {marine.health}, S: {marine.stress})
      </div>
    </div>
  {/each}

  <!-- Alien position (if visible) -->
  {#if !agents.alien.hidden}
    <div 
      class="alien-marker" 
      style="left: {zones[agents.alien.position]?.x || 0}px; top: {zones[agents.alien.position]?.y || 0}px;"
      role="status" 
      aria-label="Alien threat visible at {agents.alien.position}"
    >
      <div class="alien-icon" aria-label="Alien position indicator">A</div>
    </div>
  {/if}
</div>

<style>
  .map-container {
    position: relative;
    width: 800px;
    height: 600px;
    border: 2px solid #2c3e50;
    background: #ecf0f1;
  }

  .game-map {
    position: absolute;
    top: 0;
    left: 0;
  }

  .zone {
    cursor: pointer;
  }

  .zone:hover rect {
    stroke-width: 3;
    stroke: #e74c3c;
  }

  .zone-label {
    font-size: 12px;
    font-weight: bold;
    fill: #2c3e50;
    pointer-events: none;
  }

  .agent-marker {
    position: absolute;
    width: 30px;
    height: 30px;
    background: #3498db;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 10px;
    border: 2px solid #2980b9;
    z-index: 10;
  }

  .agent-marker:hover {
    transform: scale(1.2);
    z-index: 20;
  }

  .alien-marker {
    position: absolute;
    width: 30px;
    height: 30px;
    background: #e74c3c;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 10px;
    border: 2px solid #c0392b;
    z-index: 10;
    animation: pulse 1s infinite;
  }

  .agent-status {
    position: absolute;
    bottom: -25px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 8px;
    color: #7f8c8d;
    white-space: nowrap;
  }

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  .sr-only {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
</style>