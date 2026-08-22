export default function SearchBar({ value = '', onSearch }) {
  return (
    <label className="block">
      <span className="sr-only">Search cards</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onSearch?.(event.target.value)}
        placeholder="Search cards"
        className="h-10 w-full rounded-md border px-3 text-sm outline-none"
        style={{
          background: 'var(--canvas)',
          borderColor: 'var(--line)',
          color: 'var(--text)',
        }}
      />
    </label>
  )
}
