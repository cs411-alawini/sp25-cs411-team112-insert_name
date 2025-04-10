import React, { useState, useRef } from 'react';
import './SearchBar.css';

function SearchBar({ onSearch, isLoading, suggestions = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  };
  
  const handleChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    // No auto-search here - we'll only search when the button is clicked
  };
  
  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    // We don't auto-search here either
    setIsFocused(false);
  };
  
  // Filter suggestions based on current input
  const filteredSuggestions = suggestions.filter(suggestion => 
    suggestion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} className="search-form">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Enter an industry category (e.g., sporting goods, electronics)"
          value={searchTerm}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          disabled={isLoading}
        />
        <button type="submit" className="search-button" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      {/* Show suggestions dropdown when input is focused and we have matching suggestions */}
      {isFocused && searchTerm.length > 1 && filteredSuggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
            <div 
              key={index} 
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
      
      <div className="search-examples">
        <p>Example categories: Sporting Goods, Electronics, Footwear, Clothing</p>
      </div>
    </div>
  );
}

export default SearchBar;