import React, { memo } from 'react';
import './CategoryResults.css';

// Helper function to get risk level based on emissions value
const getRiskLevel = (emissions) => {
  if (!emissions) return 'unknown';
  if (emissions >= 500) return 'high';
  if (emissions >= 300) return 'medium';
  return 'low';
};

// Use React.memo to prevent unnecessary re-renders
const ResultCard = memo(({ result }) => {
  const formattedEmission = result.emissionFactor ? 
    parseFloat(result.emissionFactor).toFixed(2) : 'N/A';
  
  const riskLevel = getRiskLevel(result.emissionFactor);
  
  return (
    <div className="result-card">
      <div className="result-header">
        <h3>{result.category}</h3>
        <span className="naics-badge">NAICS: {result.naicsCode}</span>
      </div>
      
      <div className="emission-data">
        <div className="emission-value-container">
          <div className="emission-value">
            <span className="value">
              {result.emissionFactor ? result.emissionFactor.toFixed(2) : 'N/A'}
            </span>
            <span className="unit">{result.unit}</span>
          </div>
          <div className={`risk-level ${riskLevel}`}>
            {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
          </div>
        </div>
        
        {result.emissionFactor && (
          <div className="emission-gauge">
            <div 
              className={`gauge-fill ${riskLevel}`}
              style={{ width: `${Math.min((result.emissionFactor || 0) / 10, 100)}%` }}
            ></div>
          </div>
        )}
      </div>
      
      <div className="result-footer">
        <p>
          {result.emissionFactor 
            ? `This means that for every dollar spent in the ${result.category} industry, approximately ${result.emissionFactor.toFixed(2)} ${result.unit} are emitted.`
            : `No emissions data available for this category.`
          }
        </p>
        
        {result.description && (
          <p className="result-description">{result.description}</p>
        )}
        
        {result.emissionFactor && (
          <div className="comparison-section">
            <h4>How Does This Compare?</h4>
            <ul className="comparison-list">
              <li>
                <span className="comparison-icon">🚗</span>
                <span className="comparison-text">
                  Driving approximately {Math.round(result.emissionFactor * 2.5)} miles in an average car
                </span>
              </li>
              <li>
                <span className="comparison-icon">💡</span>
                <span className="comparison-text">
                  Powering a home for {Math.round(result.emissionFactor / 12)} days
                </span>
              </li>
              <li>
                <span className="comparison-icon">🌲</span>
                <span className="comparison-text">
                  {Math.round(result.emissionFactor / 25)} trees needed to absorb this carbon in one year
                </span>
              </li>
            </ul>
          </div>
        )}
        
      </div>
    </div>
  );
});

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
      
      {/* If there are multiple results, show related categories */}
      {results.length > 1 && (
        <div className="related-categories">
          <h3>Related Categories</h3>
          <div className="related-list">
            {results.slice(1).map((result, index) => (
              <div key={index} className="related-item">
                <span className="related-name">{result.category}</span>
                <span className="related-emission">
                  {result.emissionFactor ? `${parseFloat(result.emissionFactor).toFixed(2)} ${result.unit}` : 'No data'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(CategoryResults);