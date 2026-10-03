"""
Lightweight Local HTTP Server for Network Failure Detection & BFS Visualizer
Launches local web server and opens the application in your default browser.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Concise logging
        print(f"[{self.log_date_time_string()}] {args[0]} - {args[1]}")

def run_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = QuietHandler
    
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 70)
        print("🚀 Network BFS Failure & Rerouting Visualizer Server Running")
        print(f"📡 Local URL : {url}")
        print("⏹️  To stop server: Press Ctrl+C in this terminal")
        print("=" * 70)
        
        try:
            webbrowser.open(url)
        except Exception:
            pass

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server. Goodbye!")
            sys.exit(0)

if __name__ == "__main__":
    run_server()
