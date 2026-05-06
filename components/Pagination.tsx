'use client';

interface Props {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  perPage: number;
  onPageChange: (page: number) => void;
  approximated?: boolean;
}

export default function Pagination({ currentPage, totalPages, totalResults, perPage, onPageChange, approximated }: Props) {
  const start = ((currentPage - 1) * (approximated ? perPage : perPage) + 1).toLocaleString('fr-FR');
  const end = Math.min(currentPage * perPage, totalResults).toLocaleString('fr-FR');
  const total = totalResults.toLocaleString('fr-FR');

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('…');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between flex-shrink-0">
      <p className="text-sm text-slate-500">
        {start} – {end} sur{' '}
        <strong className="text-slate-700">{total}</strong> résultats
        {approximated && <span className="text-amber-600 ml-1 text-xs">(estimé — mots-clés combinés)</span>}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          ← Préc.
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-2 text-slate-400 text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`w-9 h-9 text-sm rounded-lg transition font-medium ${
                p === currentPage
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Suiv. →
        </button>
      </div>
    </div>
  );
}
