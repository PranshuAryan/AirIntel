/** Screen-reader-only data table: a text alternative for charts. */
export default function SrTable({caption, headers, rows}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{headers.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c ?? 'no data'}</td>))}</tr>)}</tbody>
    </table>
  );
}
