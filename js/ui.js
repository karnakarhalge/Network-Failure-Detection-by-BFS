/**
 * ==============================================================================
 * UI Controller, Visual Queue, Playback Stepper & Event Log Orchestrator
 * ==============================================================================
 */

class UIController {
  constructor(graph, bfsEngine) {
    this.graph = graph;
    this.bfsEngine = bfsEngine;

    // Simulation & Stepper State
    this.traceSteps = [];
    this.currentStepIdx = 0;
    this.isPlaying = false;
    this.playTimer = null;
    this.playbackSpeed = 800; // ms per step

    this.cacheDomElements();
    this.bindEvents();
    this.updateMetrics();
    this.populateNodeSelects();
  }

  cacheDomElements() {
    // Stepper & Playback controls
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.btnStepForward = document.getElementById('btn-step-forward');
    this.btnStepBack = document.getElementById('btn-step-back');
    this.btnResetStep = document.getElementById('btn-reset-step');
    this.speedSlider = document.getElementById('speed-slider');
    this.speedLabel = document.getElementById('speed-label');

    // Visual Queue container
    this.queueTrack = document.getElementById('visual-queue-track');
    this.stepCounter = document.getElementById('step-counter');
    this.stepExplanation = document.getElementById('step-explanation');

    // Source & Target selectors
    this.selectSource = document.getElementById('select-source');
    this.selectTarget = document.getElementById('select-target');
    this.btnComputeRoute = document.getElementById('btn-compute-route');

    // Analysis buttons
    this.btnScanSPOF = document.getElementById('btn-scan-spof');
    this.btnCheckPartitions = document.getElementById('btn-check-partitions');
    this.btnResetFailures = document.getElementById('btn-reset-failures');

    // Metrics counters
    this.metricNodes = document.getElementById('metric-total-nodes');
    this.metricEdges = document.getElementById('metric-total-edges');
    this.metricFailedNodes = document.getElementById('metric-failed-nodes');
    this.metricSeveredLinks = document.getElementById('metric-severed-links');
    this.metricPartitions = document.getElementById('metric-partitions');
    this.metricPathHops = document.getElementById('metric-path-hops');

    // Status alert banner
    this.alertBanner = document.getElementById('status-alert-banner');
    this.alertText = document.getElementById('status-alert-text');

    // Event log console
    this.logConsole = document.getElementById('log-console');
    this.btnClearLogs = document.getElementById('btn-clear-logs');

    // Modals
    this.modalTheory = document.getElementById('modal-theory');
    this.btnOpenTheory = document.getElementById('btn-open-theory');
    this.btnCloseTheory = document.getElementById('btn-close-theory');

    // Topology Switcher
    this.topologySelect = document.getElementById('topology-select');
  }

  bindEvents() {
    // Topology switcher
    if (this.topologySelect) {
      this.topologySelect.addEventListener('change', (e) => {
        this.graph.loadTopology(e.target.value);
        this.resetSimulation();
        this.populateNodeSelects();
        this.updateMetrics();
        this.runLiveReroute();
        this.addLog(`Loaded [${e.target.value.toUpperCase()}] network topology.`, 'INFO');
      });
    }

    // Source / Target selection changes
    if (this.selectSource) {
      this.selectSource.addEventListener('change', (e) => {
        this.graph.selectedSource = e.target.value;
        this.resetSimulation();
        this.runLiveReroute();
      });
    }

    if (this.selectTarget) {
      this.selectTarget.addEventListener('change', (e) => {
        this.graph.selectedTarget = e.target.value;
        this.resetSimulation();
        this.runLiveReroute();
      });
    }

    // Playback Controls
    if (this.btnPlayPause) {
      this.btnPlayPause.addEventListener('click', () => this.togglePlayPause());
    }
    if (this.btnStepForward) {
      this.btnStepForward.addEventListener('click', () => this.stepForward());
    }
    if (this.btnStepBack) {
      this.btnStepBack.addEventListener('click', () => this.stepBack());
    }
    if (this.btnResetStep) {
      this.btnResetStep.addEventListener('click', () => this.resetSimulation());
    }
    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.playbackSpeed = val;
        this.speedLabel.textContent = `${val}ms`;
        if (this.isPlaying) {
          clearInterval(this.playTimer);
          this.playTimer = setInterval(() => this.stepForward(), this.playbackSpeed);
        }
      });
    }

    // Analysis actions
    if (this.btnScanSPOF) {
      this.btnScanSPOF.addEventListener('click', () => this.handleScanSPOF());
    }
    if (this.btnCheckPartitions) {
      this.btnCheckPartitions.addEventListener('click', () => this.handleCheckPartitions());
    }
    if (this.btnResetFailures) {
      this.btnResetFailures.addEventListener('click', () => {
        this.graph.resetAllFailures();
        this.updateMetrics();
        this.runLiveReroute();
        this.showAlert('All router crashes and severed links restored.', 'success');
        this.addLog('Restored all failed routers and links to normal operational state.', 'SUCCESS');
      });
    }

    // Clear logs
    if (this.btnClearLogs) {
      this.btnClearLogs.addEventListener('click', () => {
        this.logConsole.innerHTML = '';
      });
    }

    // Modals
    if (this.btnOpenTheory) {
      this.btnOpenTheory.addEventListener('click', () => {
        this.modalTheory.classList.remove('hidden');
      });
    }
    if (this.btnCloseTheory) {
      this.btnCloseTheory.addEventListener('click', () => {
        this.modalTheory.classList.add('hidden');
      });
    }

    // Listen to Canvas Graph mutations (clicks on nodes/edges)
    window.addEventListener('networkStateChanged', (e) => {
      const detail = e.detail;
      if (detail.type === 'node_toggle') {
        const n = detail.node;
        const status = n.isFailed ? 'CRASHED' : 'ONLINE';
        this.addLog(`Router [${n.label}] state toggled: ${status}`, n.isFailed ? 'DANGER' : 'SUCCESS');
      } else if (detail.type === 'edge_toggle') {
        const edge = detail.edge;
        const status = edge.isFailed ? 'SEVERED' : 'REPAIRED';
        this.addLog(`Physical link (${edge.u} ⇄ ${edge.v}) state toggled: ${status}`, edge.isFailed ? 'DANGER' : 'SUCCESS');
      }

      this.updateMetrics();
      this.runLiveReroute();
    });
  }

  // ----------------------------------------------------------------------------
  // Select Dropdowns Population
  // ----------------------------------------------------------------------------
  populateNodeSelects() {
    if (!this.selectSource || !this.selectTarget) return;

    this.selectSource.innerHTML = '';
    this.selectTarget.innerHTML = '';

    const sortedIds = Array.from(this.graph.nodes.keys()).sort();

    sortedIds.forEach(id => {
      const node = this.graph.nodes.get(id);
      const opt1 = document.createElement('option');
      opt1.value = id;
      opt1.textContent = `${node.label} (${node.ip})`;
      if (id === this.graph.selectedSource) opt1.selected = true;
      this.selectSource.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = id;
      opt2.textContent = `${node.label} (${node.ip})`;
      if (id === this.graph.selectedTarget) opt2.selected = true;
      this.selectTarget.appendChild(opt2);
    });
  }

  // ----------------------------------------------------------------------------
  // Live Automatic Rerouting Analysis
  // ----------------------------------------------------------------------------
  runLiveReroute() {
    const src = this.graph.selectedSource;
    const dst = this.graph.selectedTarget;

    if (!src || !dst) return;

    const result = this.bfsEngine.findShortestPath(src, dst);

    if (result.path) {
      this.graph.highlightPath = result.path;
      this.metricPathHops.textContent = `${result.hops} hops`;
      this.showAlert(`Operational Route active: ${result.path.join(' ➔ ')} (${result.hops} hops)`, 'success');
      this.addLog(`BFS shortest path recomputed: ${result.path.join(' ➔ ')} [Hops: ${result.hops}]`, 'REROUTE');
    } else {
      this.graph.highlightPath = [];
      this.metricPathHops.textContent = 'Unreachable';
      this.showAlert(`ALERT: Target [${dst}] is UNREACHABLE from [${src}]! Network partitioned.`, 'danger');
      this.addLog(`Target [${dst}] is unreachable from [${src}]. Packet drop imminent!`, 'CRITICAL');
    }

    // Refresh simulation traces for new route
    this.initTrace();
  }

  // ----------------------------------------------------------------------------
  // Step-by-Step Simulation Controller
  // ----------------------------------------------------------------------------
  initTrace() {
    this.stopPlayback();
    const src = this.graph.selectedSource;
    const dst = this.graph.selectedTarget;

    if (!src || !dst) return;

    this.traceSteps = this.bfsEngine.generateStepByStepTrace(src, dst);
    this.currentStepIdx = 0;
    this.applyStep(this.currentStepIdx);
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (this.currentStepIdx >= this.traceSteps.length - 1) {
      this.currentStepIdx = 0;
    }
    this.isPlaying = true;
    this.btnPlayPause.innerHTML = '<i class="fas fa-pause mr-1"></i> Pause';
    this.btnPlayPause.classList.replace('bg-emerald-600', 'bg-amber-600');
    this.playTimer = setInterval(() => {
      if (this.currentStepIdx < this.traceSteps.length - 1) {
        this.stepForward();
      } else {
        this.stopPlayback();
      }
    }, this.playbackSpeed);
  }

  stopPlayback() {
    this.isPlaying = false;
    clearInterval(this.playTimer);
    if (this.btnPlayPause) {
      this.btnPlayPause.innerHTML = '<i class="fas fa-play mr-1"></i> Play';
      this.btnPlayPause.classList.replace('bg-amber-600', 'bg-emerald-600');
    }
  }

  stepForward() {
    if (this.currentStepIdx < this.traceSteps.length - 1) {
      this.currentStepIdx++;
      this.applyStep(this.currentStepIdx);
    }
  }

  stepBack() {
    if (this.currentStepIdx > 0) {
      this.currentStepIdx--;
      this.applyStep(this.currentStepIdx);
    }
  }

  resetSimulation() {
    this.stopPlayback();
    this.currentStepIdx = 0;
    this.graph.clearBFSVisuals();
    this.runLiveReroute();
  }

  applyStep(index) {
    if (!this.traceSteps || this.traceSteps.length === 0) return;
    const step = this.traceSteps[index];
    if (!step) return;

    // Update Counter & Description
    this.stepCounter.textContent = `Step ${index + 1} of ${this.traceSteps.length}`;
    this.stepExplanation.textContent = step.description;

    // Synchronize Canvas Visuals
    this.graph.currentFrontierNode = step.currentNode;
    this.graph.visitedNodes = new Set(step.visited || []);
    this.graph.activeEdge = step.activeEdge;

    if (step.path) {
      this.graph.highlightPath = step.path;
    }

    // Render Queue
    this.renderVisualQueue(step.queue, step.type === 'DEQUEUE' ? step.currentNode : null);

    // Highlight Pseudo-code Line
    this.highlightPseudoCode(step.codeLine);
  }

  renderVisualQueue(queueItems, dequeuedNode = null) {
    if (!this.queueTrack) return;
    this.queueTrack.innerHTML = '';

    if (!queueItems || queueItems.length === 0) {
      this.queueTrack.innerHTML = '<span class="text-xs text-gray-500 italic ml-2">FIFO Queue is empty</span>';
      return;
    }

    // Head indicator
    const headLabel = document.createElement('div');
    headLabel.className = 'text-[10px] font-bold text-cyan-400 mr-1 uppercase';
    headLabel.textContent = 'FRONT ➔';
    this.queueTrack.appendChild(headLabel);

    queueItems.forEach((id, idx) => {
      const item = document.createElement('div');
      item.className = 'queue-node-item';
      if (idx === 0) item.classList.add('bg-blue-600');
      item.innerHTML = `<i class="fas fa-server text-[10px]"></i> <span>${id}</span>`;
      this.queueTrack.appendChild(item);
    });

    const tailLabel = document.createElement('div');
    tailLabel.className = 'text-[10px] font-bold text-gray-500 ml-1 uppercase';
    tailLabel.textContent = '➔ REAR';
    this.queueTrack.appendChild(tailLabel);
  }

  highlightPseudoCode(lineNum) {
    document.querySelectorAll('.code-line').forEach(el => {
      el.classList.remove('active');
    });
    if (lineNum) {
      const target = document.querySelector(`.code-line[data-line="${lineNum}"]`);
      if (target) {
        target.classList.add('active');
      }
    }
  }

  // ----------------------------------------------------------------------------
  // High-Level Analysis Handlers
  // ----------------------------------------------------------------------------
  handleScanSPOF() {
    this.addLog('Starting O(V * (V + E)) Articulation Point / Single Point of Failure (SPOF) Scan...', 'ANALYSIS');
    const criticalRouters = this.bfsEngine.findCriticalRouters();

    if (criticalRouters.length > 0) {
      this.showAlert(`CRITICAL WARNING: ${criticalRouters.length} Single Point(s) of Failure detected: [${criticalRouters.join(', ')}]`, 'danger');
      criticalRouters.forEach(r => {
        this.addLog(`⚠️ Router [${r}] is a SINGLE POINT OF FAILURE! Partition occurs upon crash.`, 'CRITICAL');
      });
    } else {
      this.showAlert('SURVIVABILITY CHECK PASSED: Network is 2-vertex connected. No single point of failure.', 'success');
      this.addLog('Analysis Complete: Zero Single Points of Failure detected. Network has redundancy.', 'SUCCESS');
    }
    this.updateMetrics();
  }

  handleCheckPartitions() {
    const partitions = this.bfsEngine.detectPartitions();
    this.addLog(`BFS Partition Discovery complete: ${partitions.length} connected subnetworks identified.`, 'ANALYSIS');

    partitions.forEach((comp, idx) => {
      this.addLog(`Subnetwork Component #${idx + 1} (${comp.size} routers): { ${comp.nodes.join(', ')} }`, 'INFO');
    });

    if (partitions.length === 1) {
      this.showAlert('Network is fully connected and reachable.', 'success');
    } else {
      this.showAlert(`PARTITION DETECTED: Network is split into ${partitions.length} isolated segments!`, 'danger');
    }
    this.updateMetrics();
  }

  // ----------------------------------------------------------------------------
  // Status Banner & Metrics Helpers
  // ----------------------------------------------------------------------------
  showAlert(message, type = 'info') {
    if (!this.alertBanner || !this.alertText) return;
    this.alertText.textContent = message;
    this.alertBanner.classList.remove('hidden', 'bg-emerald-950/80', 'border-emerald-600', 'bg-rose-950/80', 'border-rose-600', 'bg-blue-950/80', 'border-blue-600');

    if (type === 'success') {
      this.alertBanner.classList.add('bg-emerald-950/80', 'border-emerald-600');
    } else if (type === 'danger') {
      this.alertBanner.classList.add('bg-rose-950/80', 'border-rose-600', 'alert-pulse-red');
    } else {
      this.alertBanner.classList.add('bg-blue-950/80', 'border-blue-600');
    }
  }

  updateMetrics() {
    const totalNodes = this.graph.nodes.size;
    const totalEdges = this.graph.edges.length;
    const failedNodes = Array.from(this.graph.nodes.values()).filter(n => n.isFailed).length;
    const severedLinks = this.graph.edges.filter(e => e.isFailed).length;
    const partitions = this.bfsEngine.detectPartitions().length;

    if (this.metricNodes) this.metricNodes.textContent = totalNodes;
    if (this.metricEdges) this.metricEdges.textContent = totalEdges;
    if (this.metricFailedNodes) {
      this.metricFailedNodes.textContent = failedNodes;
      this.metricFailedNodes.className = failedNodes > 0 ? 'text-lg font-bold text-rose-400' : 'text-lg font-bold text-gray-200';
    }
    if (this.metricSeveredLinks) {
      this.metricSeveredLinks.textContent = severedLinks;
      this.metricSeveredLinks.className = severedLinks > 0 ? 'text-lg font-bold text-rose-400' : 'text-lg font-bold text-gray-200';
    }
    if (this.metricPartitions) {
      this.metricPartitions.textContent = partitions;
      this.metricPartitions.className = partitions > 1 ? 'text-lg font-bold text-amber-400' : 'text-lg font-bold text-emerald-400';
    }
  }

  addLog(message, category = 'INFO') {
    if (!this.logConsole) return;
    const line = document.createElement('div');
    line.className = 'py-0.5 text-xs font-mono flex items-start gap-2';

    const timestamp = new Date().toLocaleTimeString();
    let badgeClass = 'text-cyan-400';
    if (category === 'DANGER' || category === 'CRITICAL') badgeClass = 'text-rose-400 font-bold';
    else if (category === 'SUCCESS') badgeClass = 'text-emerald-400 font-bold';
    else if (category === 'REROUTE') badgeClass = 'text-amber-300 font-semibold';
    else if (category === 'ANALYSIS') badgeClass = 'text-purple-400 font-semibold';

    line.innerHTML = `
      <span class="text-gray-500 shrink-0">[${timestamp}]</span>
      <span class="${badgeClass} shrink-0">[${category}]</span>
      <span class="text-gray-300">${message}</span>
    `;

    this.logConsole.appendChild(line);
    this.logConsole.scrollTop = this.logConsole.scrollHeight;
  }
}

window.UIController = UIController;
