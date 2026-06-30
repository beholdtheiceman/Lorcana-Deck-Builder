export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="flex border-b border-line gap-1">
      {tabs.map(tab => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-fast ${
            tab.value === value
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
