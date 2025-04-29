import React from 'react';
import './NotFound.css';

function NotFound({ suggestions = [], onSuggestionClick }) {
  
  const displaySuggestions = suggestions.length > 0 
    ? suggestions.slice(0, 5) 
    : ['Sporting Goods', 'Electronics', 'Footwear', 'Men\'s Clothing', 'Women\'s Clothing'];

  return (
    <div className="not-found">
      <div className="not-found-content">
        <div className="icon">❓</div>
        <h2>Category Not Found</h2>
        <p>
          We couldn't find emissions data for the category you searched for. 
          Please try a different category or check your spelling.
        </p>
        <div className="suggestions">
          <p>Try searching for common categories like:</p>
          <ul>
            {displaySuggestions.map((suggestion, index) => (
              <li key={index} onClick={() => onSuggestionClick && onSuggestionClick(suggestion)}>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
