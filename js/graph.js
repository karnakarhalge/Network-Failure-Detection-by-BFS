/**
 * ==============================================================================
 * Network Graph Model, Topologies & Canvas Rendering Engine
 * ==============================================================================
 */

class NetworkGraph {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Core Graph Model
    this.nodes = new Map(); // id -> { id, label, ip, x, y, vx, vy, isFailed, isCritical, componentId, tier }
    this.edges = [];        // [ { u, v, isFailed, id } ]
    
    // Interaction State
    this.draggedNode = null;
    this.hoveredNode = null;
    this.hoveredEdge = null;
    this.selectedSource = null;
    this.selectedTarget = null;
    
    // Visualization Overrides (for BFS animation)
    this.highlightPath = [];        // Array of node IDs forming shortest path
    this.currentFrontierNode = null;// Node currently being explored in BFS
    this.visitedNodes = new Set();  // Nodes marked visited in BFS step
    this.activeEdge = null;         // Currently inspected edge [u, v]
    
    // Camera Transform (Pan & Zoom)
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    
    // Animation Loop
    this.packetOffset = 0;
    this.animationFrameId = null;
    
    // Color Palette for Components
    this.componentColors = [
      '#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', 
      '#f87171', '#2dd4bf', '#c084fc', '#fb923c'
    ];

    this.initCanvas();
    this.setupEventListeners();
    this.startAnimationLoop();
  }

  initCanvas() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  // ----------------------------------------------------------------------------
  // Graph Mutation Methods
  // ----------------------------------------------------------------------------
  addNode(id, label = id, x = null, y = null, tier = 'router') {
    if (this.nodes.has(id)) return;
    
    const posX = x !== null ? x : (this.width / 2 + (Math.random() - 0.5) * 200);
    const posY = y !== null ? y : (this.height / 2 + (Math.random() - 0.5) * 200);
    
    // Generate mock IP based on hash
    const hash = Math.abs(id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
    const ip = `10.0.${hash % 10}.${(hash * 3) % 250 + 1}`;

    this.nodes.set(id, {
      id,
      label,
      ip,
      x: posX,
      y: posY,
      vx: 0,
      vy: 0,
      isFailed: false,
      isCritical: false,
      componentId: 0,
      tier
    });
  }

  addEdge(u, v) {
    if (!this.nodes.has(u) || !this.nodes.has(v) || u === v) return;
    const norm = u < v ? `${u}--${v}` : `${v}--${u}`;
    if (!this.edges.some(e => e.id === norm)) {
      this.edges.push({
        id: norm,
        u: u < v ? u : v,
        v: u < v ? v : u,
        isFailed: false
      });
    }
  }

  removeNode(id) {
    this.nodes.delete(id);
    this.edges = this.edges.filter(e => e.u !== id && e.v !== id);
    if (this.selectedSource === id) this.selectedSource = null;
    if (this.selectedTarget === id) this.selectedTarget = null;
  }

  removeEdge(u, v) {
    const norm = u < v ? `${u}--${v}` : `${v}--${u}`;
    this.edges = this.edges.filter(e => e.id !== norm);
  }

  getEdge(u, v) {
    const norm = u < v ? `${u}--${v}` : `${v}--${u}`;
    return this.edges.find(e => e.id === norm);
  }

  toggleNodeFailure(id) {
    const node = this.nodes.get(id);
    if (!node) return null;
    node.isFailed = !node.isFailed;
    return node.isFailed;
  }

  toggleLinkFailure(u, v) {
    const edge = this.getEdge(u, v);
    if (!edge) return null;
    edge.isFailed = !edge.isFailed;
    return edge.isFailed;
  }

  resetAllFailures() {
    this.nodes.forEach(node => {
      node.isFailed = false;
      node.isCritical = false;
    });
    this.edges.forEach(edge => {
      edge.isFailed = false;
    });
    this.clearBFSVisuals();
  }

  clearBFSVisuals() {
    this.highlightPath = [];
    this.currentFrontierNode = null;
    this.visitedNodes = new Set();
    this.activeEdge = null;
  }

  getNeighbors(nodeId) {
    const neighbors = [];
    for (const edge of this.edges) {
      if (edge.isFailed) continue;
      if (edge.u === nodeId) neighbors.push(edge.v);
      else if (edge.v === nodeId) neighbors.push(edge.u);
    }
    return neighbors;
  }

  // ----------------------------------------------------------------------------
  // Predefined Academic Topologies
  // ----------------------------------------------------------------------------
  loadTopology(type) {
    this.nodes.clear();
    this.edges = [];
    this.resetAllFailures();
    
    const cx = this.width / 2;
    const cy = this.height / 2;

    switch (type) {
      case 'star': {
        this.addNode('Core-Router', 'Core (SPOF)', cx, cy, 'core');
        const count = 6;
        const radius = Math.min(this.width, this.height) * 0.32;
        for (let i = 1; i <= count; i++) {
          const angle = ((i - 1) / count) * 2 * Math.PI;
          const id = `Leaf-R${i}`;
          this.addNode(id, id, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), 'access');
          this.addEdge('Core-Router', id);
        }
        this.selectedSource = 'Leaf-R1';
        this.selectedTarget = 'Leaf-R4';
        break;
      }

      case 'ring': {
        const count = 7;
        const radius = Math.min(this.width, this.height) * 0.34;
        for (let i = 1; i <= count; i++) {
          const angle = ((i - 1) / count) * 2 * Math.PI - Math.PI / 2;
          const id = `Router-${i}`;
          this.addNode(id, id, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), 'distribution');
        }
        for (let i = 1; i <= count; i++) {
          const next = i === count ? 1 : i + 1;
          this.addEdge(`Router-${i}`, `Router-${next}`);
        }
        this.selectedSource = 'Router-1';
        this.selectedTarget = 'Router-4';
        break;
      }

      case 'mesh': {
        const count = 5;
        const radius = Math.min(this.width, this.height) * 0.3;
        for (let i = 1; i <= count; i++) {
          const angle = ((i - 1) / count) * 2 * Math.PI - Math.PI / 2;
          const id = `Mesh-R${i}`;
          this.addNode(id, id, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), 'core');
        }
        for (let i = 1; i <= count; i++) {
          for (let j = i + 1; j <= count; j++) {
            this.addEdge(`Mesh-R${i}`, `Mesh-R${j}`);
          }
        }
        this.selectedSource = 'Mesh-R1';
        this.selectedTarget = 'Mesh-R3';
        break;
      }

      case 'tree': {
        // Hierarchical 3-Tier Tree
        const yTop = cy - 160;
        const yMid = cy;
        const yBottom = cy + 160;

        this.addNode('Core-0', 'Core-Root', cx, yTop, 'core');
        
        const distCount = 2;
        const dOffset = 180;
        this.addNode('Dist-1', 'Dist-1', cx - dOffset, yMid, 'distribution');
        this.addNode('Dist-2', 'Dist-2', cx + dOffset, yMid, 'distribution');
        this.addEdge('Core-0', 'Dist-1');
        this.addEdge('Core-0', 'Dist-2');

        const accSpacing = 90;
        this.addNode('Acc-1', 'Acc-1', cx - dOffset - accSpacing, yBottom, 'access');
        this.addNode('Acc-2', 'Acc-2', cx - dOffset + accSpacing, yBottom, 'access');
        this.addNode('Acc-3', 'Acc-3', cx + dOffset - accSpacing, yBottom, 'access');
        this.addNode('Acc-4', 'Acc-4', cx + dOffset + accSpacing, yBottom, 'access');

        this.addEdge('Dist-1', 'Acc-1');
        this.addEdge('Dist-1', 'Acc-2');
        this.addEdge('Dist-2', 'Acc-3');
        this.addEdge('Dist-2', 'Acc-4');

        this.selectedSource = 'Acc-1';
        this.selectedTarget = 'Acc-4';
        break;
      }

      case 'enterprise':
      default: {
        // Dual-Core Multi-homed Fault-tolerant Backbone
        const yCore = cy - 130;
        const yDist = cy;
        const yAccess = cy + 140;

        this.addNode('Core-1', 'Core-1', cx - 110, yCore, 'core');
        this.addNode('Core-2', 'Core-2', cx + 110, yCore, 'core');
        this.addEdge('Core-1', 'Core-2'); // Cross link

        this.addNode('Dist-1', 'Dist-1', cx - 200, yDist, 'distribution');
        this.addNode('Dist-2', 'Dist-2', cx + 200, yDist, 'distribution');
        
        this.addEdge('Core-1', 'Dist-1');
        this.addEdge('Core-1', 'Dist-2');
        this.addEdge('Core-2', 'Dist-1');
        this.addEdge('Core-2', 'Dist-2');

        this.addNode('Access-A', 'Host-A', cx - 270, yAccess, 'access');
        this.addNode('Access-B', 'Host-B', cx - 130, yAccess, 'access');
        this.addNode('Access-C', 'Host-C', cx + 130, yAccess, 'access');
        this.addNode('Access-D', 'Host-D', cx + 270, yAccess, 'access');

        this.addEdge('Dist-1', 'Access-A');
        this.addEdge('Dist-1', 'Access-B');
        this.addEdge('Dist-2', 'Access-C');
        this.addEdge('Dist-2', 'Access-D');
        // Redundant cross-connect at access level
        this.addEdge('Access-B', 'Access-C');

        this.selectedSource = 'Access-A';
        this.selectedTarget = 'Access-D';
        break;
      }
    }
  }

  // ----------------------------------------------------------------------------
  // Canvas Rendering & Animation
  // ----------------------------------------------------------------------------
  startAnimationLoop() {
    const loop = () => {
      this.packetOffset = (this.packetOffset + 0.02) % 1.0;
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // Apply Pan & Zoom
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // Render Edges
    this.renderEdges(ctx);

    // Render Nodes
    this.renderNodes(ctx);

    ctx.restore();
  }

  renderEdges(ctx) {
    const pathEdges = new Set();
    if (this.highlightPath && this.highlightPath.length > 1) {
      for (let i = 0; i < this.highlightPath.length - 1; i++) {
        const u = this.highlightPath[i];
        const v = this.highlightPath[i + 1];
        pathEdges.add(u < v ? `${u}--${v}` : `${v}--${u}`);
      }
    }

    for (const edge of this.edges) {
      const uNode = this.nodes.get(edge.u);
      const vNode = this.nodes.get(edge.v);
      if (!uNode || !vNode) continue;

      const isPathEdge = pathEdges.has(edge.id);
      const isHovered = this.hoveredEdge === edge;
      const isActiveExploration = this.activeEdge && 
        ((this.activeEdge[0] === edge.u && this.activeEdge[1] === edge.v) ||
         (this.activeEdge[0] === edge.v && this.activeEdge[1] === edge.u));

      ctx.beginPath();
      ctx.moveTo(uNode.x, uNode.y);
      ctx.lineTo(vNode.x, vNode.y);

      if (edge.isFailed) {
        // Severed Cable Style (Red dashed)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw 'X' cut icon at midpoint
        const midX = (uNode.x + vNode.x) / 2;
        const midY = (uNode.y + vNode.y) / 2;
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕ CUT', midX, midY - 6);

      } else if (isActiveExploration) {
        // BFS frontier edge check
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

      } else if (isPathEdge) {
        // Active Shortest Path (Glowing Emerald)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw animated traveling packet along the path
        this.renderAnimatedPacket(ctx, uNode, vNode);

      } else {
        // Normal Operational Link
        ctx.strokeStyle = isHovered ? '#06b6d4' : '#374151';
        ctx.lineWidth = isHovered ? 3 : 1.8;
        ctx.stroke();
      }
    }
  }

  renderAnimatedPacket(ctx, u, v) {
    const t = this.packetOffset;
    const px = u.x + (v.x - u.x) * t;
    const py = u.y + (v.y - u.y) * t;

    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#6ee7b7';
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }

  renderNodes(ctx) {
    for (const [id, node] of this.nodes) {
      const isSource = this.selectedSource === id;
      const isTarget = this.selectedTarget === id;
      const isHovered = this.hoveredNode === node;
      const isCurrent = this.currentFrontierNode === id;
      const isVisited = this.visitedNodes.has(id);
      const isPath = this.highlightPath.includes(id);

      ctx.save();
      const radius = node.tier === 'core' ? 24 : 20;

      // Outer Glow / Rings
      if (node.isFailed) {
        // Offline / Crashed state
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

      } else if (node.isCritical) {
        // Critical Articulation Point (SPOF) Hazard Badge
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

      } else if (isCurrent) {
        // Current BFS inspection frontier
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12;
        ctx.stroke();

      } else if (isSource) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 10;
        ctx.stroke();

      } else if (isTarget) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
        ctx.stroke();
      }

      // Node Body Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

      // Color selection based on dynamic state
      if (node.isFailed) {
        ctx.fillStyle = '#7f1d1d'; // Crimson dark
        ctx.strokeStyle = '#ef4444';
      } else if (isCurrent) {
        ctx.fillStyle = '#b45309'; // Amber dark
        ctx.strokeStyle = '#f59e0b';
      } else if (isPath) {
        ctx.fillStyle = '#064e3b'; // Emerald dark
        ctx.strokeStyle = '#10b981';
      } else if (isVisited) {
        ctx.fillStyle = '#312e81'; // Indigo dark
        ctx.strokeStyle = '#818cf8';
      } else {
        // Component-based coloring or default NOC cyan
        const compColor = this.componentColors[node.componentId % this.componentColors.length];
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = isHovered ? '#06b6d4' : (compColor || '#475569');
      }

      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.fill();
      ctx.stroke();

      // Node Icon / Symbol inside
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';

      if (node.isFailed) {
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('CRASH', node.x, node.y);
      } else if (isSource) {
        ctx.fillText('SRC', node.x, node.y);
      } else if (isTarget) {
        ctx.fillText('DST', node.x, node.y);
      } else {
        const short = node.label.replace('Router-', 'R').replace('Leaf-', 'L').replace('Mesh-', 'M');
        ctx.fillText(short, node.x, node.y);
      }

      // Label below node
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = node.isFailed ? '#ef4444' : '#9ca3af';
      ctx.fillText(node.label, node.x, node.y + radius + 14);

      // IP Address
      ctx.font = '9px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(node.ip, node.x, node.y + radius + 25);

      ctx.restore();
    }
  }

  // ----------------------------------------------------------------------------
  // Interactive Mouse & Pointer Handlers
  // ----------------------------------------------------------------------------
  setupEventListeners() {
    const c = this.canvas;
    const tooltip = document.getElementById('canvas-tooltip');

    const toWorldCoords = (clientX, clientY) => {
      const rect = c.getBoundingClientRect();
      const x = (clientX - rect.left - this.camera.x) / this.camera.zoom;
      const y = (clientY - rect.top - this.camera.y) / this.camera.zoom;
      return { x, y };
    };

    c.addEventListener('mousedown', (e) => {
      const { x, y } = toWorldCoords(e.clientX, e.clientY);
      const hitNode = this.findNodeAt(x, y);

      if (e.button === 0) { // Left click
        if (hitNode) {
          this.draggedNode = hitNode;
        } else {
          this.isPanning = true;
          this.panStart = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      const { x, y } = toWorldCoords(e.clientX, e.clientY);

      if (this.draggedNode) {
        this.draggedNode.x = x;
        this.draggedNode.y = y;
        return;
      }

      if (this.isPanning) {
        this.camera.x = e.clientX - this.panStart.x;
        this.camera.y = e.clientY - this.panStart.y;
        return;
      }

      // Hover detections
      const hitNode = this.findNodeAt(x, y);
      const hitEdge = !hitNode ? this.findEdgeAt(x, y) : null;
      
      this.hoveredNode = hitNode;
      this.hoveredEdge = hitEdge;
      c.style.cursor = hitNode ? 'pointer' : (hitEdge ? 'crosshair' : 'default');

      // Tooltip handling
      if (hitNode && tooltip) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top = `${e.clientY + 14}px`;
        const nbrs = this.getNeighbors(hitNode.id);
        tooltip.innerHTML = `
          <div class="font-bold text-cyan-400 mb-1">${hitNode.label}</div>
          <div class="text-xs text-gray-300">IP: <span class="font-mono">${hitNode.ip}</span></div>
          <div class="text-xs text-gray-300">Degree: <span class="font-semibold text-white">${nbrs.length}</span></div>
          <div class="text-xs text-gray-300">Status: <span class="${hitNode.isFailed ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}">${hitNode.isFailed ? 'OFFLINE (CRASHED)' : 'ONLINE'}</span></div>
          ${hitNode.isCritical ? '<div class="text-xs text-amber-400 font-semibold mt-1">⚠️ Single Point of Failure</div>' : ''}
          <div class="text-[10px] text-gray-400 mt-1 italic">Click to toggle failure</div>
        `;
      } else if (hitEdge && tooltip) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top = `${e.clientY + 14}px`;
        tooltip.innerHTML = `
          <div class="font-bold text-gray-200 mb-1">Physical Link</div>
          <div class="text-xs font-mono text-cyan-300">${hitEdge.u} ⇄ ${hitEdge.v}</div>
          <div class="text-xs text-gray-300">Status: <span class="${hitEdge.isFailed ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}">${hitEdge.isFailed ? 'SEVERED (CUT)' : 'OPERATIONAL'}</span></div>
          <div class="text-[10px] text-gray-400 mt-1 italic">Click to sever/repair cable</div>
        `;
      } else if (tooltip) {
        tooltip.style.display = 'none';
      }
    });

    window.addEventListener('mouseup', () => {
      this.draggedNode = null;
      this.isPanning = false;
    });

    // Node & Edge toggle on click
    c.addEventListener('click', (e) => {
      const { x, y } = toWorldCoords(e.clientX, e.clientY);
      const hitNode = this.findNodeAt(x, y);
      
      if (hitNode) {
        hitNode.isFailed = !hitNode.isFailed;
        window.dispatchEvent(new CustomEvent('networkStateChanged', { 
          detail: { type: 'node_toggle', node: hitNode } 
        }));
        return;
      }

      const hitEdge = this.findEdgeAt(x, y);
      if (hitEdge) {
        hitEdge.isFailed = !hitEdge.isFailed;
        window.dispatchEvent(new CustomEvent('networkStateChanged', { 
          detail: { type: 'edge_toggle', edge: hitEdge } 
        }));
      }
    });

    // Zoom via wheel
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(Math.max(this.camera.zoom * zoomFactor, 0.4), 2.5);
      this.camera.zoom = newZoom;
    }, { passive: false });
  }

  findNodeAt(x, y) {
    for (const [id, node] of this.nodes) {
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist <= 26) return node;
    }
    return null;
  }

  findEdgeAt(x, y) {
    for (const edge of this.edges) {
      const u = this.nodes.get(edge.u);
      const v = this.nodes.get(edge.v);
      if (!u || !v) continue;

      const d = this.distToSegment({ x, y }, u, v);
      if (d <= 8) return edge;
    }
    return null;
  }

  distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }
}

window.NetworkGraph = NetworkGraph;
