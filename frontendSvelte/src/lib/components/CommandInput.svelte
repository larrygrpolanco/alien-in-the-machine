<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LogEntry } from '$lib/types';

  type SubmitEvent = CustomEvent<string>;

  const dispatch = createEventDispatcher<{ submit: SubmitEvent }>();

  export let disabled = false;

  let input: HTMLInputElement;
  let command = '';

  function handleSubmit() {
    if (disabled || !input) return;
    const cmd = command.trim();
    dispatch('submit', { detail: cmd });  // Dispatch even if empty ("pass" turn)
    command = '';  // Clear input
    input.focus();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !disabled) {
      handleSubmit();
    }
  }
</script>

<div class="input-container">
  <input
    bind:this={input}
    bind:value={command}
    type="text"
    placeholder="Enter command to Vanessa Miller..."
    maxlength={200}
    {disabled}
    on:keydown={handleKeydown}
    class="command-input"
  />
  <button on:click={handleSubmit} {disabled} class="submit-btn">
    {#if disabled}
      Processing...
    {:else}
      SEND
    {/if}
  </button>
</div>

<style>
  .input-container {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #333;
  }

  .command-input {
    flex: 1;
    padding: 0.75rem 1rem;
    background: #1a1a1a;
    color: #00ff00;
    border: 2px solid #333;
    border-radius: 0.5rem;
    font-family: 'Courier New', monospace;
    font-size: 1rem;
  }

  .command-input:focus {
    outline: none;
    border-color: #00ff00;
    box-shadow: 0 0 0 2px rgba(0, 255, 0, 0.2);
  }

  .command-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-btn {
    padding: 0.75rem 1.5rem;
    background: #00ff00;
    color: #000;
    border: none;
    border-radius: 0.5rem;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    cursor: pointer;
    min-width: 80px;
  }

  .submit-btn:hover:not(:disabled) {
    background: #00cc00;
  }

  .submit-btn:disabled {
    background: #555;
    color: #999;
    cursor: not-allowed;
  }
</style>
