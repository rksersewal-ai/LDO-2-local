import sys
import json
from pathlib import Path
from graphify.detect import detect
from graphify.extract import collect_files, extract
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json, to_html

def main():
    root = Path('.')
    print("Detecting files...")
    detection = detect(root)
    code_files = []
    
    for f in detection.get('files', {}).get('code', []):
        p = Path(f)
        code_files.extend(collect_files(p) if p.is_dir() else [p])
        
    if not code_files:
        print("No code files found in the current directory.")
        return
        
    print(f"Extracting AST relationships from {len(code_files)} code files...")
    extraction = extract(code_files)
    
    if not extraction.get('nodes'):
        print("No nodes were extracted. Graph is empty.")
        return
        
    print("Building knowledge graph...")
    G = build_from_json(extraction)
    
    print(f"Graph created: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    
    print("Clustering communities...")
    communities = cluster(G)
    cohesion = score_all(G, communities)
    
    print("Running analysis...")
    gods = god_nodes(G)
    surprises = surprising_connections(G, communities)
    labels = {cid: f'Community {cid}' for cid in communities}
    questions = suggest_questions(G, communities, labels)
    
    tokens = {'input': 0, 'output': 0}
    
    print("Generating reports and interactive HTML...")
    out_dir = Path('graphify-out')
    out_dir.mkdir(exist_ok=True)
    
    report = generate(
        G, communities, cohesion, labels, gods, 
        surprises, detection, tokens, str(root), 
        suggested_questions=questions
    )
    (out_dir / 'GRAPH_REPORT.md').write_text(report, encoding='utf-8')
    to_json(G, communities, str(out_dir / 'graph.json'))
    
    if G.number_of_nodes() <= 5000:
        to_html(G, communities, str(out_dir / 'graph.html'), community_labels=labels)
        print("Wrote graph.html")
    else:
        print("Graph too large for HTML visualization, skipped graph.html.")
        
    print("\nSuccess! Outputs have landed in the graphify-out/ folder.")

if __name__ == '__main__':
    main()
