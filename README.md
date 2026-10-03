# Automated Network Failure Detection and Rerouting Analysis using BFS

An interactive academic web application and DAA mini-project demonstrating graph theory, Breadth-First Search (BFS) shortest-path optimality, dynamic network failure simulation, component partitioning, and Single Point of Failure (SPOF) articulation analysis.

---

## 📌 Problem Statement & DAA Scenario
A communication network is modeled as an undirected, unweighted graph $G = (V, E)$, where vertices represent routers and edges represent physical communication cables.

Failures can occur due to:
1. **Router Crash (Node Failure):** Router hardware goes offline.
2. **Severed Link (Edge Failure):** Physical communication cable is severed.

Using **Breadth-First Search (BFS)**:
- **Connectivity:** Verifies if the network is connected and reachable.
- **Dynamic Rerouting:** Automatically finds the shortest alternate route (minimum hop count) if an active link or router fails.
- **Partition Detection:** Identifies isolated sub-networks/components using BFS.
- **Single Point of Failure (SPOF):** Detects critical articulation routers whose failure partitions the network ($\mathcal{O}(V(V + E))$).

---

## 🚀 Quick Start Instructions

### Method 1: Python Server (Recommended)
Navigate to the project folder and run:
```bash
python server.py
```
This automatically launches a local web server at `http://localhost:8000` and opens your default browser.

### Method 2: Direct File Open
You can directly open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari). No compilation or build steps are required.

### Method 3: Using Node / NPX
```bash
npx serve .
```

---

## 🛠️ Features & Interactive Capabilities

1. **Interactive HTML5 Canvas Graph**:
   - **Click any Router:** Toggles crash state (turns red, offline).
   - **Click any Cable:** Toggles severed state (red dashed line, cuts communication).
   - **Drag & Pan:** Reposition nodes smoothly with mouse drag; scroll to zoom in/out.
   - **Hover Inspection:** Inspect router IP, degree, status, and link connections.

2. **Pre-configured Academic Topologies**:
   - **Enterprise Redundant Backbone:** Dual-homed core with cross-links.
   - **Star Topology:** Classic hub-and-spoke highlighting central SPOF.
   - **Ring Topology:** 2-connected resilient cycle (survives 1 link cut, partitions on 2).
   - **Full Mesh ($K_5$):** Complete graph with maximum redundancy.
   - **Hierarchical Tree:** Multi-tier Core $\rightarrow$ Distribution $\rightarrow$ Access layers.

3. **Step-by-Step BFS Execution Player**:
   - **Playback Controls:** Play, Pause, Step Forward, Step Backward, Reset.
   - **Visual FIFO Queue (Q):** Live animated queue showing routers enqueued at the rear and dequeued at the front.
   - **Frontier & Traversal Highlights:** Color-coded node levels and inspected cross-edges.
   - **Synchronized Pseudo-Code Viewer:** Highlights exact execution lines as the algorithm progresses.

4. **Fault Analysis & Real-time Metrics**:
   - **One-Click SPOF Scanner:** Brute-force BFS vertex deletion identifies all articulation points.
   - **Partition Scanner:** Discovers all connected components and visualizes isolated subnets.
   - **Terminal Console:** Live event log streaming timestamped packet dispatches, link drops, and rerouting notifications.

---

## 📊 Theoretical DAA Complexity Analysis

| Metric | Complexity | Mathematical Rationale |
| :--- | :---: | :--- |
| **Standard BFS Traversal** | $\mathcal{O}(V + E)$ | Each vertex is enqueued/dequeued once ($\mathcal{O}(V)$). Each incident edge is inspected once per endpoint ($\sum \text{deg}(u) = 2E$). |
| **Shortest Path Rerouting** | $\mathcal{O}(V + E)$ | Executes BFS on modified graph $G' = (V, E \setminus \{e\})$. |
| **Partition Detection** | $\mathcal{O}(V + E)$ | Aggregate traversal covering all connected components without re-visiting marked nodes. |
| **Critical Router (SPOF)** | $\mathcal{O}(V(V + E))$ | Iterates over $|V|$ nodes, running an $\mathcal{O}(V + E)$ partition BFS on $G[V \setminus \{v\}]$. |
| **Auxiliary Space** | $\mathcal{O}(V)$ | Queue $Q$ and visited set store at most $|V|$ vertex identifiers. |

---

## 📂 Project Structure

```text
network-bfs-visualizer/
├── index.html          # Main responsive web interface (Tailwind CSS, NOC theme)
├── server.py           # One-click Python local server with browser auto-launch
├── README.md           # Comprehensive project manual & academic DAA guide
├── css/
│   └── styles.css      # Glassmorphism panels, queue animations, glowing canvas links
└── js/
    ├── graph.js        # High-DPI canvas renderer, mouse physics, topologies
    ├── bfs-engine.js   # Step tracer, queue state machine, rerouter, SPOF analysis
    ├── ui.js           # Playback stepper, visual queue DOM, metrics, event log
    └── app.js          # Main application bootstrapper
```

---

## 🎓 Academic Viva Questions & Answers Reference

1. **Why does BFS guarantee the shortest path in unweighted graphs?**  
   *Because BFS explores vertices level-by-level in non-decreasing order of distance $\delta(s, v)$ via a FIFO queue. The first time target $t$ is discovered, no shorter hop-count path can exist.*

2. **Why does BFS fail on weighted graphs?**  
   *BFS optimizes hop count, not cumulative link metric weights. A 1-hop link with high latency could be chosen over a 2-hop path with much lower total latency. Weighted networks require Dijkstra's Algorithm ($\mathcal{O}((V + E) \log V)$).*

3. **Can Critical Routers (Articulation Points) be found faster than $\mathcal{O}(V(V + E))$?**  
   *Yes. Tarjan's algorithm uses DFS tree back-edges and low-link values (`low[u]`) to discover all articulation points and bridges in linear time $\mathcal{O}(V + E)$. The BFS removal method is used here to empirically demonstrate multi-fault resilience and component partitioning.*
