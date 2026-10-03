/**
 * ==============================================================================
 * Application Bootstrap & Initialization
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Canvas Graph Engine
  const graph = new NetworkGraph('network-canvas');

  // 2. Load Initial Enterprise Redundant Topology
  graph.loadTopology('enterprise');

  // 3. Initialize BFS Algorithmic Engine
  const bfsEngine = new BFSEngine(graph);

  // 4. Initialize UI & Event Controller
  const ui = new UIController(graph, bfsEngine);

  // 5. Initial Calculations
  ui.runLiveReroute();
  ui.addLog('Automated Network Failure Detection & Rerouting Engine initialized.', 'INFO');
  ui.addLog('Loaded [Enterprise Multi-Tier Backbone] with dual redundant cores.', 'INFO');
  ui.addLog('Click any router to simulate crash (Node failure) or click any link to cut cable (Edge failure).', 'INFO');
});
