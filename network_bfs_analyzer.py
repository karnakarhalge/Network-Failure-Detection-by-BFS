"""
================================================================================
Project: Automated Network Failure Detection & Rerouting Analysis using BFS
Course: Design and Analysis of Algorithms (DAA)
Description:
    Models an undirected computer network, analyzes reachability, identifies
    isolated partitions, computes optimal shortest-path reroutes upon link
    failure, and detects Single Points of Failure (SPOF) using BFS.
================================================================================
"""

from collections import deque
from typing import Dict, List, Set, Tuple, Optional
import sys

# Optional visualization dependencies
try:
    import networkx as nx
    import matplotlib.pyplot as plt
    HAS_VISUALIZATION = True
except ImportError:
    HAS_VISUALIZATION = False


class NetworkGraph:
    """
    Undirected Graph modeled with an Adjacency List.
    Supports dynamic vertex/edge state masking to simulate hardware faults.
    """

    def __init__(self):
        # Adjacency list: router_id -> set of adjacent router_ids
        self.adj: Dict[str, Set[str]] = {}
        # Fault tracking
        self.failed_nodes: Set[str] = set()
        self.failed_links: Set[Tuple[str, str]] = set()

    def add_node(self, node: str) -> None:
        """Adds a router node to the network."""
        if node not in self.adj:
            self.adj[node] = set()

    def add_edge(self, u: str, v: str) -> None:
        """Adds a bidirectional communication link between routers u and v."""
        self.add_node(u)
        self.add_node(v)
        self.adj[u].add(v)
        self.adj[v].add(u)

    def _normalize_edge(self, u: str, v: str) -> Tuple[str, str]:
        """Returns ordered tuple representing an undirected edge."""
        return (u, v) if u < v else (v, u)

    def fail_node(self, node: str) -> bool:
        """Disables a router node. Returns True if successfully disabled."""
        if node in self.adj and node not in self.failed_nodes:
            self.failed_nodes.add(node)
            return True
        return False

    def restore_node(self, node: str) -> bool:
        """Restores an offline router node."""
        if node in self.failed_nodes:
            self.failed_nodes.remove(node)
            return True
        return False

    def fail_link(self, u: str, v: str) -> bool:
        """Disables a physical link between u and v."""
        edge = self._normalize_edge(u, v)
        if v in self.adj.get(u, set()) and edge not in self.failed_links:
            self.failed_links.add(edge)
            return True
        return False

    def restore_link(self, u: str, v: str) -> bool:
        """Restores a disabled physical link."""
        edge = self._normalize_edge(u, v)
        if edge in self.failed_links:
            self.failed_links.remove(edge)
            return True
        return False

    def reset_failures(self) -> None:
        """Restores all routers and links to operational state."""
        self.failed_nodes.clear()
        self.failed_links.clear()

    def is_link_active(self, u: str, v: str) -> bool:
        """Checks if a communication link is functioning."""
        edge = self._normalize_edge(u, v)
        return edge not in self.failed_links

    def is_node_active(self, node: str) -> bool:
        """Checks if a router is functioning."""
        return node in self.adj and node not in self.failed_nodes

    def bfs_connectivity(self, source: str) -> Set[str]:
        """
        Explores all reachable routers from 'source' using Breadth-First Search.
        Time Complexity: O(V + E)
        Space Complexity: O(V)
        """
        if not self.is_node_active(source):
            return set()

        visited: Set[str] = {source}
        queue: deque = deque([source])

        while queue:
            curr = queue.popleft()
            for neighbor in self.adj[curr]:
                if self.is_node_active(neighbor) and self.is_link_active(curr, neighbor):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)

        return visited

    def bfs_shortest_path(self, source: str, target: str) -> Tuple[Optional[List[str]], int]:
        """
        Finds the shortest hop-count path between source and target via BFS.
        Time Complexity: O(V + E)
        Space Complexity: O(V)
        """
        if not self.is_node_active(source) or not self.is_node_active(target):
            return None, -1

        if source == target:
            return [source], 0

        visited: Set[str] = {source}
        parent: Dict[str, str] = {}
        queue: deque = deque([source])
        found = False

        while queue and not found:
            curr = queue.popleft()
            for neighbor in self.adj[curr]:
                if self.is_node_active(neighbor) and self.is_link_active(curr, neighbor):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        parent[neighbor] = curr
                        queue.append(neighbor)
                        if neighbor == target:
                            found = True
                            break

        if not found:
            return None, -1

        path = []
        curr_step: Optional[str] = target
        while curr_step is not None:
            path.append(curr_step)
            curr_step = parent.get(curr_step)
        path.reverse()

        return path, len(path) - 1

    def detect_network_partition(self) -> List[Set[str]]:
        """
        Detects all isolated connected components among active nodes.
        Time Complexity: O(V + E)
        Space Complexity: O(V)
        """
        visited: Set[str] = set()
        components: List[Set[str]] = []

        active_nodes = [node for node in self.adj if self.is_node_active(node)]

        for node in active_nodes:
            if node not in visited:
                comp = self.bfs_connectivity(node)
                visited.update(comp)
                components.append(comp)

        return components

    def find_critical_routers(self) -> List[str]:
        """
        Identifies Single Points of Failure (Articulation Nodes) using BFS removal.
        Time Complexity: O(V * (V + E))
        Space Complexity: O(V)
        """
        active_nodes = [n for n in self.adj if self.is_node_active(n)]
        if len(active_nodes) <= 2:
            return []

        baseline_partitions = len(self.detect_network_partition())
        critical_routers: List[str] = []

        for candidate in active_nodes:
            self.failed_nodes.add(candidate)
            new_partitions = len(self.detect_network_partition())
            
            if new_partitions > baseline_partitions:
                critical_routers.append(candidate)

            self.failed_nodes.remove(candidate)

        return critical_routers

    def simulate_node_failure(self, failed_node: str) -> Dict:
        """Simulates node crash and evaluates post-failure survivability metrics."""
        if failed_node not in self.adj:
            return {"error": f"Node '{failed_node}' does not exist."}

        was_active = self.is_node_active(failed_node)
        if not was_active:
            return {"error": f"Node '{failed_node}' is already failed."}

        initial_components = self.detect_network_partition()
        self.fail_node(failed_node)
        post_components = self.detect_network_partition()

        is_spof = len(post_components) > len(initial_components)
        active_remaining = [n for n in self.adj if self.is_node_active(n)]

        return {
            "failed_node": failed_node,
            "was_spof": is_spof,
            "previous_partition_count": len(initial_components),
            "new_partition_count": len(post_components),
            "components": post_components,
            "isolated_nodes": [c for c in post_components if len(c) == 1],
            "total_operational_nodes": len(active_remaining)
        }

    def simulate_link_failure(self, u: str, v: str) -> Dict:
        """Severing link (u, v) and testing automatic BFS rerouting."""
        if v not in self.adj.get(u, set()):
            return {"error": f"Link ({u} <-> {v}) does not exist."}

        edge = self._normalize_edge(u, v)
        if edge in self.failed_links:
            return {"error": f"Link ({u} <-> {v}) is already severed."}

        self.fail_link(u, v)
        reroute_path, hops = self.bfs_shortest_path(u, v)

        return {
            "severed_link": (u, v),
            "reroute_possible": reroute_path is not None,
            "alternate_path": reroute_path,
            "hop_count": hops,
            "latency_penalty": (hops - 1) if hops != -1 else None
        }


def create_topology(top_type: str) -> NetworkGraph:
    """Instantiates classic computer network configurations."""
    net = NetworkGraph()

    if top_type == "star":
        hub = "Core-Router"
        leaves = [f"Leaf-R{i}" for i in range(1, 6)]
        for leaf in leaves:
            net.add_edge(hub, leaf)

    elif top_type == "ring":
        nodes = [f"Router-{i}" for i in range(1, 7)]
        for i in range(len(nodes)):
            net.add_edge(nodes[i], nodes[(i + 1) % len(nodes)])

    elif top_type == "mesh":
        nodes = [f"R{i}" for i in range(1, 6)]
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                net.add_edge(nodes[i], nodes[j])

    elif top_type == "tree":
        net.add_edge("Core", "Dist-1")
        net.add_edge("Core", "Dist-2")
        net.add_edge("Dist-1", "Access-A")
        net.add_edge("Dist-1", "Access-B")
        net.add_edge("Dist-2", "Access-C")
        net.add_edge("Dist-2", "Access-D")

    elif top_type == "enterprise":
        net.add_edge("Core-1", "Core-2")
        net.add_edge("Core-1", "Dist-1")
        net.add_edge("Core-1", "Dist-2")
        net.add_edge("Core-2", "Dist-1")
        net.add_edge("Core-2", "Dist-2")
        net.add_edge("Dist-1", "Access-1")
        net.add_edge("Dist-1", "Access-2")
        net.add_edge("Dist-2", "Access-3")
        net.add_edge("Dist-2", "Access-4")
        net.add_edge("Access-1", "Access-2")

    return net


def render_network(net: NetworkGraph, title: str = "Network State Visualizer",
                   highlight_path: Optional[List[str]] = None) -> None:
    if not HAS_VISUALIZATION:
        print("\n[!] Matplotlib/NetworkX not installed. Skipping visual plot.")
        return

    G = nx.Graph()
    for u in net.adj:
        for v in net.adj[u]:
            if u < v:
                G.add_edge(u, v)

    pos = nx.spring_layout(G, seed=42)
    plt.figure(figsize=(9, 6))
    plt.title(title, fontsize=12, fontweight="bold")

    node_colors = []
    for node in G.nodes():
        if node in net.failed_nodes:
            node_colors.append("#e74c3c")
        elif highlight_path and node in highlight_path:
            node_colors.append("#2ecc71")
        else:
            node_colors.append("#3498db")

    edge_colors = []
    path_edges = set()
    if highlight_path:
        for i in range(len(highlight_path) - 1):
            path_edges.add(net._normalize_edge(highlight_path[i], highlight_path[i+1]))

    for u, v in G.edges():
        norm_e = net._normalize_edge(u, v)
        if norm_e in net.failed_links:
            edge_colors.append("#e74c3c")
        elif norm_e in path_edges:
            edge_colors.append("#27ae60")
        else:
            edge_colors.append("#bdc3c7")

    nx.draw_networkx_nodes(G, pos, node_color=node_colors, node_size=700)
    nx.draw_networkx_labels(G, pos, font_size=9, font_family="sans-serif")
    nx.draw_networkx_edges(G, pos, edge_color=edge_colors, width=2.0)

    plt.axis("off")
    plt.tight_layout()
    plt.show()


def print_banner():
    banner = """
================================================================================
   AUTOMATED NETWORK FAILURE DETECTION & REROUTING ANALYZER (BFS ENGINE)
                  DAA Mini-Project | Graph Theory Module
================================================================================
"""
    print(banner)


def cli_loop():
    net = create_topology("enterprise")
    print_banner()
    print("Default topology loaded: Redundant Enterprise Topology.")

    while True:
        print("\n" + "=" * 60)
        print(" [1] Load Predefined Topology (Star, Ring, Mesh, Tree, Enterprise)")
        print(" [2] Display Graph Adjacency List & Active Network Status")
        print(" [3] Run Full Network Connectivity & Partition Check (BFS)")
        print(" [4] Find Single Points of Failure / Critical Routers (SPOF)")
        print(" [5] Compute Shortest Path Between Routers (BFS)")
        print(" [6] Simulate Router Crash (Node Failure)")
        print(" [7] Simulate Cable Cut & Automatic Reroute (Link Failure)")
        print(" [8] Reset All Failures to Normal")
        print(" [9] Visualize Network Graph (requires matplotlib)")
        print(" [0] Exit")
        print("=" * 60)

        choice = input("Enter choice [0-9]: ").strip()

        if choice == "1":
            print("\nSelect Topology:")
            print("  a. Star Topology (Single central SPOF)")
            print("  b. Ring Topology (2-connected)")
            print("  c. Mesh Topology (K_5 fully connected)")
            print("  d. Tree Topology (Hierarchical)")
            print("  e. Enterprise Topology (Redundant multi-tier)")
            sub = input("Choice [a-e]: ").strip().lower()
            mapping = {"a": "star", "b": "ring", "c": "mesh", "d": "tree", "e": "enterprise"}
            if sub in mapping:
                net = create_topology(mapping[sub])
                print(f"[+] Loaded '{mapping[sub].upper()}' topology successfully.")
            else:
                print("[-] Invalid selection.")

        elif choice == "2":
            print("\n--- Network Status ---")
            print(f"Total Routers : {len(net.adj)}")
            print(f"Failed Routers: {list(net.failed_nodes) if net.failed_nodes else 'None'}")
            print(f"Severed Links : {list(net.failed_links) if net.failed_links else 'None'}")
            print("\nAdjacency Connections:")
            for node, neighbors in sorted(net.adj.items()):
                status = "[OFFLINE]" if node in net.failed_nodes else "[ONLINE]"
                links_desc = []
                for n in neighbors:
                    e = net._normalize_edge(node, n)
                    l_stat = "(CUT)" if e in net.failed_links else ""
                    links_desc.append(f"{n}{l_stat}")
                print(f"  {node:12} {status} -> {', '.join(links_desc)}")

        elif choice == "3":
            print("\n--- BFS Partition & Connectivity Analysis ---")
            partitions = net.detect_network_partition()
            print(f"Connected Sub-networks Detected: {len(partitions)}")
            for idx, comp in enumerate(partitions, 1):
                print(f"  Component #{idx} ({len(comp)} nodes): {sorted(list(comp))}")
            if len(partitions) == 1:
                print("\n[OK] The entire active network is FULLY REACHABLE.")
            else:
                print("\n[ALERT] CRITICAL PARTITION DETECTED! The network is split into isolated segments.")

        elif choice == "4":
            print("\n--- Articulation Point / Critical Router Analysis ---")
            print("[*] Running O(V * (V + E)) BFS articulation discovery...")
            critical = net.find_critical_routers()
            if critical:
                print(f"[!] WARNING: {len(critical)} Critical Router(s) Detected!")
                for r in critical:
                    print(f"   --> {r} is a Single Point of Failure (SPOF).")
                print("Recommendation: Introduce redundant links to these vertices.")
            else:
                print("[OK] No Single Points of Failure found. Network is at least 2-vertex-connected.")

        elif choice == "5":
            src = input("Source router: ").strip()
            dst = input("Destination router: ").strip()
            path, hops = net.bfs_shortest_path(src, dst)
            if path:
                print(f"\n[+] Shortest Path: {' -> '.join(path)}")
                print(f"[+] Total Hop Count: {hops}")
            else:
                print(f"\n[-] Unreachable: No operational path exists between '{src}' and '{dst}'.")

        elif choice == "6":
            node = input("Enter router to crash: ").strip()
            res = net.simulate_node_failure(node)
            if "error" in res:
                print(f"[-] {res['error']}")
            else:
                print(f"\n[!] Router '{node}' has CRASHED.")
                print(f"    Was Single Point of Failure: {res['was_spof']}")
                print(f"    New Partition Count: {res['new_partition_count']}")
                for i, comp in enumerate(res['components'], 1):
                    print(f"      Sub-network #{i}: {sorted(list(comp))}")

        elif choice == "7":
            u = input("Link endpoint 1: ").strip()
            v = input("Link endpoint 2: ").strip()
            res = net.simulate_link_failure(u, v)
            if "error" in res:
                print(f"[-] {res['error']}")
            else:
                print(f"\n[!] Cable severed between '{u}' and '{v}'.")
                if res["reroute_possible"]:
                    print(f"[+] Automatic BFS Rerouting SUCCESSFUL!")
                    print(f"    Alternate Path: {' -> '.join(res['alternate_path'])}")
                    print(f"    New Path Hops : {res['hop_count']} (Hop Penalty: +{res['latency_penalty']})")
                else:
                    print("[-] CRITICAL: Link failure caused network partition. No alternate route exists!")

        elif choice == "8":
            net.reset_failures()
            print("\n[+] All network router crashes and link cuts have been CLEARED.")

        elif choice == "9":
            render_network(net, title="Network Topology & Failure State")

        elif choice == "0":
            print("\nTerminating Network Analyzer. Goodbye!")
            sys.exit(0)
        else:
            print("[-] Invalid command. Enter a digit between 0 and 9.")


if __name__ == "__main__":
    cli_loop()
