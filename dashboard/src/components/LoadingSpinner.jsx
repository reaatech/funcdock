import React from 'react'

const LoadingSpinner = ({ size = 'md', type = 'spinner', text, className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }

  const renderSpinner = () => {
    switch (type) {
      case 'dots':
        return (
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        )
      case 'pulse':
        return (
          <div className={`${sizeClasses[size]} bg-primary-600 rounded-full animate-pulse`}></div>
        )
      default:
        return (
          <svg 
            className={`${sizeClasses[size]} animate-spin text-primary-600`} 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            ></circle>
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )
    }
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        {renderSpinner()}
        {text && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
        )}
      </div>
    </div>
  )
}

// Skeleton loading component for lists and grids
export const SkeletonLoader = ({ type = 'card', count = 3, className = '' }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="card animate-pulse">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="ml-2 h-5 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </div>
                <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="flex justify-between">
                  <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="flex justify-between">
                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
              <div className="flex space-x-2">
                <div className="flex-1 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-10 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        )
      case 'list':
        return (
          <div className="animate-pulse">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center">
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="ml-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={index > 0 ? 'mt-4' : ''}>
          {renderSkeleton()}
        </div>
      ))}
    </div>
  )
}

export default LoadingSpinner 