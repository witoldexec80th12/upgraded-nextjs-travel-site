export function StructuredData({ nodes }: { nodes: object[] }) {
  return nodes.map((node, index) => <script key={index} type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, '\\u003c') }} />);
}
