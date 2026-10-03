/**
 * ==============================================================================
 * DAA Core BFS Engine: Step Tracer, Rerouting & Partition Analysis
 * ==============================================================================
 */

class BFSEngine {
  constructor(graph) {
    this.graph = graph;
  }

  // ----------------------------------------------------------------------------
  // Standard BFS Shortest Path
  // Time Complexity: O(V + E)
  // Space Complexity: O(V)
  // ----------------------------------------------------------------------------
  findShortestPath(source, target) {
    const nodes = this.graph.nodes;
    const sNode = nodes.get(source);
    const tNode = nodes.get(target);

    if (!sNode || !tNode || sNode.isFailed || tNode.isFailed) {
      return { path: null, hops: -1, visited: [] };
    }

    if (source === target) {
      return { path: [source], hops: 0, visited: [source] };
    }

    const visited = new Set([source]);
    const parent = new Map();
    const queue = [source];
    let found = false;

    while (queue.length > 0 && !found) {
      const curr = queue.shift();
      const neighbors = this.graph.getNeighbors(curr);

      for (const neighbor of neighbors) {
        const nNode = nodes.get(neighbor);
        if (nNode && !nNode.isFailed && !visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, curr);
          queue.push(neighbor);

          if (neighbor === target) {
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      return { path: null, hops: -1, visited: Array.from(visited) };
    }

    // Backtrack path
    const path = [];
    let step = target;
    while (step) {
      path.push(step);
      step = parent.get(step);
    }
    path.reverse();

    return {
      path,
      hops: path.length - 1,
      visited: Array.from(visited),
      parentMap: parent
    };
  }

  // ----------------------------------------------------------------------------
  // Step-by-Step Execution Tracer for Interactive Step Visualizer
  // Generates state snapshots with matching pseudo-code line indices
  // ----------------------------------------------------------------------------
  generateStepByStepTrace(source, target) {
    const steps = [];
    const nodes = this.graph.nodes;
    const sNode = nodes.get(source);
    const tNode = nodes.get(target);

    if (!sNode || !tNode || sNode.isFailed || tNode.isFailed) {
      steps.push({
        type: 'ERROR',
        codeLine: 1,
        queue: [],
        visited: [],
        currentNode: null,
        neighborNode: null,
        activeEdge: null,
        description: `Cannot initiate BFS: Either source (${source}) or target (${target}) is OFFLINE.`
      });
      return steps;
    }

    const visited = new Set([source]);
    const parent = new Map();
    const queue = [source];

    // Initial state
    steps.push({
      type: 'INIT',
      codeLine: 5,
      queue: [...queue],
      visited: Array.from(visited),
      currentNode: source,
      neighborNode: null,
      activeEdge: null,
      description: `Initialized FIFO Queue with source router [${source}]. Marked ${source} as visited (distance d=0).`
    });

    let found = false;

    while (queue.length > 0 && !found) {
      // Dequeue operation
      const curr = queue.shift();
      steps.push({
        type: 'DEQUEUE',
        codeLine: 9,
        queue: [...queue],
        visited: Array.from(visited),
        currentNode: curr,
        neighborNode: null,
        activeEdge: null,
        description: `DEQUEUE [${curr}] from front of queue. Exploring incident operational links.`
      });

      const neighbors = this.graph.getNeighbors(curr);

      if (neighbors.length === 0) {
        steps.push({
          type: 'NO_NEIGHBORS',
          codeLine: 10,
          queue: [...queue],
          visited: Array.from(visited),
          currentNode: curr,
          neighborNode: null,
          activeEdge: null,
          description: `Router [${curr}] has no operational outgoing communication links.`
        });
      }

      for (const neighbor of neighbors) {
        const nNode = nodes.get(neighbor);
        if (!nNode || nNode.isFailed) continue;

        // Link examination
        steps.push({
          type: 'EXAMINE_LINK',
          codeLine: 11,
          queue: [...queue],
          visited: Array.from(visited),
          currentNode: curr,
          neighborNode: neighbor,
          activeEdge: [curr, neighbor],
          description: `Inspecting link (${curr} ⇄ ${neighbor}). Checking if [${neighbor}] is already in visited set.`
        });

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, curr);
          queue.push(neighbor);

          steps.push({
            type: 'ENQUEUE',
            codeLine: 15,
            queue: [...queue],
            visited: Array.from(visited),
            currentNode: curr,
            neighborNode: neighbor,
            activeEdge: [curr, neighbor],
            description: `Discovered unvisited router [${neighbor}]. Enqueued to FIFO tail; parent pointer set: parent[${neighbor}] = ${curr}.`
          });

          if (neighbor === target) {
            found = true;
            steps.push({
              type: 'TARGET_FOUND',
              codeLine: 16,
              queue: [...queue],
              visited: Array.from(visited),
              currentNode: neighbor,
              neighborNode: null,
              activeEdge: [curr, neighbor],
              description: `🎯 TARGET ROUTER [${target}] REACHED! Terminating frontier exploration.`
            });
            break;
          }
        } else {
          steps.push({
            type: 'ALREADY_VISITED',
            codeLine: 11,
            queue: [...queue],
            visited: Array.from(visited),
            currentNode: curr,
            neighborNode: neighbor,
            activeEdge: [curr, neighbor],
            description: `Router [${neighbor}] has already been visited. Pruning cycle (cross-edge discarded).`
          });
        }
      }
    }

    if (found) {
      const path = [];
      let step = target;
      while (step) {
        path.push(step);
        step = parent.get(step);
      }
      path.reverse();

      steps.push({
        type: 'FINISH_SUCCESS',
        codeLine: 17,
        queue: [...queue],
        visited: Array.from(visited),
        currentNode: null,
        neighborNode: null,
        activeEdge: null,
        path: path,
        description: `Path Reconstruction Complete! Shortest Path: ${path.join(' ➔ ')} (${path.length - 1} hops).`
      });
    } else {
      steps.push({
        type: 'FINISH_FAIL',
        codeLine: 18,
        queue: [],
        visited: Array.from(visited),
        currentNode: null,
        neighborNode: null,
        activeEdge: null,
        path: null,
        description: `Queue exhausted. Target router [${target}] is unreachable from [${source}]. Network is partitioned.`
      });
    }

    return steps;
  }

  // ----------------------------------------------------------------------------
  // Connected Component & Network Partition Detection
  // Time Complexity: O(V + E)
  // ----------------------------------------------------------------------------
  detectPartitions() {
    const nodes = this.graph.nodes;
    const visited = new Set();
    const components = [];

    // Reset component identifiers
    nodes.forEach(n => { n.componentId = 0; });

    let compId = 0;
    for (const [id, node] of nodes) {
      if (node.isFailed || visited.has(id)) continue;

      const currentComp = [];
      const queue = [id];
      visited.add(id);

      while (queue.length > 0) {
        const curr = queue.shift();
        currentComp.push(curr);
        const currNode = nodes.get(curr);
        if (currNode) currNode.componentId = compId;

        const neighbors = this.graph.getNeighbors(curr);
        for (const nbr of neighbors) {
          const nNode = nodes.get(nbr);
          if (nNode && !nNode.isFailed && !visited.has(nbr)) {
            visited.add(nbr);
            queue.push(nbr);
          }
        }
      }

      components.push({
        id: compId,
        nodes: currentComp,
        size: currentComp.length
      });
      compId++;
    }

    return components;
  }

  // ----------------------------------------------------------------------------
  // Critical Router / Single Point of Failure (SPOF) Detection
  // Brute-force BFS vertex deletion
  // Time Complexity: O(V * (V + E))
  // Space Complexity: O(V)
  // ----------------------------------------------------------------------------
  findCriticalRouters() {
    const nodes = this.graph.nodes;
    const operationalNodes = Array.from(nodes.values()).filter(n => !n.isFailed);

    // Reset critical markings
    nodes.forEach(n => { n.isCritical = false; });

    if (operationalNodes.length <= 2) {
      return [];
    }

    const baselineComponents = this.detectPartitions().length;
    const criticalList = [];

    for (const node of operationalNodes) {
      // Temporarily deactivate node
      node.isFailed = true;

      const testComponents = this.detectPartitions().length;

      // If partitions increase, router is an articulation point
      if (testComponents > baselineComponents) {
        node.isCritical = true;
        criticalList.push(node.id);
      }

      // Restore active status
      node.isFailed = false;
    }

    // Recompute actual component IDs for baseline
    this.detectPartitions();

    return criticalList;
  }
}

window.BFSEngine = BFSEngine;
