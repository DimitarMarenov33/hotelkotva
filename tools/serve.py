#!/usr/bin/env python3
"""
Local dev server for previewing the site.

Mimics Cloudflare Pages' clean-URL resolution, so the links in the nav work
here exactly as they will in production:

    /aquapark      -> aquapark.html
    /bg/           -> bg/index.html
    /bg/aquapark   -> bg/aquapark.html
    /terms?lang=de -> terms.html

    python3 tools/serve.py [port]

NOTE: this serves static files only. The /api/* Pages Functions do not run
here, so the booking widget will reach its request/confirmation step but no
email is sent and no Stripe session opens — every backend call is written to
fail silently, which is exactly what you will see. To exercise the real
backend, use `npx wrangler pages dev .` with the env vars from README §5.
"""
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8899


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0]
        local = super().translate_path(clean)
        if os.path.isdir(local):
            index = os.path.join(local, "index.html")
            if os.path.exists(index):
                return index
        if not os.path.exists(local):
            # Extensionless URL: /aquapark -> aquapark.html, /bg -> bg/index.html
            for candidate in (local + ".html", os.path.join(local, "index.html")):
                if os.path.exists(candidate):
                    return candidate
        return local

    def end_headers(self):
        # Never cache during development, so a rebuild shows up on reload.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        status = str(args[1]) if len(args) > 1 else ""
        if status.startswith(("4", "5")):          # only surface problems
            sys.stderr.write("  %s %s\n" % (status, args[0]))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Hotel Kotva dev server → http://localhost:{PORT}/")
        print("  EN /   BG /bg/   RO /ro/   RU /ru/   UK /uk/   DE /de/")
        print(f"  aquapark: http://localhost:{PORT}/aquapark")
        print("Ctrl-C to stop.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
