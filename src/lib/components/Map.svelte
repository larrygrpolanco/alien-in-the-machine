
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Zone, MapView } from '$lib/models/entities';
  import { getCurrentTurn } from '$lib/services/turnService';
  import { get } from 'svelte/store';
  import { agentStore } from '$lib/stores/agentStore';
  import { worldStore } from '$lib/stores/worldStore';
  import { layoutStore } from '../stores/layoutStore';

  let zones: Record<string, Zone> = {};
  let agents = get(agentStore);
  let worldState = get(worldStore);
  let layoutState = get(layoutStore);
  let mapView: MapView = {
    position: { x: 50, y: 50, centered: true },
    connections: [],
    size: { width: '100%', height: '50vh' },
    interactive: true
  };

  // Subscribe to layout changes for responsive updates
  $: layoutState = get(layoutStore);
  $: if (layoutState) {
    // Update map sizing based on breakpoint
    if (layoutState.breakpoint === 'mobile') {
      mapView.size = { width: '100%', height: '40vh' }; // Smaller on mobile
    } else if (layoutState.breakpoint === 'tablet') {
      mapView.size = { width: '100%', height: '45vh' };
    } else {
      mapView.size