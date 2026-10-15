from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=4173)
parser.add_argument('--directory',type=Path,default=Path(__file__).resolve().parents[1]/'dist')
args=parser.parse_args()
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(args.directory),**kw)
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        if self.path.endswith(('/sw.js','/data/share.json')):self.send_header('Cache-Control','no-cache')
        super().end_headers()
    def list_directory(self,path):self.send_error(404)
print(f'Local validation server on 127.0.0.1:{args.port}; public files: {args.directory}',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
