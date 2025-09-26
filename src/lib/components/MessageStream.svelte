<script lang="ts">
  import type { Message } from '../stores/messageStore';
  import type { Connection } from '$lib/models/entities';
  import { layoutStore } from '../stores/layoutStore';
  
  export let messages: Message[] = [];
  export let connections: Connection[] = []; // From map connections
  
  let container: HTMLDivElement;
  let messageList: HTMLUListElement;
  let layoutState = $layoutStore;
  
  // Auto-scroll to bottom when new messages arrive
  $: if (messageList) {
    messageList.scrollTop = messageList.scrollHeight;
  }
  
  // Update connection status based on layout and messages
  $: activeConnections = connections.filter(c => c.active && c.target === 'messageStream');
  $: hasActiveMapConnection = activeConnections.length > 0;
  $: glowEffect = activeConnections.some(c => c.glow);
  
  // Connection style from contract
  $: connectionStyle = activeConnections[0]?.style || {
    lineColor: '#00f5ff',
    thickness: 2,
    animation: 'pulse'
  };
</script>

<div
  class="message-stream-container {layoutState.breakpoint}"
  class:connected={hasActiveMapConnection}
  class:glowing={glowEffect}
  bind:this={container}
  role="log"
  aria-live="polite"
  aria-label="Message stream{hasActiveMapConnection ? ' connected to map' : ''}. {messages.length} messages."
  data-connection-target="messageStream"
  style="--connection-color: {connectionStyle.lineColor}; --connection-thickness: {connectionStyle.thickness}px; --connection-animation: {connectionStyle.animation};"
>
  <!-- Connection indicator line to map -->
  {#if hasActiveMapConnection}
    <div
      class="connection-indicator to-map"
      role="status"
      aria-label={`Active connection to map, {glowEffect ? 'glowing' : 'static'}`}
      data-connection="map-message"
    >
      <div class="connection-line" aria-hidden="true"></div>
      <div class="connection-status sr-only" aria-live="polite">
        Map connection {glowEffect ? 'active and glowing' : 'active'}
      </div>
    </div>
  {/if}
  
  <ul class="message-list" bind:this={messageList} role="log" aria-live="polite">
    {#each messages as message, index (message.timestamp + '-' + index)}
      <li class="message-item" role="log" aria-label="{message.sender} message at {new Date(message.timestamp).toLocaleTimeString()}">
        <span class="timestamp">
          [{new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}]
        </span>
        <span class="sender">{message.sender}:</span>
        <span class="content">{message.content}</span>
      </li>
    {/each}
    
    {#if messages.length === 0}
      <li class="message-item no-messages" role="status" aria-label="No messages - awaiting mission start">
        <span class="timestamp">[--:--:--]</span>
        <span class="sender">SYSTEM:</span>
        <span class="content">Awaiting mission start...</span>
      </li>
    {/if}
  </ul>
  
  <!-- Connection status indicator -->
  {#if hasActiveMapConnection}
    <div class="connection-status-bar" role="status" aria-live="polite">
      <span class="connection-icon" aria-hidden="true">↔</span>
      <span class="connection-text">
        Map {glowEffect ? 'streaming' : 'connected'}
        <span class="connection-glow" style="--glow: {glowEffect ? 'visible' : 'hidden'};"></span>
      </span>
    </div>
  {/if}
</div>

<style>
  .message-stream-container {
    height: 100%;
    background: #000;
    border: 1px solid #00ff41;
    border-radius: 3px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .message-list {
    flex: 1;
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    background: #000;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.3;
    scroll-behavior: smooth;
  }
  
  .message-item {
    display: flex;
    flex-direction: column;
    padding: 4px 8px;
    border-bottom: 1px solid #003300;
    background: #001100;
    margin: 0;
    color: #00ff41;
    word-wrap: break-word;
    hyphens: auto;
  }
  
  .message-item + .message-item {
    border-top: 1px solid #003300;
  }
  
  .message-item.no-messages {
    justify-content: center;
    align-items: center;
    text-align: center;
    opacity: 0.6;
    font-style: italic;
  }
  
  .timestamp {
    color: #00cc33;
    font-size: 10px;
    opacity: 0.8;
    margin-right: 8px;
    min-width: 60px;
    display: inline-block;
  }
  
  .sender {
    color: #00ff41;
    font-weight: bold;
    margin-right: 8px;
    text-transform: uppercase;
    font-size: 11px;
  }
  
  .content {
    color: #00ff41;
    font-size: 12px;
    flex: 1;
  }
  
  /* Sender-specific colors */
  .sender.COMMANDER {
    color: #ffffff;
    text-shadow: 0 0 2px #00ff41;
  }
  
  .sender.SYSTEM {
    color: #ffaa00;
    font-weight: bold;
  }
  
  .sender.hudson {
    color: #ff6666;
  }
  
  .sender.vasquez {
    color: #66ccff;
  }
  
  .sender.ALIEN {
    color: #ff0000;
    text-shadow: 0 0 2px #ff0000;
    animation: alienGlow 2s infinite alternate;
  }
  
  /* Message type styling */
  .message-item:has(.sender.COMMANDER) {
    border-left: 3px solid #ffffff;
    background: #001a00;
  }
  
  .message-item:has(.sender.SYSTEM) {
    background: #001100;
    border-left: 2px solid #ffaa00;
  }
  
  .message-item:has(.sender.ALIEN) {
    background: #1a0000;
    border-left: 3px solid #ff0000;
  }
  
  /* New message highlight */
  .message-item.new-message {
    background: #001a00 !important;
    border-left: 4px solid #00ff41;
    animation: newMessageFlash 0.5s ease-out;
  }
  
  @keyframes newMessageFlash {
    0% {
      background: #001a00;
      border-left-color: #00ff41;
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
    100% {
      background: #001100;
      border-left-color: #00ff41;
      opacity: 1;
    }
  }
  
  @keyframes alienGlow {
    0% {
      text-shadow: 0 0 2px #ff0000;
    }
    100% {
      text-shadow: 0 0 5px #ff0000, 0 0 10px #ff0000;
    }
  }
  
  /* Scrollbar styling */
  .message-list::-webkit-scrollbar {
    width: 6px;
  }
  
  .message-list::-webkit-scrollbar-track {
    background: #000;
  }
  
  .message-list::-webkit-scrollbar-thumb {
    background: #003300;
    border: 1px solid #00ff41;
  }
  
  .message-list::-webkit-scrollbar-thumb:hover {
    background: #004400;
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .message-item {
      border-bottom-color: #00ff41;
    }
    
    .timestamp, .sender, .content {
      color: #00ff41 !important;
    }
  }
  
  /* Print styles */
  @media print {
    .message-list {
      font-size: 10px;
      max-height: none;
      break-inside: avoid;
    }
    
    .message-item {
      break-inside: avoid;
      margin-bottom: 2px;
      page-break-inside: avoid;
    }
  }
</style>