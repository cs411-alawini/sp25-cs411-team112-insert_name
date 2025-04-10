import React, { memo } from 'react';
import './CategoryResults.css';

// Use React.memo to prevent unnecessary re-renders
const ResultCard = memo(({ result }) => (
  <div className="result-card">
    <div className="result-header">
      <h3>{result.category}</h3>
      <span className="naics-badge">NAICS: {result.naicsCode}</span>
    </div>
    
    <div className="emission-data">
      <div className="emission-value">
        <span className="value">
          {result.emissionFactor ? result.emissionFactor.toFixed(2) : 'N/A'}
        </span>
        <span className="unit">{result.unit}</span>
      </div>
    </div>
    
    <div className="result-footer">
      <p>
        {result.emissionFactor 
          ? `This means that for every dollar spent in the ${result.category} industry, approximately ${result.emissionFactor.toFixed(2)} ${result.unit} are emitted.`
          : `No emissions data available for this category.`
        }
      </p>
      <button className="explore-btn">Explore More Details</button>
    </div>
  </div>
));

function CategoryResults({ results }) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="category-results">
      <h2>Carbon Footprint Results</h2>
      
      {/* Use a key based on unique values to help React reconciliation */}
      {results.map((result, index) => (
        <ResultCard 
          key={`${result.naicsCode}-${result.categoryId}-${index}`} 
          result={result} 
        />
      ))}
    </div>
  );
}

export default React.memo(CategoryResults);