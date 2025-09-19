<script lang="ts">
  import type { LogEntry, MessageType } from '$lib/types';

  export let entry: LogEntry;
</script>

<div class="log-entry {entry.type}">
  <span class="author">[Turn {entry.turn}] <strong>{entry.author}</strong></span>
  <div class="content">{@html entry.content}</div>
</div>

<style>
  .log-entry {
    margin-bottom: 0.75rem;
    padding: 0.5rem;
    border-left: 3px solid #333;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 0 0.5rem 0.5rem 0;
  }

  .author {
    font-size: 0.85rem;
    opacity: 0.8;
    margin-bottom: 0.25rem;
  }

  .content {
    font-family: 'Courier New', monospace;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  /* Type-based styling for radio log theme */
  .log-entry.commander {
    border-left-color: #ffff00;  /* Yellow for player commands */
    background: rgba(255, 255, 0, 0.05);
  }

  .log-entry.ai_dialogue {
    border-left-color: #00ffff;  /* Cyan for speech */
    background: rgba(0, 255, 255, 0.05);
  }

  .log-entry.ai_action {
    border-left-color: #ff9900;  /* Orange for narration */
    background: rgba(255, 153, 0, 0.05);
  }

  .log-entry.ai_thoughts {
    border-left-color: #888;     /* Gray for debug thoughts */
    background: rgba(136, 136, 136, 0.05);
    font-style: italic;
    opacity: 0.7;
  }

  .log-entry.system {
    border-left-color: #ff0000;  /* Red for errors */
    background: rgba(255, 0, 0, 0.1);
  }

  /* Responsive: Stack on small screens */
  @media (max-width: 600px) {
    .log-entry {
      border-radius: 0.5rem;
      padding: 0.75rem;
    }

    .author {
      display: block;
      margin-bottom: 0.5rem;
    }
  }
</style>
