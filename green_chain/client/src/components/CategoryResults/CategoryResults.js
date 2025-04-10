import React from 'react';
import './CategoryResults.css';

function CategoryResults({ result }) {
  return (
    <div className="category-results">
      <h2>Carbon Footprint Results</h2>
      
      <div className="result-card">
        <div className="result-header">
          <h3>{result.category}</h3>
          <span className="naics-badge">NAICS: {result.naicsCode}</span>
        </div>
        
        <div className="emission-data">
          <div className="emission-value">
            <span className="value">{result.emissionFactor.toFixed(2)}</span>
            <span className="unit">{result.unit}</span>
          </div>
        </div>
        
        <div className="result-footer">
          <p>
            This means that for every dollar spent in the {result.category} industry, 
            approximately {result.emissionFactor.toFixed(2)} {result.unit} are emitted.
          </p>
          <button className="explore-btn">Explore More Details</button>
        </div>
      </div>
    </div>
  );
}

export default CategoryResults;