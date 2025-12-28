import React, { useState, useRef, useEffect } from 'react';
import { FactoringCompany } from '../types';
import { normalize } from '../services/brokerUtils';
import { ChevronDown, X, Plus } from 'lucide-react';

interface FactoringCompanyAutocompleteProps {
  value: string; // factoringCompanyName
  onChange: (company: FactoringCompany | null) => void;
  factoringCompanies: FactoringCompany[];
  onAddCompany?: (company: Omit<FactoringCompany, 'id'>) => void; // Callback to add new company
  placeholder?: string;
  className?: string;
}

export const FactoringCompanyAutocomplete: React.FC<FactoringCompanyAutocompleteProps> = ({
  value,
  onChange,
  factoringCompanies,
  onAddCompany,
  placeholder = 'Type to search factoring companies...',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected company
  const selectedCompany = factoringCompanies.find(c => c.name === value);

  // Search companies based on query
  const filteredCompanies = React.useMemo(() => {
    if (!query || query.trim().length === 0) {
      // Show top 20 companies when no query
      return factoringCompanies.slice(0, 20);
    }
    
    const normalizedQuery = normalize(query);
    
    // Filter and sort companies
    const matched = factoringCompanies.filter(company => {
      // Check if searchKey starts with the query (exact prefix match)
      const searchKey = company.searchKey || normalize(company.name);
      if (searchKey.startsWith(normalizedQuery)) {
        return true;
      }
      
      // Check if any alias starts with the query
      if (company.aliases && company.aliases.some(alias => normalize(alias).startsWith(normalizedQuery))) {
        return true;
      }
      
      // Check if searchKey contains the query (partial match)
      if (searchKey.includes(normalizedQuery)) {
        return true;
      }
      
      return false;
    });
    
    // Sort results: exact prefix matches first, then partial matches
    const sorted = matched.sort((a, b) => {
      const aSearchKey = a.searchKey || normalize(a.name);
      const bSearchKey = b.searchKey || normalize(b.name);
      
      const aStartsWith = aSearchKey.startsWith(normalizedQuery) || 
                         (a.aliases && a.aliases.some(alias => normalize(alias).startsWith(normalizedQuery)));
      const bStartsWith = bSearchKey.startsWith(normalizedQuery) || 
                         (b.aliases && b.aliases.some(alias => normalize(alias).startsWith(normalizedQuery)));
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      // Both same type, sort alphabetically
      return a.name.localeCompare(b.name);
    });
    
    return sorted.slice(0, 20); // Limit to 20 results
  }, [query, factoringCompanies]);

  // Check if query doesn't match any company (for showing "Add new" option)
  const hasExactMatch = React.useMemo(() => {
    if (!query || query.trim().length === 0) return true;
    const normalizedQuery = normalize(query);
    return factoringCompanies.some(company => {
      const searchKey = company.searchKey || normalize(company.name);
      return searchKey === normalizedQuery ||
        (company.aliases && company.aliases.some(alias => normalize(alias) === normalizedQuery));
    });
  }, [query, factoringCompanies]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(true);
    setHighlightedIndex(0);
    
    // If input is cleared, clear selection
    if (!newQuery) {
      onChange(null);
    } else if (selectedCompany && newQuery !== selectedCompany.name) {
      // User is typing something different, clear selection
      onChange(null);
    }
  };

  // Handle company selection
  const handleSelectCompany = (company: FactoringCompany) => {
    onChange(company);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Handle clear
  const handleClear = () => {
    setQuery('');
    onChange(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Handle add new company
  const handleAddNewCompany = () => {
    if (!newCompanyName.trim() || !onAddCompany) return;
    
    const newCompany: Omit<FactoringCompany, 'id'> = {
      name: newCompanyName.trim(),
    };
    
    onAddCompany(newCompany);
    setNewCompanyName('');
    setShowAddForm(false);
    setIsOpen(false);
    // The new company will be added to the list and can be selected
    setQuery(newCompanyName.trim());
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAddForm) {
      if (e.key === 'Enter' && newCompanyName.trim()) {
        e.preventDefault();
        handleAddNewCompany();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowAddForm(false);
        setNewCompanyName('');
      }
      return;
    }

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    const totalItems = filteredCompanies.length + (hasExactMatch || !query ? 0 : 1); // +1 for "Add new" option

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < totalItems - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      if (highlightedIndex < filteredCompanies.length) {
        handleSelectCompany(filteredCompanies[highlightedIndex]);
      } else if (!hasExactMatch && query.trim()) {
        // "Add new" option selected
        setShowAddForm(true);
        setNewCompanyName(query);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update query when value changes externally (e.g., editing existing load)
  useEffect(() => {
    if (value && !query && selectedCompany) {
      // Value set externally, don't update query if user is typing
    } else if (!value && query) {
      // Value cleared externally, clear query
      setQuery('');
    }
  }, [value, selectedCompany]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query || (selectedCompany ? selectedCompany.name : '') || ''}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            // If we have a selected company but no query, show dropdown
            if (selectedCompany && !query) {
              setQuery('');
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-20"
        />
        
        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        )}
        
        {/* Dropdown arrow */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronDown size={20} className={isOpen ? 'rotate-180' : ''} />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {factoringCompanies.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              <div>No factoring companies loaded</div>
              <div className="text-xs mt-1 text-slate-400">
                Companies will be auto-seeded on first load
              </div>
            </div>
          ) : showAddForm ? (
            <div className="p-4 border-b border-slate-200">
              <div className="text-sm font-medium text-slate-900 mb-2">Add New Factoring Company</div>
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCompanyName.trim()) {
                    handleAddNewCompany();
                  } else if (e.key === 'Escape') {
                    setShowAddForm(false);
                    setNewCompanyName('');
                  }
                }}
                placeholder="Enter company name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddNewCompany}
                  disabled={!newCompanyName.trim()}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add Company
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewCompanyName('');
                  }}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {filteredCompanies.length === 0 && query.trim() ? (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                  No companies found matching "{query}"
                </div>
              ) : (
                <ul className="py-1">
                  {filteredCompanies.map((company, index) => (
                    <li
                      key={company.id}
                      onClick={() => handleSelectCompany(company)}
                      className={`px-4 py-2 cursor-pointer transition-colors ${
                        index === highlightedIndex
                          ? 'bg-blue-50 text-blue-900'
                          : 'hover:bg-slate-50 text-slate-900'
                      }`}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="font-medium">{company.name}</div>
                      {company.aliases && company.aliases.length > 0 && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Also known as: {company.aliases.join(', ')}
                        </div>
                      )}
                      {company.feePercentage && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Typical fee: {company.feePercentage}%
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              
              {/* Add new company option */}
              {!hasExactMatch && query.trim() && onAddCompany && (
                <div className="border-t border-slate-200">
                  <li
                    onClick={() => {
                      setShowAddForm(true);
                      setNewCompanyName(query);
                    }}
                    className={`px-4 py-2 cursor-pointer transition-colors flex items-center gap-2 ${
                      highlightedIndex === filteredCompanies.length
                        ? 'bg-blue-50 text-blue-900'
                        : 'hover:bg-slate-50 text-slate-900'
                    }`}
                    onMouseEnter={() => setHighlightedIndex(filteredCompanies.length)}
                  >
                    <Plus size={16} className="text-blue-600" />
                    <div className="font-medium text-blue-600">
                      Add "{query}" as new company
                    </div>
                  </li>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};


