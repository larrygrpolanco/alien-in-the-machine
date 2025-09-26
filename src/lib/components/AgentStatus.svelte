<script lang="ts">
  import { get } from 'svelte/store';
  import { agentStore } from '../stores/agentStore';
  import type { AgentsState, Marine } from '../stores/agentStore';
  
  let agents: AgentsState;
  
  // Subscribe to agent store
  $: agents = get(agentStore);
  
  // Get stress color class
  function getStressColor(stress: number): string {
    if (stress > 7) return 'stress-high';
    if (stress > 4) return 'stress-medium';
    return 'stress-low';
  }
  
  // Get health color
  function getHealthColor(health: number): string {
    if (health === 0) return 'health-dead';
    if (health <= 3) return 'health-critical';
    if (health <= 7) return 'health-injured';
    return 'health-good';
  }
</script>

<div class="agent-status-container">
  <table class="agent-table">
    <thead>
      <tr>
        <th>AGENT</th>
        <th>HEALTH</th>
        <th>STRESS</th>
        <th>TYPE</th>
        <th>LOCATION</th>
        <th>INVENTORY</th>
      </tr>
    </thead>
    
    <tbody>
      {#each agents?.marines || [] as marine (marine.id)}
        <tr class="agent-row {getHealthColor(marine.health)}">
          <td class="agent-name">
            <span class="status-indicator {marine.health > 0 ? 'alive' : 'dead'}"></span>
            {marine.id.toUpperCase()}
          </td>
          <td class="health-cell">
            <div class="health-bar">
              <div class="health-fill" style="width: {(marine.health / 10) * 100}%"></div>
            </div>
            <span class="health-text">{marine.health}/10</span>
          </td>
          <td class="stress-cell {getStressColor(marine.stress)}">
            <div class="stress-bar">
              <div class="stress-fill" style="width: {(marine.stress / 10) * 100}%"></div>
            </div>
            <span class="stress-text">{marine.stress}/10</span>
          </td>
          <td class="personality-cell">
            <span class="{marine.personality.toLowerCase()}">
              {marine.personality[0]}{marine.personality.slice(1)}
            </span>
          </td>
          <td class="location-cell">
            <span class="zone-indicator">
              {marine.position.substring(0, 3).toUpperCase()}
            </span>
          </td>
          <td class="inventory-cell">
            {#if marine.inventory.length > 0}
              <span class="inventory-item">
                {marine.inventory.join(', ')}
              </span>
            {:else}
              <span class="empty-inventory">EMPTY</span>
            {/if}
          </td>
        </tr>
      {/each}
      
      <!-- Alien Status -->
      {#if agents?.alien}
        <tr class="agent-row alien-row">
          <td class="agent-name">
            <span class="status-indicator alien {agents.alien.hidden ? 'hidden' : 'visible'}"></span>
            ALIEN
          </td>
          <td class="health-cell">
            <span>-</span>
          </td>
          <td class="stress-cell">
            <span>-</span>
          </td>
          <td class="personality-cell">
            <span class="predator">PREDATOR</span>
          </td>
          <td class="location-cell">
            <span class="zone-indicator">
              {agents.alien.hidden ? '?' : agents.alien.position.substring(0, 3).toUpperCase()}
            </span>
          </td>
          <td class="inventory-cell">
            <span>-</span>
          </td>
        </tr>
      {/if}
      
      <!-- Director Status -->
      {#if agents?.director}
        <tr class="agent-row director-row">
          <td class="agent-name">
            <span class="status-indicator director"></span>
            DIRECTOR
          </td>
          <td class="health-cell">
            <span>-</span>
          </td>
          <td class="stress-cell">
            <span>-</span>
          </td>
          <td class="personality-cell">
            <span class="narrator">NARRATOR</span>
          </td>
          <td class="location-cell">
            <span class="zone-indicator">CMD</span>
          </td>
          <td class="inventory-cell">
            <span class="adjustments">
              {agents.director.adjustments.length} ADJ
            </span>
          </td>
        </tr>
      {/if}
    </tbody>
  </table>
  
  <!-- Summary Stats -->
  {#if agents?.marines && agents.marines.length > 0}
    <div class="status-summary">
      <div class="stat-item">
        <span class="label">SURVIVORS:</span>
        <span class="value">{agents.marines.filter(m => m.health > 0).length}/2</span>
      </div>
      <div class="stat-item">
        <span class="label">AVG STRESS:</span>
        <span class="value">
          {Math.round(agents.marines.reduce((sum, m) => sum + m.stress, 0) / agents.marines.length)}/10
        </span>
      </div>
      <div class="stat-item">
        <span class="label">ACTIVE ZONES:</span>
        <span class="value">{new Set(agents.marines.map(m => m.position)).size}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .agent-status-container {
    height: 100%;
    background: #000;
    color: #00ff41;
    font-family: 'Courier New', monospace;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  
  .agent-table {
    width: 100%;
    border-collapse: collapse;
    background: #000;
    border: 1px solid #00ff41;
    font-size: 11px;
    table-layout: fixed;
    flex: 1;
  }
  
  .agent-table th {
    background: #001100;
    color: #00ff41;
    padding: 6px 4px;
    text-align: left;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #00ff41;
    font-size: 9px;
  }
  
  .agent-table td {
    padding: 4px 6px;
    border-bottom: 1px solid #003300;
    vertical-align: middle;
  }
  
  .agent-row {
    transition: all 0.3s ease;
  }
  
  .agent-row:hover {
    background: #001a00;
  }
  
  .agent-name {
    font-weight: bold;
    position: relative;
  }
  
  .status-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    border: 1px solid #00ff41;
  }
  
  .status-indicator.alive {
    background: #00ff41;
    animation: pulse 2s infinite;
  }
  
  .status-indicator.dead {
    background: #666666;
  }
  
  .status-indicator.alien {
    background: #ff0000;
    animation: alienPulse 3s infinite;
  }
  
  .status-indicator.alien.hidden {
    background: #ffff00;
    opacity: 0.6;
  }
  
  .status-indicator.director {
    background: #ffaa00;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  @keyframes alienPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }
  
  .health-cell, .stress-cell {
    position: relative;
  }
  
  .health-bar, .stress-bar {
    position: relative;
    height: 4px;
    background: #003300;
    border: 1px solid #00ff41;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 2px;
  }
  
  .health-fill, .stress-fill {
    height: 100%;
    transition: width 0.5s ease;
    background: linear-gradient(to right, #00ff41, #00cc33);
  }
  
  .health-text, .stress-text {
    font-size: 9px;
    color: #00cc33;
    margin-left: 2px;
  }
  
  .personality-cell {
    text-align: center;
  }
  
  .personality-cell span {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .personality-cell .aggressive {
    background: #ff4444;
    color: #ffffff;
  }
  
  .personality-cell .cautious {
    background: #4488ff;
    color: #ffffff;
  }
  
  .personality-cell .predator {
    background: #ff0000;
    color: #ffff00;
    animation: predatorGlow 2s infinite alternate;
  }
  
  .personality-cell .narrator {
    background: #ffaa00;
    color: #000000;
  }
  
  @keyframes predatorGlow {
    from { box-shadow: 0 0 2px #ff0000; }
    to { box-shadow: 0 0 8px #ff0000; }
  }
  
  .location-cell {
    text-align: center;
  }
  
  .zone-indicator {
    background: #003300;
    color: #00ff41;
    padding: 1px 4px;
    border: 1px solid #00ff41;
    border-radius: 2px;
    font-size: 9px;
    font-weight: bold;
  }
  
  .inventory-cell {
    text-align: center;
    font-size: 9px;
  }
  
  .inventory-item {
    background: #002200;
    color: #ffff00;
    padding: 1px 3px;
    border-radius: 2px;
    font-size: 8px;
  }
  
  .empty-inventory {
    color: #666666;
    font-style: italic;
  }
  
  .status-summary {
    margin-top: 10px;
    padding: 8px;
    background: #001100;
    border-top: 1px solid #00ff41;
    display: flex;
    justify-content: space-around;
    font-size: 10px;
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .stat-item .label {
    color: #00cc33;
    font-size: 8px;
    margin-bottom: 2px;
    text-transform: uppercase;
  }
  
  .stat-item .value {
    color: #00ff41;
    font-weight: bold;
    font-size: 12px;
  }
  
  /* Stress level colors */
  .stress-low .stress-fill {
    background: linear-gradient(to right, #00ff41, #00cc33) !important;
  }
  
  .stress-medium .stress-fill {
    background: linear-gradient(to right, #ffaa00, #ff8800) !important;
  }
  
  .stress-high .stress-fill {
    background: linear-gradient(to right, #ff4400, #ff0000) !important;
  }
  
  .health-good .health-fill {
    background: linear-gradient(to right, #00ff41, #00cc33) !important;
  }
  
  .health-critical .health-fill {
    background: linear-gradient(to right, #ff4400, #ff0000) !important;
  }
  
  .health-injured .health-fill {
    background: linear-gradient(to right, #ffaa00, #ff8800) !important;
  }
  
  .health-dead .health-fill {
    background: #666666 !important;
  }
  
  /* Dead agent styling */
  .health-dead td {
    opacity: 0.5;
  }
  
  .health-dead .agent-name {
    text-decoration: line-through;
  }
  
  /* Responsive table */
  @media (max-width: 600px) {
    .agent-table {
      font-size: 9px;
    }
    
    .agent-table th, .agent-table td {
      padding: 2px 3px;
    }
    
    .status-indicator {
      width: 6px;
      height: 6px;
      margin-right: 4px;
    }
    
    .health-bar, .stress-bar {
      height: 3px;
    }
    
    .health-text, .stress-text {
      font-size: 8px;
    }
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    .agent-table {
      border-color: #ffffff;
    }
    
    .agent-table th {
      background: #003300;
      color: #ffffff;
    }
    
    .agent-row:hover {
      background: #004400;
    }
    
    .status-indicator {
      border-color: #ffffff !important;
    }
  }
</style>