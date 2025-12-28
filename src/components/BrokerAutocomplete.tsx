import React, { useState, useRef, useEffect } from 'react';
import { Broker, NewBrokerInput } from '../types';
import { normalize, searchBrokers } from '../services/brokerUtils';
import { ChevronDown, X, Plus } from 'lucide-react';

interface BrokerAutocompleteProps {
  value: string; // brokerName
  onChange: (broker: Broker | null) => void;
  brokers: Broker[];
  onAddBroker?: (broker: NewBrokerInput) => void; // Callback to add new broker
  placeholder?: string;
  className?: string;
}

export const BrokerAutocomplete: React.FC<BrokerAutocompleteProps> = ({
  value,
  onChange,
  brokers,
  onAddBroker,
  placeholder = 'Type to search brokers...',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected broker
  const selectedBroker = brokers.find(b => b.name === value);

  // Search brokers based on query
  const filteredBrokers = React.useMemo(() => {
    if (!query || query.trim().length === 0) {
      // Show top 20 brokers when no query
      return brokers.slice(0, 20);
    }
    
    const normalizedQuery = normalize(query);
    
    // Filter and sort brokers
    const matched = brokers.filter(broker => {
      // Check if searchKey starts with the query (exact prefix match)
      if (broker.searchKey.startsWith(normalizedQuery)) {
        return true;
      }
      
      // Check if any alias starts with the query
      if (broker.aliases && broker.aliases.some(alias => normalize(alias).startsWith(normalizedQuery))) {
        return true;
      }
      
      // Check if searchKey contains the query (partial match)
      if (broker.searchKey.includes(normalizedQuery)) {
        return true;
      }
      
      return false;
    });
    
    // Sort results: exact prefix matches first, then partial matches
    const sorted = matched.sort((a, b) => {
      const aStartsWith = a.searchKey.startsWith(normalizedQuery) || 
                         (a.aliases && a.aliases.some(alias => normalize(alias).startsWith(normalizedQuery)));
      const bStartsWith = b.searchKey.startsWith(normalizedQuery) || 
                         (b.aliases && b.aliases.some(alias => normalize(alias).startsWith(normalizedQuery)));
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      // Both same type, sort alphabetically
      return a.name.localeCompare(b.name);
    });
    
    return sorted.slice(0, 20); // Limit to 20 results
  }, [query, brokers]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(true);
    setHighlightedIndex(0);
    
    // If input is cleared, clear selection
    if (!newQuery) {
      onChange(null);
    } else if (selectedBroker && newQuery !== selectedBroker.name) {
      // User is typing something different, clear selection
      onChange(null);
    }
  };

  // Handle broker selection
  const handleSelectBroker = (broker: Broker) => {
    onChange(broker);
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

  // Check if query doesn't match any broker (for showing "Add new" option)
  const hasExactMatch = React.useMemo(() => {
    if (!query || query.trim().length === 0) return true;
    const normalizedQuery = normalize(query);
    return brokers.some(broker => 
      normalize(broker.name) === normalizedQuery ||
      (broker.aliases && broker.aliases.some(alias => normalize(alias) === normalizedQuery))
    );
  }, [query, brokers]);

  // Handle add new broker
  const handleAddNewBroker = () => {
    if (!newBrokerName.trim() || !onAddBroker) return;
    
    const newBroker: NewBrokerInput = {
      name: newBrokerName.trim(),
    };
    
    onAddBroker(newBroker);
    setNewBrokerName('');
    setShowAddForm(false);
    setIsOpen(false);
    // The new broker will be added to the list and can be selected
    // We'll set the query to the new name so it can be found
    setQuery(newBrokerName.trim());
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showAddForm) {
      if (e.key === 'Enter' && newBrokerName.trim()) {
        e.preventDefault();
        handleAddNewBroker();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowAddForm(false);
        setNewBrokerName('');
      }
      return;
    }

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    const totalItems = filteredBrokers.length + (hasExactMatch || !query ? 0 : 1); // +1 for "Add new" option

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
      if (highlightedIndex < filteredBrokers.length) {
        handleSelectBroker(filteredBrokers[highlightedIndex]);
      } else if (!hasExactMatch && query.trim()) {
        // "Add new" option selected
        setShowAddForm(true);
        setNewBrokerName(query);
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
    if (value && !query && selectedBroker) {
      // Value set externally, don't update query if user is typing
    } else if (!value && query) {
      // Value cleared externally, clear query
      setQuery('');
    }
  }, [value, selectedBroker]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query || (selectedBroker ? selectedBroker.name : '') || ''}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            // If we have a selected broker but no query, show dropdown
            if (selectedBroker && !query) {
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
          {brokers.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              <div>No brokers loaded</div>
              <div className="text-xs mt-1 text-slate-400">
                Run the seed script to load 200+ brokers
              </div>
            </div>
          ) : showAddForm ? (
            <div className="p-4 border-b border-slate-200">
              <div className="text-sm font-medium text-slate-900 mb-2">Add New Broker</div>
              <input
                type="text"
                value={newBrokerName}
                onChange={(e) => setNewBrokerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newBrokerName.trim()) {
                    handleAddNewBroker();
                  } else if (e.key === 'Escape') {
                    setShowAddForm(false);
                    setNewBrokerName('');
                  }
                }}
                placeholder="Enter broker name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddNewBroker}
                  disabled={!newBrokerName.trim()}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add Broker
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewBrokerName('');
                  }}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {filteredBrokers.length === 0 && query.trim() ? (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                  No brokers found matching "{query}"
                </div>
              ) : (
                <ul className="py-1">
                  {filteredBrokers.map((broker, index) => (
                    <li
                      key={broker.id}
                      onClick={() => handleSelectBroker(broker)}
                      className={`px-4 py-2 cursor-pointer transition-colors ${
                        index === highlightedIndex
                          ? 'bg-blue-50 text-blue-900'
                          : 'hover:bg-slate-50 text-slate-900'
                      }`}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="font-medium">{broker.name}</div>
                      {broker.aliases && broker.aliases.length > 0 && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Also known as: {broker.aliases.join(', ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              
              {/* Add new broker option */}
              {!hasExactMatch && query.trim() && onAddBroker && (
                <div className="border-t border-slate-200">
                  <li
                    onClick={() => {
                      setShowAddForm(true);
                      setNewBrokerName(query);
                    }}
                    className={`px-4 py-2 cursor-pointer transition-colors flex items-center gap-2 ${
                      highlightedIndex === filteredBrokers.length
                        ? 'bg-blue-50 text-blue-900'
                        : 'hover:bg-slate-50 text-slate-900'
                    }`}
                    onMouseEnter={() => setHighlightedIndex(filteredBrokers.length)}
                  >
                    <Plus size={16} className="text-blue-600" />
                    <div className="font-medium text-blue-600">
                      Add "{query}" as new broker
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

