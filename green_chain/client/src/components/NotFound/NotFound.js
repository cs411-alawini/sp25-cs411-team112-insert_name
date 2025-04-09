import React from 'react';
import './NotFound.css';

function NotFound() {
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
            <li>Manufacturing</li>
            <li>Agriculture</li>
            <li>Transportation</li>
            <li>Retail</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default NotFound;